#!/usr/bin/env node
/** Validate the reviewed, source-only capability map and its generated guide. */
import { createHash } from 'node:crypto'
import { readFile, writeFile, lstat, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const ROOT = fileURLToPath(new URL('../', import.meta.url))
export const DATA_PATH = 'docs/evidence/gusto-capability-gaps.json'
export const GUIDE_PATH = 'docs/GUSTO-CAPABILITY-GAPS.md'
export const CAPABILITIES_PATH = '.SYSTEMX/GUSTO/CAPABILITIES.json'
export const INVENTORY_PATH = '.SYSTEMX/GUSTO/sdk/endpoint-inventory.json'
export const PIN_PATH = '.SYSTEMX/GUSTO/VERSION-PIN.json'
export const SDK_PATH = 'src/hr/gusto/GustoSdkPreview.tsx'
const requiredBindings = [CAPABILITIES_PATH, INVENTORY_PATH, PIN_PATH, SDK_PATH,
  '.SYSTEMX/GUSTO/ROUTES.json', '.SYSTEMX/GUSTO/mock/fixtures/demo-company.json',
  'src/hr/model.ts', 'src/hr/components/HrWorkspace.tsx', 'src/hr/components/HrInsights.tsx', 'src/hr/mock-workflows.ts',
  'src/hr/insights.ts', 'src/hr/people-operations.ts', 'src/hr/service-desk.ts',
  'src/hr/recruiting.ts', 'src/hr/recruiting-link.ts', 'src/hr/performance.ts', 'src/hr/surveys.ts',
  'src/pages/HrPage.tsx', 'integrations/gusto/mock-api.mjs', 'integrations/gusto/sdk-onboarding.mjs',
  'integrations/gusto/sdk-payroll.mjs', 'integrations/gusto/schema.json',
  'integrations/gusto/functions/src/backend.mjs', 'integrations/gusto/functions/src/security.mjs',
  'integrations/gusto/functions/src/index.mjs', 'integrations/gusto/functions/src/webhooks.mjs',
  'src/portals/unsaved-work-core.ts', 'src/portals/unsaved-work.tsx', 'src/lib/navigation.ts', 'src/router.tsx',
  'src/hr/components/useHrFormDraft.ts', 'src/hr/components/PeopleOperations.tsx',
  'src/hr/components/HrServiceDesk.tsx', 'src/hr/components/HrRecruiting.tsx',
  'src/hr/components/HrPerformance.tsx', 'src/hr/components/HrSurveys.tsx',
  'src/portals/PortalWorkspaceProvider.tsx', 'src/portals/useDemoPersistence.ts',
  'src/portals/recovery-preferences.ts', 'src/portals/replacement-recovery.ts',
  'src/portals/DemoWorkspaceBackup.tsx', 'src/portals/DemoWorkspaceReset.tsx',
  'src/portals/RecoveryCheckpointPreview.tsx',
  'src/hr/lifecycle-types.ts', 'src/hr/lifecycle.ts',
  'src/hr/components/HrDirectoryCorrections.tsx', 'src/hr/components/HrEmploymentLifecycle.tsx',
  'src/hr/persistence.ts', 'src/hr/linked-operations.ts',
  'src/portals/workspace-inspection.ts', 'src/portals/WorkspaceInspection.tsx',
  'src/hr/recruiting-lifecycle-types.ts', 'src/hr/recruiting-lifecycle-value.ts',
  'src/hr/recruiting-lifecycle-replay.ts', 'src/hr/recruiting-lifecycle-projection.ts',
  'src/hr/recruiting-lifecycle.ts', 'src/hr/recruiting-controller.ts',
  'src/hr/recruiting-requisitions.ts', 'src/hr/recruiting-interviews.ts',
  'src/hr/recruiting-hire.ts', 'src/hr/recruiting-services.ts',
  'src/hr/recruiting-time-zone.ts', 'src/hr/recruiting-employment-baseline.ts',
  'src/hr/recruiting-lifecycle-validation.ts', 'src/hr/provider-adapter.ts',
  'src/hr/RecruitingPreviewProvider.tsx', 'src/hr/components/HrRecruitingLifecycleHost.tsx',
  'src/hr/components/HrRecruitingApplications.tsx', 'src/hr/components/HrRecruitingHireSummary.tsx',
  'src/hr/components/HrRecruitingRequisitions.tsx', 'src/hr/components/HrRecruitingInterviews.tsx',
  'src/hr/components/HrRecruitingOwnScorecards.tsx', 'src/portals/ScopedPortalChrome.tsx',
  'src/components/layout/Layout.tsx', 'src/pages/TemplatePortalsPage.tsx',
  'src/portals/RetainedPortalSurface.tsx', 'src/portals/CombinedWorkspaceBackup.tsx',
  'src/hr/payroll-control-types.ts', 'src/hr/payroll-control-value.ts',
  'src/hr/payroll-control.ts', 'src/hr/payroll-control-controller.ts',
  'src/hr/payroll-control-host.ts', 'src/hr/components/HrPayrollControl.tsx',
  'src/hr/components/HrPayrollControlHost.tsx',
]
const shaPattern = /^[0-9a-f]{64}$/
const nativeCoverage = ['interactive-mock', 'read-only-mock', 'partial-mock', 'not-implemented']
const exact = (record, keys) => !!record && typeof record === 'object' && !Array.isArray(record)
  && Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key))
