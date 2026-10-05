#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const rootDir = process.cwd()
const distDir = join(rootDir, 'dist')
const readableExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.txt'])
const forbiddenNames = new Set(['Website_Dashboard.html', 'website_dashboard.html'])
const forbiddenMarkers = [
  '.SYSTEMX/LAN',
  '.SYSTEMX\\LAN',
  'SYSTEMX LAN Builder',
  'SYSTEMX Local Control',
  'systemx-preview-inspector',
  'data-systemx-component',
  'data-systemx-name',
  'data-systemx-region',
  'data-systemx-reusable',
  'data-systemx-source',
]

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  throw new Error('Production dist directory does not exist. Run the public build first.')
}

for (const file of walk(distDir)) {
  const localPath = relative(distDir, file)
  const fileName = localPath.replaceAll('\\', '/').split('/').at(-1)
  if (fileName && forbiddenNames.has(fileName)) {
    throw new Error(`SYSTEMX LAN file leaked into dist: ${localPath}`)
  }
  if (!readableExtensions.has(extname(file).toLowerCase())) continue
  const contents = readFileSync(file, 'utf8')
  for (const marker of forbiddenMarkers) {
    if (contents.includes(marker)) {
      throw new Error(`SYSTEMX LAN marker "${marker}" leaked into dist: ${localPath}`)
    }
  }
}

console.log('[SYSTEMX] LAN production-isolation check passed.')
