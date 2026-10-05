#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const scanRoots = [
  join(repoRoot, 'README.md'),
  join(repoRoot, '.SYSTEMX'),
  join(repoRoot, 'wiki'),
]

function collectMarkdown(target) {
  if (!existsSync(target)) return []
  const stats = statSync(target)
  if (stats.isFile()) return extname(target).toLowerCase() === '.md' ? [target] : []
  const files = []
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue
    files.push(...collectMarkdown(join(target, entry.name)))
  }
  return files
}

function isExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)
}

function candidates(sourceFile, target) {
  const withoutAnchor = target.split('#', 1)[0].split('?', 1)[0]
  if (!withoutAnchor || isExternal(target)) return []

  const sourceRelative = relative(repoRoot, sourceFile).replaceAll('\\', '/')
  const sourceIsWiki = sourceRelative === 'wiki' || sourceRelative.startsWith('wiki/')
  const decoded = decodeURIComponent(withoutAnchor)
  const raw = decoded.startsWith('/')
    ? resolve(repoRoot, decoded.slice(1))
    : resolve(dirname(sourceFile), decoded)
  const options = [raw]

  if (sourceIsWiki && !withoutAnchor.startsWith('../') && !withoutAnchor.startsWith('./')) {
    options.push(resolve(repoRoot, 'wiki', withoutAnchor))
  }

  for (const option of [...options]) {
    if (!extname(option)) options.push(`${option}.md`)
    if (existsSync(option) && statSync(option).isDirectory()) options.push(join(option, 'README.md'))
  }

  return [...new Set(options)]
}

const markdownFiles = [...new Set(scanRoots.flatMap(collectMarkdown))]
const broken = []
const linkPattern = /\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g

for (const sourceFile of markdownFiles) {
  const contents = (await readFile(sourceFile, 'utf8')).replace(/^```.*?^```[^\n]*$/gms, '')
  let match
  while ((match = linkPattern.exec(contents)) !== null) {
    const target = match[1] ?? match[2]
    if (isExternal(target)) continue
    const possible = candidates(sourceFile, target)
    if (possible.length === 0 || !possible.some((file) => existsSync(file))) {
      broken.push(`${relative(repoRoot, sourceFile)} -> ${target}`)
    }
  }
}

if (broken.length > 0) {
  console.error(`[SYSTEMX] Markdown link check failed: ${broken.length} broken link(s)`)
  for (const item of broken) console.error(`- ${item}`)
  process.exit(1)
}

console.log(`[SYSTEMX] Markdown link check passed: ${markdownFiles.length} file(s)`)
