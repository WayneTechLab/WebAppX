#!/usr/bin/env node
import { lstat, readFile, realpath } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const scriptPurposes = Object.freeze(['setup', 'app', 'portal', 'SYSTEMX', 'wiki', 'release'])
export const publicInputLimits = Object.freeze({ characters: 2_000_000, depth: 32, nodes: 100_000, scripts: 500, command: 50_000 })
const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const invalid = () => { throw new Error('Invalid or oversized public setup data. Inspect its documented schema.') }
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,99}$/
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const hasControl = value => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)

/** Plain bounded JSON with duplicate keys refused, never revivers or evaluation. */
export function parsePublicJson(text) {
  if (typeof text !== 'string' || text.length > publicInputLimits.characters) invalid()
  let cursor = 0, nodes = 0
  const whitespace = () => { while (/[\t\r\n ]/.test(text[cursor] ?? '') && cursor < text.length) cursor++ }
  function string() {
    const start = cursor++
    while (cursor < text.length) {
      if (text[cursor] === '\\') { cursor += 2; continue }
      if (text[cursor++] === '"') { try { return JSON.parse(text.slice(start, cursor)) } catch { invalid() } }
    }
    invalid()
  }
  function value(depth) {
    if (++nodes > publicInputLimits.nodes || depth > publicInputLimits.depth) invalid()
    whitespace()
    const token = text[cursor]
    if (token === '"') return string()
    if (token === '{') {
      cursor++; whitespace(); const result = {}; const keys = new Set()
      if (text[cursor] === '}') { cursor++; return result }
      while (cursor < text.length) {
        whitespace(); if (text[cursor] !== '"') invalid()
        const key = string(); if (forbidden.has(key) || keys.has(key)) invalid(); keys.add(key)
        whitespace(); if (text[cursor++] !== ':') invalid()
        result[key] = value(depth + 1); whitespace()
        const delimiter = text[cursor++]; if (delimiter === '}') return result
        if (delimiter !== ',') invalid()
      }
      invalid()
    }
    if (token === '[') {
      cursor++; whitespace(); const result = []
      if (text[cursor] === ']') { cursor++; return result }
      while (cursor < text.length) {
        result.push(value(depth + 1)); whitespace()
        const delimiter = text[cursor++]; if (delimiter === ']') return result
        if (delimiter !== ',') invalid()
      }
      invalid()
    }
    const primitive = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(cursor))?.[0]
    if (!primitive) invalid()
    cursor += primitive.length
    const result = JSON.parse(primitive)
    if (typeof result === 'number' && !Number.isFinite(result)) invalid()
    return result
  }
  const result = value(0); whitespace(); if (cursor !== text.length) invalid()
  return result
}

export function assertPublicData(value, maximum = publicInputLimits.characters) {
  let nodes = 0; const ancestors = new Set()
  function visit(item, depth) {
    if (++nodes > publicInputLimits.nodes || depth > publicInputLimits.depth) invalid()
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return
    if (typeof item === 'number') { if (!Number.isFinite(item)) invalid(); return }
    if (typeof item !== 'object' || ancestors.has(item) || Object.getOwnPropertySymbols(item).length) invalid()
    if (!Array.isArray(item) && !record(item)) invalid()
    ancestors.add(item)
    if (Array.isArray(item) && Object.keys(item).length !== item.length) invalid()
    for (const key of Object.getOwnPropertyNames(item)) {
      if (Array.isArray(item) && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(item, key)
      if (forbidden.has(key) || !descriptor?.enumerable || !('value' in descriptor)) invalid()
      visit(descriptor.value, depth + 1)
    }
    ancestors.delete(item)
  }
  visit(value, 0)
  if (JSON.stringify(value).length > maximum) invalid()
}

export async function readPublicText(root, relative) {
  if (typeof relative !== 'string' || relative.length > 240 || relative.startsWith('/') || relative.split('/').some(part => !part || ['.', '..'].includes(part)) || /[\\:]/.test(relative) || hasControl(relative)) invalid()
  const canonical = await realpath(root); let path = canonical
  for (const part of relative.split('/')) {
    path = resolve(path, part)
    if (!path.startsWith(canonical + sep) || (await lstat(path)).isSymbolicLink()) invalid()
  }
  const info = await lstat(path)
  if (!info.isFile() || info.size > publicInputLimits.characters) invalid()
  return new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path))
}

