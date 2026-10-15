import { mkdir, writeFile } from 'node:fs/promises'
import { loadMockModel } from './model-loader.mjs'
import { dashboardTotals, seedFile, seedDigestFile, seedName, seedTimestamp, sha256 } from './seed-contract.mjs'

// Explicit maintainer command only. The smoke runner never imports this file.
if (process.argv.length !== 3 || process.argv[2] !== '--write') {
  throw new Error('To intentionally replace the reviewed synthetic seed, run node tests/browser/generate-seed.mjs --write and review the full fixture/digest diff.')
}
const { createDemoWorkspaces, isDemoWorkspaces } = await loadMockModel(new URL('../../src/portals/workspaces.ts', import.meta.url))
const workspaces = createDemoWorkspaces()
if (!isDemoWorkspaces(workspaces)) throw new Error('Canonical defaults do not pass the complete mock validators')
const text = JSON.stringify({ schemaVersion: 1, name: seedName, createdAt: seedTimestamp, dashboardTotals: dashboardTotals(workspaces), workspaces }, null, 2) + '\n'
await mkdir(new URL('./fixtures/', import.meta.url), { recursive: true })
await writeFile(seedFile, text)
await writeFile(seedDigestFile, `${sha256(text)}\n`)
console.log(`Wrote ${seedName}; review its full records, dashboard totals and SHA-256 digest before accepting the fixture update.`)
