#!/usr/bin/env node
/** Compile authored LAN capability specifications into reviewable delivery requirements. */
import { createHash } from 'node:crypto'
import { readFile, writeFile, realpath, stat, lstat, mkdir } from 'node:fs/promises'
import { resolve, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
export const sourceBase = '053382b383d0fbffbe5161e9fb4d5f07a3c1fed8'
export const createdOn = '2026-10-26'
export const specificationFiles = Object.freeze(['01-foundation', '02-design', '03-content', '04-app-systems', '05-delivery'].map(name => `.SYSTEMX/LAN/Backlog/specs/${name}.json`))
export const progressFile = 'docs/backlog/lan-10000-progress.json'
export const artifactFiles = Object.freeze({ json: 'docs/backlog/lan-10000.json', markdown: 'docs/backlog/LAN-10000-TODO.md', csv: 'docs/backlog/lan-10000.csv', plan: 'docs/LAN-10000-EXECUTION-PLAN.md' })
export const lanes = Object.freeze(['behavior', 'boundaries', 'recovery', 'feedback', 'evidence'])
const laneNames = { behavior: 'Observable behavior', boundaries: 'Boundaries and refusal', recovery: 'Recovery and reversibility', feedback: 'Operator feedback', evidence: 'Verification evidence' }
const familyKeys = ['id', 'name', 'area', 'phase', 'priority', 'gate', 'dependsOnFamilies', 'scope', 'refusal', 'recovery', 'feedback', 'evidence', 'capabilities']
const capabilityKeys = ['key', 'title', 'outcome']
const completionKeys = ['id', 'definitionSha256', 'verifiedOn', 'sourceRevision', 'evidence', 'reviewedBy']
const gates = ['local', 'operator', 'provider']
const slug = value => typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80
const clean = (value, min = 1, max = 1400) => typeof value === 'string' && value === value.trim() && value.length >= min && value.length <= max && !/[\x00-\x1f\x7f]/.test(value)
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value)
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const idFor = value => `LAN-${String(value).padStart(5, '0')}`
const normalized = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const canonicalJson = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry)
export const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex')

export function validateDependencyGraph(items) {
  const map = new Map(items.map(item => [item.id, item]))
  if (map.size !== items.length) throw new Error('Duplicate requirement IDs.')
  const pending = new Map()
  const dependents = new Map()
  for (const item of items) {
    if (!Array.isArray(item.dependsOn) || new Set(item.dependsOn).size !== item.dependsOn.length) throw new Error(`${item.id}: duplicate or invalid dependencies.`)
    pending.set(item.id, item.dependsOn.length)
    for (const dependency of item.dependsOn) {
      if (!map.has(dependency)) throw new Error(`${item.id}: unknown dependency ${dependency}.`)
      if (!dependents.has(dependency)) dependents.set(dependency, [])
      dependents.get(dependency).push(item.id)
    }
  }
  const ready = items.filter(item => pending.get(item.id) === 0).map(item => item.id)
  let visited = 0
  for (let position = 0; position < ready.length; position += 1) {
    visited += 1
    for (const dependent of dependents.get(ready[position]) ?? []) {
      pending.set(dependent, pending.get(dependent) - 1)
      if (pending.get(dependent) === 0) ready.push(dependent)
    }
  }
  if (visited !== items.length) throw new Error(`Dependency cycle involving ${items.filter(item => pending.get(item.id) > 0).slice(0, 8).map(item => item.id).join(', ')}.`)
}

