#!/usr/bin/env node
/** Validate and render the WebAppX proposal catalog without activating tasks. */
import { readFile, writeFile, realpath, stat } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const folder = resolve(root, 'docs/backlog')
const sourceFile = resolve(folder, 'webappx-1000-todo.json')
const markdownFile = resolve(folder, 'WEBAPPX-1000-TODO.md')
const csvFile = resolve(folder, 'webappx-1000-todo.csv')
const areas = [
  ['setup', 'Project setup and developer experience'],
  ['portal-shell', 'Shared portal architecture'],
  ['hr-onboarding', 'HR onboarding and directory'],
  ['hr-payroll', 'HR payroll, benefits and time'],
  ['hr-talent', 'HR talent and employee operations'],
  ['cms-authoring', 'CMS models and authoring'],
  ['cms-publishing', 'CMS review and publication'],
  ['crm-contacts', 'CRM leads and contacts'],
  ['crm-sales', 'CRM sales and service'],
  ['mock-recovery', 'Mock persistence, backup and recovery'],
  ['identity', 'Identity, membership and permissions'],
  ['firebase', 'Firebase data, functions and rules'],
  ['security', 'Security and privacy'],
  ['quality', 'Testing, quality and accessibility'],
  ['design', 'Design, responsiveness and interaction'],
  ['operations', 'Observability, support and operations'],
  ['delivery', 'CI, delivery and infrastructure'],
  ['systemx', 'SYSTEMX and agent workflows'],
  ['adoption', 'Documentation and adoption kits'],
  ['integrations', 'Optional integrations, extensibility and internationalization'],
]
const priorities = ['P1', 'P2', 'P3']
const phases = ['foundation', 'portal-maturity', 'production-readiness', 'extensions']
const gates = ['local', 'provider', 'operator']
const statuses = ['todo', 'done']
const itemKeys = ['id', 'area', 'priority', 'phase', 'status', 'title', 'acceptance', 'source', 'gate', 'dependsOn']
const completionKeys = ['verifiedOn', 'sourceBase', 'evidence', 'reviewedBy']
const exactKeys = (record, keys) => !!record && typeof record === 'object' && !Array.isArray(record)
  && Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key))
const clean = (value, min, max) => typeof value === 'string' && value === value.trim()
  && value.length >= min && value.length <= max && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
