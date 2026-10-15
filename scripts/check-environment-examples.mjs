#!/usr/bin/env node
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = 'docs/environment-config.schema.json'
const serverDocumentation = 'docs/GUSTO-FIREBASE.md'
const profiles = [
  { id: 'root', example: '.env.example', declarations: 'src/vite-env.d.ts' },
  { id: 'starter', example: '.SYSTEMX/Template/starter/.env.example', declarations: '.SYSTEMX/Template/starter/src/vite-env.d.ts' },
]
const variableName = /^[A-Z][A-Z0-9_]*$/
const publicName = /^VITE_[A-Z][A-Z0-9_]*$/
const pricePattern = '^VITE_STRIPE_PRICE_[A-Z][A-Z0-9_]*$'
const optionalMarkers = ['VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_STRIPE_PRICE_*']
const secretWords = /(?:^|_)(?:SECRETS?|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN|VERIFICATION_TOKEN|SERVICE_ACCOUNT|CREDENTIALS?)(?:_|$)/
const reservedServer = /^(?:SMTP_|SENDER_|GUSTO_|FIREBASE_ADMIN_|SYSTEMX_GOOGLE_FONTS_API_KEY$|GOOGLE_APPLICATION_CREDENTIALS$|OPENAI_API_KEY$|STRIPE_(?:SECRET|RESTRICTED|WEBHOOK)_)/
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const unique = values => new Set(values).size === values.length
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const safeName = name => variableName.test(name) ? name : 'invalid variable name'
const isReservedPublic = name => name.startsWith('VITE_') && (secretWords.test(name.slice(5)) || reservedServer.test(name.slice(5)))
const descriptorKeys = new Set(['type', 'enum', 'description', 'x-classification', 'x-sensitivity', 'x-consumer', 'x-declared-in'])

/** Fixed allowlist, not a dotenv discovery API. Never add local env files. */
export const environmentContractFiles = Object.freeze([
  schemaPath,
  ...profiles.flatMap(profile => [profile.example, profile.declarations]),
  serverDocumentation,
])

/** Validate the reviewed JSON Schema subset and classification annotations.
 * Diagnostics contain names/categories only, never schema or example values. */