export function buildCatalog(documents, options = {}) {
  const { expectedFamilyCount = 100, capabilitiesPerFamily = 20, expectedDocuments = 5, familiesPerDocument = 20, baseline = sourceBase, creationDate = createdOn } = options
  if (!Number.isInteger(expectedFamilyCount) || expectedFamilyCount < 1 || !Number.isInteger(capabilitiesPerFamily) || capabilitiesPerFamily < 1 || !hex(baseline, 40) || !day(creationDate)) throw new Error('Invalid catalog count or baseline options.')
  if (!Array.isArray(documents) || documents.length !== expectedDocuments) throw new Error(`Expected exactly ${expectedDocuments} authored specification documents.`)
  const families = []
  const sources = new Map()
  documents.forEach((document, documentIndex) => {
    if (!exactKeys(document, ['schemaVersion', 'families']) || document.schemaVersion !== 1 || !Array.isArray(document.families) || document.families.length !== familiesPerDocument) throw new Error(`Specification ${documentIndex + 1}: schema 1 requires exactly ${familiesPerDocument} families.`)
    document.families.forEach(family => { families.push(family); sources.set(family, specificationFiles[documentIndex] ?? `fixture-${documentIndex + 1}.json`) })
  })
  if (families.length !== expectedFamilyCount) throw new Error(`Expected exactly ${expectedFamilyCount} families.`)
  const familyIds = new Set()
  const familyNames = new Set()
  const capabilities = new Map()
  for (const family of families) {
    if (!exactKeys(family, familyKeys) || typeof family.id !== 'string' || !/^F\d{3}$/.test(family.id)) throw new Error('Family has unexpected fields or an invalid F001-style ID.')
    if (familyIds.has(family.id)) throw new Error(`Duplicate family ID ${family.id}.`)
    familyIds.add(family.id)
    if (!clean(family.name, 4, 140) || familyNames.has(normalized(family.name))) throw new Error(`${family.id}: invalid or duplicate family name.`)
    familyNames.add(normalized(family.name))
    if (!slug(family.area) || !slug(family.phase) || !['P1', 'P2', 'P3'].includes(family.priority) || !gates.includes(family.gate)) throw new Error(`${family.id}: invalid area, phase, priority or gate.`)
    for (const field of ['scope', 'refusal', 'recovery', 'feedback', 'evidence']) if (!clean(family[field], 12) || /^(todo|tbd|placeholder)$/i.test(family[field])) throw new Error(`${family.id}: ${field} requires bounded authored acceptance context.`)
    if (!Array.isArray(family.dependsOnFamilies) || new Set(family.dependsOnFamilies).size !== family.dependsOnFamilies.length || family.dependsOnFamilies.some(value => typeof value !== 'string' || !/^F\d{3}$/.test(value) || value === family.id)) throw new Error(`${family.id}: invalid or duplicate family dependencies.`)
    if (!Array.isArray(family.capabilities) || family.capabilities.length !== capabilitiesPerFamily) throw new Error(`${family.id}: expected exactly ${capabilitiesPerFamily} authored capabilities.`)
    const titles = new Set()
    for (const capability of family.capabilities) {
      const keys = Object.hasOwn(capability ?? {}, 'dependsOnCapabilities') ? [...capabilityKeys, 'dependsOnCapabilities'] : capabilityKeys
      if (!exactKeys(capability, keys) || !slug(capability.key) || !clean(capability.title, 5, 180) || !clean(capability.outcome, 20, 1600)) throw new Error(`${family.id}: invalid capability definition.`)
      const key = `${family.id}/${capability.key}`
      if (capabilities.has(key)) throw new Error(`Duplicate capability key ${key}.`)
      if (titles.has(normalized(capability.title))) throw new Error(`${family.id}: duplicate capability title.`)
      titles.add(normalized(capability.title))
      const dependencies = capability.dependsOnCapabilities ?? []
      if (!Array.isArray(dependencies) || dependencies.some(value => typeof value !== 'string' || !(slug(value) || /^F\d{3}\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)))) throw new Error(`${key}: invalid capability dependencies.`)
      const resolved = dependencies.map(value => value.includes('/') ? value : `${family.id}/${value}`)
      if (new Set(resolved).size !== resolved.length) throw new Error(`${key}: duplicate capability dependencies.`)
      capabilities.set(key, { family, capability, dependencies: resolved, requirements: [] })
    }
  }
  families.sort((left, right) => left.id.localeCompare(right.id))
  families.forEach((family, index) => { if (family.id !== `F${String(index + 1).padStart(3, '0')}`) throw new Error('Family IDs must form the complete ordered F001 sequence.') })
  for (const family of families) for (const dependency of family.dependsOnFamilies) if (!familyIds.has(dependency)) throw new Error(`${family.id}: unknown family dependency ${dependency}.`)
  for (const [key, entry] of capabilities) for (const dependency of entry.dependencies) if (!capabilities.has(dependency)) throw new Error(`${key}: unknown capability dependency ${dependency}.`)
  const items = []
  const familyItems = new Map(families.map(family => [family.id, []]))
  for (const family of families) for (const capability of family.capabilities) {
    const reference = `${family.id}/${capability.key}`
    const entry = capabilities.get(reference)
    for (const lane of lanes) {
      const context = `Context: ${family.scope}`
      const detail = lane === 'behavior' ? `Deliver the stated behavior within this scope. ${context}`
        : lane === 'boundaries' ? `${context} Refusal: ${family.refusal}`
          : lane === 'recovery' ? `${context} Recovery: ${family.recovery}`
            : lane === 'feedback' ? `${context} Feedback: ${family.feedback}`
              : `${context} Evidence: ${family.evidence}`
      const item = { id: idFor(items.length + 1), familyId: family.id, familyName: family.name, capabilityKey: capability.key, capabilityTitle: capability.title, area: family.area, phase: family.phase, priority: family.priority, gate: family.gate, lane, title: `${family.name}: ${capability.title} — ${laneNames[lane]}`, acceptance: `${capability.outcome} ${detail}`, source: sources.get(family), dependsOn: [] }
      items.push(item); entry.requirements.push(item.id); familyItems.get(family.id).push(item.id)
    }
  }
  const map = new Map(items.map(item => [item.id, item]))
  for (const entry of capabilities.values()) {
    const own = entry.requirements
    const behavior = map.get(own[0])
    // Evidence requires its own preceding four lanes. Terminal evidence edges
    // therefore preserve the full prerequisite closure without repeating it.
    behavior.dependsOn = [...new Set([...entry.family.dependsOnFamilies.flatMap(id => familyItems.get(id).filter(itemId => map.get(itemId).lane === 'evidence')), ...entry.dependencies.map(key => capabilities.get(key).requirements[4])])].sort()
    for (const id of own.slice(1, 4)) map.get(id).dependsOn = [own[0]]
    map.get(own[4]).dependsOn = own.slice(0, 4)
  }
  validateDependencyGraph(items)
  for (const item of items) {
    const family = families.find(value => value.id === item.familyId)
    const definition = { ...item, authoredFamily: Object.fromEntries(familyKeys.filter(key => key !== 'capabilities').map(key => [key, family[key]])), authoredCapability: capabilities.get(`${item.familyId}/${item.capabilityKey}`).capability }
    item.definitionSha256 = sha256(definition)
    item.status = 'todo'
  }
  return { schemaVersion: 1, project: 'WebAppX LAN', intent: 'delivery-requirements', createdOn: creationDate, sourceBase: baseline, sourceSha256: sha256({ families, sourceBase: baseline, createdOn: creationDate }), sourceSpecifications: specificationFiles.slice(0, documents.length), familyCount: families.length, capabilityCount: capabilities.size, lanes: [...lanes], items }
}