const clean = (value, min = 1, max = 1800) => typeof value === 'string' && value === value.trim()
  && value.length >= min && value.length <= max && !/[\x00-\x1f\x7f]/.test(value)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const normalizedText = value => value.replaceAll('\r\n', '\n')
const sha = value => createHash('sha256').update(value).digest('hex')
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
export const capabilityDigest = value => sha(JSON.stringify(stable(value)))
export function sourceDigest(bytes, mode) {
  if (mode === 'bytes-sha256') return sha(bytes)
  if (mode !== 'utf8-lf-sha256') throw new Error('Unknown reviewed source hash mode')
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  return sha(normalizedText(text))
}

async function localFile(root, name) {
  if (!clean(name, 1, 240) || isAbsolute(name) || /[\\?#:]/.test(name)
    || name.split('/').some(part => ['', '.', '..', 'node_modules', '.git', 'local', 'logs', 'state'].includes(part))
    || !/\.(?:json|md|ts|tsx|mjs)$/.test(name) || /(?:^|\/)(?:\.env|\.secrets|service-account|credentials)(?:[./-]|$)/i.test(name)) {
    throw new Error('References must name contained public source files: ' + name)
  }
  const sourceRoot = await realpath(root)
  const path = resolve(sourceRoot, name)
  let part = sourceRoot
  for (const segment of name.split('/')) {
    const info = await lstat(part = resolve(part, segment))
    if (info.isSymbolicLink()) throw new Error('Linked source references are refused: ' + name)
  }
  const actual = await realpath(path)
  if (relative(sourceRoot, actual).startsWith('..' + sep) || isAbsolute(relative(sourceRoot, actual))) {
    throw new Error('Source reference escapes the repository: ' + name)
  }
  const info = await lstat(actual)
  if (!info.isFile() || info.nlink > 1 || info.size > 2_000_000) throw new Error('Source references require bounded regular files: ' + name)
  return readFile(actual)
}

/** Inspect mounted SDK JSX rather than strings, comments or the endpoint catalog. */
export function selectedSdkExports(source) {
  const file = ts.createSourceFile('GustoSdkPreview.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  if (file.parseDiagnostics.length) throw new Error('Selected SDK source is not valid TSX')
  const imported = new Map()
  for (const node of file.statements) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === '@gusto/embedded-react-sdk') {
      if (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) imported.set(node.importClause.namedBindings.name.text, '')
      for (const item of node.importClause?.namedBindings?.elements ?? []) {
        if (!item.isTypeOnly) imported.set(item.name.text, item.propertyName?.text ?? item.name.text)
      }
    }
  }
  const selected = new Set()
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const parts = node.tagName.getText(file).split('.')
      if (parts.length > 1 && imported.has(parts[0])) selected.add([imported.get(parts[0]), ...parts.slice(1)].filter(Boolean).join('.'))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...selected].sort()
}

