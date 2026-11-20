import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomInt, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { findAvailablePort } from '../../.SYSTEMX/LAN/Builder/runtime/port-utils.mjs'

export async function startGraphCommandFixture(t, { capabilitySetting } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'lan-proposal-operator-'))
  const sourceLan = fileURLToPath(new URL('../../.SYSTEMX/LAN/', import.meta.url)), lan = join(root, '.SYSTEMX', 'LAN')
  let child, stopped
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill()
    if (stopped) await stopped
    await rm(root, { recursive: true, force: true })
  })
  await mkdir(lan, { recursive: true })
  for (const name of ['Builder', 'Website', 'Website_Dashboard.html', 'server.mjs', 'session-restart-preview.mjs', 'work-status.mjs']) {
    await cp(join(sourceLan, name), join(lan, name), { recursive: true })
  }
  const port = String(await findAvailablePort(randomInt(20000, 60000))), origin = 'http://127.0.0.1:' + port
  const env = { ...process.env }
  delete env.SYSTEMX_LAN_GRAPH_EDIT_CAPABILITIES
  if (capabilitySetting !== undefined) env.SYSTEMX_LAN_GRAPH_EDIT_CAPABILITIES = capabilitySetting
  child = spawn(process.execPath, [join(lan, 'server.mjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...env, PATH: dirname(process.execPath), SYSTEMX_STRICT_PORT: 'true', SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_LAN_PORT: port, SYSTEMX_APP_PORT: port, SYSTEMX_FIREBASE_AUTH_PORT: port,
      SYSTEMX_FIREBASE_FIRESTORE_PORT: port, SYSTEMX_FIREBASE_STORAGE_PORT: port } })
  stopped = once(child, 'close')
  const lines = createInterface({ input: child.stdout })
  const [banner] = await Promise.race([once(lines, 'line', { signal: AbortSignal.timeout(8000) }),
    stopped.then(() => { throw new Error('Disposable LAN stopped before readiness') })])
  lines.close()
  assert.equal(banner, '[SYSTEMX LAN] ' + origin + '/')
  const read = (path, options = {}) => fetch(origin + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) })
  const dashboard = await (await read('/')).text()
  const session = dashboard.match(/<meta name="systemx-session" content="([a-f0-9]{48})"/)?.[1]
  const status = JSON.parse(dashboard.match(/id="systemx-status-data">([^<]+)</)?.[1])
  assert.ok(session && status.repository.workspaceId)
  async function call(kind, operation, payload, expectedRevision = null) {
    const body = { apiVersion: '1.1', requestId: randomUUID(), kind, operation, payload: { type: operation, ...payload } }
    if (kind === 'command') Object.assign(body, { capabilityId: 'lan.' + operation + '@1', expectedRevision,
      confirmation: operation === 'graph.accept' ? 'ACCEPT GRAPH' : '' })
    const response = await read('/api/contracts/' + kind, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-systemx-session': session }, body: JSON.stringify(body) })
    const data = await response.json()
    assert.equal(data.ok, true, data.error?.code)
    return data.result
  }
  return { root, origin, status, session, read, call }
}
