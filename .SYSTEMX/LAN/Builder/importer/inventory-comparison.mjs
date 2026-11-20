import { createHash } from 'node:crypto'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0
const rowLimit = 256

// All collections in these projections are unordered, except for the steps in
// a shell usage trace. Source bytes are hashed separately from display order.
function canonical(value, field) {
  if (Array.isArray(value)) {
    const items = value.map(item => canonical(item))
    return field === 'trace' ? items : items.sort((a,b) => order(JSON.stringify(a),JSON.stringify(b)))
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k], k)]))
  return value
}

function resources(snapshot) {
  const values = new Map(), covered = new Set()
  function declaration(row) {
    // An unchanged declaration can share a source file with a changed one.
    // Track source-byte revisions once, separately from each declaration.
    const { sourceRevision, evidence, ...fields } = row
    return evidence ? { ...fields, declaredIn:evidence.path } : fields
  }
  function group(kind, rows, identify, project = declaration) {
    covered.add(kind)
    for (const row of rows) {
      const identity = identify(row)
      const key = JSON.stringify([kind, ...identity])
      const resource = values.get(key) ?? { kind, identity, revisions: [] }
      resource.revisions.push(hash(canonical(project(row))))
      values.set(key,resource)
    }
  }
  if (!snapshot) return { values, covered }
  group('source',snapshot.evidence,r=>[r.path],r=>r.sha256)
  group('entry-point',snapshot.entryPoints,r=>[r.source])
  group('route',snapshot.routes,r=>[r.pattern])
  if (snapshot.components) {
    group('component-export',snapshot.components.exports,r=>[r.source,r.name])
    group('shell-source',snapshot.components.shellSources,r=>[r.source,r.component])
  }
  if (snapshot.metadata) {
    for (const kind of ['public-asset','ownership-marker']) {
      group(kind,snapshot.metadata.resources.filter(r => r.kind === kind),r=>[r.path],r=>r)
    }
  }
  if (snapshot.configuration) {
    const c = snapshot.configuration
    group('dependency',c.dependencies,r=>[r.group,r.name])
    group('runtime-pin',c.runtimePins,r=>[r.evidence.path,r.field,r.tool])
    group('build-target',c.buildTargets,r=>[r.evidence.path,r.field])
    group('bridge',c.bridges,r=>[r.evidence.path,r.route])
    group('firebase',c.firebase,r=>[r.kind,r.service])
  }
  for (const value of values.values()) value.revision = hash(value.revisions.sort())
  return { values, covered }
}

export function compareInventories(previous, candidate) {
  const left = resources(previous), right = resources(candidate)
  const counts = { added:0, removed:0, changed:0, previouslyUncovered:0, unverified:0 }
  const differences = []
  const keys = [...new Set([...left.values.keys(), ...right.values.keys()])].sort(order)
  for (const key of keys) {
    const before = left.values.get(key), after = right.values.get(key)
    const row = after ?? before
    let change
    if (!before) change = previous && !left.covered.has(row.kind) ? 'previouslyUncovered' : 'added'
    else if (!after) change = candidate.complete && right.covered.has(row.kind) ? 'removed' : 'unverified'
    else if (after.revision !== before.revision) change = 'changed'
    else continue
    counts[change]++
    if (differences.length < rowLimit) differences.push({ change, kind:row.kind, identity:row.identity, before:before?.revision ?? null, after:after?.revision ?? null })
  }
  const sourceRevision = input => hash([...input.values.entries()].filter(([,r])=>r.kind==='source').sort(([a],[b])=>order(a,b)).map(([k,r])=>[k,r.revision]))
  return {
    baselineRevision: previous?.revision ?? null, candidateRevision:candidate.revision, candidateComplete:candidate.complete,
    baselineSourceRevision: previous ? sourceRevision(left) : null, candidateSourceRevision:sourceRevision(right),
    counts, differences, omitted: Object.values(counts).reduce((sum,n)=>sum+n,0) - differences.length,
  }
}
