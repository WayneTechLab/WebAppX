import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSuite } from './browser-smoke.mjs'
import { runPortalLifecycle } from '../tests/browser/portal-lifecycle.mjs'
import { runCrmMergeSuite } from '../tests/browser/crm-merge.mjs'

const sha256 = value => createHash('sha256').update(value).digest('hex')
async function files(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(path))
    else if (entry.isFile()) result.push(path)
  }
  return result.sort()
}

/** Keep the original journeys intact. Each suite retains its own source and
 * artifact receipt; this outer manifest binds the complete combined result. */
export async function runPortalLifecycleAndCrmMerges(options) {
  const legacyDir = join(options.artifactDir, 'legacy'), crmDir = join(options.artifactDir, 'crm-merge')
  await mkdir(legacyDir, { recursive: true }); await mkdir(crmDir, { recursive: true })
  const legacy = await runPortalLifecycle({ ...options, artifactDir: legacyDir })
  let crm
  try { crm = await runCrmMergeSuite({ ...options, artifactDir: crmDir }) }
  catch (error) { error.smokeEvidence = { ...error.smokeEvidence, completedLegacyPortalLifecycle: legacy }; throw error }
  const legacyBytes = await readFile(join(legacyDir, legacy.manifest.file))
  const crmBytes = await readFile(join(crmDir, crm.manifest.file))
  assert.equal(sha256(legacyBytes), legacy.manifest.sha256)
  assert.equal(sha256(crmBytes), crm.manifest.sha256)
  const previous = JSON.parse(legacyBytes), current = JSON.parse(crmBytes)
  assert.deepEqual(current.runtime, previous.runtime, 'Original and new browser journeys must examine exactly the same complete runtime bytes')
  const harness = { ...previous.harness }
  for (const [path, digest] of Object.entries(current.harness)) { if (Object.hasOwn(harness, path)) assert.equal(harness[path], digest); harness[path] = digest }
  const artifacts = {}
  for (const path of await files(options.artifactDir)) {
    const local = relative(options.artifactDir, path).split('\\').join('/')
    if (local.startsWith('vite-cache/') || ['report.json', 'portal-lifecycle-combined-manifest.json'].includes(local)) continue
    artifacts[local] = sha256(await readFile(path))
  }
  const manifest = { algorithm: 'sha256', hashMode: 'exact bytes; both suites prove runtime before/after equality; complete combined artifacts exclude only Vite cache and self-referential report/manifest', runtime: previous.runtime, harness, artifacts }
  const bytes = JSON.stringify(manifest, null, 2) + '\n'
  await writeFile(join(options.artifactDir, 'portal-lifecycle-combined-manifest.json'), bytes)
  return {
    ...legacy,
    checks: [...legacy.checks, ...crm.checks], warnings: [...new Set([...legacy.warnings, ...crm.warnings])],
    manifest: { file: 'portal-lifecycle-combined-manifest.json', sha256: sha256(bytes), runtimeFiles: Object.keys(manifest.runtime).length, harnessFiles: Object.keys(harness).length, artifacts: Object.keys(artifacts).length },
    legacyPortalLifecycle: { ...legacy, manifest: { ...legacy.manifest, file: `legacy/${legacy.manifest.file}` } },
    crmMerge: crm.crmMerge, crmMergeManifest: { ...crm.manifest, file: `crm-merge/${crm.manifest.file}` },
  }
}

export async function main(args = process.argv.slice(2)) {
  return runBrowserSuite({ args, suite: 'portal-lifecycle', runChecks: runPortalLifecycleAndCrmMerges })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
