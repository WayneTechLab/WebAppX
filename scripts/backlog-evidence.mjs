#!/usr/bin/env node
/** Index scoped, revision-bound review references without accepting proposals. */
import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const indexFile = resolve(root, 'docs/backlog/webappx-evidence-index.json')
const catalogFile = resolve(root, 'docs/backlog/webappx-1000-todo.json')
const categories = ['local', 'browser', 'provider', 'operator']
const reviewKeys = ['reviewId', 'proposalId', 'examinedRevision', 'reviewedOn', 'scope', 'evidence', 'limitations']
const evidenceKeys = ['category', 'reference', 'observedOn', 'observationRevision', 'revisionBasis', 'scope']
const exactKeys = (value, keys) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const clean = (value, min, max) => typeof value === 'string' && value === value.trim()
  && value.length >= min && value.length <= max && !/[\x00-\x1f\x7f]/.test(value)
const revision = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const day = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
const contained = (base, file) => {
  const path = relative(base, file)
  return path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path)
}

export async function validateEvidenceIndex(index, catalog, { repositoryRoot = root } = {}) {
  if (!exactKeys(index, ['schemaVersion', 'project', 'intent', 'reviews']) || index.schemaVersion !== 1
    || index.project !== 'WebAppX' || index.intent !== 'scoped-feature-evidence'
    || !Array.isArray(index.reviews) || index.reviews.length > 1000) {
    throw new Error('Expected schema 1 WebAppX scoped-feature-evidence metadata and at most 1,000 reviews.')
  }
  if (!Array.isArray(catalog?.items) || catalog.items.some(item => typeof item?.id !== 'string')) {
    throw new Error('The canonical proposal catalog must supply item IDs.')
  }
  const ids = new Set(catalog.items.map(item => item.id))
  const reviewIds = new Set()
  const references = new Set()
  const actualRoot = await realpath(repositoryRoot)
  for (const [position, review] of index.reviews.entries()) {
    const label = `Review ${position + 1}`
    if (!exactKeys(review, reviewKeys)) throw new Error(`${label}: unexpected or missing fields; status and completion fields are prohibited.`)
    if (typeof review.reviewId !== 'string' || !/^WXR-\d{4}$/.test(review.reviewId) || reviewIds.has(review.reviewId)) {
      throw new Error(`${label}: reviewId must be a unique WXR-0001-style identifier.`)
    }
    reviewIds.add(review.reviewId)
    if (typeof review.proposalId !== 'string' || !/^WX-\d{4}$/.test(review.proposalId) || !ids.has(review.proposalId)) {
      throw new Error(`${label}: unknown proposal ID.`)
    }
    if (!revision(review.examinedRevision) || !day(review.reviewedOn)) throw new Error(`${label}: examinedRevision needs a full lowercase 40-character SHA and reviewedOn an actual calendar date.`)
    if (!clean(review.scope, 12, 700) || !clean(review.limitations, 12, 1000)) throw new Error(`${label}: scope and limitations must be bounded single-line text.`)
    if (!Array.isArray(review.evidence) || review.evidence.length < 1 || review.evidence.length > 8) throw new Error(`${label}: attach between one and eight scoped evidence references.`)
    const seen = new Set()
    for (const evidence of review.evidence) {
      if (!exactKeys(evidence, evidenceKeys)) throw new Error(`${label}: unexpected or missing evidence fields; status and completion fields are prohibited.`)
      if (!categories.includes(evidence.category)) throw new Error(`${label}: unknown evidence category.`)
      if (!day(evidence.observedOn) || evidence.observedOn > review.reviewedOn || !revision(evidence.observationRevision)) {
        throw new Error(`${label}: evidence needs a full observationRevision and an actual observedOn date no later than reviewedOn.`)
      }
      if (!['examined-source', 'receipt-source-base'].includes(evidence.revisionBasis)
        || (evidence.revisionBasis === 'examined-source' && evidence.observationRevision !== review.examinedRevision)) {
        throw new Error(`${label}: revisionBasis must describe the recorded source base or match the examined source.`)
      }
      if (!clean(evidence.scope, 12, 700)) throw new Error(`${label}: evidence scope must be bounded single-line text.`)
      const ref = evidence.reference
      if (!clean(ref, 2, 240) || isAbsolute(ref) || /[\\:%?#]/.test(ref)
        || ref.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
        throw new Error(`${label}: evidence reference must be a repository-relative file without URLs, queries or traversal.`)
      }
      const key = `${evidence.category}\0${ref}\0${evidence.observationRevision}`
      if (seen.has(key)) throw new Error(`${label}: duplicate scoped evidence reference.`)
      seen.add(key)
      if (!references.has(ref)) {
        try {
          const file = await realpath(resolve(repositoryRoot, ref))
          if (!contained(actualRoot, file) || !(await stat(file)).isFile()) throw new Error('Not a contained file')
        } catch { throw new Error(`${label}: evidence does not resolve to an existing file inside this repository: ${ref}`) }
        references.add(ref)
      }
    }
  }
  return index
}

export function evidenceSummary(index) {
  const evidence = index.reviews.flatMap(review => review.evidence)
  return {
    reviews: index.reviews.length,
    proposals: new Set(index.reviews.map(review => review.proposalId)).size,
    references: evidence.length,
    categories: Object.fromEntries(categories.map(category => [category, evidence.filter(item => item.category === category).length])),
  }
}

export function queryEvidence(index, { proposalId, category, limit = 20 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Limit must be between 1 and 100.')
  if (category !== undefined && !categories.includes(category)) throw new Error('Unknown evidence category.')
  const matches = index.reviews.filter(review => (!proposalId || review.proposalId === proposalId)
    && (!category || review.evidence.some(item => item.category === category)))
  return { matches: matches.length, reviews: matches.slice(0, limit).map(review => ({
    ...review, evidence: review.evidence.filter(item => !category || item.category === category),
  })) }
}

const markdownText = value => value.replace(/([\\`*_\[\]<>#!|])/g, '\\$1')
const pathSegment = value => encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
export function renderEvidence(index) {
  const lines = ['# WebAppX scoped feature evidence', '',
    'This index attaches historical review references to proposals. It does not',
    'determine current completion, accept prerequisites or grant provider/operator authority.', '',
    'An observation revision qualified as `receipt-source-base` is the source base',
    'named by that receipt; it does not identify an exact final browser build.', '',
    'Read [the evidence guide](../BACKLOG-EVIDENCE.md) for the record contract.', '']
  for (const review of index.reviews) {
    lines.push(`## ${review.reviewId} · ${review.proposalId}`, '',
      `Reviewed ${review.reviewedOn}; examined revision \`${review.examinedRevision}\`.`, '',
      `Scope: ${markdownText(review.scope)}`, '', `Limitations: ${markdownText(review.limitations)}`, '')
    for (const evidence of review.evidence) {
      const target = `../../${evidence.reference.split('/').map(pathSegment).join('/')}`
      lines.push(`- **${evidence.category}** · observed ${evidence.observedOn} · revision \`${evidence.observationRevision}\` (${evidence.revisionBasis}).`,
        `  [${markdownText(evidence.reference)}](${target}): ${markdownText(evidence.scope)}`)
    }
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/backlog-evidence.mjs [--check | --summary | --markdown | --id WX-0717 --category browser --limit 20]')
    return
  }
  const flags = new Map()
  for (let position = 0; position < args.length; position += 1) {
    const flag = args[position]
    if (flags.has(flag)) throw new Error(`Repeated option: ${flag}`)
    if (['--check', '--summary', '--markdown'].includes(flag)) flags.set(flag, true)
    else if (['--id', '--category', '--limit'].includes(flag) && args[position + 1] && !args[position + 1].startsWith('--')) flags.set(flag, args[++position])
    else throw new Error(`Unknown option or missing value: ${flag}`)
  }
  if (['--check', '--summary', '--markdown'].some(flag => flags.has(flag)) && flags.size !== 1) throw new Error('Choose one output mode, or query by --id/--category/--limit.')
  const [rawIndex, rawCatalog] = await Promise.all([readFile(indexFile, 'utf8'), readFile(catalogFile, 'utf8')])
  if (Buffer.byteLength(rawIndex) > 1024 * 1024) throw new Error('Evidence index exceeds the 1 MiB bound.')
  const catalog = JSON.parse(rawCatalog)
  const index = await validateEvidenceIndex(JSON.parse(rawIndex), catalog)
  if (flags.has('--check')) {
    console.log(`Evidence index verified: ${JSON.stringify(evidenceSummary(index))}. References are scoped records, not current acceptance.`)
  } else if (flags.has('--markdown')) process.stdout.write(renderEvidence(index))
  else if (!flags.size || flags.has('--summary')) console.log(JSON.stringify(evidenceSummary(index), null, 2))
  else {
    const proposalId = flags.get('--id')
    if (proposalId && !catalog.items.some(item => item.id === proposalId)) throw new Error('Unknown proposal ID.')
    const limit = flags.get('--limit') ?? '20'
    if (!/^\d+$/.test(limit)) throw new Error('Limit must be an integer between 1 and 100.')
    console.log(JSON.stringify(queryEvidence(index, { proposalId, category: flags.get('--category'), limit: Number(limit) }), null, 2))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`WebAppX evidence index failed: ${error.message}`); process.exitCode = 1 })
}