function receiptBindings(contents, evidence) {
  const bindings = []
  const pattern = /```lan-completion-evidence[ \t]*\r?\n([\s\S]*?)\r?\n```/g
  for (const match of contents.matchAll(pattern)) {
    let block
    try { block = JSON.parse(match[1]) } catch { throw new Error(`${evidence}: invalid lan-completion-evidence JSON.`) }
    if (!exactKeys(block, ['schemaVersion', 'requirements']) || block.schemaVersion !== 1 || !Array.isArray(block.requirements)) throw new Error(`${evidence}: invalid receipt binding schema.`)
    for (const binding of block.requirements) {
      if (!exactKeys(binding, ['id', 'definitionSha256', 'sourceRevision']) || typeof binding.id !== 'string' || !/^LAN-\d{5}$/.test(binding.id) || !hex(binding.definitionSha256, 64) || !hex(binding.sourceRevision, 40)) throw new Error(`${evidence}: invalid receipt requirement binding.`)
      if (bindings.some(value => value.id === binding.id)) throw new Error(`${evidence}: duplicate receipt requirement binding ${binding.id}.`)
      bindings.push(binding)
    }
  }
  if (!bindings.length) throw new Error(`${evidence}: missing fenced lan-completion-evidence requirement bindings.`)
  return bindings
}

