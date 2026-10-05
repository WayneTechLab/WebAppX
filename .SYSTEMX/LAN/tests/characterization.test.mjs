import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { readFile } from 'node:fs/promises'
import { test, before, after } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { findAvailablePort } from '../Builder/runtime/port-utils.mjs'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDirectory, '../../..')
const serverFile = resolve(repoRoot, '.SYSTEMX/LAN/server.mjs')

let child
let baseUrl
let sessionToken
let childOutput = ''

async function getJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options)
  const body = await response.json()
  return { response, body }
}

function requestStatus(pathname, headers = {}) {
  return new Promise((resolveStatus, rejectStatus) => {
    const request = httpRequest(`${baseUrl}${pathname}`, { headers }, (response) => {
      response.resume()
      response.once('end', () => resolveStatus(response.statusCode))
    })
    request.once('error', rejectStatus)
    request.end()
  })
}

async function waitForHealth() {
  const deadline = Date.now() + 5000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // The child may still be binding its loopback socket.
    }

    await delay(50)
  }

  throw new Error(`SYSTEMX LAN test server did not start. Output: ${childOutput}`)
}

before(async () => {
  const port = await findAvailablePort(7400, 30)
  baseUrl = `http://127.0.0.1:${port}`

  child = spawn(process.execPath, [serverFile], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SYSTEMX_APP_PORT: '7410',
      SYSTEMX_LAN_PORT: String(port),
      SYSTEMX_STRICT_PORT: 'true',
      SYSTEMX_LAN_TEST_MODE: 'true',
      SYSTEMX_SESSION_ID: `characterization-${process.pid}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    childOutput += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    childOutput += chunk.toString()
  })

  await waitForHealth()

  const dashboard = await fetch(`${baseUrl}/`)
  const html = await dashboard.text()
  const tokenMatch = html.match(/meta name="systemx-session" content="([^"]+)"/)
  sessionToken = tokenMatch?.[1]

  assert.ok(sessionToken, `dashboard did not expose a session token: ${childOutput}`)
})

after(async () => {
  if (!child) return

  child.kill('SIGTERM')
  await new Promise((resolveExit) => {
    child.once('exit', resolveExit)
    setTimeout(resolveExit, 2000)
  })
})

test('loopback health and dashboard remain local-only', async () => {
  const { response, body } = await getJson('/api/health')

  assert.equal(response.status, 200)
  assert.deepEqual(
    {
      status: body.status,
      mode: body.mode,
      host: body.host,
    },
    {
      status: 'online',
      mode: 'local-only',
      host: '127.0.0.1',
    },
  )

  const dashboard = await fetch(`${baseUrl}/`)
  assert.equal(dashboard.status, 200)
  const dashboardHtml = await dashboard.text()
  assert.match(dashboardHtml, /SYSTEMX Local Control/)
  assert.match(dashboardHtml, /id="left-panel-visibility"/)
  assert.match(dashboardHtml, /id="right-panel-visibility"/)
  assert.match(dashboardHtml, /data-state="auto">Auto/)
})

test('host and origin guards reject non-local callers', async () => {
  const wrongHost = await requestStatus('/api/health', { host: 'external.example' })
  const wrongOrigin = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'https://external.example' },
  })

  assert.equal(wrongHost, 403)
  assert.equal(wrongOrigin.status, 403)
})

test('read models expose the current repository without cloud authority', async () => {
  const status = await getJson('/api/status')
  const installation = JSON.parse(await readFile(resolve(repoRoot, '.SYSTEMX/INSTALLATION.json'), 'utf8'))
  const tasks = JSON.parse(await readFile(resolve(repoRoot, '.SYSTEMX/WORK/TASKS.json'), 'utf8'))
  const agents = JSON.parse(await readFile(resolve(repoRoot, '.SYSTEMX/AGENTS/REGISTRY.json'), 'utf8'))
  const projects = JSON.parse(await readFile(resolve(repoRoot, '.SYSTEMX/Projects/REGISTRY.json'), 'utf8'))
  assert.equal(status.body.operating.selectedVersion, installation.activeVersion)
  assert.equal(status.body.operating.pinnedVersion, status.body.operating.selectedVersion)
  assert.equal(status.body.operating.authority, 'records-only')
  assert.equal(status.body.operating.taskCount, tasks.tasks.length)
  assert.equal(status.body.operating.childProjectCount, projects.projects.length)
  assert.deepEqual(status.body.operating.agentRoles, agents.agents.map(({ id, role }) => ({ id, role })))
  const workspace = await getJson('/api/builder/workspace')
  const tools = await getJson('/api/tools')
  const auth = await getJson('/api/auth/providers')
  const fonts = await getJson('/api/fonts/catalog')
  const projectFont = await getJson('/api/fonts/project')

  assert.equal(status.response.status, 200)
  assert.equal(workspace.response.status, 200)
  assert.equal(tools.response.status, 200)
  assert.equal(auth.response.status, 200)
  assert.equal(fonts.response.status, 200)
  assert.equal(projectFont.response.status, 200)
  assert.equal(workspace.body.target, 'current-repo')
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  assert.equal(workspace.body.repository.branch, branch)
  assert.ok(Array.isArray(workspace.body.pages))
  assert.ok(Array.isArray(workspace.body.providers))
  assert.deepEqual(auth.body.localAllowedProviders, ['email-password'])
  assert.equal(auth.body.policy, 'disabled')
  assert.ok(auth.body.providers.some((provider) => provider.id === 'email-password'))
  assert.equal(auth.body.providers.find((provider) => provider.id === 'email-password')?.localState, 'enabled')
  assert.equal(auth.body.providers.find((provider) => provider.id === 'google')?.localState, 'disabled')
  assert.equal(auth.body.providers.find((provider) => provider.id === 'email-link')?.localState, 'disabled')
  assert.equal(auth.body.providers.find((provider) => provider.id === 'custom-token')?.localState, 'planned')
  assert.equal(auth.body.providers.find((provider) => provider.id === 'sso')?.localState, 'planned')
  assert.equal(status.body.providers.find((provider) => provider.name === 'Firebase Realtime Database')?.label, 'planned')
  assert.equal(status.body.providers.find((provider) => provider.name === 'Firebase SQL Connect / Cloud SQL PostgreSQL')?.label, 'planned')
  assert.doesNotMatch(JSON.stringify(auth.body), /AIza|sk_(?:live|test)_|PRIVATE KEY|password\s*[:=]/i)
  assert.deepEqual(workspace.body.auth.localAllowedProviders, ['email-password'])
  assert.equal(tools.body.environment, 'local-only')
  assert.ok(Array.isArray(fonts.body.items))
  assert.ok(fonts.body.items.some((font) => font.family === 'Inter'))
  assert.ok(fonts.body.items.every((font) => typeof font.cssUrl === 'string' && font.cssUrl.startsWith('https://fonts.googleapis.com/css2?')))
  assert.equal(projectFont.body.path, 'src/index.css')
  assert.doesNotMatch(JSON.stringify(fonts.body), /AIza|SYSTEMX_GOOGLE_FONTS_API_KEY/i)
})

test('mutating routes reject missing or incorrect session authority', async () => {
  const missing = await fetch(`${baseUrl}/api/builder/page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'create-page' }),
  })
  assert.equal(missing.status, 403)

  const incorrect = await fetch(`${baseUrl}/api/builder/page`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-systemx-session': 'not-the-session-token',
    },
    body: JSON.stringify({ operation: 'create-page' }),
  })
  assert.equal(incorrect.status, 403)
})

