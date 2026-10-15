#!/usr/bin/env node
/** Build and exercise a disposable adoption. Never transforms a real app. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, readdir, symlink, rm } from 'node:fs/promises'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { build, preview } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { chromium, expect } from '@playwright/test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OVERRIDES = join(ROOT, 'tests/adoption/hr-disabled-overrides')
const OVERRIDE_PATHS = new Set(['src/router.tsx', 'src/pages/TemplatePortalsPage.tsx', 'src/portals/registry.ts',
  'src/portals/workspaces.ts', 'src/portals/PortalWorkspaceProvider.tsx', 'src/portals/combined-backup.ts'])
const exec = promisify(execFile)
const ownedCommands = new Set()
function ownedCommand(command, args, options) {
  const result = exec(command, args, options)
  const child = result.child
  ownedCommands.add(child)
  const closed = new Promise(done => child.once('close', () => { ownedCommands.delete(child); done() }))
  return { result, child, closed }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const allowed = path => path === 'index.html' || path === 'package.json' || path === 'tsconfig.json'
  || path.startsWith('src/') || path.startsWith('public/')
const forbiddenModule = id => /(?:\/src\/hr\/|\/integrations\/gusto\/|\/@gusto\/)/i.test(id.replaceAll('\\', '/'))

function gitEnvironment() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')))
  return { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_NO_LAZY_FETCH: '1' }
}
async function git(args, binary = false, signal) {
  const running = ownedCommand('git', ['-c', 'protocol.allow=never', '-C', ROOT, ...args], {
    env: gitEnvironment(), encoding: binary ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15000, signal,
  })
  try { return (await running.result).stdout }
  finally { await running.closed }
}
async function captured(revision, path, signal) { return git(['show', `${revision}:${path}`], true, signal) }

async function copyCapturedSource(fixture, revision, signal) {
  const tree = await git(['ls-tree', '-r', '-z', revision, '--', 'src', 'public', 'index.html', 'package.json', 'tsconfig.json'], false, signal)
  const files = []
  for (const row of tree.split('\0').filter(Boolean)) {
    signal?.throwIfAborted()
    const match = /^(100644|100755) blob ([a-f0-9]+)\t(.+)$/.exec(row)
    assert.ok(match, 'Public source must contain regular Git blobs, never links or submodules')
    const path = match[3]
    assert.ok(allowed(path) && !path.split('/').some(part => part === '..' || part.startsWith('.env')), 'Source path is outside the public app allowlist')
    const bytes = await captured(revision, path, signal)
    await mkdir(dirname(join(fixture, path)), { recursive: true })
    await writeFile(join(fixture, path), bytes)
    files.push({ path, sha256: hash(bytes) })
  }
  assert.ok(files.some(file => file.path === 'src/main.tsx'))
  return files
}

async function applyOverrides(fixture, signal, directory = OVERRIDES, prefix = '') {
  const receipt = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    signal?.throwIfAborted()
    const relative = prefix + entry.name
    assert.ok(!entry.isSymbolicLink(), 'Override links are refused')
    if (entry.isDirectory()) receipt.push(...await applyOverrides(fixture, signal, join(directory, entry.name), `${relative}/`))
    else {
      assert.ok(entry.isFile() && OVERRIDE_PATHS.has(relative), 'Only the six reviewed app-source overrides are allowed')
      const bytes = await readFile(join(directory, entry.name))
      await mkdir(dirname(join(fixture, relative)), { recursive: true })
      await writeFile(join(fixture, relative), bytes)
      receipt.push({ path: relative, sha256: hash(bytes) })
    }
  }
  return receipt
}

async function freePort() {
  const socket = createServer()
  await new Promise((done, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', done) })
  const port = socket.address().port
  await new Promise(done => socket.close(done))
  return port === 55733 ? freePort() : port
}

async function downloadJson(page, button, directory, name) {
  const waiting = page.waitForEvent('download')
  await button.click()
  const download = await waiting
  const file = join(directory, name)
  await download.saveAs(file)
  assert.equal(await download.failure(), null)
  return JSON.parse(await readFile(file, 'utf8'))
}
const nav = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const open = (page, name) => nav(page).getByRole('link', { name, exact: true }).click()
const bundleRegion = page => page.getByRole('region', { name: 'Adopted bundle backup', exact: true })
const upload = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
async function slots(page) { return page.evaluate(() => Object.fromEntries(Object.entries(localStorage).sort(([a], [b]) => a.localeCompare(b)))) }

async function exerciseAdoption(context, origin, fixture, seed) {
  const legacyHr = JSON.stringify({ schemaVersion: 1, module: 'hr', data: seed.hr })
  const legacyHistory = JSON.stringify({ schemaVersion: 1, points: [{ id: 'legacy-hr-point', createdAt: '2026-10-15T12:00:00.000Z', kind: 'restore', modules: ['hr'], states: { hr: seed.hr } }] })
  await context.addInitScript(({ legacyHr, legacyHistory }) => {
    // Deliberate legacy fixtures in this owned browser only. Every application
    // access is recorded after seeding, proving the removed module is not read.
    if (sessionStorage.getItem('webappx.adoption.initialized') !== 'yes') {
      localStorage.setItem('webappx.demo.hr', legacyHr)
      localStorage.setItem('webappx.demo.restore-points', legacyHistory)
      sessionStorage.setItem('webappx.adoption.initialized', 'yes')
    }
    const original = Storage.prototype.getItem
    window.__adoptionReads = []
    Storage.prototype.getItem = function (key) { window.__adoptionReads.push(key); return original.call(this, key) }
  }, { legacyHr, legacyHistory })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = [], outbound = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue()
    outbound.push(route.request().url()); return route.abort()
  })
  await page.goto(`${origin}/portals`)
  await expect(page.getByRole('heading', { name: 'CMS and CRM adopted example', exact: true })).toBeVisible()
  await expect(page.locator('a[href^="/hr"], a[href^="/admin/hr"], a[href^="/employee"], a[href^="/manager/hr"], a[href^="/contractor"]')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Restore points', exact: true })).toHaveCount(0)
  const initial = await downloadJson(page, bundleRegion(page).getByRole('button', { name: 'Export adopted bundle', exact: true }), fixture, 'initial-adopted.json')
  assert.equal(initial.format, 'webappx-adopted-cms-crm-workspaces')
  assert.equal(initial.schemaVersion, 1)
  assert.deepEqual(Object.keys(initial.workspaces).sort(), ['cms', 'crm'])
  assert.deepEqual(initial.workspaces, { cms: seed.cms, crm: seed.crm }, 'Complete unmodified CMS and CRM defaults must match the committed named seed')
  const expected = structuredClone(initial.workspaces)
  await open(page, 'Content management')
  await page.locator('#edit-title').fill('Adopted fictional editorial release')
  await page.locator('#edit-slug').fill('adopted-fictional-editorial-release')
  await page.locator('#edit-body').fill('A complete fictional draft retained by the CMS-only adoption walkthrough.')
  await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
  Object.assign(expected.cms.entries.find(entry => entry.id === 'cms-article-001'), { title: 'Adopted fictional editorial release', slug: 'adopted-fictional-editorial-release', body: 'A complete fictional draft retained by the CMS-only adoption walkthrough.', revision: 2, status: 'draft', approval: null, feedback: '' })
  expected.cms.sequence = 1
  expected.cms.activity.push({ receipt: 'MOCK-CMS-0001', entryId: 'cms-article-001', revision: 2, actorId: 'cms-author', action: 'Saved draft revision; previous approval invalidated' })
  await page.reload()
  await expect(page.locator('#edit-title')).toHaveValue('Adopted fictional editorial release')
  const cms = await downloadJson(page, page.getByRole('region', { name: 'CMS workspace backup', exact: true }).getByRole('button', { name: 'Export workspace', exact: true }), fixture, 'cms.json')
  assert.equal(cms.format, 'webappx-mock-workspace'); assert.equal(cms.schemaVersion, 1); assert.equal(cms.module, 'cms')
  assert.deepEqual(cms.data, expected.cms, 'Individual CMS export includes the complete graph and draft receipt')
  await open(page, 'Customer relationships')
  await page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name: 'Leads', exact: true }).click()
  await page.getByLabel('Lead name', { exact: true }).fill('Adopted Fiction')
  await page.getByLabel('Lead email', { exact: true }).fill('adopted@fixture.invalid')
  await page.getByLabel('Lead company', { exact: true }).fill('Adopted Fictional Studio')
  await page.getByRole('button', { name: 'Create sample lead', exact: true }).click()
  expected.crm.leads.push({ id: 'lead-0001', name: 'Adopted Fiction', email: 'adopted@fixture.invalid', companyName: 'Adopted Fictional Studio', ownerId: 'crm-owner', status: 'new' })
  expected.crm.activity.unshift({ receipt: 'MOCK-CRM-0001', ownerId: 'crm-owner', action: 'create-lead', description: 'Created sample lead Adopted Fiction.' })
  expected.crm.sequence = 2
  await page.reload()
  await page.getByRole('navigation', { name: 'CRM pages', exact: true }).getByRole('button', { name: 'Leads', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Adopted Fiction', exact: true })).toBeVisible()
  const crm = await downloadJson(page, page.getByRole('region', { name: 'CRM workspace backup', exact: true }).getByRole('button', { name: 'Export workspace', exact: true }), fixture, 'crm.json')
  assert.equal(crm.format, 'webappx-mock-workspace'); assert.equal(crm.schemaVersion, 1); assert.equal(crm.module, 'crm')
  assert.deepEqual(crm.data, expected.crm, 'Individual CRM export includes the complete graph and new lead receipt')

  // Both unchanged individual import controls are exercised after actual Reset.
  for (const [module, backup, reset, title] of [['crm', crm, 'Reset CRM demo', 'Customer relationships'], ['cms', cms, 'Reset CMS samples', 'Content management']]) {
    await open(page, title)
    await page.getByRole('button', { name: reset, exact: true }).click()
    const region = page.getByRole('region', { name: `${module.toUpperCase()} workspace backup`, exact: true })
    await region.getByLabel(`${module.toUpperCase()} backup JSON file`, { exact: true }).setInputFiles(upload(`${module}.json`, backup))
    await region.getByRole('button', { name: `Replace ${module.toUpperCase()} workspace`, exact: true }).click()
    assert.deepEqual((await downloadJson(page, region.getByRole('button', { name: 'Export workspace', exact: true }), fixture, `${module}-restored.json`)).data, expected[module])
  }
  await open(page, 'Portal directory')
  const adopted = await downloadJson(page, bundleRegion(page).getByRole('button', { name: 'Export adopted bundle', exact: true }), fixture, 'adopted.json')
  assert.deepEqual(adopted.workspaces, expected)
  const beforeReject = await slots(page)
  for (const rejected of [
    { format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: adopted.exportedAt, workspaces: seed },
    JSON.parse(legacyHistory),
    { ...adopted, workspaces: { ...adopted.workspaces, hr: seed.hr } },
  ]) {
    await bundleRegion(page).getByLabel('Adopted bundle JSON file', { exact: true }).setInputFiles(upload('incompatible.json', rejected))
    await expect(bundleRegion(page).getByRole('alert')).toBeVisible()
    await expect(bundleRegion(page).getByRole('button', { name: 'Replace adopted workspaces', exact: true })).toHaveCount(0)
    assert.deepEqual(await slots(page), beforeReject, 'Rejected bundle/recovery/extra-module inputs must not write any browser slot')
  }
  // HR individual format is rejected by both retained individual controls.
  const hrBackup = { format: 'webappx-mock-workspace', schemaVersion: 1, module: 'hr', exportedAt: adopted.exportedAt, data: seed.hr }
  for (const [module, title] of [['cms', 'Content management'], ['crm', 'Customer relationships']]) {
    await open(page, title)
    const beforeHrReject = await slots(page)
    const region = page.getByRole('region', { name: `${module.toUpperCase()} workspace backup`, exact: true })
    await region.getByLabel(`${module.toUpperCase()} backup JSON file`, { exact: true }).setInputFiles(upload('old-hr.json', hrBackup))
    await expect(region.getByRole('alert')).toContainText('does not belong')
    assert.deepEqual(await slots(page), beforeHrReject)
    await page.getByRole('button', { name: module === 'cms' ? 'Reset CMS samples' : 'Reset CRM demo', exact: true }).click()
  }
  await open(page, 'Portal directory')
  await bundleRegion(page).getByLabel('Adopted bundle JSON file', { exact: true }).setInputFiles(upload('adopted.json', adopted))
  await bundleRegion(page).getByRole('button', { name: 'Replace adopted workspaces', exact: true }).click()
  await expect(bundleRegion(page).getByRole('status')).toContainText('restored and saved')
  await page.reload()
  assert.deepEqual((await downloadJson(page, bundleRegion(page).getByRole('button', { name: 'Export adopted bundle', exact: true }), fixture, 'adopted-restored.json')).workspaces, expected)
  const stored = await slots(page)
  assert.deepEqual(JSON.parse(stored['webappx.demo.cms']), { schemaVersion: 1, module: 'cms', data: expected.cms })
  assert.deepEqual(JSON.parse(stored['webappx.demo.crm']), { schemaVersion: 1, module: 'crm', data: expected.crm })
  assert.equal(stored['webappx.demo.hr'], legacyHr); assert.equal(stored['webappx.demo.restore-points'], legacyHistory)
  assert.equal((await page.evaluate(() => window.__adoptionReads)).some(key => ['webappx.demo.hr', 'webappx.demo.restore-points'].includes(key)), false)
  for (const path of ['/hr', '/hr/demo/admin', '/hr/demo/sdk', '/admin/hr', '/employee', '/manager/hr', '/contractor']) {
    await page.goto(origin + path)
    await expect(page.getByRole('heading', { name: 'Page unavailable in this adopted app', exact: true })).toBeVisible()
    await expect(page.locator('a[href^="/hr"], a[href^="/admin/hr"], a[href^="/employee"], a[href^="/manager/hr"], a[href^="/contractor"]')).toHaveCount(0)
    assert.equal((await page.evaluate(() => window.__adoptionReads)).some(key => ['webappx.demo.hr', 'webappx.demo.restore-points'].includes(key)), false)
  }
  assert.deepEqual(errors, []); assert.deepEqual(outbound, [])
  return ['CMS and CRM complete named defaults', 'CMS UI edit/save/reload/full individual export/import', 'CRM UI create/save/reload/full individual export/import', 'two-module adopted bundle UI export/restore/reload', 'legacy combined, HR imports, extra HR module and old recovery rejected before writes', 'old HR/recovery browser slots untouched and unread', 'removed HR entry routes unavailable', 'no browser errors or external requests']
}

export async function main(args = process.argv.slice(2)) {
  if (args.length) throw new Error('This rehearsal accepts no paths or transformation targets; it always owns and removes its temporary fixture.')
  let fixture, server, context
  let closing, closingContext, interrupted, forcedExit
  const cancellation = new AbortController()
  const checkpoint = () => cancellation.signal.throwIfAborted()
  const closeContext = () => context ? closingContext ??= context.close() : Promise.resolve()
  const cleanup = () => closing ??= (async () => {
    const failures = []
    try { await closeContext() } catch (error) { failures.push(error) }
    try { if (server) await new Promise((done, fail) => server.httpServer.close(error => error ? fail(error) : done())) } catch (error) { failures.push(error) }
    try { if (fixture) await rm(fixture, { recursive: true, force: true }) } catch (error) { failures.push(error) }
    if (failures.length) throw new Error('Owned rehearsal cleanup failed: ' + failures.map(error => error.message).join('; '))
  })()
  const stop = (reason, code) => {
    if (interrupted) return
    interrupted = new Error(reason)
    process.exitCode = code
    cancellation.abort(interrupted)
    // Do not remove the fixture while an in-flight copy/build/launch can still
    // use it. Cancellation/checkpoints first unwind the work into finally.
    void closeContext().catch(() => {})
    forcedExit = setTimeout(() => {
      console.error('Owned rehearsal cleanup exceeded its 8 second interruption bound.')
      for (const child of ownedCommands) child.kill('SIGKILL')
      // Append after Playwright's synchronous exit cleanup, which terminates
      // its owned Chromium process/group even with automatic signals disabled.
      // Node work cannot resume after this final synchronous fixture removal.
      process.once('exit', () => {
        try { if (fixture) rmSync(fixture, { recursive: true, force: true }) }
        catch (error) { console.error('Owned temporary fixture removal failed: ' + error.message) }
      })
      process.exit(code)
    }, 8000)
  }
  const onInterrupt = () => stop('HR-disabled rehearsal interrupted by SIGINT.', 130)
  const onTerminate = () => stop('HR-disabled rehearsal interrupted by SIGTERM.', 143)
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  const timer = setTimeout(() => stop('HR-disabled rehearsal exceeded its 180 second deadline.', 1), 180000)
  try {
    // Synchronous creation publishes ownership before the first signal delivery
    // opportunity; every later asynchronous acquisition has a stop checkpoint.
    fixture = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-hr-disabled-')))
    const revision = (await git(['rev-parse', '--verify', 'HEAD'], false, cancellation.signal)).trim()
    checkpoint()
    assert.match(revision, /^[a-f0-9]{40}$/)
    const sourceFiles = await copyCapturedSource(fixture, revision, cancellation.signal)
    checkpoint()
    const overrides = await applyOverrides(fixture, cancellation.signal)
    checkpoint()
    assert.equal(overrides.length, OVERRIDE_PATHS.size, 'Every reviewed override is required')
    await symlink(join(ROOT, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    checkpoint()
    const pkg = JSON.parse(await readFile(join(fixture, 'package.json'), 'utf8'))
    pkg.name = 'webappx-owned-cms-crm-adoption'; pkg.scripts = {}; delete pkg.dependencies['@gusto/embedded-react-sdk']
    await writeFile(join(fixture, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
    const tsconfig = JSON.parse(await readFile(join(fixture, 'tsconfig.json'), 'utf8'))
    tsconfig.include = ['src/main.tsx']; await writeFile(join(fixture, 'tsconfig.json'), JSON.stringify(tsconfig))
    checkpoint()
    const checking = ownedCommand(process.execPath, [join(ROOT, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', join(fixture, 'tsconfig.json')], { timeout: 30000, maxBuffer: 1024 * 1024, signal: cancellation.signal })
    // IPC is optional local test evidence; ordinary CLI output stays bounded JSON.
    process.send?.({ kind: 'webappx-owned-rehearsal-phase', phase: 'typecheck', fixture, childPid: checking.child.pid })
    try { await checking.result } finally { await checking.closed }
    checkpoint()
    const emitted = new Set()
    const configuration = { root: fixture, configFile: false, cacheDir: join(fixture, '.cache/vite'), plugins: [react(), tailwindcss(), { name: 'adopted-module-audit', generateBundle(_options, bundle) { for (const output of Object.values(bundle)) if (output.type === 'chunk') for (const id of Object.keys(output.modules)) emitted.add(id) } }], resolve: { alias: { '@': join(fixture, 'src') } }, build: { sourcemap: false, reportCompressedSize: false }, logLevel: 'error' }
    await build(configuration)
    checkpoint()
    assert.ok(emitted.size > 0)
    assert.deepEqual([...emitted].filter(forbiddenModule), [], 'Emitted build must exclude HR and Gusto runtime modules')
    for (const required of ['/src/cms/CmsDemo.tsx', '/src/crm/CrmDemo.tsx', '/src/portals/backup.ts']) assert.ok([...emitted].some(id => id.endsWith(required)), `Missing retained module ${required}`)
    const port = await freePort()
    checkpoint()
    server = await preview({ ...configuration, plugins: [], preview: { host: '127.0.0.1', port, strictPort: true, open: false } })
    checkpoint()
    const origin = `http://127.0.0.1:${port}`
    context = await chromium.launchPersistentContext(join(fixture, 'browser-profile'), { headless: true, viewport: { width: 1440, height: 1000 }, acceptDownloads: true, timeout: 20000, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
    checkpoint()
    process.send?.({ kind: 'webappx-owned-rehearsal-phase', phase: 'browser', fixture, origin })
    const seedBytes = await captured(revision, 'tests/browser/fixtures/portal-smoke-v1.json', cancellation.signal)
    assert.equal(hash(seedBytes), (await captured(revision, 'tests/browser/fixtures/portal-smoke-v1.sha256', cancellation.signal)).toString().trim())
    checkpoint()
    const checks = await exerciseAdoption(context, origin, fixture, JSON.parse(seedBytes).workspaces)
    checkpoint()
    const report = { kind: 'webappx-owned-hr-disabled-rehearsal', schemaVersion: 1, status: 'passed', sourceRevision: revision, sourceCapture: 'committed-public-app-allowlist', copiedFiles: sourceFiles.length, sourceManifestSha256: hash(JSON.stringify(sourceFiles)), overrides, emittedModuleCount: emitted.size, excludedRuntime: ['src/hr', 'integrations/gusto', '@gusto'], backupFormat: 'webappx-adopted-cms-crm-workspaces', backupVersion: 1, recoveryHistory: 'not-adopted-old-slots-unread-and-preserved', checks, scope: 'Owned temporary CMS/CRM adoption only; no provider, deployment or native Windows acceptance.' }
    console.log(JSON.stringify(report, null, 2))
    return report
  } finally {
    let cleanupFailed = false
    try { await cleanup() }
    catch (error) {
      cleanupFailed = true
      if (!interrupted) stop('Owned rehearsal cleanup failed.', 1)
      throw error
    }
    finally {
      clearTimeout(timer)
      // Keep the forced-exit bound alive if a cleanup operation rejected while
      // an owned browser/command may still hold process handles.
      if (!cleanupFailed) clearTimeout(forcedExit)
      process.removeListener('SIGINT', onInterrupt)
      process.removeListener('SIGTERM', onTerminate)
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main() } catch (error) { console.error(error.message); process.exitCode ||= 1 }
}