export function checkEnvironmentSchema(schema) {
  const errors = []
  if (!object(schema) || schema.$schema !== 'https://json-schema.org/draft/2020-12/schema'
    || schema.type !== 'object' || schema.additionalProperties !== false
    || !object(schema.properties) || !object(schema.patternProperties) || !object(schema['x-webappx'])) {
    return ['schema: require the reviewed object, property, family and example-profile contract.']
  }
  const contract = schema['x-webappx']
  if (Object.keys(schema).some(key => !['$schema', '$id', 'title', 'description', 'type', 'additionalProperties', 'properties', 'patternProperties', 'x-webappx'].includes(key))
    || Object.keys(contract).some(key => !['version', 'profiles', 'optionalMarkers', 'serverDocumentation'].includes(key))) errors.push('schema: unsupported schema keyword or example-contract field.')
  if (contract.version !== 1 || !same(contract.optionalMarkers, optionalMarkers)) errors.push('schema: invalid version or reviewed optional marker inventory.')
  if (!Array.isArray(contract.profiles) || contract.profiles.length !== profiles.length) errors.push('schema: require root and starter example profiles.')
  for (const profile of profiles) {
    const entry = contract.profiles?.find?.(candidate => candidate?.id === profile.id)
    if (!object(entry) || Object.keys(entry).some(key => !['id', 'example', 'declarations', 'required'].includes(key))
      || entry.example !== profile.example || entry.declarations !== profile.declarations
      || !Array.isArray(entry.required) || !unique(entry.required)
      || entry.required.some(name => typeof name !== 'string' || !variableName.test(name) || !Object.hasOwn(schema.properties, name))) {
      errors.push('schema: ' + profile.id + ' has an invalid public-file or mandatory fixture-key inventory.')
    }
  }
  const documentation = contract.serverDocumentation
  if (!object(documentation) || documentation.path !== serverDocumentation || !Array.isArray(documentation.keys)
    || !documentation.keys.length || !unique(documentation.keys)
    || documentation.keys.some(name => typeof name !== 'string' || schema.properties[name]?.['x-classification'] !== 'server-only')) {
    errors.push('schema: invalid reviewed server documentation inventory.')
  }
  if (!same(Object.keys(schema.patternProperties), [pricePattern])) errors.push('schema: unsupported optional variable family.')
  const descriptors = [
    ...Object.entries(schema.properties).map(([name, descriptor]) => ({ name, descriptor, family: false })),
    ...Object.entries(schema.patternProperties).map(([, descriptor]) => ({ name: 'VITE_STRIPE_PRICE_*', descriptor, family: true })),
  ]
  for (const { name, descriptor, family } of descriptors) {
    const label = family ? name : safeName(name)
    if ((!family && !variableName.test(name)) || !object(descriptor)) {
      errors.push('schema: ' + label + ' has an invalid variable declaration.')
      continue
    }
    if (Object.keys(descriptor).some(key => !descriptorKeys.has(key)) || descriptor.type !== 'string'
      || !Array.isArray(descriptor.enum) || !descriptor.enum.length || !unique(descriptor.enum)
      || descriptor.enum.some(value => typeof value !== 'string') || !descriptor.enum.includes('')) {
      errors.push('schema: ' + label + ' requires the reviewed string and blank-placeholder contract.')
    }
    const classification = descriptor['x-classification']
    const sensitivity = descriptor['x-sensitivity']
    const consumer = descriptor['x-consumer']
    const declarations = descriptor['x-declared-in']
    if (!['public-browser', 'server-only'].includes(classification)
      || (classification === 'public-browser' && (sensitivity !== 'public' || !['browser', 'setup-metadata', 'optional-extension'].includes(consumer)))
      || (classification === 'server-only' && (!['private-setting', 'secret'].includes(sensitivity) || consumer !== 'server'))) {
      errors.push('schema: ' + label + ' has an invalid classification, sensitivity or consumer.')
    }
    if (!Array.isArray(declarations) || !unique(declarations) || declarations.some(id => !profiles.some(profile => profile.id === id))
      || (consumer === 'browser' ? declarations.length === 0 : declarations.length !== 0)) {
      errors.push('schema: ' + label + ' has an invalid typed-declaration inventory.')
    }
    if ((classification === 'public-browser' && (!name.startsWith('VITE_') || isReservedPublic(name)))
      || (classification === 'server-only' && name.startsWith('VITE_'))) {
      errors.push('schema: ' + label + ' violates the public-browser/server-only prefix boundary.')
    }
    if ((secretWords.test(name) || ['SYSTEMX_GOOGLE_FONTS_API_KEY', 'OPENAI_API_KEY'].includes(name))
      && (classification !== 'server-only' || sensitivity !== 'secret')) errors.push('schema: ' + label + ' requires server-only secret classification.')
    if (sensitivity === 'secret' && descriptor.enum?.some?.(value => !['', 'replace-with-secret-store-value'].includes(value))) {
      errors.push('schema: ' + label + ' permits a non-placeholder secret example.')
    }
    for (const id of Array.isArray(declarations) ? declarations : []) {
      if (!contract.profiles?.find?.(profile => profile.id === id)?.required?.includes(name)) errors.push('schema: ' + id + ' must retain the typed ' + label + ' fixture key.')
    }
  }
  for (const marker of optionalMarkers) {
    const descriptor = marker.endsWith('*') ? schema.patternProperties[pricePattern] : schema.properties[marker]
    if (descriptor?.['x-classification'] !== 'public-browser' || descriptor?.['x-consumer'] !== 'optional-extension') errors.push('schema: ' + marker + ' requires an optional public-browser declaration.')
  }
  return [...new Set(errors)]
}

