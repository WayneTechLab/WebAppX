import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { isAllowedSmokeRequest, isAllowedSmokeWebSocket } from './portals-smoke.mjs'

const sessionPath = '/__gusto_mock__/__session'
const sessionHeader = 'X-Systemx-Gusto-Mock-Session'
const employee = '00000000-0000-4000-8000-000000000102'
const payroll = '00000000-0000-4000-8000-000000000301'

/** Finite selected-session inventory. These are mounted SDK/host meanings,
 * not the vendor's full export inventory or any real provider workflow. */
export const sdkStateInventory = Object.freeze({
  'session-starting': ['session', 'Starting an isolated synthetic SDK session…', 'button "Reset SDK samples" [disabled]'],
  'session-ready-directory': ['session', 'Isolated fictional records are ready.', 'tab "Active" [selected]'],
  'session-unavailable': ['session', 'The local mock session could not start.', 'button "Retry mock session"'],
  'session-invalid-response': ['session', 'The mock returned an invalid session.', 'button "Retry mock session"'],
  'session-retry-starting': ['session', 'Starting an isolated synthetic SDK session…', 'button "Reset SDK samples" [disabled]'],
  'session-retry-ready': ['session', 'Isolated fictional records are ready.', 'rowheader "Avery Example"'],
  'directory-onboarding': ['directory', 'Jordan Example', 'tab "Onboarding" [selected]'],
  'directory-dismissed': ['directory', 'Morgan Example', 'tab "Dismissed" [selected]'],
  'directory-unsupported-action': ['directory', 'Choose Employee onboarding for the supported synthetic workflow.', 'heading "Employees"'],
  'directory-completed-active': ['directory', 'Jordan Example', 'tab "Active" [selected]'],
  'onboarding-initial': ['onboarding data', 'Save each SDK data step and finish its summary to unlock this review.', 'heading "Basics"'],
  'onboarding-profile-validation': ['onboarding data', 'Please select valid start date', 'spinbutton "year, Start date" [invalid]'],
  'onboarding-after-profile': ['onboarding data', 'Compensation', 'textbox "Job Title"'],
  'onboarding-compensation-saved': ['onboarding data', 'Synthetic quality engineer', 'grid "List of all jobs for the employee"'],
  'onboarding-federal-tax': ['onboarding data', 'Federal tax withholdings (Form W-4)', 'button "Continue"'],
  'onboarding-state-tax': ['onboarding data', "No state income tax withholding is required for this employee's work state.", 'button "Continue"'],
  'onboarding-payment': ['onboarding data', 'Payment method', 'radio "Check" [checked]'],
  'onboarding-deductions': ['onboarding data', 'Deductions', 'button "Continue"'],
  'onboarding-sdk-summary': ['onboarding review', 'Missing requirements', 'button "Done"'],
  'onboarding-readiness-incomplete': ['onboarding review', 'Some SDK data steps remain incomplete.', 'checkbox "Simulate employee form review · no legal signature" [disabled]'],
  'onboarding-readiness-unverified': ['onboarding review', 'The mock onboarding readiness could not be verified.', 'button "Done"'],
  'onboarding-review-ready': ['onboarding review', 'SDK data steps verified.', 'checkbox "Simulate employee form review · no legal signature"'],
  'onboarding-form-reviewed': ['onboarding review', 'Simulate employee form review · no legal signature', 'checkbox "Simulate employee form review · no legal signature" [checked]'],
  'onboarding-report-reviewed': ['onboarding review', 'Simulate new-hire report review · no filing', 'checkbox "Simulate new-hire report review · no filing" [checked]'],
  'onboarding-review-refused': ['onboarding review', 'Save every required synthetic onboarding step before the mock review.', 'button "Complete simulated onboarding"'],
  'onboarding-completion-refused': ['onboarding review', 'Complete every required synthetic onboarding step before finishing.', 'button "Complete simulated onboarding"'],
  'onboarding-completion-unverified': ['onboarding review', 'The fictional completion status could not be verified.', 'button "Complete simulated onboarding"'],
  'onboarding-completed': ['onboarding completion', 'Synthetic onboarding receipt: completed.', 'checkbox "Simulate employee form review · no legal signature" [checked] [disabled]'],
  'sdk-event-log': ['events', 'company/employees', 'listitem: company/employees'],
  'payroll-preparing': ['payroll pending', 'Preparing payroll...', 'heading "Preparing payroll..."'],
  'payroll-initial': ['payroll', 'Edit Payroll', 'button "Calculate and review"'],
  'payroll-calculating': ['payroll pending', 'Calculating payroll...', 'heading "Calculating payroll..."'],
  'payroll-review': ['payroll', 'Review payroll', 'button "Submit"'],
  'payroll-hours': ['payroll review tabs', 'Hours worked', 'tab "Hours worked" [selected]'],
  'payroll-take-home': ['payroll review tabs', 'Employee take home', 'tab "Employee take home" [selected]'],
  'payroll-tax-debit': ['payroll review tabs', 'Taxed and debited', 'tab "Taxed and debited" [selected]'],
  'payroll-submitting': ['payroll pending', 'Submitting payroll...', 'heading "Submitting payroll..."'],
  'payroll-submitted': ['payroll', 'Simulated payroll processed.', 'alert "Payroll submitted"'],
  'payroll-receipt': ['payroll receipt', 'Synthetic test receipt only. No wages, taxes, bank transfer or Gusto submission occurred.', 'grid "Fictional debit breakdown (no transfer)"'],
  'payroll-receipt-tax': ['payroll receipt', 'Illustrative zero-tax breakdown', 'grid "Illustrative zero-tax breakdown"'],
  'payroll-receipt-employees': ['payroll receipt', 'Avery Example', 'grid "Employees"'],
  'reset-refused': ['reset', 'The mock reset failed. Refresh to start a new session.', 'button "Reset SDK samples"'],
  'reset-pending': ['reset', 'Reset SDK samples', 'button "Reset SDK samples" [disabled]'],
  'reset-success': ['reset', 'All SDK sample changes reset. No provider records were changed.', 'button "Reset SDK samples"'],
})

