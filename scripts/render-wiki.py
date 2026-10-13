#!/usr/bin/env python3
"""Export local wiki pages with rendered GitHub page links; retain source bytes."""
import argparse
from pathlib import Path
import re
from urllib.parse import quote, unquote, urlsplit


INLINE_LINK = re.compile(r'\]\((<[^>\n]+>|[^\s)]+)((?:[ \t]+(?:"[^"\n]*"|\'[^\'\n]*\'|\([^\n)]*\)))?[ \t]*)\)')
REFERENCE = re.compile(r'^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]+>|[^\s]+)', re.M)
INLINE_CODE = re.compile(r'(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)')
FENCE = re.compile(r'^ {0,3}(`{3,}|~{3,})(.*)$')


def wiki_base(origin):
    match = re.fullmatch(r'(?:https://github\.com/|git@github\.com:)([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?/?', origin)
    if not match:
        raise ValueError('Wiki export requires an explicit GitHub repository origin')
    return 'https://github.com/' + match.group(1) + '/wiki'


def render(content, source, pages, base):
    def destination(target):
        angled = target.startswith('<') and target.endswith('>')
        value = target[1:-1] if angled else target
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or not parsed.path:
            return target
        page = pages.get((source.parent / unquote(parsed.path)).resolve())
        if page is None:
            return target
        slug = quote(page.replace(' ', '-'), safe='-_.')
        result = base + '/' + slug
        if parsed.query:
            result += '?' + parsed.query
        if parsed.fragment:
            result += '#' + parsed.fragment
        return '<' + result + '>' if angled else result

    def prose(text):
        def links(chunk):
            chunk = INLINE_LINK.sub(lambda match: '](' + destination(match.group(1)) + match.group(2) + ')', chunk)
            return REFERENCE.sub(lambda match: match.group(1) + destination(match.group(2)), chunk)
        result, start = [], 0
        for match in INLINE_CODE.finditer(text):
            result.extend((links(text[start:match.start()]), match.group(0)))
            start = match.end()
        result.append(links(text[start:]))
        return ''.join(result)

    result, pending, fence = [], [], None
    def flush():
        if pending:
            result.append(prose(''.join(pending)))
            pending.clear()
    for line in content.splitlines(keepends=True):
        marker = FENCE.match(line.rstrip('\r\n'))
        if fence:
            result.append(line)
            if marker and marker.group(1)[0] == fence[0] and len(marker.group(1)) >= fence[1] and not marker.group(2).strip():
                fence = None
        elif marker:
            flush()
            fence = (marker.group(1)[0], len(marker.group(1)))
            result.append(line)
        elif line.startswith(('    ', '\t')):
            flush()
            result.append(line)
        else:
            pending.append(line)
    flush()
    return ''.join(result)


def export(source, target, origin):
    source, target = Path(source), Path(target)
    base = wiki_base(origin)
    if source.is_symlink() or target.is_symlink() or not source.is_dir() or not target.is_dir():
        raise ValueError('Wiki source and destination must be regular directories')
    files = sorted(source.glob('*.md'))
    if not files:
        raise ValueError('Wiki source has no Markdown pages')
    for path in files:
        destination = target / path.name
        if path.is_symlink() or not path.is_file() or destination.is_symlink() or (destination.exists() and not destination.is_file()):
            raise ValueError('Wiki export refused a linked or nonregular page: ' + path.name)
    # Wiki-only pages remain present and can be linked without copying them.
    names = {path.name for path in files}
    names.update(path.name for path in target.glob('*.md') if path.is_file() and not path.is_symlink())
    pages = {(source / name).resolve(): Path(name).stem for name in names}
    outputs = [(path.name, render(path.read_bytes().decode('utf-8'), path, pages, base).encode('utf-8')) for path in files]
    for name, data in outputs:
        destination = target / name
        if destination.is_symlink() or (destination.exists() and not destination.is_file()):
            raise ValueError('Wiki export refused a linked or nonregular destination: ' + name)
        destination.write_bytes(data)
    return len(outputs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--target', required=True, type=Path)
    parser.add_argument('--origin', required=True)
    args = parser.parse_args()
    count = export(args.source, args.target, args.origin)
    print('Rendered {} wiki pages for {}.'.format(count, wiki_base(args.origin)))


if __name__ == '__main__':
    main()