function textList(value, label, { empty = false } = {}) {
  if (!Array.isArray(value) || (!empty && !value.length) || value.length > 12
    || value.some(item => !clean(item)) || new Set(value).size !== value.length) throw new Error(label + ' must be a bounded unique text list')
}

export async function validateGapData(data, { root = ROOT } = {}) {
  if (!exact(data, ['schemaVersion', 'kind', 'reviewedOn', 'reviewBase', 'evidenceScope', 'sdk', 'sourceBindings', 'capabilities'])
    || data.schemaVersion !== 1 || data.kind !== 'webappx-gusto-capability-gaps' || data.evidenceScope !== 'source-review'
    || !clean(data.reviewedOn) || !/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedOn)
    || !Number.isFinite(Date.parse(data.reviewedOn + 'T00:00:00Z'))
    || new Date(data.reviewedOn + 'T00:00:00Z').toISOString().slice(0, 10) !== data.reviewedOn
    || !exact(data.reviewBase, ['revision', 'provenance']) || typeof data.reviewBase.revision !== 'string' || !/^[0-9a-f]{40}$/.test(data.reviewBase.revision)
    || data.reviewBase.provenance !== 'integration-baseline-supplied-by-agent-0') throw new Error('Invalid source-review metadata')
  const cache = new Map()
  const bytes = async name => {
    if (!cache.has(name)) cache.set(name, await localFile(root, name))
    return cache.get(name)
  }
  const json = async name => JSON.parse((await bytes(name)).toString('utf8'))
  const [catalog, inventory, pin, sdkSource, appPackage, appLock] = await Promise.all([
    json(CAPABILITIES_PATH), json(INVENTORY_PATH), json(PIN_PATH), bytes(SDK_PATH),
    json('package.json'), json('package-lock.json'),
  ])
  if (!Array.isArray(catalog.capabilities) || catalog.capabilities.length !== 33
    || new Set(catalog.capabilities.map(item => item.id)).size !== 33) throw new Error('Canonical capability catalog must contain 33 unique IDs; review changed specifications')
  const mounted = selectedSdkExports(new TextDecoder('utf-8', { fatal: true }).decode(sdkSource))
  if (!exact(data.sdk, ['package', 'version', 'apiVersion', 'selectedExports'])
    || data.sdk.package !== pin.sdk.package || data.sdk.version !== pin.sdk.version
    || data.sdk.apiVersion !== pin.embeddedApi.apiVersion || !same(data.sdk.selectedExports, mounted)
    || mounted.length !== 3) throw new Error('Selected SDK version or three mounted mock components changed')
  if (appPackage.dependencies?.[data.sdk.package] !== data.sdk.version
    || appLock.packages?.['node_modules/' + data.sdk.package]?.version !== data.sdk.version) {
    throw new Error('Declared or locked SDK dependency differs from the reviewed pinned version')
  }
  if (sha(await bytes(INVENTORY_PATH)) !== pin.sdk.inventorySha256) throw new Error('Pinned vendor inventory bytes differ from their exact fingerprint')
  if (!Array.isArray(data.sourceBindings) || data.sourceBindings.length < requiredBindings.length || data.sourceBindings.length > 84) throw new Error('Missing bounded reviewed source bindings')
  const bound = new Map()
  for (const binding of data.sourceBindings) {
    if (!exact(binding, ['path', 'hashMode', 'sha256']) || !shaPattern.test(binding.sha256) || bound.has(binding.path)) throw new Error('Invalid or duplicate source binding')
    const expectedMode = binding.path === INVENTORY_PATH ? 'bytes-sha256' : 'utf8-lf-sha256'
    if (binding.hashMode !== expectedMode) throw new Error('Source binding hash mode must retain the reviewed text/vendor contract: ' + binding.path)
    if (sourceDigest(await bytes(binding.path), binding.hashMode) !== binding.sha256) throw new Error('Reviewed source drift: ' + binding.path)
    bound.set(binding.path, binding)
  }
  if (requiredBindings.some(path => !bound.has(path))) throw new Error('Required behavior/source binding is missing')
  if (!Array.isArray(data.capabilities) || data.capabilities.length !== catalog.capabilities.length) throw new Error('Every documented capability needs one gap row')
  const ids = new Set(), selected = []
  for (const [index, row] of data.capabilities.entries()) {
    if (!exact(row, ['id', 'title', 'capabilitySha256', 'native', 'sdk', 'adopter', 'evidence'])) throw new Error('Gap row has missing or unknown fields')
    if (ids.has(row.id)) throw new Error('Duplicate capability gap: ' + row.id)
    ids.add(row.id)
    const capability = catalog.capabilities.find(item => item.id === row.id)
    if (!capability) throw new Error('Unknown capability gap: ' + row.id)
    if (capability.id !== catalog.capabilities[index].id || row.title !== capability.title
      || row.capabilitySha256 !== capabilityDigest(capability)) throw new Error('Canonical capability definition/order drift: ' + row.id)
    if (!exact(row.native, ['coverage', 'behavior', 'refs']) || !nativeCoverage.includes(row.native.coverage)
      || !clean(row.native.behavior, 40)) throw new Error('Native mock coverage is required: ' + row.id)
    if (!exact(row.sdk, ['coverage', 'selectedExports', 'inventoryExports', 'detail', 'refs']) || !clean(row.sdk.detail, 30)) throw new Error('Explicit SDK coverage is required: ' + row.id)
    textList(row.sdk.selectedExports, row.id + ' selected exports', { empty: true })
    textList(row.sdk.inventoryExports, row.id + ' inventory exports', { empty: true })
    if (!same(row.sdk.inventoryExports, capability.providerWorkflowExports)) throw new Error('Inventory candidates differ from the portable specification: ' + row.id)
    for (const name of [...row.sdk.selectedExports, ...row.sdk.inventoryExports]) {
      if (!Object.hasOwn(inventory.blocks, name) && !Object.hasOwn(inventory.flows, name) && !Object.hasOwn(inventory.hooks, name)) throw new Error('SDK export absent from pinned inventory: ' + name)
    }
    if (row.sdk.selectedExports.some(name => !mounted.includes(name))) throw new Error('SDK inventory is not selected mock UI coverage: ' + row.id)
    const coverage = row.sdk.selectedExports.length ? 'selected-mock' : row.sdk.inventoryExports.length ? 'inventory-only' : 'none'
    if (row.sdk.coverage !== coverage) throw new Error('SDK coverage classification disagrees with mounted selections: ' + row.id)
    selected.push(...row.sdk.selectedExports)
    if (!exact(row.adopter, ['backendWork', 'providerRequirement', 'providerWork', 'rationale'])
      || !['required', 'optional', 'not-required'].includes(row.adopter.providerRequirement) || !clean(row.adopter.rationale, 30)) throw new Error('Adopter-owned work and provider decision required: ' + row.id)
    textList(row.adopter.backendWork, row.id + ' backend work')
    textList(row.adopter.providerWork, row.id + ' provider work', { empty: row.adopter.providerRequirement === 'not-required' })
    if (row.adopter.providerRequirement === 'not-required' && row.adopter.providerWork.length) throw new Error('Not-required provider work must be explicitly empty: ' + row.id)
    if (!exact(row.evidence, ['scope', 'limitation', 'refs']) || row.evidence.scope !== 'source-review'
      || !clean(row.evidence.limitation, 40)) throw new Error('Source-only evidence scope and limitation required: ' + row.id)
    for (const section of [row.native, row.sdk, row.evidence]) {
      textList(section.refs, row.id + ' source references')
      for (const ref of section.refs) {
        await bytes(ref)
        if (ref.startsWith('src/') || ref.startsWith('integrations/') || ref.startsWith('.SYSTEMX/GUSTO/')) {
          if (!bound.has(ref)) throw new Error('Behavior source lacks a reviewed binding: ' + ref)
        }
      }
    }
  }
  if (!same([...selected].sort(), mounted)) throw new Error('Each selected SDK mock component must map to one capability exactly once')
  return data
}