export function sdkInventoryCoverage(observations) {
  const expected = Object.keys(sdkStateInventory)
  return { expected: expected.length, observed: new Set(observations.map(item => item.state)).size,
    missing: expected.filter(state => !observations.some(item => item.state === state && item.text && item.shape && item.capture && item.labelCapture && item.witness?.uncovered === true && item.witness.samples > 0)),
    unknown: observations.map(item => item.state).filter(state => !Object.hasOwn(sdkStateInventory, state)) }
}

/** A failure exemption belongs to one intercepted Request object. Its resource
 * console message must independently match that request's complete URL once. */
export function createSdkFailureLedger() {
  const expected = [], requests = new Map(), cancellations = new Set()
  let responsesSeen = 0
  return {
    expected,
    get responsesSeen() { return responsesSeen },
    expect(request, status) {
      const url = new URL(request.url())
      const item = { method: request.method(), path: url.pathname + url.search, status, responseSeen: false, resourceErrorSeen: false, cancelled: false }
      expected.push(item); requests.set(request, item)
    },
    allowStrictModeCancellation(request) { cancellations.add(request) },
    response(request, status) {
      const item = requests.get(request)
      if (!item || item.status !== status || item.responseSeen || item.cancelled) return false
      item.responseSeen = true; responsesSeen += 1; return true
    },
    resourceError(message, location) {
      const status = /^Failed to load resource: the server responded with a status of (\d+)\b/.exec(message)?.[1]
      if (!status) return false
      const match = [...requests].find(([request, item]) => request.url() === location && item.status === Number(status) && !item.resourceErrorSeen && !item.cancelled)
      if (!match) return false
      match[1].resourceErrorSeen = true; return true
    },
    abort(request, reason) {
      if (reason !== 'net::ERR_ABORTED' || !cancellations.delete(request)) return false
      const item = requests.get(request)
      if (item) item.cancelled = true
      return true
    },
    reconciled() { return expected.every(item => item.cancelled || item.responseSeen && item.resourceErrorSeen) },
  }
}

/** This exception belongs only to the separate account-free SDK companion.
 * The native gate continues to refuse every SDK mock/backend request. */