const idFor = number => `WX-${String(number).padStart(4, '0')}`
const normalized = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const validDay = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function validate(catalog) {
  const errors = []
  if (!exactKeys(catalog, ['schemaVersion', 'project', 'intent', 'createdOn', 'sourceCommit', 'items'])
    || catalog.schemaVersion !== 1 || catalog.project !== 'WebAppX' || catalog.intent !== 'proposed-backlog'
    || !validDay(catalog.createdOn) || typeof catalog.sourceCommit !== 'string' || !/^[0-9a-f]{40}$/.test(catalog.sourceCommit)
    || !Array.isArray(catalog.items) || catalog.items.length !== 1000) {
    throw new Error('The catalog must use schema 1, WebAppX proposal metadata, a source commit and exactly 1,000 items.')
  }
  const titles = new Set()
  const acceptance = new Set()
  const checkedSources = new Set()
  const checkedEvidence = new Set()
  const completedIds = new Set(catalog.items.filter(item => item?.status === 'done').map(item => item.id))
  const actualRoot = await realpath(root)
  for (const [index, item] of catalog.items.entries()) {
    const expectedId = idFor(index + 1)
    const expectedArea = areas[Math.floor(index / 50)][0]
    const requiredKeys = item?.status === 'done' ? [...itemKeys, 'completion'] : itemKeys
    if (!exactKeys(item, requiredKeys)) { errors.push(`${expectedId}: unexpected or missing fields; done items require completion metadata and todo items prohibit it`); continue }
    if (item.id !== expectedId || item.area !== expectedArea) errors.push(`${expectedId}: IDs must be ordered and each defined area must contain exactly 50 items`)
    if (!statuses.includes(item.status) || !priorities.includes(item.priority) || !phases.includes(item.phase) || !gates.includes(item.gate)) errors.push(`${expectedId}: invalid planning status, priority, phase or acceptance gate`)
    if (!clean(item.title, 18, 180) || !clean(item.acceptance, 30, 700)) errors.push(`${expectedId}: title and observable acceptance must be bounded single-line text`)
    for (const [value, seen, label] of [[item.title, titles, 'title'], [item.acceptance, acceptance, 'acceptance']]) {
      if (typeof value !== 'string') continue
      const key = normalized(value)
      if (seen.has(key)) errors.push(`${expectedId}: duplicate ${label}`)
      seen.add(key)
    }
    if (!Array.isArray(item.dependsOn) || new Set(item.dependsOn).size !== item.dependsOn.length
      || item.dependsOn.some(id => !/^WX-\d{4}$/.test(id) || id < 'WX-0001' || id >= expectedId)) errors.push(`${expectedId}: dependencies must be unique earlier catalog IDs`)
    if (!clean(item.source, 2, 240) || isAbsolute(item.source) || /[\\?#]/.test(item.source)
      || item.source.split('/').some(segment => segment === '..' || segment === '.')) {
      errors.push(`${expectedId}: source must be a repository-relative existing path`)
    } else if (!checkedSources.has(item.source)) {
      try {
        const source = await realpath(resolve(root, item.source))
        const fromRoot = relative(actualRoot, source)
        if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) throw new Error('Source escapes repository')
        checkedSources.add(item.source)
      } catch { errors.push(`${expectedId}: source does not resolve inside this repository: ${item.source}`) }
    }
    if (item.status === 'done') {
      if (Array.isArray(item.dependsOn) && item.dependsOn.some(id => !completedIds.has(id))) errors.push(`${expectedId}: done requires completed dependencies`)
      const completed = item.completion
      if (!exactKeys(completed, completionKeys) || !validDay(completed.verifiedOn)
        || typeof completed.sourceBase !== 'string' || !/^[0-9a-f]{40}$/.test(completed.sourceBase)
        || !['agent.0', 'user'].includes(completed.reviewedBy)) {
        errors.push(`${expectedId}: completion requires an actual verifiedOn date, 40-character sourceBase, evidence file and reviewedBy agent.0 or user`)
      } else if (!clean(completed.evidence, 2, 240) || isAbsolute(completed.evidence) || /[\\?#]/.test(completed.evidence)
        || completed.evidence.split('/').some(segment => segment === '..' || segment === '.')) {
        errors.push(`${expectedId}: completion evidence must be a repository-relative existing file`)
      } else if (!checkedEvidence.has(completed.evidence)) {
        try {
          const evidence = await realpath(resolve(root, completed.evidence))
          const fromRoot = relative(actualRoot, evidence)
          if (fromRoot.startsWith('..') || isAbsolute(fromRoot) || !(await stat(evidence)).isFile()) throw new Error('Evidence must be a file inside the repository')
          checkedEvidence.add(completed.evidence)
        } catch { errors.push(`${expectedId}: completion evidence does not resolve to a file inside this repository: ${completed.evidence}`) }
      }
    }
  }
  if (errors.length) throw new Error(errors.slice(0, 35).join('\n') + (errors.length > 35 ? `\n… ${errors.length - 35} more errors` : ''))
  return catalog
}

const markdownText = value => value.replace(/([\\`*_\[\]<>])/g, '\\$1')
const csvText = value => `"${String(value).replaceAll('"', '""')}"`
export function summary(catalog) {
  return {
    total: catalog.items.length,
    statuses: Object.fromEntries(statuses.map(value => [value, catalog.items.filter(item => item.status === value).length])),
    priorities: Object.fromEntries(priorities.map(value => [value, catalog.items.filter(item => item.priority === value).length])),
    remainingPriorities: Object.fromEntries(priorities.map(value => [value, catalog.items.filter(item => item.priority === value && item.status === 'todo').length])),
    phases: Object.fromEntries(phases.map(value => [value, catalog.items.filter(item => item.phase === value).length])),
    gates: Object.fromEntries(gates.map(value => [value, catalog.items.filter(item => item.gate === value).length])),
    areas: Object.fromEntries(areas.map(([key, label]) => [key, { label, count: catalog.items.filter(item => item.area === key).length }])),
  }
}
export function render(catalog) {
  const stats = summary(catalog)
  const lines = [
    '# WebAppX — 1,000-item improvement catalog', '',
    `Planning baseline: \`${catalog.sourceCommit}\`. Created ${catalog.createdOn}.`, '',
    'The owner authorized execution of the full catalog on 2026-10-15. Unchecked',
    'items await implementation and acceptance. Checked items require completion metadata and a review',
    'receipt within their acceptance gate; a check does not establish deployment or',
    'provider access. Existing portal capabilities remain documented in source and',
    'their scoped QA receipts.', '',
    'The canonical catalog is [webappx-1000-todo.json](webappx-1000-todo.json).',
    'The [CSV](webappx-1000-todo.csv) and this page are generated with',
    '`npm run backlog:render`; run `npm run backlog:check` to validate all 1,000',
    'IDs, source paths, unique titles/acceptance, dependencies, completion records',
    'and generated views.',
    'Read the [execution plan](../WEBAPPX-EXECUTION-PLAN.md) for the full goal,',
    'dependency-ready selection and acceptance boundaries, and the',
    '[roadmap](../WEBAPPX-ROADMAP.md) for catalog conventions.', '',
    '## Reading the list', '',
    '- **P1**: first candidates to review; **P2**: subsequent maturity work; **P3**: optional expansion.',
    '- **foundation**, **portal-maturity**, **production-readiness**, **extensions** are planning phases.',
    '- **local** checks use synthetic/local evidence. **provider** checks need a separately approved optional provider environment. **operator** checks need a separately approved infrastructure or operational setup.',
    '- Dependencies link earlier proposals. They do not activate tasks or override acceptance gates.',
    '- A `done` item records its verification date, reviewed source base, existing evidence file and reviewer. Read that evidence for its actual scope; metadata does not grant provider access.',
    '- Reusable `.SYSTEMX` task, context, plan and memory seeds stay blank. Promote a bounded proposal into an adopted project’s canonical task ledger when execution is authorized.', '',
    '## Counts', '',
    `**${stats.total} catalog items · ${stats.statuses.todo} TODO · ${stats.statuses.done} done · ${areas.length} areas · 50 items per area.**`, '',
    `Priorities: ${priorities.map(key => `${key}: ${stats.priorities[key]}`).join(' · ')}.`, '',
    `Remaining TODO priorities: ${priorities.map(key => `${key}: ${stats.remainingPriorities[key]}`).join(' · ')}.`, '',
    `Acceptance gates: ${gates.map(key => `${key}: ${stats.gates[key]}`).join(' · ')}.`, '',
    '| Area | IDs | Count |', '| --- | --- | ---: |',
    ...areas.map(([key, label], index) => `| [${label}](#${key}) | ${idFor(index * 50 + 1)}–${idFor((index + 1) * 50)} | 50 |`),
  ]
  for (const [key, label] of areas) {
    lines.push('', `<a id="${key}"></a>`, '', `## ${label}`, '')
    for (const item of catalog.items.filter(value => value.area === key)) {
      const dependencies = item.dependsOn.length ? ` · Depends on: ${item.dependsOn.join(', ')}` : ''
      lines.push(`- [${item.status === 'done' ? 'x' : ' '}] **${item.id} — ${markdownText(item.title)}**`,
        `  - ${item.priority} · ${item.phase} · ${item.gate}${dependencies}`,
        `  - Acceptance: ${markdownText(item.acceptance)}`,
        `  - Source: [${item.source}](../../${item.source.split('/').map(encodeURIComponent).join('/')})`)
      if (item.status === 'done') {
        const completed = item.completion
        lines.push(`  - Verified: ${completed.verifiedOn} · Source base: \`${completed.sourceBase}\` · Reviewed by: \`${completed.reviewedBy}\` · Evidence: [${completed.evidence}](../../${completed.evidence.split('/').map(encodeURIComponent).join('/')})`)
      }
    }
  }
  const headers = [...itemKeys, 'completion']
  const csv = [headers.map(csvText).join(','), ...catalog.items.map(item => headers.map(key => csvText(key === 'dependsOn' ? item[key].join(';') : key === 'completion' ? (item.completion ? JSON.stringify(item.completion) : '') : item[key])).join(','))].join('\n') + '\n'
  return { markdown: lines.join('\n') + '\n', csv }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: npm run backlog -- [--summary | --check | --write | --area AREA --priority P1 --status todo|done --limit 20 | --id WX-0001]')
    return
  }
  const flags = new Map()
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (flags.has(arg)) throw new Error(`Repeated option: ${arg}`)
    if (['--summary', '--check', '--write'].includes(arg)) flags.set(arg, true)
    else if (['--area', '--priority', '--status', '--limit', '--id'].includes(arg) && args[index + 1] && !args[index + 1].startsWith('--')) flags.set(arg, args[++index])
    else throw new Error(`Unknown option or missing value: ${arg}`)
  }
  const modes = ['--summary', '--check', '--write'].filter(key => flags.has(key))
  if (modes.length > 1 || (modes.length && flags.size > 1)) throw new Error('Choose one mode, or query with --area/--priority/--status/--limit/--id.')
  const catalog = await validate(JSON.parse(await readFile(sourceFile, 'utf8')))
  if (flags.has('--write') || flags.has('--check')) {
    const { markdown, csv } = render(catalog)
    if (flags.has('--write')) {
      await writeFile(markdownFile, markdown)
      await writeFile(csvFile, csv)
      console.log('Rendered exactly 1,000 catalog items with TODO/done status to Markdown and CSV.')
    } else {
      const [savedMarkdown, savedCsv] = await Promise.all([readFile(markdownFile, 'utf8'), readFile(csvFile, 'utf8')])
      if (savedMarkdown !== markdown || savedCsv !== csv) throw new Error('Generated backlog views differ. Edit the JSON catalog, then run npm run backlog:render.')
      console.log('Backlog verified: 1,000 ordered unique catalog items, 20 areas × 50, valid source paths/dependencies/completion records and exact Markdown/CSV views.')
    }
  } else if (!flags.size || flags.has('--summary')) console.log(JSON.stringify(summary(catalog), null, 2))
  else {
    if (flags.has('--area') && !areas.some(([key]) => key === flags.get('--area'))) throw new Error('Unknown area.')
    if (flags.has('--priority') && !priorities.includes(flags.get('--priority'))) throw new Error('Unknown priority.')
    if (flags.has('--status') && !statuses.includes(flags.get('--status'))) throw new Error('Unknown status; choose todo or done.')
    if (flags.has('--id') && !catalog.items.some(item => item.id === flags.get('--id'))) throw new Error('Unknown item ID.')
    const limitText = flags.get('--limit') ?? '20'
    if (!/^\d+$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 1000) throw new Error('Limit must be between 1 and 1,000.')
    const found = catalog.items.filter(item => (!flags.has('--area') || item.area === flags.get('--area'))
      && (!flags.has('--priority') || item.priority === flags.get('--priority')) && (!flags.has('--status') || item.status === flags.get('--status'))
      && (!flags.has('--id') || item.id === flags.get('--id')))
    console.log(JSON.stringify({ matches: found.length, items: found.slice(0, Number(limitText)) }, null, 2))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`WebAppX backlog failed: ${error.message}`); process.exitCode = 1 })
}
