#!/usr/bin/env node
/** Read the canonical backlog, compute dependency order, and render the host
 * execution plan. This never starts workers or changes checklist acceptance. */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summary, validate } from './webappx-backlog.mjs'

const catalogFile = new URL('../docs/backlog/webappx-1000-todo.json', import.meta.url)
const planFile = new URL('../docs/WEBAPPX-EXECUTION-PLAN.md', import.meta.url)
const priorityOrder = ['P1', 'P2', 'P3']
const phaseOrder = ['foundation', 'portal-maturity', 'production-readiness', 'extensions']
const idPattern = /^WX-\d{4}$/
const waves = [
  ['Foundation', ['setup', 'systemx']],
  ['Shared core', ['portal-shell', 'identity', 'security']],
  ['Recovery', ['mock-recovery']],
  ['Human resources', ['hr-onboarding', 'hr-payroll', 'hr-talent']],
  ['Content', ['cms-authoring', 'cms-publishing']],
  ['Customer relationships', ['crm-contacts', 'crm-sales']],
  ['Quality and design', ['quality', 'design']],
  ['Operations and delivery', ['operations', 'delivery']],
  ['Adoption', ['adoption']],
  ['Connected extensions', ['firebase', 'integrations']],
]

export function dependencyAnalysis(items, selected = items.map(item => item.id)) {
  const byId = new Map(items.map(item => [item.id, item]))
  if (byId.size !== items.length) throw new Error('Duplicate proposal IDs')
  const paths = new Map()
  const visiting = []
  const included = new Set()
  function visit(id) {
    const item = byId.get(id)
    if (!item) throw new Error(`Unknown proposal dependency or selection: ${id}`)
    const cycle = visiting.indexOf(id)
    if (cycle !== -1) throw new Error(`Dependency cycle: ${[...visiting.slice(cycle), id].join(' -> ')}`)
    included.add(id)
    if (paths.has(id)) return paths.get(id)
    visiting.push(id)
    const predecessors = item.dependsOn.map(visit)
    visiting.pop()
    const depth = Math.max(0, ...predecessors.map(parent => parent.depth))
    const tied = predecessors.filter(parent => parent.depth === depth)
    const count = tied.length ? tied.reduce((sum, parent) => sum + parent.count, 0n) : 1n
    const examples = tied.length ? tied.flatMap(parent => parent.examples.map(chain => [...chain, id]))
      .sort((left, right) => left.join().localeCompare(right.join())).slice(0, 10) : [[id]]
    const result = { depth: depth + 1, count, examples }
    paths.set(id, result)
    return result
  }
  for (const id of selected) visit(id)
  const nodes = items.filter(item => included.has(item.id))
  const selectedPaths = [...new Set(selected)].map(id => paths.get(id))
  const depth = Math.max(0, ...selectedPaths.map(path => path.depth))
  const tied = selectedPaths.filter(path => path.depth === depth)
  const count = tied.reduce((sum, path) => sum + path.count, 0n)
  const longestChains = tied.flatMap(path => path.examples).sort((a, b) => a.join().localeCompare(b.join())).slice(0, 10)
  return {
    nodes,
    edges: nodes.flatMap(item => item.dependsOn.map(dependency => ({ from: dependency, to: item.id }))),
    longestChain: longestChains[0] ?? [],
    longestChains: longestChains.slice(0, 10),
    longestChainCount: count.toString(),
    externalGates: nodes.filter(item => item.status !== 'done' && item.gate !== 'local').map(({ id, gate, acceptance }) => ({ id, gate, acceptance })),
  }
}