function findDescriptor(schema, name) {
  if (Object.hasOwn(schema.properties, name)) return schema.properties[name]
  if (/^VITE_STRIPE_PRICE_[A-Z][A-Z0-9_]*$/.test(name)) return schema.patternProperties[pricePattern]
  return undefined
}

/** Parse supplied public example text only. No expansion, imports or execution.
 * Values exist only within this function long enough to compare placeholders. */
export function checkEnvironmentExample({ id, example, schema, required = [] }) {
  const errors = []
  const assignments = new Map()
  const markers = new Set()
  for (const [index, line] of example.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    if (/^\s*#/.test(line)) {
      if (/^\s*#\s*@optional\b/.test(line)) {
        const marker = /^\s*#\s*@optional\s+(VITE_[A-Z][A-Z0-9_]*(?:\*)?)\s*$/.exec(line)?.[1]
        if (!marker || !optionalMarkers.includes(marker)) errors.push(id + ': line ' + (index + 1) + ' has an unreviewed optional marker.')
        else if (markers.has(marker)) errors.push(id + ': duplicate optional marker ' + marker + '.')
        else markers.add(marker)
      }
      continue
    }
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line)
    if (!match) {
      errors.push(id + ': line ' + (index + 1) + ' is not a supported example assignment.')
      continue
    }
    const name = match[1]
    if (assignments.has(name)) errors.push(id + ': duplicate assignment ' + name + '.')
    const descriptor = findDescriptor(schema, name)
    assignments.set(name, { name, classification: descriptor?.['x-classification'] ?? 'unclassified' })
    if (isReservedPublic(name)) errors.push(id + ': ' + name + ' uses a reserved server or secret name in the public-browser prefix.')
    if (!descriptor) {
      errors.push(id + ': ' + name + ' has no reviewed ' + (publicName.test(name) ? 'public-browser' : 'server-only') + ' schema declaration.')
      continue
    }
    let value = match[2].trim()
    if (value.startsWith('"') || value.startsWith("'")) {
      if (value.length < 2 || !value.endsWith(value[0])) {
        errors.push(id + ': ' + name + ' has an invalid quoted example placeholder.')
        continue
      }
      value = value.slice(1, -1)
    }
    if (!descriptor.enum.includes(value)) errors.push(id + ': ' + name + ' must use a reviewed example placeholder or blank.')
  }
  for (const name of required) if (!assignments.has(name)) errors.push(id + ': missing mandatory fixture key ' + name + '.')
  for (const marker of optionalMarkers) if (!markers.has(marker)) errors.push(id + ': missing optional extension marker ' + marker + '.')
  return { errors: [...new Set(errors)], assignments: [...assignments.values()].sort((left, right) => left.name.localeCompare(right.name)), optionalMarkers: [...markers].sort() }
}

