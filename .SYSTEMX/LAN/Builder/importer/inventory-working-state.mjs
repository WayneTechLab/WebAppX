import { lstatSync, opendirSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

export const workLimits = Object.freeze({ directories: 512, directoryEntries: 32_000, fileReads: 1_600, bytesRead: 18_000_000, elapsedMs: 15_000, depth: 18, pendingPaths: 1_000 })
export const prunedNames = /^(?:node_modules|vendor|dist|build|coverage|target|out|generated|__pycache__|tmp|temp|cache|backups?)$/i
export function workBudget(elapsedMs = workLimits.elapsedMs) {
  if (!Number.isInteger(elapsedMs) || elapsedMs < 1 || elapsedMs > workLimits.elapsedMs) throw Object.assign(new Error(), { inventoryCode:'invalid-elapsed-budget' })
  const start = performance.now(), limits = { ...workLimits, elapsedMs }
  const spent = { directories:0, directoryEntries:0, fileReads:0, bytesRead:0 }
  function check() {
    if (performance.now() - start >= elapsedMs) throw Object.assign(new Error(), { inventoryCode:'elapsed-budget' })
  }
  function add(kind, n = 1) {
    check()
    if (spent[kind] + n > limits[kind]) throw Object.assign(new Error(), { inventoryCode:'filesystem-budget' })
    spent[kind] += n
  }
  return { add, check, remaining:()=>Math.max(1,Math.ceil(elapsedMs - (performance.now() - start))),
    report:()=>({ limits, spent:{ ...spent, elapsedMs:Math.ceil(performance.now()-start) } }) }
}

// Never open untracked source. Only enumerate the supported root/src scope,
// prune links and runtime directories, and consult Git ignore rules in batches.
export function untrackedSources({ root, index, eligible, safeDirectory, ignored, budget }) {
  const found = [], exclusions = { prunedDirectories:0, linkedEntries:0, ignoredUntracked:0, outsideScope:0 }
  let dirs = ['']
  for (let depth = 0; dirs.length; depth++) {
    if (depth > workLimits.depth) throw Object.assign(new Error(), { inventoryCode:'directory-depth-budget' })
    const pending = [], files = []
    for (const dir of dirs) {
      budget.add('directories')
      const disk = join(root,dir)
      const stat = lstatSync(disk)
      if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(disk) !== disk) { exclusions.linkedEntries++; continue }
      const handle = opendirSync(disk)
      try {
        let entry
        while ((entry = handle.readSync())) {
          budget.add('directoryEntries')
          const path = dir ? dir + '/' + entry.name : entry.name
          if (entry.isSymbolicLink()) { exclusions.linkedEntries++; continue }
          if (entry.isDirectory()) {
            if ((!dir && path !== 'src') || prunedNames.test(entry.name) || !safeDirectory(path)) exclusions.prunedDirectories++
            else pending.push(path)
          } else if (!index.has(path) && eligible(path) && entry.isFile()) {
            const file = lstatSync(join(disk,entry.name))
            if (file.isFile() && file.nlink === 1) files.push(path)
            else exclusions.linkedEntries++
          }
          else if (!index.has(path)) exclusions.outsideScope++
          if (files.length + found.length + pending.length > workLimits.pendingPaths) throw Object.assign(new Error(), { inventoryCode:'untracked-path-budget' })
        }
      } finally { handle.closeSync() }
    }
    const candidates = [...pending,...files]
    const ignoredPaths = candidates.length ? ignored(candidates) : new Set()
    exclusions.ignoredUntracked += ignoredPaths.size
    dirs = pending.filter(path => !ignoredPaths.has(path)).sort()
    found.push(...files.filter(path => !ignoredPaths.has(path)))
  }
  return { paths:found.sort(), exclusions }
}

export function stagedSources(raw, eligible) {
  const input = raw.split('\0')
  if (input.pop() !== '' || input.length % 2) throw Object.assign(new Error(), { inventoryCode:'invalid-staged-records' })
  const statuses = { A:'added', M:'modified', D:'deleted', T:'type-changed' }
  const result = []
  for (let i=0; i<input.length; i+=2) {
    const path=input[i+1], status=statuses[input[i]]
    if (!eligible(path)) continue
    if (!status) throw Object.assign(new Error(), { inventoryCode:'unsupported-staged-change' })
    result.push({ path,status })
  }
  return result.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
}
