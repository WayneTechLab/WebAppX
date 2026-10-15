#!/usr/bin/env node
/** Actual rendered controls against an owned temporary LAN fixture; no app/provider services. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect } from '@playwright/test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const temporary = mkdtempSync(join(tmpdir(), 'webappx-work-status-browser-'))
const fixture = join(temporary, 'fixture')
const evidence = join(temporary, 'evidence')
mkdirSync(evidence, { recursive: true })
const files = ['WORK/TASKS.json', 'WORK/FOCUS.json', 'AGENTS/REGISTRY.json']
const originalBytes = files.map((name) => readFileSync(join(repoRoot, '.SYSTEMX', name)))
const write = (path, value) => {
  mkdirSync(dirname(join(fixture, path)), { recursive: true })
  writeFileSync(join(fixture, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`)
}
const freePort = () => new Promise((resolvePort, reject) => {
  const socket = createServer()
  socket.once('error', reject)
  socket.listen(0, '127.0.0.1', () => {
    const port = socket.address().port
    socket.close((error) => error ? reject(error) : resolvePort(port))
  })
})
const installation = JSON.parse(readFileSync(join(repoRoot, '.SYSTEMX/INSTALLATION.json'), 'utf8'))
for (const directory of ['.SYSTEMX/LAN', 'src']) cpSync(join(repoRoot, directory), join(fixture, directory), {
  recursive: true,
  filter: (source) => !['Files', 'Temp', 'Backup', 'Research', 'tests'].some((name) => source === join(repoRoot, '.SYSTEMX/LAN', name)),
})
cpSync(join(repoRoot, 'package.json'), join(fixture, 'package.json'))
write('.SYSTEMX/INSTALLATION.json', installation)
write('.SYSTEMX/AGENTS/agent.0/MEMORY.md', 'Temporary browser fixture memory.')
for (const [index, name] of files.entries()) {
  write(`.SYSTEMX/${name}`, originalBytes[index].toString('utf8'))
  write(`.SYSTEMX/.systemx/releases/${installation.activeVersion}/${name}`, readFileSync(join(repoRoot, '.SYSTEMX/.systemx/releases', installation.activeVersion, name), 'utf8'))
}
const catalog = JSON.parse(readFileSync(join(repoRoot, 'docs/backlog/webappx-1000-todo.json'), 'utf8'))
write('docs/backlog/webappx-1000-todo.json', catalog)
const expectedDone = catalog.items.filter((item) => item.status === 'done').length
write('.SYSTEMX/Projects/REGISTRY.json', { schemaVersion: 1, projects: [{ name: 'Example App', path: 'Projects/Example App', records: 'Projects/Example App/.SYSTEMXP', kind: 'software' }] })
const childRoot = '.SYSTEMX/Projects/Example App/.SYSTEMXP'
write(`${childRoot}/project.json`, { schemaVersion: 1, project: { name: 'Example App', description: 'Isolated browser fixture' }, checks: [], commands: { dev: [], build: [], deploy: [] } })
write(`${childRoot}/AGENTS/REGISTRY.json`, JSON.parse(originalBytes[2]))
write(`${childRoot}/AGENTS/agent.0/MEMORY.md`, 'Temporary child fixture memory.')
const timestamp = '2026-10-15T12:00:00Z'
write(`${childRoot}/WORK/TASKS.json`, { schemaVersion: 1, tasks: [{
  id: 'TASK-001', title: 'Verify adopted browser fixture', owner: 'agent.0', status: 'todo', milestone: '', scope: [],
  acceptance: ['Rendered status reports the selected fixture task.'], dependsOn: [], nextAction: '', blocker: '', evidence: [], reviewedBy: '',
  createdAt: timestamp, updatedAt: timestamp, history: [{ at: timestamp, status: 'todo', owner: 'agent.0', note: '', evidence: [], reviewedBy: '' }],
}] })
write(`${childRoot}/WORK/FOCUS.json`, { schemaVersion: 1, objective: 'Review selected child fixture', taskIds: ['TASK-001'], checkpoint: '', updatedAt: timestamp })

const [port, appPort] = await Promise.all([freePort(), freePort()])
const origin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, [join(fixture, '.SYSTEMX/LAN/server.mjs')], {
  cwd: fixture, env: { ...process.env, SYSTEMX_LAN_PORT: String(port), SYSTEMX_APP_PORT: String(appPort), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverOutput = ''
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString() })
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString() })
let browser
let browserServer
const deadline = setTimeout(() => {
  server.kill('SIGTERM')
  void browserServer?.kill()
}, 90000)
deadline.unref()
const checks = []
try {
  let healthy = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { healthy = (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch { /* Wait for this owned child only. */ }
    if (healthy) break
    if (server.exitCode !== null) throw new Error(`Owned fixture server exited: ${serverOutput}`)
    await delay(50)
  }
  assert.ok(healthy, `Owned fixture server did not start: ${serverOutput}`)
  browserServer = await chromium.launchServer({ headless: true, timeout: 15000 })
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.setDefaultNavigationTimeout(20000)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${origin}/#agi`, { waitUntil: 'domcontentloaded' })
  const section = page.locator('.work-status-section')
  const cards = page.locator('.work-status-card')
  const select = page.getByLabel('Inspect recorded project work', { exact: true })
  await expect(section).toBeVisible()
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toContainText('Selected stock comparison: exact.')
  await expect(cards.nth(0)).toContainText('No work recorded.')
  await expect(cards.nth(1)).toContainText(`${catalog.items.length} catalog items`)
  await expect(cards.nth(1)).toContainText(`${expectedDone} recorded source completions`)
  await expect(cards.nth(2)).toContainText('No adopted scope selected.')
  await expect(select).toHaveValue('')
  await section.screenshot({ path: join(evidence, '01-seeds-roadmap-unselected.png') })
  checks.push('Three rendered source sections start with exact blank work seeds, computed catalog counts and no selected adopted scope.')

  await select.selectOption('root')
  await expect(cards.nth(2)).toContainText('Explicit scope: root records.')
  await expect(cards.nth(2)).toContainText('No work recorded.')
  checks.push('Explicit root selection reports no work recorded and retains completion and worker boundaries.')
  await select.selectOption('child:Example App')
  await expect(cards.nth(2)).toContainText('Explicit scope: Example App.')
  await expect(cards.nth(2)).toContainText('1 recorded task')
  await expect(cards.nth(2)).toContainText('Review selected child fixture')
  await section.screenshot({ path: join(evidence, '02-explicit-child.png') })
  checks.push('The exact registered child is selected through the real control and displays its independent task/focus facts.')

  // Hold one genuine root API response so the newer child selection finishes first.
  let releaseRoot
  let notifyRootRead
  const rootHeld = new Promise((resolveRead) => { notifyRootRead = resolveRead })
  const release = new Promise((resolveRelease) => { releaseRoot = resolveRelease })
  await page.route('**/api/status?workScope=root', async (route) => {
    const response = await route.fetch({ timeout: 15000 })
    notifyRootRead()
    await release
    await route.fulfill({ response })
  })
  await select.selectOption('root')
  await expect(page.locator('#work-status-view')).toContainText('Reading selected work sources…')
  await Promise.race([rootHeld, delay(15000).then(() => { throw new Error('Delayed root response was not observed') })])
  await select.selectOption('child:Example App')
  await expect(cards.nth(2)).toContainText('Explicit scope: Example App.')
  await expect(cards.nth(2)).toContainText('1 recorded task')
  const staleResponse = page.waitForResponse((response) => response.url().endsWith('/api/status?workScope=root'), { timeout: 15000 })
  releaseRoot()
  await staleResponse
  await page.waitForLoadState('networkidle')
  await expect(select).toHaveValue('child:Example App')
  await expect(cards.nth(2)).toContainText('Explicit scope: Example App.')
  await expect(cards.nth(2)).toContainText('1 recorded task')
  await page.unroute('**/api/status?workScope=root')
  checks.push('A delayed stale root response cannot replace the newer rendered child selection.')

  write(`${childRoot}/WORK/TASKS.json`, '{')
  await select.selectOption('root')
  await expect(cards.nth(2)).toContainText('No work recorded.')
  await select.selectOption('child:Example App')
  await expect(cards.nth(2)).toContainText('Task records unavailable.')
  await expect(cards.nth(2)).toContainText('unavailable')
  await cards.nth(2).getByText('Source digests and diagnostics', { exact: true }).click()
  await expect(cards.nth(2)).toContainText('invalid-json-or-text')
  await section.screenshot({ path: join(evidence, '03-child-unavailable.png') })
  checks.push('Malformed selected child records render unavailable with a diagnostic while explicit root remains readable.')

  await select.selectOption('')
  await expect(cards.nth(2)).toContainText('No adopted scope selected.')
  write('docs/backlog/webappx-1000-todo.json', '{')
  await select.selectOption('root')
  await expect(cards.nth(1)).toContainText('Roadmap counts unavailable.')
  await expect(cards.nth(0)).toContainText('No work recorded.')
  await section.screenshot({ path: join(evidence, '04-roadmap-unavailable.png') })
  checks.push('Malformed roadmap counts become unavailable independently of valid blank root records.')
  assert.deepEqual(pageErrors, [])
  for (const [index, name] of files.entries()) assert.deepEqual(readFileSync(join(repoRoot, '.SYSTEMX', name)), originalBytes[index])
  writeFileSync(join(evidence, 'result.json'), `${JSON.stringify({ schemaVersion: 1, kind: 'isolated-work-status-browser-evidence', checks, pageErrors, sourceRecordBytesPreserved: true }, null, 2)}\n`)
  console.log(JSON.stringify({ status: 'passed', checks: checks.length, evidence }, null, 2))
} finally {
  clearTimeout(deadline)
  if (browser) await Promise.race([browser.close(), delay(3000)])
  if (browserServer) {
    const closed = await Promise.race([browserServer.close().then(() => true), delay(3000).then(() => false)])
    if (!closed) await Promise.race([browserServer.kill(), delay(2000)])
  }
  const waitForExit = (timeout) => new Promise((resolveExit) => {
    if (server.exitCode !== null || server.signalCode !== null) { resolveExit(true); return }
    const listener = () => { clearTimeout(timer); resolveExit(true) }
    const timer = setTimeout(() => { server.off('exit', listener); resolveExit(false) }, timeout)
    server.once('exit', listener)
  })
  const exited = waitForExit(3000)
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM')
  if (!await exited) {
    const killed = waitForExit(2000)
    server.kill('SIGKILL')
    assert.ok(await killed, 'Owned fixture server did not exit after bounded termination')
  }
  rmSync(fixture, { recursive: true, force: true })
}