const cell = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;')
const links = refs => refs.map((ref, index) => `[source ${index + 1}](../${ref})`).join(', ')
export function renderGapGuide(data) {
  const counts = Object.fromEntries(['selected-mock', 'inventory-only', 'none'].map(value => [value, data.capabilities.filter(row => row.sdk.coverage === value).length]))
  const lines = ['# Gusto capability adoption gaps', '',
    'Generated from the reviewed [capability gap data](evidence/gusto-capability-gaps.json).',
    'This matrix addresses WX-0909 and maps every capability in the',
    '[portable catalog](../.SYSTEMX/GUSTO/CAPABILITIES.json) to current native mock',
    'behavior, selected SDK coverage, specific adopter-owned work and evidence scope.', '',
    `Source review: **${data.reviewedOn}**. Integration baseline supplied by Agent 0:`,
    `**\`${data.reviewBase.revision}\`**. This revision names the supplied published baseline.`,
    'The explicit fingerprints below bind the reviewed payroll-control working tree.',
    'Agent 0 froze 130 application source files by exact bytes in the [runtime source manifest](evidence/payroll-control-runtime-2026-10-15.json); its SHA-256 is `6adc613e9cb4681668200c742b08716259833a678ba03cc95c9ea7fdb5af8666`.',
    'This source-only review establishes no new commit, browser observation, provider operation or production acceptance.', '',
    `The pinned SDK is **${data.sdk.package} ${data.sdk.version}**, API alias`,
    `**${data.sdk.apiVersion}**. The app declaration and lockfile must retain that SDK version.`,
    `Current selection: **${counts['selected-mock']} capabilities with`,
    `selected mock components, ${counts['inventory-only']} with inventory candidates only, and ${counts.none} with no claimed SDK flow**.`,
    'Only these three components are mounted in the development SDK preview:', '',
    ...data.sdk.selectedExports.map(name => `- \`${name}\``), '',
    'The endpoint inventory lists candidates; it does not mount their interfaces,',
    'authorize endpoints or establish provider support. Benefits and general time',
    'entry use native interfaces; the pinned inventory supplies no dedicated SDK',
    'UI flow for them. Native browser records and the SDK mock session are separate.', '',
    '## Capability matrix', '',
    '| Capability | Native mock behavior | Optional SDK coverage | Adopter backend work | Provider work and decision | Evidence scope |',
    '| --- | --- | --- | --- | --- | --- |']
  for (const row of data.capabilities) {
    lines.push(`| **\`${row.id}\`** — ${cell(row.title)} | **${row.native.coverage}**. ${cell(row.native.behavior)} ${links(row.native.refs)} | **${row.sdk.coverage}**. ${cell(row.sdk.detail)} Selected: ${row.sdk.selectedExports.map(name => `\`${name}\``).join(', ') || 'none'}. Inventory candidates: ${row.sdk.inventoryExports.map(name => `\`${name}\``).join(', ') || 'none'}. ${links(row.sdk.refs)} | ${row.adopter.backendWork.map(cell).join('<br>')} | **${row.adopter.providerRequirement}**. ${cell(row.adopter.rationale)} ${row.adopter.providerWork.map(cell).join('<br>')} | **${row.evidence.scope}**. ${cell(row.evidence.limitation)} ${links(row.evidence.refs)} |`)
  }
  lines.push('', '## Evidence and adoption boundary', '',
    'Every row is a source review. Test references identify authored cases; this',
    'matrix records no new browser, emulator, provider or production execution.',
    'Mock receipts, package exports and readable fixtures do not establish payroll,',
    'tax, bank, insurance, identity or legal acceptance. The optional backend keeps',
    'provider forwarding and payroll execution unavailable. Operator-approved',
    'adoption must implement and accept each selected workflow in its own environment.', '',
    'Use [Gusto setup](GUSTO-SETUP.md), [backend and permission boundaries](GUSTO-FIREBASE.md),',
    '[portal capabilities](PORTAL-CAPABILITIES.md), [browser retention](PORTAL-STATE-CONTRACT.md)',
    'and [operations readiness](OPERATIONS-READINESS.md) for the shared boundaries.', '',
    '## Reviewed source bindings', '',
    'Reviewed UTF-8 text uses `utf8-lf-sha256`: CRLF is normalized to LF before',
    'hashing. The third-party pinned endpoint inventory uses `bytes-sha256` and',
    'must retain its exact vendor fingerprint. Unknown/binary formats are not',
    'normalized by this contract. Source changes require a deliberate data review;',
    'the checker never refreshes fingerprints or accepts capability work.', '',
    '| Local file | Hash mode | Reviewed SHA-256 |', '| --- | --- | --- |',
    ...data.sourceBindings.map(binding => `| [${binding.path}](../${binding.path}) | ${binding.hashMode} | \`${binding.sha256}\` |`), '',
    '## Maintain this matrix', '', '```bash',
    'node scripts/check-gusto-capability-gaps.mjs --check',
    'node --test tests/hr/capability-gaps.test.mjs',
    '# After deliberately reviewing/editing the canonical gap data:',
    'node scripts/check-gusto-capability-gaps.mjs --write', '```', '',
    'The default/check modes read local files only. `--write` validates the data',
    'and regenerates only this guide; it does not alter application behavior,',
    'the portable specification, source evidence, task status or providers.',
    'The guide check accepts LF/CRLF checkout equivalence.', '')
  return lines.join('\n')
}