export async function validateProgress(catalog, progress, { publicRoot = repositoryRoot } = {}) {
  if (!exactKeys(progress, ['schemaVersion', 'completions']) || progress.schemaVersion !== 1 || !Array.isArray(progress.completions) || progress.completions.length > catalog.items.length) throw new Error('Progress requires schema 1 and bounded completions; authored definitions contain no completion fields.')
  const items = new Map(catalog.items.map(item => [item.id, item]))
  const completed = new Set()
  const checkedReceipts = new Map()
  const actualRoot = await realpath(publicRoot)
  for (const completion of progress.completions) {
    if (!exactKeys(completion, completionKeys) || !items.has(completion.id) || completed.has(completion.id)) throw new Error('Completion has unexpected fields, an unknown ID, or a duplicate ID.')
    completed.add(completion.id)
    if (completion.definitionSha256 !== items.get(completion.id).definitionSha256) throw new Error(`${completion.id}: definitionSha256 does not match the current requirement definition.`)
    if (!day(completion.verifiedOn) || completion.verifiedOn < catalog.createdOn || !hex(completion.sourceRevision, 40) || completion.reviewedBy !== 'agent.0') throw new Error(`${completion.id}: completion needs an actual verification date, full sourceRevision and reviewedBy agent.0.`)
    const evidence = completion.evidence
    if (!clean(evidence, 8, 240) || !/^docs\/.+\.md$/.test(evidence) || isAbsolute(evidence) || /[\\:%?#]/.test(evidence) || evidence.split('/').some(segment => !segment || segment.startsWith('.') || segment === '..')) throw new Error(`${completion.id}: evidence must be a contained public docs/*.md receipt path.`)
    if (!checkedReceipts.has(evidence)) {
      let contents
      try {
        const path = await realpath(resolve(publicRoot, evidence))
        const within = relative(actualRoot, path)
        const publicName = within.split(sep).join('/')
        const info = await stat(path)
        if (!/^docs\/.+\.md$/.test(publicName) || publicName.split('/').some(segment => segment.startsWith('.')) || !contained(actualRoot, path) || !info.isFile() || info.size > 8 * 1024 * 1024) throw new Error('Not a bounded contained public file')
        contents = await readFile(path, 'utf8')
      } catch { throw new Error(`${completion.id}: evidence must resolve to an existing bounded Markdown file inside the public repository.`) }
      checkedReceipts.set(evidence, receiptBindings(contents, evidence))
    }
    if (!checkedReceipts.get(evidence).some(binding => binding.id === completion.id && binding.definitionSha256 === completion.definitionSha256 && binding.sourceRevision === completion.sourceRevision)) throw new Error(`${completion.id}: receipt does not bind the exact ID, definitionSha256 and sourceRevision tuple.`)
  }
  for (const id of completed) for (const dependency of items.get(id).dependsOn) if (!completed.has(dependency)) throw new Error(`${id}: prerequisite ${dependency} is not completed.`)
  return progress
}

export function applyProgress(catalog, progress) {
  const completions = new Map(progress.completions.map(entry => [entry.id, entry]))
  return { ...catalog, items: catalog.items.map(item => completions.has(item.id) ? { ...item, status: 'done', completion: { ...completions.get(item.id) } } : { ...item, status: 'todo' }) }
}

export function readyItems(catalog, { limit = 20, gate = 'local' } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !gates.includes(gate)) throw new Error('Ready queries require limit 1..100 and a known gate.')
  // Validated progress closes every accepted dependency, so checking all direct
  // prerequisites is equivalent to checking the complete transitive closure.
  const done = new Set(catalog.items.filter(item => item.status === 'done').map(item => item.id))
  const matches = catalog.items.filter(item => item.status === 'todo' && item.gate === gate && item.dependsOn.every(id => done.has(id)))
  return { gate, executionAuthorized: false, meaning: 'Dependency-ready delivery requirements only; no assignment, execution, provider access or publication authority.', matches: matches.length, items: matches.slice(0, limit) }
}

const countBy = (items, key) => Object.fromEntries([...new Set(items.map(item => item[key]))].sort().map(value => [value, items.filter(item => item[key] === value).length]))
export function summary(catalog) {
  const capabilities = new Map()
  for (const item of catalog.items) {
    const key = `${item.familyId}/${item.capabilityKey}`
    if (!capabilities.has(key)) capabilities.set(key, [])
    capabilities.get(key).push(item)
  }
  const values = [...capabilities.values()]
  const complete = values.filter(items => items.length === lanes.length && items.every(item => item.status === 'done')).length
  const partial = values.filter(items => items.some(item => item.status === 'done') && items.some(item => item.status !== 'done')).length
  return { requirements: { total: catalog.items.length, todo: catalog.items.filter(item => item.status === 'todo').length, done: catalog.items.filter(item => item.status === 'done').length }, capabilities: { total: values.length, todo: values.length - complete - partial, partial, done: complete }, families: catalog.familyCount, gates: countBy(catalog.items, 'gate'), phases: countBy(catalog.items, 'phase'), priorities: countBy(catalog.items, 'priority'), localReady: readyItems(catalog, { limit: 1 }).matches, executionAuthorized: false }
}

const markdown = value => String(value).replace(/([\\`*_\[\]<>|])/g, '\\$1')
const csv = value => {
  const text = String(value)
  const cell = /^\s*[=+@-]/.test(text) ? `'${text}` : text
  return `"${cell.replaceAll('"', '""')}"`
}
export function renderArtifacts(catalog, { maximumCombinedMarkdownBytes = 1024 * 1024 } = {}) {
  const stats = summary(catalog)
  const families = [...new Map(catalog.items.map(item => [item.familyId, item])).values()]
  const intro = [
    '# SYSTEMX LAN — 10,000 delivery requirements', '',
    `Created ${catalog.createdOn}; source baseline \`${catalog.sourceBase}\`.`, '',
    `${catalog.familyCount} authored families × ${catalog.capabilityCount / catalog.familyCount} capabilities × ${lanes.length} acceptance lanes = **${catalog.items.length.toLocaleString('en-US')} separately trackable delivery requirements**.`,
    'These requirements describe delivery work; the count does not mean 10,000 shipped standalone features.',
    `Status: **${stats.requirements.done} accepted requirements / ${stats.requirements.todo} TODO**; **${stats.capabilities.done} fully accepted capabilities / ${stats.capabilities.partial} partial / ${stats.capabilities.todo} TODO**.`, '',
    'Authored specifications and [progress](lan-10000-progress.json) are the inputs. This page, [JSON](lan-10000.json), [CSV](lan-10000.csv), and the [execution plan](../LAN-10000-EXECUTION-PLAN.md) are deterministic generated views. CSV cells with formula-leading text receive a protective apostrophe; JSON retains the authored values.',
    'Run `node scripts/lan-backlog.mjs --check` to verify them; `--ready` reports local dependency-ready TODO requirements and grants no execution authority.',
    'All five requirements of a capability must be accepted before it is counted done. Provider/operator gates remain explicit; accepted prerequisites do not grant access.', '',
  ]
  const sections = new Map()
  for (const family of families) {
    const section = [`## ${family.familyId} — ${markdown(family.familyName)}`, '', `${family.priority} · ${family.phase} · ${family.gate}`, '']
    for (const item of catalog.items.filter(value => value.familyId === family.familyId)) {
      section.push(`- [${item.status === 'done' ? 'x' : ' '}] **${item.id} — ${markdown(item.capabilityTitle)} / ${laneNames[item.lane]}**`, `  - Acceptance: ${markdown(item.acceptance)}`, `  - Direct prerequisites: ${item.dependsOn.length ? `${item.dependsOn.length} requirement(s); exact IDs are in JSON/CSV, with full prerequisite closure required.` : 'none'}`)
      if (item.completion) section.push(`  - Verified ${item.completion.verifiedOn} · source \`${item.completion.sourceRevision}\` · [receipt](../../${item.completion.evidence}) · reviewer \`agent.0\``)
    }
    section.push('')
    sections.set(family.familyId, section)
  }
  const combinedMarkdown = [...intro, ...[...sections.values()].flat()].join('\n') + '\n'
  const split = Buffer.byteLength(combinedMarkdown) > maximumCombinedMarkdownBytes
  const familyViews = {}
  if (split) {
    intro.push('## Family checklists', '', 'The complete checklist exceeds 1 MiB and is split by family for readable public review. Each linked page retains every requirement and its acceptance text.', '', '| Family | Requirements | Checklist |', '| --- | --- | --- |')
    for (const family of families) {
      const items = catalog.items.filter(item => item.familyId === family.familyId)
      intro.push(`| ${family.familyId} — ${markdown(family.familyName)} | ${items[0].id}–${items.at(-1).id} | [${items.length} requirements](lan-10000/${family.familyId}.md) |`)
      const section = sections.get(family.familyId).map(line => line.replace(/\]\(\.\.\/\.\.\/docs\//g, '](../../../docs/'))
      familyViews[`docs/backlog/lan-10000/${family.familyId}.md`] = [`# ${family.familyId} — LAN delivery checklist`, '', `Source baseline \`${catalog.sourceBase}\`; created ${catalog.createdOn}.`, '', '[Catalog index](../LAN-10000-TODO.md) · [Execution plan](../../LAN-10000-EXECUTION-PLAN.md)', '', 'These are delivery requirements. A checkbox records reviewed acceptance, not provider or production authorization.', '', ...section].join('\n').trimEnd() + '\n'
    }
  }
  const headers = ['id', 'familyId', 'familyName', 'capabilityKey', 'capabilityTitle', 'lane', 'area', 'phase', 'priority', 'gate', 'status', 'title', 'acceptance', 'dependsOn', 'definitionSha256', 'source', 'completion']
  const csvText = [headers.map(csv).join(','), ...catalog.items.map(item => headers.map(key => csv(key === 'dependsOn' ? item.dependsOn.join(';') : key === 'completion' ? item.completion ? canonicalJson(item.completion) : '' : item[key])).join(','))].join('\n') + '\n'
  const plan = [
    '# SYSTEMX LAN delivery execution plan', '',
    `Planning source: \`${catalog.sourceBase}\`; created ${catalog.createdOn}.`, '',
    `The catalog contains ${catalog.familyCount} authored capability families, ${catalog.capabilityCount} capabilities and ${catalog.items.length} delivery requirements. Five lanes describe behavior, boundaries/refusal, recovery, feedback and evidence. They are acceptance requirements, not a claim that this many independent features ship today.`, '',
    `Current accepted status: ${stats.requirements.done}/${stats.requirements.total} requirements and ${stats.capabilities.done}/${stats.capabilities.total} capabilities. ${stats.capabilities.partial} capabilities have partial acceptance.`, '',
    '## Execution and ownership', '',
    'Agent 0 selects bounded work from the dependency-ready local queue, assigns one write owner and preserves the existing React/Vite/Firebase application and familiar LAN editor shell. Querying readiness never assigns or executes work. Existing work, reusable blank seeds, managed release fingerprints, and both checksummed research packages remain separate.', '',
    'Preserve the source ownership, Designer kernel, command journal, style engine, component, CMS, preview and extension sequencing in the [Webflow master plan](../.SYSTEMX/LAN/WEBFLOW-DEEP-RESEARCH-MASTER-PLAN.md). The [dated refresh](../.SYSTEMX/LAN/WEBFLOW-RESEARCH-2026-10-25.md) supplies current source distinctions. Family dependencies refine that plan without accepting unimplemented editor behavior.', '',
    '## Dependency and gate contract', '',
    '- A behavior requirement has a direct edge to the terminal evidence requirement of each explicitly named prerequisite capability, and to every capability evidence requirement in each prerequisite family. Each evidence node requires its own first four lanes, so the transitive closure still requires all five capability requirements and every prerequisite-family requirement. These compressed direct edges avoid duplicating the same prerequisite proof.',
    '- Boundary, recovery and feedback requirements depend on their own behavior. Evidence depends on its own first four lanes. The expanded dependency graph must be acyclic.',
    '- `--ready` defaults to local TODO requirements whose prerequisites are accepted. `--gate operator` or `--gate provider` inspects that queue without granting authorization.',
    '- A completion is reviewed by `agent.0`, binds the exact requirement definition digest and full source revision, and points to an existing contained public Markdown receipt. All prerequisites must already be accepted in the same validated progress ledger.',
    '- A public receipt contains proof and limitations plus a fenced `lan-completion-evidence` JSON block: `{"schemaVersion":1,"requirements":[{"id":"LAN-00001","definitionSha256":"64 lowercase hex","sourceRevision":"40 lowercase hex"}]}`. Each tuple must match its progress entry exactly. A filename or count alone proves nothing.',
    '- Definition SHA-256 covers authored family/capability semantics and the resolved requirement definition/dependencies. Status, completion receipts and generated artifacts are excluded; there is no self-referential output digest.', '',
    '## Commands', '',
    '```text', 'node scripts/lan-backlog.mjs --summary --json', 'node scripts/lan-backlog.mjs --ready --limit 20 --json', 'node scripts/lan-backlog.mjs --ready --gate provider --limit 5 --json', 'node scripts/lan-backlog.mjs --item LAN-00001 --json', 'node scripts/lan-backlog.mjs --write', 'node scripts/lan-backlog.mjs --check', '```', '',
    `The tool reads fixed public specification/progress paths and validated public receipt paths. It does not inspect private environment files, Git, live processes, provider state or credentials. Only \`--write\` writes generated views${split ? ' and the family checklists' : ''}; progress and source definitions are never rewritten by the CLI. JSON is compact and deterministic. Check mode bounds each artifact read to its exact expected byte size.`, '',
    '## Review and delivery boundaries', '',
    'Use temporary synthetic fixtures for risky workflow tests. Record observable behavior, refusal, recovery, operator feedback and verification evidence with each accepted capability. Preserve confirmation, token/host/origin, backup, secret rejection and source-write controls. Local HTTP health, provider publication, live acceptance and production authorization remain distinct.', '',
    'Before any later publication run `npm run ci:all`, `npm run deploy -- hosting --preflight`, and `npm run sync:system:check`. Production deployment needs explicit operator authorization. Run `npm run template:check` before copying this reusable template into a mirror.', '',
    '## Family sequence', '', '| Family | Area | Phase | Gate | Requirements | Checklist |', '| --- | --- | --- | --- | --- | --- |',
    ...families.map(family => { const items = catalog.items.filter(item => item.familyId === family.familyId); return `| ${family.familyId} — ${markdown(family.familyName)} | ${family.area} | ${family.phase} | ${family.gate} | ${items[0].id}–${items.at(-1).id} | [Review](backlog/${split ? `lan-10000/${family.familyId}.md` : 'LAN-10000-TODO.md'}) |` }), '',
  ].join('\n')
  return { json: canonicalJson(catalog) + '\n', markdown: split ? intro.join('\n') + '\n' : combinedMarkdown, csv: csvText, plan, familyViews }
}

export function parseArgs(args) {
  let mode = 'summary'
  let selected = false
  const result = { mode, json: false, limit: 20, gate: 'local' }
  const seen = new Set()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (seen.has(flag)) throw new Error(`Repeated option ${flag}.`)
    seen.add(flag)
    if (['--write', '--check', '--summary', '--ready', '--item'].includes(flag)) {
      if (selected) throw new Error('Choose exactly one mode.')
      selected = true; mode = flag.slice(2); result.mode = mode
      if (mode === 'item') { result.id = args[++index]; if (!/^LAN-\d{5}$/.test(result.id ?? '')) throw new Error('Item requires a LAN-00001-style ID.') }
    } else if (flag === '--json') result.json = true
    else if (flag === '--limit' || flag === '--gate') {
      const value = args[++index]
      if (flag === '--limit') { if (!/^(?:[1-9]|[1-9]\d|100)$/.test(value ?? '')) throw new Error('Limit must be an integer from 1 to 100.'); result.limit = Number(value) }
      else { if (!gates.includes(value)) throw new Error('Unknown gate.'); result.gate = value }
    } else throw new Error(`Unknown option ${flag}.`)
  }
  if ((seen.has('--limit') || seen.has('--gate')) && mode !== 'ready') throw new Error('--limit and --gate apply only to --ready.')
  return result
}

const contained = (base, path) => {
  const within = relative(base, path)
  return within !== '..' && !within.startsWith('../') && !within.startsWith('..\\') && !isAbsolute(within)
}

async function publicPath(publicRoot, path, { writing = false } = {}) {
  const base = await realpath(publicRoot)
  const target = resolve(publicRoot, path)
  if (writing) {
    const parent = await realpath(resolve(target, '..'))
    if (!contained(base, parent)) throw new Error(`Public output escapes the repository: ${path}.`)
    try { if ((await lstat(target)).isSymbolicLink()) throw new Error(`Public output must not be a symbolic link: ${path}.`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    return target
  }
  const actual = await realpath(target)
  if (!contained(base, actual) || relative(base, actual).split(sep).join('/') !== path) throw new Error(`Public input is not its fixed repository path: ${path}.`)
  return actual
}

async function readJson(path, maxBytes) {
  const info = await stat(path)
  if (!info.isFile() || info.size > maxBytes) throw new Error('Public JSON input exceeds its size bound or is not a file.')
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function runCli(args, { publicRoot = repositoryRoot, output = value => console.log(value), buildOptions } = {}) {
  const flags = parseArgs(args)
  const documents = await Promise.all(specificationFiles.map(async path => readJson(await publicPath(publicRoot, path), 4 * 1024 * 1024)))
  const progress = await readJson(await publicPath(publicRoot, progressFile), 12 * 1024 * 1024)
  const definition = buildCatalog(documents, buildOptions)
  await validateProgress(definition, progress, { publicRoot })
  const catalog = applyProgress(definition, progress)
  let result
  if (flags.mode === 'write' || flags.mode === 'check') {
    const artifacts = renderArtifacts(catalog)
    const views = [...Object.entries(artifactFiles).map(([key, path]) => [path, artifacts[key]]), ...Object.entries(artifacts.familyViews)]
    if (flags.mode === 'write' && Object.keys(artifacts.familyViews).length) await mkdir(resolve(publicRoot, 'docs/backlog/lan-10000'), { recursive: true })
    for (const [path, contents] of views) {
      if (flags.mode === 'write') await writeFile(await publicPath(publicRoot, path, { writing: true }), contents)
      else {
        const target = await publicPath(publicRoot, path)
        if ((await stat(target)).size !== Buffer.byteLength(contents) || await readFile(target, 'utf8') !== contents) throw new Error(`Generated artifact differs: ${path}. Review source/progress, then run --write.`)
      }
    }
    result = { mode: flags.mode, verified: true, ...summary(catalog) }
  } else if (flags.mode === 'ready') result = readyItems(catalog, flags)
  else if (flags.mode === 'item') {
    result = catalog.items.find(item => item.id === flags.id)
    if (!result) throw new Error(`Unknown item ${flags.id}.`)
  } else result = summary(catalog)
  output(flags.json ? JSON.stringify(result, null, 2) : flags.mode === 'summary' || flags.mode === 'write' || flags.mode === 'check'
    ? `${result.mode ?? 'summary'}: ${result.requirements.total} delivery requirements (${result.requirements.done} done, ${result.requirements.todo} TODO); ${result.capabilities.total} capabilities (${result.capabilities.done} fully accepted). No execution authority granted.`
    : flags.mode === 'ready' ? `${result.matches} ${result.gate} dependency-ready TODO requirement(s). No execution authority granted.\n${result.items.map(item => `${item.id} ${item.title}`).join('\n')}`
      : `${result.id} ${result.title}\n${result.status} · ${result.gate}\n${result.acceptance}\nDefinition SHA-256: ${result.definitionSha256}\nPrerequisites: ${result.dependsOn.join(', ') || 'none'}`)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli(process.argv.slice(2)).catch(error => { console.error(`LAN backlog failed: ${error.message}`); process.exitCode = 1 })
