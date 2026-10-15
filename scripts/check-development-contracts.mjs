#!/usr/bin/env node
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { prerequisiteBaseline } from './developer-prerequisites.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const starter = '.SYSTEMX/Template/starter'
const exactVersion = /^\d+\.\d+\.\d+$/
const stableObject = value => JSON.stringify(Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right))))
const clientNames = text => [...new Set(text.match(/\bVITE_[A-Z][A-Z0-9_]*(?:\*)?/g) ?? [])].sort()

/** Compare public package metadata only. This does not probe or install tools. */
export function checkRuntimeDeclarations({ rootPackage, starterPackage, rootLock, starterLock, pins }) {
  const errors = []
  for (const [label, manifest] of [['root', rootPackage], ['starter', starterPackage]]) {
    if (!manifest?.engines || typeof manifest.engines !== 'object' || Array.isArray(manifest.engines) || typeof manifest.engines.node !== 'string' || !manifest.engines.node.trim()) errors.push(`${label}: declare engines.node.`)
    if (!/^npm@\d+\.\d+\.\d+$/.test(manifest?.packageManager ?? '')) errors.push(`${label}: packageManager must pin an exact npm version.`)
  }
  if (stableObject(rootPackage?.engines) !== stableObject(starterPackage?.engines)) errors.push('Root and starter engines declarations differ.')
  if (rootPackage?.packageManager !== starterPackage?.packageManager) errors.push('Root and starter packageManager declarations differ.')
  for (const [label, lock, manifest] of [['root', rootLock, rootPackage], ['starter', starterLock, starterPackage]]) {
    if (stableObject(lock?.packages?.['']?.engines) !== stableObject(manifest?.engines)) errors.push(`${label}: package-lock root engines differ from package.json.`)
  }
  const expectedPins = ['.nvmrc', '.node-version', `${starter}/.nvmrc`, `${starter}/.node-version`]
  for (const name of expectedPins) {
    if (typeof pins?.[name] !== 'string' || !exactVersion.test(pins[name].trim())) errors.push(`${name}: require an exact stable Node version.`)
  }
  const versions = expectedPins.map(name => pins?.[name]?.trim())
  if (new Set(versions).size !== 1) errors.push('Root and starter Node runtime pins differ.')
  // The template deliberately declares a minimum, matching the prerequisite
  // doctor. Refuse a new policy syntax until its checker is changed explicitly.
  const minimum = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(rootPackage?.engines?.node ?? '')
  if (!minimum) errors.push('engines.node must use the documented >=major.minor.patch minimum policy.')
  else if (exactVersion.test(versions[0] ?? '')) {
    const pinParts = versions[0].split('.').map(Number)
    const minimumParts = minimum.slice(1).map(Number)
    const difference = pinParts.map((part, index) => part - minimumParts[index]).find(value => value !== 0) ?? 0
    if (difference < 0) errors.push('The Node runtime pin is older than engines.node.')
  }
  if (rootPackage?.engines?.node !== `>=${prerequisiteBaseline.node}`) errors.push('engines.node differs from the prerequisite doctor minimum.')
  return errors
}

/** Read only variable NAMES from supplied checked-in text. Values are neither
 * interpreted nor returned. Optional extension names use # @optional markers. */