/** Compare browser types with the schema without loading application configuration. */
export function checkEnvironmentDeclarations({ id, declarations, schema }) {
  const errors = []
  const names = new Set()
  for (const match of declarations.matchAll(/\breadonly\s+(VITE_[A-Z][A-Z0-9_]*)(?:\?)?\s*:\s*([^\r\n;}]+)/g)) {
    const [, name, type] = match
    if (names.has(name)) errors.push(id + ': duplicate typed declaration ' + name + '.')
    names.add(name)
    const descriptor = schema.properties[name]
    if (descriptor?.['x-classification'] !== 'public-browser' || descriptor?.['x-consumer'] !== 'browser'
      || !descriptor?.['x-declared-in']?.includes(id)) errors.push(id + ': typed ' + name + ' disagrees with the public-browser schema inventory.')
    if (!/^(?:string|(?:'[^']*'|"[^"]*")(?:\s*\|\s*(?:'[^']*'|"[^"]*"))*)$/.test(type.trim())) errors.push(id + ': typed ' + name + ' must describe string configuration.')
    else if (type.trim() !== 'string' && descriptor?.enum) {
      const members = [...type.matchAll(/'([^']*)'|"([^"]*)"/g)].map(member => member[1] ?? member[2])
      if (descriptor.enum.some(value => value !== '' && !members.includes(value))) errors.push(id + ': typed ' + name + ' disagrees with the schema string choices.')
    }
  }
  for (const [name, descriptor] of Object.entries(schema.properties)) {
    if (descriptor['x-declared-in'].includes(id) && !names.has(name)) errors.push(id + ': schema browser key ' + name + ' is missing its typed declaration.')
  }
  return { errors, declarationCount: names.size }
}

/** Read only the fixed public allowlist. Schema paths cannot add reads.
 * Inspect every relative path component before reading to reject symlink escapes. */
export function checkEnvironmentExamples(root = repository, { readText = path => readFileSync(path, 'utf8') } = {}) {
  const errors = []
  const contents = new Map()
  for (const name of environmentContractFiles) {
    try {
      const parts = name.split('/')
      for (let count = 1; count <= parts.length; count += 1) {
        const stat = lstatSync(join(root, ...parts.slice(0, count)))
        if (stat.isSymbolicLink() || (count === parts.length ? !stat.isFile() : !stat.isDirectory())) throw new Error('Public file boundary.')
      }
      contents.set(name, readText(join(root, name)))
    } catch {
      errors.push(name + ': reviewed public contract file is missing, unreadable or not a regular file.')
    }
  }
  let schema
  try {
    schema = JSON.parse(contents.get(schemaPath))
    errors.push(...checkEnvironmentSchema(schema))
  } catch {
    errors.push('schema: reviewed environment proposal is missing or invalid JSON.')
  }
  const examples = []
  if (!errors.length) {
    for (const profile of profiles) {
      const required = schema['x-webappx'].profiles.find(entry => entry.id === profile.id).required
      const example = checkEnvironmentExample({ id: profile.id, example: contents.get(profile.example), schema, required })
      const declarations = checkEnvironmentDeclarations({ id: profile.id, declarations: contents.get(profile.declarations), schema })
      errors.push(...example.errors, ...declarations.errors)
      examples.push({ scope: profile.id, assignmentCount: example.assignments.length,
        publicBrowserCount: example.assignments.filter(entry => entry.classification === 'public-browser').length,
        serverOnlyCount: example.assignments.filter(entry => entry.classification === 'server-only').length,
        declarationCount: declarations.declarationCount, optionalMarkerCount: example.optionalMarkers.length,
        keys: example.assignments })
    }
    const documentation = contents.get(serverDocumentation)
    for (const name of schema['x-webappx'].serverDocumentation.keys) {
      if (!(documentation.match(/\b[A-Z][A-Z0-9_]*\b/g) ?? []).includes(name)) errors.push('server documentation: ' + name + ' is missing its reviewed server-only reference.')
    }
  }
  return { schemaVersion: 1, ok: errors.length === 0, errors: [...new Set(errors)], examples,
    scope: 'Tracked example proposal, root/starter browser declarations and reviewed server documentation only. No private env files, shell environment values, secret stores, network, writes or runtime activation. This is not production runtime enforcement.' }
}

export function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--json') || args.length > 1) {
    console.error('Usage: node scripts/check-environment-examples.mjs [--json]')
    return 2
  }
  const report = checkEnvironmentExamples()
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(report.ok ? 'PASS environment examples: reviewed names, classifications, placeholders and browser declarations agree.' : 'FAIL environment examples:')
    for (const error of report.errors) console.log('- ' + error)
    for (const example of report.examples) console.log(example.scope + ': ' + example.publicBrowserCount + ' public-browser keys, ' + example.serverOnlyCount + ' server-only keys, ' + example.declarationCount + ' typed keys, ' + example.optionalMarkerCount + ' optional markers.')
    console.log(report.scope)
  }
  return report.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) process.exitCode = main()
