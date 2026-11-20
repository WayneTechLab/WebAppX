import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { responseLimits } from '../Builder/transport-policy.mjs'

test('real LAN advertises retry semantics, returns full exports and acknowledges large local writes', { timeout: 25_000 }, async t => {
  const fixture = mkdtempSync(join(tmpdir(), 'webappx-representation-'))
  const source = fileURLToPath(new URL('../', import.meta.url))
  const lan = join(fixture, '.SYSTEMX', 'LAN')
  const excluded = new Set(['tests', 'Files', 'Temp', 'Backup', 'Research'])
  cpSync(source, lan, { recursive: true, filter: path => !excluded.has(basename(path)) })
  cpSync(join(source, '../../package.json'), join(fixture, 'package.json'))
  const files = join(lan, 'Files')
  mkdirSync(files, { recursive: true })
  const child = spawn(process.execPath, [join(lan, 'server.mjs')], {
    cwd: fixture,
    env: { ...process.env, SYSTEMX_LAN_TEST_MODE: 'true', SYSTEMX_STRICT_PORT: 'false', SYSTEMX_GOOGLE_FONTS_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const stopped = once(child, 'exit')
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    await stopped
    rmSync(fixture, { recursive: true, force: true })
  })
  const [line] = await once(createInterface({ input: child.stdout }), 'line', { signal: AbortSignal.timeout(7_000) })
  const origin = line.match(/^\[SYSTEMX LAN\] (http:\/\/127\.0\.0\.1:\d+)\/$/)?.[1]
  assert.ok(origin, 'Owned LAN fixture must announce its loopback address')
  const health = await fetch(origin + '/api/health')
  assert.equal(health.headers.get('x-systemx-retry'), 'read-only')
  assert.equal(health.headers.get('x-systemx-representation'), 'complete')
  assert.equal((await health.json()).status, 'online')
  const dashboard = await (await fetch(origin)).text()
  const downloadHref = dashboard.match(/href="([^"]+)">Export component registry</)?.[1]
  assert.ok(downloadHref)
  assert.equal(new URL(downloadHref, origin + '/__systemx/').pathname, '/__systemx/api/builder/components/export')
  assert.equal(new URL(downloadHref, origin + '/').pathname, '/api/builder/components/export')
  const token = dashboard.match(/name="systemx-session" content="([^"]+)"/)?.[1]
  assert.ok(token)
  const post = (path, body, headers = {}) => fetch(origin + path, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-systemx-session': token, ...headers },
    body: JSON.stringify(body),
  })

  const registryFile = join(files, 'component-registry.json')
  const registry = { schemaVersion: 1, components: [{ id: 'fixture', name: 'Fixture card' }] }
  writeFileSync(registryFile, JSON.stringify(registry))
  const exportPath = origin + '/api/builder/components/export'
  const complete = await fetch(exportPath)
  assert.equal(complete.headers.get('content-disposition'), 'attachment; filename="systemx-component-registry.json"')
  assert.equal(complete.headers.get('x-systemx-representation'), 'complete')
  assert.equal(await complete.text(), JSON.stringify(registry, null, 2) + '\n')
  registry.components[0].detail = 'x'.repeat(responseLimits.jsonBytes)
  writeFileSync(registryFile, JSON.stringify(registry))
  const refused = await fetch(exportPath)
  assert.equal(refused.status, 413)
  assert.equal(refused.headers.get('content-disposition'), null)
  assert.equal(refused.headers.get('x-systemx-representation'), 'refused')
  assert.equal((await refused.json()).code, 'TRANSPORT_RESPONSE_TOO_LARGE')

  const dataFile = join(files, 'local-data.json')
  const initialData = JSON.parse(readFileSync(dataFile, 'utf8'))
  initialData.users.push({ id: 'prior-fixture', notes: 'a'.repeat(responseLimits.legacyAcknowledgementBytes) })
  writeFileSync(dataFile, JSON.stringify(initialData))
  const record = { resource: 'users', record: { email: 'fixture@example.test' } }
  const saved = await post('/api/builder/record', record)
  assert.equal(saved.status, 200)
  assert.equal(saved.headers.get('x-systemx-retry'), 'reconcile-before-retry')
  assert.equal(saved.headers.get('x-systemx-representation'), 'acknowledgement')
  assert.deepEqual(await saved.json(), { status: 'saved-local-record', acknowledgement: true, detailOmitted: true })
  const after = JSON.parse(readFileSync(dataFile, 'utf8'))
  assert.equal(after.users.filter(user => user.email === record.record.email).length, 1)

  for (const [key, expected] of [[randomUUID(), 'idempotent-keyed'], ['invalid-key', 'reconcile-before-retry']]) {
    const response = await post('/api/builder/record', {}, { 'Idempotency-Key': key })
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('x-systemx-retry'), expected)
    await response.text()
  }
  for (const [path, expected] of [['/api/contracts/query', 'read-only'], ['/api/contracts/command', 'fresh-proposal']]) {
    const refusal = await post(path, {})
    assert.equal(refusal.headers.get('x-systemx-retry'), expected)
    assert.equal((await refusal.json()).ok, false)
  }
})