test('source writes fail closed for paths outside the allowlist', async () => {
  const response = await fetch(`${baseUrl}/api/builder/source`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-systemx-session': sessionToken,
    },
    body: JSON.stringify({
      path: 'package.json',
      content: '{}',
      confirmation: 'SAVE LOCAL CHANGE',
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.match(body.error, /allowlist/i)
})

test('source writes require confirmation and reject secret-shaped content', async () => {
  const missingConfirmation = await fetch(`${baseUrl}/api/builder/source`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-systemx-session': sessionToken,
    },
    body: JSON.stringify({
      path: 'src/router.tsx',
      content: 'unchanged',
    }),
  })
  assert.equal(missingConfirmation.status, 400)
  assert.match(await missingConfirmation.text(), /SAVE LOCAL CHANGE/)

  const secretContent = await fetch(`${baseUrl}/api/builder/source`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-systemx-session': sessionToken,
    },
    body: JSON.stringify({
      path: 'src/router.tsx',
      content: 'const key = "sk_live_characterization-only"',
      confirmation: 'SAVE LOCAL CHANGE',
    }),
  })
  assert.equal(secretContent.status, 400)
  assert.match(await secretContent.text(), /secret-shaped/i)
})

test('font writes remain session-authorized and confirmation-gated', async () => {
  const missingToken = await fetch(`${baseUrl}/api/builder/font`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ family: 'Inter', confirmation: 'SAVE FONT CHANGE' }),
  })
  assert.equal(missingToken.status, 403)

  const missingConfirmation = await fetch(`${baseUrl}/api/builder/font`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-systemx-session': sessionToken,
    },
    body: JSON.stringify({ family: 'Inter' }),
  })
  assert.equal(missingConfirmation.status, 400)
  assert.match(await missingConfirmation.text(), /SAVE FONT CHANGE/)

  const unknownFamily = await fetch(`${baseUrl}/api/builder/font`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-systemx-session': sessionToken,
    },
    body: JSON.stringify({ family: 'Not A Verified Font', confirmation: 'SAVE FONT CHANGE' }),
  })
  assert.equal(unknownFamily.status, 400)
  assert.match(await unknownFamily.text(), /verified.*catalog/i)
})

test('LAN does not expose runtime folders or arbitrary API commands', async () => {
  const runtimeFolder = await fetch(`${baseUrl}/Temp/operations.jsonl`)
  const arbitraryApi = await fetch(`${baseUrl}/api/exec?command=whoami`)

  assert.equal(runtimeFolder.status, 404)
  assert.equal(arbitraryApi.status, 404)
})

test('package metadata remains readable for the characterization harness', async () => {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'))
  const capabilityManifest = JSON.parse(await readFile(resolve(repoRoot, '.SYSTEMX/LAN/Builder/contracts/capability-manifest.json'), 'utf8'))
  assert.equal(packageJson.name, 'webappx')
  assert.equal(packageJson.scripts['dev:systemx'], 'node .SYSTEMX/LAN/dev-session.mjs')
  assert.equal(packageJson.scripts['docs:links'], 'node .SYSTEMX/scripts/validate-markdown-links.mjs')
  assert.equal(capabilityManifest.researchProgram.sourceCount, 200)
  assert.ok(capabilityManifest.supported.some((item) => item.id === 'lan.loopback-control'))
})