/** Membership and executable text come only from the supplied real manifest. */
export function buildScriptDiscovery(manifest, purposes) {
  assertPublicData(manifest); assertPublicData(purposes)
  if (!record(manifest) || !record(manifest.scripts) || Object.keys(manifest.scripts).length > publicInputLimits.scripts || !exact(purposes, ['schemaVersion', 'scripts']) || purposes.schemaVersion !== 1 || !Array.isArray(purposes.scripts) || purposes.scripts.length > publicInputLimits.scripts) invalid()
  const classified = new Map()
  for (const row of purposes.scripts) {
    if (!exact(row, ['name', 'purpose', 'description']) || typeof row.name !== 'string' || !namePattern.test(row.name) || !scriptPurposes.includes(row.purpose) || typeof row.description !== 'string' || row.description.trim() !== row.description || !row.description || row.description.length > 1200 || hasControl(row.description) || classified.has(row.name)) invalid()
    classified.set(row.name, row)
  }
  const groups = scriptPurposes.map(purpose => ({ purpose, scripts: [] })), unclassified = []
  for (const name of Object.keys(manifest.scripts).sort()) {
    const command = manifest.scripts[name]
    if (!namePattern.test(name) || typeof command !== 'string' || !command.trim() || command.length > publicInputLimits.command || hasControl(command)) invalid()
    const entry = { name, command }
    const row = classified.get(name)
    if (row) groups.find(group => group.purpose === row.purpose).scripts.push({ ...entry, description: row.description })
    else unclassified.push(entry)
  }
  const staleClassifications = [...classified.keys()].filter(name => !Object.hasOwn(manifest.scripts, name)).sort()
  return { schemaVersion: 1, ok: !unclassified.length && !staleClassifications.length, scriptCount: Object.keys(manifest.scripts).length, groups, unclassified, staleClassifications, scope: 'Read-only root manifest purpose discovery. Command strings are data; no script was executed or authorized.' }
}

export async function readScriptDiscovery(root = rootDirectory) {
  const [manifest, purposes] = await Promise.all([readPublicText(root, 'package.json'), readPublicText(root, 'scripts/package-script-purposes.json')])
  return buildScriptDiscovery(parsePublicJson(manifest), parsePublicJson(purposes))
}

export function formatScriptDiscovery(report) {
  const lines = ['WebAppX package scripts', report.scope]
  for (const group of report.groups) {
    lines.push('', `${group.purpose} (${group.scripts.length})`)
    for (const row of group.scripts) lines.push(`  ${row.name}: ${JSON.stringify(row.command)} — ${row.description}`)
  }
  lines.push('', `Unclassified: ${report.unclassified.map(row => row.name).join(', ') || 'none'}`, `Stale classifications: ${report.staleClassifications.join(', ') || 'none'}`)
  return lines.join('\n') + '\n'
}

export async function runScriptDiscoveryCli(args = process.argv.slice(2), { root = rootDirectory, stdout = process.stdout, stderr = process.stderr } = {}) {
  if (new Set(args).size !== args.length || args.some(arg => !['--json', '--check'].includes(arg))) { stderr.write('Usage: node scripts/package-script-discovery.mjs [--json] [--check]\n'); return 2 }
  try {
    const report = await readScriptDiscovery(root)
    stdout.write(args.includes('--json') ? JSON.stringify(report, null, 2) + '\n' : formatScriptDiscovery(report))
    return args.includes('--check') && !report.ok ? 1 : 0
  } catch { stderr.write('Script discovery unavailable: invalid or unreadable public manifest/purpose data.\n'); return 1 }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runScriptDiscoveryCli()