export function executionReport(catalog, { limit = 20, gate = 'local', priority = 'all' } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Limit must be an integer from 1 to 50')
  if (!['local', 'provider', 'operator', 'all'].includes(gate)) throw new Error('Unknown gate')
  if (!['P1', 'P2', 'P3', 'all'].includes(priority)) throw new Error('Unknown priority')
  const done = new Set(catalog.items.filter(item => item.status === 'done').map(item => item.id))
  const remaining = catalog.items.filter(item => item.status !== 'done')
  const graph = dependencyAnalysis(catalog.items)
  const ready = remaining.filter(item => item.dependsOn.every(id => done.has(id)))
    .filter(item => (gate === 'all' || item.gate === gate) && (priority === 'all' || item.priority === priority))
    .sort((left, right) => priorityOrder.indexOf(left.priority) - priorityOrder.indexOf(right.priority)
      || phaseOrder.indexOf(left.phase) - phaseOrder.indexOf(right.phase) || left.id.localeCompare(right.id))
  return {
    objective: 'Implement and verify all 1,000 WebAppX catalog items against their original acceptance criteria.',
    ...summary(catalog),
    remainingGates: Object.fromEntries(['local', 'provider', 'operator'].map(value => [value, remaining.filter(item => item.gate === value).length])),
    waves: waves.map(([name, areas]) => {
      const selected = catalog.items.filter(item => areas.includes(item.area))
      return { name, areas, total: selected.length, done: selected.filter(item => item.status === 'done').length, remaining: selected.filter(item => item.status !== 'done').length }
    }),
    dependencyGraph: { edges: graph.edges.length, longestChains: graph.longestChains, longestChainCount: graph.longestChainCount },
    dependencyWaiting: remaining.filter(item => !item.dependsOn.every(id => done.has(id))).map(item => ({ id: item.id, needs: item.dependsOn.filter(id => !done.has(id)) })),
    dependencyReady: ready.length,
    next: ready.slice(0, limit),
    readinessBoundary: 'Dependency-ready is a selection aid. Review source, original acceptance, write ownership and any provider/operator evidence before execution or completion.',
  }
}

export function renderGraph(analysis) {
  const nodeId = id => id.replace('-', '_')
  const lines = ['```mermaid', 'flowchart LR']
  for (const item of analysis.nodes) lines.push(`  ${nodeId(item.id)}["${item.id} · ${item.status} · ${item.gate}"]`)
  for (const edge of analysis.edges) lines.push(`  ${nodeId(edge.from)} --> ${nodeId(edge.to)}`)
  lines.push('```', '', `Longest selected chain (${analysis.longestChain.length} items): ${analysis.longestChain.join(' → ') || 'none'}.`, `Equal longest chains: ${analysis.longestChainCount}; showing at most ten examples.`, ...analysis.longestChains.map(chain => `- ${chain.join(' → ')}`), '', 'Unresolved nonlocal acceptance gates:')
  lines.push(...(analysis.externalGates.length ? analysis.externalGates.map(item => `- ${item.id}: ${item.gate} — ${item.acceptance}`) : ['- None in the selected dependency closure.']))
  return lines.join('\n') + '\n'
}

