// Read ordinary HTML module declarations only. Skip comments, inert markup
// and raw-text content, where apparent script tags are not declarations.
export function readModuleScripts(html, onScript, unresolved) {
  const lower = html.toLowerCase()
  const inert = new Set(['script', 'style', 'title', 'textarea', 'noscript', 'template', 'svg', 'math'])
  const tags = []
  let offset = 0
  const lineStarts = [0]
  for (let i = 0; i < html.length; i++) if (html[i] === '\n') lineStarts.push(i + 1)
  function line(index) {
    let lo = 0, hi = lineStarts.length
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1
      if (lineStarts[mid] <= index) lo = mid
      else hi = mid
    }
    return lo + 1
  }
  while ((offset = html.indexOf('<', offset)) !== -1) {
    const start = offset++
    if (html.startsWith('!--', offset)) {
      const end = html.indexOf('-->', offset + 3)
      if (end < 0) { unresolved('ambiguous-html', line(start)); return }
      offset = end + 3
      continue
    }
    const match = /^(\/?)([a-z][a-z\d:-]*)\b/i.exec(html.slice(offset, offset + 128))
    if (!match) continue
    const tag = match[2].toLowerCase()
    const attributesStart = offset + match[0].length
    offset = attributesStart
    let quote
    for (; offset < html.length; offset++) {
      const c = html[offset]
      if (quote) { if (c === quote) quote = undefined }
      else if (c === '"' || c === "'") quote = c
      else if (c === '>') break
    }
    if (offset === html.length) { unresolved('ambiguous-html', line(start)); return }
    const raw = html.slice(attributesStart, offset++)
    if (match[1]) {
      if (tag === tags.at(-1)) tags.pop()
      continue
    }
    if (!tags.length && tag === 'script') {
      const attrs = new Map()
      const attribute = /\s+([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gy
      let at = 0
      while (at < raw.length && raw.slice(at).trim()) {
        attribute.lastIndex = at
        const found = attribute.exec(raw)
        if (!found || attrs.has(found[1].toLowerCase())) { unresolved('ambiguous-script-attributes', line(start)); return }
        attrs.set(found[1].toLowerCase(), found[2] ?? found[3] ?? found[4] ?? '')
        at = attribute.lastIndex
      }
      if (attrs.get('type')?.trim().toLowerCase() === 'module') onScript(attrs.get('src'), line(start))
    } else if (!tags.length && tag === 'base') {
      unresolved('html-base-url', line(start))
    }
    if (!inert.has(tag)) continue
    if (['template', 'svg', 'math'].includes(tag)) {
      if (tag === 'template' || !raw.trimEnd().endsWith('/')) tags.push(tag)
    } else {
      const closing = new RegExp(`</${tag}\\s*>`, 'gi')
      closing.lastIndex = offset
      if (!closing.test(lower)) { unresolved('ambiguous-html', line(start)); return }
      offset = closing.lastIndex
    }
  }
  if (tags.length) unresolved('ambiguous-html', 1)
}