export async function runGapCheck({ root = ROOT, write = false } = {}) {
  const data = await validateGapData(JSON.parse((await localFile(root, DATA_PATH)).toString('utf8')), { root })
  const expected = renderGapGuide(data)
  const guide = resolve(root, GUIDE_PATH)
  if (write) {
    // Validate an existing destination through the same source path guard.
    try { await localFile(root, GUIDE_PATH) } catch (error) { if (error.code !== 'ENOENT') throw error }
    await writeFile(guide, expected, 'utf8')
  } else if (normalizedText((await localFile(root, GUIDE_PATH)).toString('utf8')) !== expected) {
    throw new Error('Generated capability guide drift; review data then run --write')
  }
  return { capabilities: data.capabilities.length, selectedSdkComponents: data.sdk.selectedExports.length,
    evidenceScope: data.evidenceScope, written: write }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { console.log('Usage: node scripts/check-gusto-capability-gaps.mjs [--check|--write|--help]'); return }
  if (args.length > 1 || args.length === 1 && !['--check', '--write'].includes(args[0])) throw new Error('Choose --check or --write')
  const report = await runGapCheck({ write: args[0] === '--write' })
  console.log(`Capability gap matrix: ${report.capabilities} capabilities, ${report.selectedSdkComponents} selected mock SDK components, ${report.evidenceScope}${report.written ? '; guide rendered' : '; guide current'}.`)
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error('Capability gap check failed: ' + error.message); process.exitCode = 1 })
}