export function checkEnvironmentCoverage({ example, declarations, sources = [], documents = [] }) {
  const errors = []
  const assignments = new Set([...example.matchAll(/^\s*(VITE_[A-Z][A-Z0-9_]*)\s*=/gm)].map(match => match[1]))
  const optional = new Set([...example.matchAll(/^\s*#\s*@optional\s+(VITE_[A-Z][A-Z0-9_]*(?:\*)?)\s*(?:$|\s)/gm)].map(match => match[1]))
  const declared = new Set([...declarations.matchAll(/\breadonly\s+(VITE_[A-Z][A-Z0-9_]*)\??\s*:/g)].map(match => match[1]))
  const covered = name => assignments.has(name) || optional.has(name) || [...optional].some(pattern => pattern.endsWith('*') && name.startsWith(pattern.slice(0, -1))) || (name.endsWith('*') && [...assignments].some(key => key.startsWith(name.slice(0, -1))))
  for (const name of clientNames(declarations)) if (!covered(name)) errors.push(`src/vite-env.d.ts: ${name} is missing from .env.example and its optional markers.`)
  for (const { name: sourceName, text } of sources) {
    for (const name of clientNames(text)) {
      if (name.endsWith('*')) continue // Explanatory messages may name a family.
      if (!declared.has(name)) errors.push(`${sourceName}: ${name} has no ImportMetaEnv declaration.`)
      if (!covered(name)) errors.push(`${sourceName}: ${name} is missing from .env.example and its optional markers.`)
    }
  }
  for (const { name: documentName, text } of documents) for (const name of clientNames(text)) if (!covered(name)) errors.push(`${documentName}: documented ${name} is missing from .env.example and its optional markers.`)
  return { errors: [...new Set(errors)], exampleCount: assignments.size, optionalCount: optional.size, declarationCount: declared.size }
}

export function checkDevelopmentContracts(root = repository, { readText = path => readFileSync(path, 'utf8') } = {}) {
  const errors = []
  const read = name => {
    const path = join(root, name)
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error('Expected a regular public contract file.')
    return readText(path)
  }
  const discover = (directory, extension) => {
    const output = []
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const name = `${directory}/${entry.name}`
      if (entry.isDirectory()) output.push(...discover(name, extension))
      else if (entry.isFile() && extension.test(entry.name)) output.push({ name, text: read(name) })
    }
    return output
  }
  const environment = []
  try {
    const json = name => JSON.parse(read(name))
    const pins = Object.fromEntries(['.nvmrc', '.node-version', `${starter}/.nvmrc`, `${starter}/.node-version`].map(name => [name, read(name)]))
    errors.push(...checkRuntimeDeclarations({ rootPackage: json('package.json'), starterPackage: json(`${starter}/package.json`), rootLock: json('package-lock.json'), starterLock: json(`${starter}/package-lock.json`), pins }))
  } catch {
    errors.push('Runtime contract files are missing, unreadable or invalid JSON; inspect package declarations, lock metadata and runtime pins.')
  }
  for (const prefix of ['', `${starter}/`]) {
    try {
      const documents = prefix
        ? [{ name: `${prefix}README.md`, text: read(`${prefix}README.md`) }]
        : [{ name: 'README.md', text: read('README.md') }, ...discover('docs', /\.md$/), ...discover('wiki', /\.md$/)]
      const report = checkEnvironmentCoverage({ example: read(`${prefix}.env.example`), declarations: read(`${prefix}src/vite-env.d.ts`), sources: discover(`${prefix}src`, /\.(?:ts|tsx|js|jsx|mjs)$/), documents })
      errors.push(...report.errors.map(error => `${prefix || 'root/'}${error}`))
      environment.push({ scope: prefix ? 'starter' : 'root', exampleCount: report.exampleCount, optionalCount: report.optionalCount, declarationCount: report.declarationCount })
    } catch {
      errors.push(`${prefix || 'root/'}Environment contract public files are missing or unreadable.`)
    }
  }
  return { schemaVersion: 1, ok: errors.length === 0, errors, environment, scope: 'Public package metadata, runtime pins, .env.example, app source declarations and host Markdown only. Ignored/local env files, shell environment and secret stores are never read. No installations or mutations.' }
}

export function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--json') || args.length > 1) {
    console.error('Usage: node scripts/check-development-contracts.mjs [--json]')
    return 2
  }
  const report = checkDevelopmentContracts()
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(report.ok ? 'PASS development contracts: runtime declarations, pins and client environment coverage agree.' : 'FAIL development contracts:')
    for (const error of report.errors) console.log(`- ${error}`)
    for (const scope of report.environment) console.log(`${scope.scope}: ${scope.exampleCount} example client names, ${scope.optionalCount} optional extension markers, ${scope.declarationCount} typed names.`)
    console.log(report.scope)
  }
  return report.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main()