export function isAllowedSdkQualityRequest(raw, origin) {
  try {
    const url = new URL(raw)
    if (url.username || url.password || url.hash || /[%\\\s]/.test(raw.split('?')[0]) || /\/\.{1,2}(?:\/|$)/.test(raw.split('?')[0])) return false
    if (url.pathname.startsWith('//')) return false
    if (url.pathname.startsWith('/__gusto_mock')) return url.origin === origin && /^\/__gusto_mock__\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(url.pathname)
    return isAllowedSmokeRequest(raw, origin)
  } catch { return false }
}

async function storage(context, origin) {
  const saved = await context.storageState()
  assert.deepEqual(saved.cookies, [], 'The account-free SDK must not create cookies')
  assert.ok(saved.origins.every(item => item.origin === origin))
  return Object.fromEntries((saved.origins.find(item => item.origin === origin)?.localStorage ?? []).map(item => [item.name, item.value]))
}

export async function runSdkQuality({ browser, origin, artifactDir }) {
  const checks = [], observations = [], problems = [], warnings = [], network = []
  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC', viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' })
  let page, sessionId, holdSessions = true
  const sessionWaiters = []
  const releaseSession = () => { holdSessions = false; for (const release of sessionWaiters.splice(0)) release() }
  let failSession = false, invalidSession = false, failReset = false, holdReset = false, releaseReset, nextApiFixture
  const failureLedger = createSdkFailureLedger(), expectedFailures = failureLedger.expected, requestFailures = [], heldApi = new Map()
  let firstMountSessionRequest = true
  function holdApiRequest(method, path) {
    const key = method + ' ' + origin + '/__gusto_mock__' + path
    let release
    const promise = new Promise(resolve => { release = resolve })
    heldApi.set(key, { promise, release })
    return () => { heldApi.delete(key); release() }
  }
  try {
    assert.deepEqual(await context.storageState(), { cookies: [], origins: [] })
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      if (!isAllowedSdkQualityRequest(request.url(), origin)) {
        problems.push(`Forbidden external/provider/backend request: ${url.origin}${url.pathname}`)
        return route.abort()
      }
      const headers = request.headers()
      if (Object.entries(headers).some(([key, value]) => /^(authorization|proxy-authorization|cookie|x-api-key|x-gusto-client-secret|x-gusto-access-token|x-gusto-refresh-token)$/i.test(key) && value)) {
        problems.push(`Credential-bearing request refused: ${url.pathname}`)
        return route.abort()
      }
      if (url.pathname.startsWith('/__gusto_mock__/')) {
        if (network.length >= 512) { problems.push('SDK mock request budget of 512 exceeded'); return route.abort() }
        network.push({ method: request.method(), path: url.pathname + url.search })
      }
      if (url.pathname === sessionPath && request.method() === 'POST') {
        if (invalidSession) return route.fulfill({ status: 201, contentType: 'application/json', body: '{"sessionId":"explicit-invalid-local-fixture"}' })
        if (failSession) {
          failureLedger.expect(request, 503)
          return route.fulfill({ status: 503, contentType: 'application/json', body: '{"errors":[{"message":"Explicit local browser fixture: session unavailable"}]}' })
        }
        if (holdSessions) await new Promise(resolve => { sessionWaiters.push(resolve) })
      }
      if (url.pathname === '/__gusto_mock__/__reset' && failReset) {
        failReset = false; failureLedger.expect(request, 503)
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"errors":[{"message":"Explicit local browser fixture: reset unavailable"}]}' })
      }
      if (url.pathname === '/__gusto_mock__/__reset' && holdReset) await new Promise(resolve => { releaseReset = resolve })
      if (nextApiFixture && nextApiFixture.path === url.pathname && nextApiFixture.method === request.method()) {
        const fixture = nextApiFixture; nextApiFixture = undefined
        if (fixture.status >= 400) {
          failureLedger.expect(request, fixture.status)
        }
        return route.fulfill({ status: fixture.status, contentType: 'application/json', body: fixture.body })
      }
      const held = heldApi.get(request.method() + ' ' + request.url())
      if (held) await held.promise
      return route.continue()
    })
    await context.routeWebSocket('**/*', socket => {
      if (isAllowedSmokeWebSocket(socket.url(), origin)) socket.connectToServer()
      else { problems.push(`Forbidden WebSocket: ${new URL(socket.url()).origin}`); socket.close() }
    })
    page = await context.newPage()
    page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(30000)
    page.on('request', request => {
      if (firstMountSessionRequest && request.method() === 'POST' && request.url() === origin + sessionPath) {
        failureLedger.allowStrictModeCancellation(request); firstMountSessionRequest = false
      }
    })
    page.on('pageerror', error => problems.push(`Page error: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error') {
        const location = message.location().url
        if (!failureLedger.resourceError(message.text(), location)) problems.push(`Console error: ${message.text()} (${location})`)
      }
      if (message.type() === 'warning') warnings.push(message.text())
    })
    page.on('response', async response => {
      const url = new URL(response.url())
      if (url.pathname === sessionPath && response.ok()) sessionId = (await response.json()).sessionId
      if (response.status() >= 400) {
        if (!failureLedger.response(response.request(), response.status())) problems.push(`HTTP ${response.status()}: ${url.pathname}`)
      }
    })
    page.on('requestfailed', request => {
      const expected = failureLedger.abort(request, request.failure()?.errorText)
      requestFailures.push({ method: request.method(), path: new URL(request.url()).pathname + new URL(request.url()).search, failure: request.failure()?.errorText, expectedStrictModeCancellation: expected })
      if (!expected) problems.push(`Request failed: ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`)
    })
    let initialStorage
    async function api(path) {
      assert.match(sessionId, /^[a-f0-9]{32}$/)
      return page.evaluate(async ({ path, sessionId, sessionHeader }) => {
        const response = await fetch('/__gusto_mock__' + path, { credentials: 'omit', headers: { [sessionHeader]: sessionId, 'X-Gusto-API-Version': '2026-06-15' } })
        if (!response.ok) throw new Error(`Local fixture read refused: ${response.status}`)
        return response.json()
      }, { path, sessionId, sessionHeader })
    }
    async function capture(name, mode = 'actual UI transition', scope) {
      await expect(page.getByRole('heading', { name: 'Gusto account-free testing', exact: true })).toBeVisible()
      const text = await page.locator('body').innerText()
      const aria = await page.locator('body').ariaSnapshot()
      const definition = sdkStateInventory[name]
      assert.ok(definition, `${name}: every capture must be inventoried`)
      const [family, expectedText, shape] = definition
      assert.ok(text.includes(expectedText), `${name}: actual visible text retains the status meaning: ${expectedText}`)
      assert.ok(aria.includes(shape), `${name}: actual accessible shape retains the status meaning: ${shape}`)
      const style = await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' })
      let witnessMeasurement
      try {
        await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).filter)).toBe('grayscale(1)')
        await (scope ?? page).screenshot({ path: join(artifactDir, `${name}-monochrome.png`), ...(scope ? {} : { fullPage: true }) })
        const candidates = page.getByText(expectedText, { exact: false })
        let witness
        for (let index = 0; index < await candidates.count(); index += 1) {
          if (await candidates.nth(index).isVisible()) { witness = candidates.nth(index); break }
        }
        assert.ok(witness, `${name}: a real visible DOM text witness is required`)
        await witness.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }))
        // A locator can be present/visible while a fixed header covers its
        // pixels. Center the real text, then hit-test every rendered text line
        // before the locator screenshot, whose auto-scroll is now unnecessary.
        await expect.poll(async () => witness.evaluate(element => {
          const box = element.getBoundingClientRect()
          return box.top >= 1 && box.bottom <= innerHeight - 1 && box.left >= 0 && box.right <= innerWidth
        })).toBe(true)
        witnessMeasurement = await witness.evaluate(element => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          const rects = []
          while (walker.nextNode()) {
            const node = walker.currentNode
            if (!node.textContent?.trim()) continue
            const range = document.createRange(); range.selectNodeContents(node)
            for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) rects.push(rect)
          }
          const occluded = []
          let samples = 0
          for (const rect of rects) {
            for (const x of [rect.left + Math.min(2, rect.width / 4), rect.left + rect.width / 2, rect.right - Math.min(2, rect.width / 4)]) {
              const y = rect.top + rect.height / 2, hit = document.elementFromPoint(x, y)
              samples += 1
              if (!hit || !element.contains(hit) && !(hit.contains(element) && getComputedStyle(element).pointerEvents === 'none')) occluded.push({ x, y, coveringTag: hit?.tagName ?? null, coveringRole: hit?.getAttribute('role') ?? null })
            }
          }
          const box = element.getBoundingClientRect()
          return { uncovered: samples > 0 && occluded.length === 0, textRects: rects.length, samples, occluded,
            bounds: { x: box.x, y: box.y, width: box.width, height: box.height }, scroll: { x: scrollX, y: scrollY } }
        })
        assert.ok(witnessMeasurement.uncovered, `${name}: every actual text-line sample must be uncovered: ${JSON.stringify(witnessMeasurement)}`)
        await witness.screenshot({ path: join(artifactDir, `${name}-label-monochrome.png`) })
      }
      finally { await style.evaluate(element => element.remove()) }
      await writeFile(join(artifactDir, `${name}.json`), JSON.stringify({ mode, text: text.slice(0, 20000), aria: aria.slice(0, 40000), textTruncated: text.length > 20000, ariaTruncated: aria.length > 40000, witness: witnessMeasurement }, null, 2) + '\n')
      await writeFile(join(artifactDir, 'last-state.txt'), text + '\n\n' + aria)
      assert.deepEqual(await storage(context, origin), initialStorage, `${name}: native raw slots and all localStorage bytes remain untouched`)
      observations.push({ family, state: name, mode, text: expectedText, shape, capture: `${name}-monochrome.png`, labelCapture: `${name}-label-monochrome.png`, evidence: `${name}.json`, witness: witnessMeasurement })
    }
    await page.goto(`${origin}/hr/demo/sdk`)
    await expect(page.getByRole('status').filter({ hasText: 'Starting an isolated synthetic SDK session…' })).toBeVisible()
    initialStorage = await storage(context, origin)
    assert.deepEqual(initialStorage, { 'sfwa-wtl:accessibility-preferences': '{"textScale":"default","lineSpacing":"default","letterSpacing":"default","contrast":"default","motion":"system"}' }, 'Only the app default accessibility preference may initialize; native workspace slots stay absent')
    await capture('session-starting', 'Actual UI while the local session response is deliberately held')
    releaseSession()
    await expect(page.getByRole('status').filter({ hasText: 'Isolated fictional records are ready.' })).toBeVisible()
    await expect(page.getByText('Avery Example', { exact: true })).toBeVisible()
    await capture('session-ready-directory')
    await page.getByRole('button', { name: 'Add employee', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Choose Employee onboarding for the supported synthetic workflow.' })).toBeVisible()
    await capture('directory-unsupported-action')
    await page.getByRole('tab', { name: 'Onboarding', exact: true }).click()
    await expect(page.getByText('Jordan Example', { exact: true })).toBeVisible()
    await capture('directory-onboarding')
    await page.getByRole('tab', { name: 'Dismissed', exact: true }).click()
    await expect(page.getByText('Morgan Example', { exact: true })).toBeVisible()
    await capture('directory-dismissed')
    await page.getByRole('button', { name: 'Employee onboarding', exact: true }).click()
    await expect(page.getByText('Save each SDK data step and finish its summary to unlock this review.', { exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Legal first name', exact: true })).toBeVisible()
    await capture('onboarding-initial')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText('Please select valid start date', { exact: true })).toBeVisible()
    await capture('onboarding-profile-validation')
    await page.getByRole('button', { name: 'Select work address... Work address', exact: true }).click()
    await page.getByRole('option').filter({ hasText: '100 Fictional Lane' }).click()
    await page.getByRole('spinbutton', { name: 'month, Start date', exact: true }).fill('10')
    await page.getByRole('spinbutton', { name: 'day, Start date', exact: true }).fill('15')
    await page.getByRole('spinbutton', { name: 'year, Start date', exact: true }).fill('2026')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Compensation', exact: true })).toBeVisible()
    await capture('onboarding-after-profile')
    await page.getByRole('textbox', { name: 'Job Title', exact: true }).fill('Synthetic quality engineer')
    await page.getByRole('button', { name: 'Select classification... Employee type', exact: true }).click()
    await page.getByRole('option', { name: 'Paid by the hour', exact: true }).click()
    await page.getByRole('textbox', { name: 'Wage', exact: true }).fill('30.00')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('grid', { name: 'List of all jobs for the employee', exact: true })).toContainText('Synthetic quality engineer')
    await capture('onboarding-compensation-saved')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Federal tax withholdings (Form W-4)', exact: true })).toBeVisible()
    await capture('onboarding-federal-tax')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByText("No state income tax withholding is required for this employee's work state.", { exact: true })).toBeVisible()
    await capture('onboarding-state-tax')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Payment method', exact: true })).toBeVisible()
    await capture('onboarding-payment')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Deductions', exact: true })).toBeVisible()
    await capture('onboarding-deductions')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Missing requirements', exact: true })).toBeVisible()
    await capture('onboarding-sdk-summary')
    nextApiFixture = { method: 'GET', path: '/__gusto_mock__/__onboarding_review', status: 200, body: '{"dataStepsComplete":false}' }
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Some SDK data steps remain incomplete.' })).toBeVisible()
    await capture('onboarding-readiness-incomplete', 'Explicit local API render fixture: readiness GET returns dataStepsComplete=false; no React state or markup injection')
    nextApiFixture = { method: 'GET', path: '/__gusto_mock__/__onboarding_review', status: 200, body: '{explicit local invalid JSON response fixture' }
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'The mock onboarding readiness could not be verified.' })).toBeVisible()
    await capture('onboarding-readiness-unverified', 'Explicit local API failure fixture: invalid JSON readiness response; actual host error handler')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'SDK data steps verified.' })).toBeVisible()
    await capture('onboarding-review-ready')
    await page.getByRole('checkbox', { name: 'Simulate employee form review · no legal signature', exact: true }).check()
    await capture('onboarding-form-reviewed')
    await page.getByRole('checkbox', { name: 'Simulate new-hire report review · no filing', exact: true }).check()
    await capture('onboarding-report-reviewed')
    for (const [name, method, path, message] of [
      ['onboarding-review-refused', 'POST', '/__gusto_mock__/__onboarding_review', 'Save every required synthetic onboarding step before the mock review.'],
      ['onboarding-completion-refused', 'PUT', `/__gusto_mock__/v1/employees/${employee}/onboarding_status`, 'Complete every required synthetic onboarding step before finishing.'],
      ['onboarding-completion-unverified', 'GET', `/__gusto_mock__/v1/employees/${employee}/onboarding_status`, 'The fictional completion status could not be verified.'],
    ]) {
      nextApiFixture = { method, path, status: 503, body: '{"errors":[{"message":"Explicit local API outage fixture"}]}' }
      await page.getByRole('button', { name: 'Complete simulated onboarding', exact: true }).click()
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
      await capture(name, `Explicit one-shot local API 503 fixture for ${method} completion stage; actual host refusal handler`)
    }
    await page.getByRole('button', { name: 'Complete simulated onboarding', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Synthetic onboarding receipt: completed.' })).toBeVisible()
    await capture('onboarding-completed')
    await page.getByText('Recent mock SDK events', { exact: true }).click()
    assert.equal(await page.getByRole('group').filter({ hasText: 'Recent mock SDK events' }).getByRole('listitem').count(), 8, 'SDK event history is bounded to the last eight actual events')
    await capture('sdk-event-log')
    await page.getByRole('button', { name: 'Employee directory', exact: true }).click()
    await expect(page.getByRole('rowheader', { name: 'Jordan Example', exact: true })).toBeVisible()
    await capture('directory-completed-active')
    const releasePrepare = holdApiRequest('PUT', `/v1/companies/00000000-0000-4000-8000-000000000001/payrolls/${payroll}/prepare?sort_by=last_name`)
    await page.getByRole('button', { name: 'Payroll workflow', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Preparing payroll...', exact: true })).toBeVisible()
    await capture('payroll-preparing', 'Actual SDK pending screen while its exact local prepare request is held')
    releasePrepare()
    await expect(page.getByRole('heading', { name: 'Edit Payroll', exact: true })).toBeVisible()
    await expect.poll(async () => (await api('/__state')).payrollPhase).toBe('prepared')
    await capture('payroll-initial')
    const releaseCalculate = holdApiRequest('PUT', `/v1/companies/00000000-0000-4000-8000-000000000001/payrolls/${payroll}/calculate`)
    await page.getByRole('button', { name: 'Calculate and review', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Calculating payroll...', exact: true })).toBeVisible()
    await capture('payroll-calculating', 'Actual SDK pending screen while its exact local calculate request is held')
    releaseCalculate()
    await expect(page.getByRole('heading', { name: 'Review payroll', exact: true })).toBeVisible()
    assert.equal((await api('/__state')).payrollPhase, 'calculated')
    await capture('payroll-review')
    for (const [name, tab] of [['payroll-hours', 'Hours worked'], ['payroll-take-home', 'Employee take home'], ['payroll-tax-debit', 'Taxed and debited']]) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      await capture(name)
    }
    const releaseSubmit = holdApiRequest('PUT', `/v1/companies/00000000-0000-4000-8000-000000000001/payrolls/${payroll}/submit`)
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Submitting payroll...', exact: true })).toBeVisible()
    await capture('payroll-submitting', 'Actual SDK pending screen while its exact local submit request is held')
    releaseSubmit()
    await expect(page.getByRole('status').filter({ hasText: 'Simulated payroll processed.' })).toBeVisible()
    const submitted = await api('/__state')
    assert.equal(submitted.payrollPhase, 'submitted')
    assert.deepEqual(submitted.receipt, { mode: 'mock', payrollId: payroll, state: 'fake-submitted', gross: '2000.00', notice: 'Synthetic test receipt only. No wages, taxes, bank transfer or Gusto submission occurred.' })
    await capture('payroll-submitted')
    await page.getByRole('button', { name: 'View payroll receipt', exact: true }).click()
    await expect(page.getByText('Synthetic test receipt only. No wages, taxes, bank transfer or Gusto submission occurred.', { exact: true })).toBeVisible()
    await expect(page.getByText('Fictional local payroll total', { exact: true })).toBeVisible()
    await expect(page.getByText('Local fictional SDK receipt. No payroll provider partnership, licensed processing or funds movement is represented.', { exact: true })).toBeVisible()
    await expect(page.getByRole('grid', { name: 'Fictional debit breakdown (no transfer)', exact: true })).toBeVisible()
    await expect(page.getByRole('grid', { name: 'Illustrative zero-tax breakdown', exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Your payroll provider partners with Gusto Inc.')
    await expect(page.locator('body')).not.toContainText('Gusto Inc. is a licensed money transmitter.')
    await capture('payroll-receipt')
    for (const [name, grid] of [['payroll-receipt-tax', 'Illustrative zero-tax breakdown'], ['payroll-receipt-employees', 'Employees']]) {
      await capture(name, 'Actual submitted SDK receipt section; rendering evidence, not a separate workflow transition', page.getByRole('grid', { name: grid, exact: true }))
    }
    assert.deepEqual(await api('/__state'), submitted, 'Viewing actual SDK receipt and tabs must preserve the submitted fictional state')
    failReset = true
    await page.getByRole('button', { name: 'Reset SDK samples', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'The mock reset failed. Refresh to start a new session.' })).toBeVisible()
    assert.deepEqual(await api('/__state'), submitted, 'Refused reset retains the isolated session state')
    await capture('reset-refused', 'Explicit one-shot local reset API 503 fixture; actual host refusal handler and exact session preservation')
    holdReset = true
    await page.getByRole('button', { name: 'Reset SDK samples', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Reset SDK samples', exact: true })).toBeDisabled()
    await capture('reset-pending', 'Actual UI while the local reset response is deliberately held')
    holdReset = false; releaseReset()
    await expect(page.getByRole('status').filter({ hasText: 'All SDK sample changes reset. No provider records were changed.' })).toBeVisible()
    const reset = await api('/__state')
    assert.equal(reset.payrollPhase, 'draft'); assert.equal(reset.receipt, null)
    assert.deepEqual(reset.employees.find(item => item.uuid === employee), { uuid: employee, first_name: 'Jordan', onboarded: false, onboarding_status: 'admin_onboarding_incomplete' })
    await capture('reset-success')
    failSession = true
    firstMountSessionRequest = true
    await page.reload()
    await expect(page.getByRole('alert').filter({ hasText: 'The local mock session could not start.' })).toBeVisible()
    await capture('session-unavailable', 'Explicit local session API 503 fixture; actual host error and retry control')
    failSession = false; invalidSession = true
    await page.getByRole('button', { name: 'Retry mock session', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'The mock returned an invalid session.' })).toBeVisible()
    await capture('session-invalid-response', 'Explicit malformed local session API response fixture; actual host validation refuses mounting the SDK')
    invalidSession = false; holdSessions = true
    await page.getByRole('button', { name: 'Retry mock session', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Starting an isolated synthetic SDK session…' })).toBeVisible()
    await capture('session-retry-starting', 'Actual Retry mock session UI with the local response held')
    releaseSession()
    await expect(page.getByRole('status').filter({ hasText: 'Isolated fictional records are ready.' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: 'Avery Example', exact: true })).toBeVisible()
    await capture('session-retry-ready')
    checks.push('Fresh owned loopback SDK context blocks providers and credentials; native raw slots remain byte-identical')
    assert.deepEqual(problems, [])
    assert.ok(failureLedger.reconciled(), 'Every explicit failure must reconcile its exact response and matching resource console error, or its specific StrictMode session cancellation')
    const coverage = sdkInventoryCoverage(observations)
    assert.deepEqual(coverage.missing, []); assert.deepEqual(coverage.unknown, [])
    await writeFile(join(artifactDir, 'sdk-status-coverage.json'), JSON.stringify({ boundary: 'Actual selected SDK local journeys plus explicitly labeled API failure/render fixtures. No provider acceptance.', inventory: sdkStateInventory, coverage, observations }, null, 2) + '\n')
    const fingerprint = async (path, location) => {
      const bytes = await readFile(location)
      return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
    }
    const sources = []
    for (const path of ['scripts/browser-sdk-quality.mjs', 'tests/browser/sdk-quality.mjs', 'tests/browser/sdk-quality.test.mjs', 'src/hr/gusto/GustoSdkPreview.tsx', 'integrations/gusto/mock-api.mjs', 'integrations/gusto/sdk-payroll.mjs', 'tests/hr/gusto-sdk-mock.test.mjs']) sources.push(await fingerprint(path, new URL('../../' + path, import.meta.url)))
    const artifacts = []
    for (const path of [...observations.flatMap(item => [item.capture, item.labelCapture, item.evidence]), 'sdk-status-coverage.json'].sort()) artifacts.push(await fingerprint(path, join(artifactDir, path)))
    await writeFile(join(artifactDir, 'sdk-quality-manifest.json'), JSON.stringify({ schemaVersion: 1, sdkVersion: '0.56.6', selectedMeanings: coverage.expected, sources, artifacts }, null, 2) + '\n')
    checks.push(`${coverage.expected} finite selected SDK session meanings retain visible text and accessible shape under grayscale`)
    checks.push('Actual SDK profile, compensation, federal/state tax, check payment and deductions data wizard; explicit simulated form/report review and active-directory completion readback')
    checks.push('Actual SDK payroll prepare, calculate, review tabs, submit and complete receipt sections; fictional arithmetic and exact local state readback')
    checks.push('Explicit local API refusal fixtures exercise session error/retry, onboarding review/completion/readback errors and reset refusal; held requests prove pending controls')
    return { checks, sdkVersion: '0.56.6', manifest: 'sdk-quality-manifest.json', boundary: 'Separate genuine selected SDK components using an isolated fictional local API session. No provider, credentials, unmounted vendor exports or native workspace acceptance. Static vendor legal/payment copy is not operational authority.', coverage, observations, warnings, problems, network, expectedFailures, observedExpectedFailures: failureLedger.responsesSeen, requestFailures, nativeStorage: { workspaceSlotsRemainAbsent: true, exactAllStoragePreservedAfterDefaultAccessibilityInitialization: true } }
  } catch (error) {
    releaseSession?.()
    releaseReset?.()
    for (const held of heldApi.values()) held.release()
    if (page && !page.isClosed()) {
      await writeFile(join(artifactDir, 'failure-state.txt'), (await page.locator('body').innerText().catch(() => '')) + '\n\n' + (await page.locator('body').ariaSnapshot().catch(() => '')))
      await page.screenshot({ path: join(artifactDir, 'failure.png'), fullPage: true }).catch(() => {})
    }
    error.smokeEvidence = { observations, problems, warnings, network, expectedFailures, requestFailures }
    throw error
  } finally { await context.close() }
}