export function renderExecutionPlan(catalog) {
  const report = executionReport(catalog)
  const areas = [...new Set(catalog.items.map(item => item.area))]
  const lines = [
    '# WebAppX execution plan — complete the 1,000-item backlog', '',
    'The owner authorized completion of the full catalog on **2026-10-15**.',
    'Work is paused at the owner’s full-stop request on **2026-10-15**.',
    'The original objective remains completion of every remaining original',
    'acceptance criterion. This plan covers all 1,000 stable IDs; the canonical',
    '[catalog](backlog/webappx-1000-todo.json) owns status and evidence. The',
    '[checklist](backlog/WEBAPPX-1000-TODO.md) and CSV remain generated views.', '',
    'The separate [review index](BACKLOG-EVIDENCE.md) attaches scoped historical',
    'receipts with examined and observation revisions. It does not accept work',
    'or convert an earlier browser result into a current execution.', '',
    `Current verified progress: **${report.statuses.done} done / ${report.statuses.todo} remaining**.`,
    `Remaining priorities: **${Object.entries(report.remainingPriorities).map(([key, value]) => `${value} ${key}`).join(' · ')}**.`,
    `Remaining acceptance gates: **${Object.entries(report.remainingGates).map(([key, value]) => `${value} ${key}`).join(' · ')}**.`, '',
    '## Completion delta and accepted work', '',
    'Published baseline `317f47806b7f86dce00f15ee5ced7c0e0bae6116` records',
    '**134 done / 866 remaining**. The prior recruiting checkpoint had 122 done;',
    'the accepted payroll/setup delta added twelve original criteria.',
    `Delta from the 134-item published baseline: **${report.statuses.done - 134 >= 0 ? '+' : ''}${report.statuses.done - 134} verified completions**, with **${report.statuses.todo} remaining**.`, '',
    'Every checked batch below is computed from canonical completion records.',
    'The linked checklist contains the individual checked IDs and original criteria.',
    'An unchecked candidate has no completion metadata and is not included in the delta.', '',
    '| Accepted batch | Checked IDs | Source examined | Evidence |',
    '| --- | ---: | --- | --- |',
    ...[...catalog.items.filter(item => item.status === 'done').reduce((groups, item) => {
      const key = `${item.completion.sourceBase}:${item.completion.evidence}`
      const group = groups.get(key) ?? { completion: item.completion, ids: [] }
      group.ids.push(item.id); groups.set(key, group); return groups
    }, new Map()).values()].map(({ completion, ids }) => `| [x] ${completion.evidence.split('/').at(-1).replace('.md', '')} | ${ids.length} | \`${completion.sourceBase}\` | [Receipt](${completion.evidence.replace(/^docs\//, '')}) |`), '',
    '## CRM and adoption candidate checklist', '',
    ...['WX-0369', 'WX-0370', 'WX-0371', 'WX-0372', 'WX-0373', 'WX-0511', 'WX-0517', 'WX-0527', 'WX-0534', 'WX-0612', 'WX-0617', 'WX-0627', 'WX-0628', 'WX-0635', 'WX-0637', 'WX-0760', 'WX-0802', 'WX-0814', 'WX-0820', 'WX-0830', 'WX-0850', 'WX-0953'].map(id => catalog.items.find(item => item.id === id)).filter(Boolean).map(item => `- [${item.status === 'done' ? 'x' : ' '}] **${item.id}** — ${item.title}${item.status === 'done' ? ` ([accepted receipt](${item.completion.evidence.replace(/^docs\//, '')}))` : ' — final verification and Agent 0 acceptance pending.'}`), '',
    '## Paused foundation savepoint', '',
    'The [full-stop checkpoint](checkpoints/FULL-STOP-2026-10-15.md) preserves',
    'the 56-file unfinished source snapshot as an unapplied Git bundle at',
    '`2638fd7f5eaf5805e4bce0e3515f57b20db1c997`. No new item is accepted by',
    'that savepoint. Main retains the tested CRM application source.', '',
    ...['WX-0015', 'WX-0017', 'WX-0018', 'WX-0021', 'WX-0061', 'WX-0701', 'WX-0715'].map(id => catalog.items.find(item => item.id === id)).filter(Boolean).map(item => `- [${item.status === 'done' ? 'x' : ' '}] **${item.id}** — ${item.title}${item.status === 'done' ? ` ([accepted receipt](${item.completion.evidence.replace(/^docs\//, '')}))` : ' — paused; saved implementation is unaccepted.'}`), '',
    'WX-0715 still depends on WX-0061 and WX-0701. Integrated browser journeys,',
    'finite source bindings, full CI and Hosting preflight remain pending for',
    'the saved work. WX-0656 retains separate manual screen-reader evidence.',
    'Resume only after an explicit owner request; no automatic continuation runs.', '',
    '## Assigned implementation plans', '',
    'The [CRM merge contract](CRM-MERGE-CONTRACT.md) assigns duplicate reporting,',
    'same-owner contact/company preview, atomic graph updates and complete recovery',
    'for WX-0369–0373. The original prerequisite previews precede their apply criteria.', '',
    'The [adoption contract index](ADOPTION-CONTRACTS.md) covers seventeen original',
    'artifact criteria WX-0511, WX-0517, WX-0527, WX-0534, WX-0612, WX-0617,',
    'WX-0627, WX-0628, WX-0635, WX-0637, WX-0760, WX-0802, WX-0814, WX-0820,',
    'WX-0830, WX-0850 and WX-0953. A reviewed design',
    'does not establish adopted enforcement, operator execution or provider acceptance.', '',
    'The earlier payroll/setup wave has its own [payroll control contract](PAYROLL-CONTROL-CONTRACT.md),',
    '[setup implementation plan](SETUP-CONTRACTS-IMPLEMENTATION-PLAN.md) and',
    '[completed local QA receipt](PAYROLL-SETUP-QA-2026-10-15.md).',
    'An assignment or focused result does not check off an item. Canonical statuses',
    'and completion receipts remain the authority below.', '',
    '## Execution and acceptance', '',
    '1. Select dependency-ready work, starting with P1 foundations. Read the exact',
    '   acceptance and source before assigning disjoint implementation scopes.',
    '2. Implement complete vertical slices across data, UI, permissions, recovery',
    '   and documentation. Review existing implementation before adding a duplicate.',
    '3. Run meaningful focused tests and browser journeys for changed interactions.',
    '   Compare full records and preserved scope rather than only success messages.',
    '4. Agent 0 reviews evidence and dependencies, then records completion metadata',
    '   in JSON and regenerates the checklist, CSV and this execution plan.',
    '5. Publish integrated waves after full CI, Hosting preflight, host drift and',
    '   template/link checks. Update README/wiki and verify direct GitHub parity.',
    '6. Repeat until every original acceptance criterion is met. An empty ready',
    '   selection, generated plan, provider design or delegated result is not completion.', '',
    'Provider/operator labels require item-specific review: many request a local',
    'design, worksheet, disabled adapter or emulator contract that can be prepared',
    'now. Items requiring actual platform/provider proof stay unfinished until',
    'that evidence exists. Named environments, account access and consequential',
    'activation decisions are resolved when the concrete prepared item reaches',
    'its acceptance boundary. Source-only or mock evidence cannot establish them.', '',
    'Keep immutable managed releases, research inventories and reusable SYSTEMX',
    'context/plan/task/memory seeds intact. This host plan records WebAppX template',
    'work; an adopting app receives its own reviewed active records. Runtime state,',
    'credentials and machine paths remain outside public release files.', '',
    '## Complete coverage and sequencing', '',
    'The ranges below partition the canonical catalog exactly once. Each area',
    'includes P1/P2/P3 and all stated phases; dependencies take precedence over',
    'the area order. Shared contracts precede their consumers, and browser/error',
    'coverage ships with each slice rather than waiting for the quality area.', '',
    '| Workstream | Stable IDs | Done | Remaining |', '| --- | --- | ---: | ---: |',
  ]
  for (const area of areas) {
    const items = catalog.items.filter(item => item.area === area)
    lines.push(`| ${report.areas[area].label} | ${items[0].id}–${items.at(-1).id} | ${items.filter(item => item.status === 'done').length} | ${items.filter(item => item.status !== 'done').length} |`)
  }
  lines.push('', 'Domain waves (the dependency graph overrides this order):', '',
    '| Wave | Areas | Done | Remaining |', '| --- | --- | ---: | ---: |',
    ...report.waves.map(wave => `| ${wave.name} | ${wave.areas.join(', ')} | ${wave.done} | ${wave.remaining} |`), '',
    `The current graph has **${report.dependencyGraph.edges} edges**. Longest explicit chains:`, '',
    ...report.dependencyGraph.longestChains.map(chain => `- ${chain.join(' → ')}`), '',
    'Implementation stages:', '',
    '- **Foundations:** runtime/environment contracts, isolated mock startup, shared',
    '  portal navigation and save/error boundaries, recovery, test/report tooling.',
    '- **Portal maturity:** HR onboarding/payroll/benefits/time/talent; CMS models,',
    '  editing/review/publication; CRM contacts/leads/deals/service; shared recovery.',
    '- **Adoption readiness:** trusted identity, Firebase contracts/emulator evidence,',
    '  privacy/security, observability, CI/release controls and SYSTEMX adoption.',
    '- **Extensions:** optional provider adapters, locales, integrations and platform',
    '  rehearsals, each with its own exact acceptance and activation boundary.', '',
    '## Next dependency-ready local candidates', '',
    'This is computed from current canonical statuses. It does not dispatch agents',
    'or grant access, and current write ownership must be checked before selection.', '',
    '| ID | Priority / phase | Acceptance |', '| --- | --- | --- |')
  for (const item of report.next) lines.push(`| ${item.id} | ${item.priority} / ${item.phase} | ${item.acceptance.replaceAll('|', '\\|')} |`)
  lines.push('', '## Resume commands', '', '```bash', 'npm run backlog:plan', 'npm run backlog:ready',
    'npm run backlog:ready -- --gate all --priority P1 --limit 30',
    'npm run backlog:graph -- --id WX-0654 --id WX-0551', 'npm run backlog:plan:render', 'npm run backlog:plan:check',
    'npm run backlog:evidence -- --id WX-0717', 'npm run backlog:evidence:check',
    '```', '', 'The graph command includes the selected dependency closure, longest chain',
    'and unresolved provider/operator criteria. Reports only read local catalog',
    'files. The explicit render command writes this document; no command starts',
    'workers, applies ledger imports, changes checklist status or contacts providers.', '')
  return lines.join('\n')
}

export function parseExecutionArguments(args) {
  const options = { mode: 'summary', ids: [], limit: 20, gate: 'local', priority: 'all' }
  let modeSeen = false
  const seen = new Set()
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (['--summary', '--ready', '--graph', '--write', '--check'].includes(arg)) {
      if (modeSeen) throw new Error('Choose exactly one execution report mode')
      modeSeen = true; options.mode = arg.slice(2)
    } else if (['--id', '--limit', '--gate', '--priority'].includes(arg) && args[index + 1] && !args[index + 1].startsWith('--')) {
      if (arg !== '--id' && seen.has(arg)) throw new Error(`Repeated option: ${arg}`)
      seen.add(arg)
      const value = args[++index]
      if (arg === '--id') {
        if (!idPattern.test(value) || options.ids.includes(value)) throw new Error('Proposal IDs must be distinct WX-0001-style IDs')
        options.ids.push(value)
      } else if (arg === '--limit') {
        if (!/^\d+$/.test(value)) throw new Error('Limit must be an integer from 1 to 50')
        options.limit = Number(value)
      } else options[arg.slice(2)] = value
    } else throw new Error(`Unknown option or missing value: ${arg}`)
  }
  if (options.ids.length > 40) throw new Error('Select at most 40 proposals for one graph')
  if (options.ids.length && options.mode !== 'graph') throw new Error('--id requires --graph')
  if (['write', 'check'].includes(options.mode) && seen.size) throw new Error('Plan render/check does not accept query filters')
  return options
}

export async function main(args = process.argv.slice(2)) {
  const options = parseExecutionArguments(args)
  const catalog = await validate(JSON.parse(await readFile(catalogFile, 'utf8')))
  const report = executionReport(catalog, options)
  if (options.mode === 'graph') {
    const selected = options.ids.length ? options.ids : report.next.slice(0, 8).map(item => item.id)
    console.log(renderGraph(dependencyAnalysis(catalog.items, selected)))
  } else if (options.mode === 'write' || options.mode === 'check') {
    const content = renderExecutionPlan(catalog)
    if (options.mode === 'write') { await writeFile(planFile, content); console.log('Rendered full 1,000-item execution plan from canonical evidence/status.') }
    else if (await readFile(planFile, 'utf8') !== content) throw new Error('Execution plan is stale; run npm run backlog:plan:render')
    else console.log('Execution plan covers all 1,000 IDs with current counts and dependency-ready selections.')
  } else if (options.mode === 'ready') {
    // A bounded work selection should not expand into the full waiting graph.
    // The summary and graph modes retain that separate diagnostic context.
    const { objective, statuses, remainingPriorities, remainingGates, dependencyReady, next, readinessBoundary } = report
    console.log(JSON.stringify({ objective, filters: { gate: options.gate, priority: options.priority, limit: options.limit }, statuses, remainingPriorities, remainingGates, dependencyReady, next, readinessBoundary }, null, 2))
  } else console.log(JSON.stringify(report, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Execution report failed: ${error.message}`); process.exitCode = 1 })
}
