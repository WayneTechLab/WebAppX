import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { newIsolatedContext } from './portals-smoke.mjs'
import { loadMockModel } from './model-loader.mjs'
import { createKeyboardDriver } from './keyboard-driver.mjs'

const navigation = page => page.getByRole('navigation', { name: 'Template workspaces', exact: true })
const unsaved = page => page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
const domainSaves = state => state.origins.flatMap(origin => origin.localStorage.filter(item => /^webappx\.demo\./.test(item.name)))

/** Source-independent browser assertions for the shared portal shell. Fault
 * injection below only exercises storage platform errors/corruption. Normal
 * workflow state changes all go through rendered application controls.
 */
export async function runPortalFoundation({ browser, origin, artifactDir }) {
  const checks = [], problems = [], warnings = [], focus = []
  let context, page
  try {
    const { portalRegistry } = await loadMockModel(new URL('../../src/portals/registry.ts', import.meta.url))
    ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
    await page.goto(`${origin}/portals/?source=foundation#overview`)
    await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
    const setupNotice = page.getByRole('complementary', { name: 'Optional Firebase setup', exact: true })
    await expect(setupNotice).toBeVisible()
    await expect(setupNotice).toContainText('HR, CMS and CRM sample workspaces are available without an account.')
    await expect(setupNotice).toContainText('Optional sign-in setup:')
    await expect(setupNotice).toContainText('.env.local')
    await expect(setupNotice.getByRole('link', { name: 'Open mock portals', exact: true })).toHaveAttribute('href', '/portals')
    await expect(setupNotice.getByRole('link', { name: 'Read setup docs', exact: true })).toHaveAttribute('href', '/docs')
    checks.push('Unset Firebase clearly keeps account-free portals available and names optional sign-in configuration with working setup destinations')
    assert.equal(new URL(page.url()).search, '?source=foundation')
    for (const portal of portalRegistry) {
      const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: portal.title, exact: true }) })
      await expect(card.getByText(portal.description, { exact: true })).toBeVisible()
      await expect(card.getByText(portal.workflows, { exact: true })).toBeVisible()
      await expect(card.getByText(portal.roles, { exact: true })).toBeVisible()
      await expect(card.getByRole('link', { name: `Open ${portal.title}`, exact: true })).toHaveAttribute('href', portal.href)
      await expect(navigation(page).getByRole('link', { name: portal.title, exact: true })).toHaveAttribute('href', portal.href)
      await expect(card.getByRole('status', { name: `${portal.label} save status`, exact: true })).toContainText('Browser save: Ready')
    }
    checks.push('All three directory cards and navigation links use the current registry metadata; fresh saves are Ready')

    for (const [path, portal] of [['/hr/demo/admin/payroll/?period=mock#review', 'hr'], ['/cms/demo/?collection=pages#editor', 'cms'], ['/crm/demo/?view=leads#pipeline', 'crm']]) {
      await page.goto(`${origin}${path}`)
      assert.equal(page.url(), `${origin}${path}`, 'Route matching must retain the requested path, query and hash')
      await expect(navigation(page).getByRole('link', { name: portalRegistry.find(item => item.id === portal).title, exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('complementary', { name: 'Account-free mock mode', exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'How mock data is handled', exact: true })).toHaveAttribute('href', '/portals#mock-data-handling')
      await expect(page.getByRole('navigation', { name: 'Portal breadcrumbs', exact: true }).getByRole('link', { name: 'Portal directory', exact: true })).toHaveAttribute('href', '/portals')
    }
    await page.getByRole('link', { name: 'How mock data is handled', exact: true }).click()
    await expect(page.locator('#mock-data-handling')).toBeInViewport()
    assert.equal(new URL(page.url()).hash, '#mock-data-handling')
    checks.push('Trailing-slash deep links preserve URL query/hash and render the correct portal, shared mock notice and directory breadcrumb')

    await page.goto(`${origin}/hr/demo/employee/onboarding`)
    const keyboard = createKeyboardDriver(page, focus)
    const crumbs = page.getByRole('navigation', { name: 'Portal breadcrumbs', exact: true })
    for (const label of ['Portal directory', 'People & HR', 'Employee']) await keyboard.focus(crumbs.getByRole('link', { name: label, exact: true }), `${label} breadcrumb reachable`)
    await keyboard.focus(crumbs.getByRole('link', { name: 'Portal directory', exact: true }), 'Return directory breadcrumb')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Choose a portal.', exact: true })).toBeVisible()
    checks.push('Deep employee onboarding breadcrumbs are reachable with visible keyboard focus and Enter returns to the directory')

    const beforeReturnNavigation = domainSaves(await context.storageState())
    const returnDocument = await page.evaluate(() => performance.timeOrigin)
    await expect(navigation(page).getByRole('link', { name: 'People & HR', exact: true })).toHaveAttribute('href', '/hr/demo/employee/onboarding')
    await expect(page.getByRole('link', { name: 'Open People & HR', exact: true })).toHaveAttribute('href', '/hr/demo/employee/onboarding')
    await navigation(page).getByRole('link', { name: 'Content management', exact: true }).click()
    await expect(navigation(page).getByRole('link', { name: 'People & HR', exact: true })).toHaveAttribute('href', '/hr/demo/employee/onboarding')
    await navigation(page).getByRole('link', { name: 'People & HR', exact: true }).click()
    assert.equal(new URL(page.url()).pathname, '/hr/demo/employee/onboarding')
    await expect(page.getByRole('navigation', { name: 'Employee HR pages', exact: true }).getByRole('link', { name: 'My onboarding', exact: true })).toHaveAttribute('aria-current', 'page')
    assert.equal(await page.evaluate(() => performance.timeOrigin), returnDocument, 'Shared portal links must retain the current mounted document')
    assert.deepEqual(domainSaves(await context.storageState()), beforeReturnNavigation, 'Remembered return pathnames are temporary shell state and must not create or change workspace/history saves')
    checks.push('Directory card and shared navigation return to the last supported HR subsection within the same document without writing browser saves')

    const beforeUnsupported = domainSaves(await context.storageState())
    for (const portal of portalRegistry) {
      await page.goto(`${origin}${portal.pathRoot}/not-a-supported-page`)
      await expect(page.getByRole('heading', { name: `This ${portal.label} demo page is unavailable.`, exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: `Open ${portal.workspaceLabel}`, exact: true })).toHaveAttribute('href', portal.href)
      await expect(page.getByText('The requested route does not match a supported page in this workspace. Your saved fictional records are unchanged.', { exact: true })).toBeVisible()
      await page.getByRole('link', { name: `Open ${portal.workspaceLabel}`, exact: true }).click()
      await expect(page.getByRole('complementary', { name: 'Account-free mock mode', exact: true })).toBeVisible()
    }
    assert.deepEqual(domainSaves(await context.storageState()), beforeUnsupported, 'Missing pages and recovery links must preserve all domain saves')
    checks.push('Unknown HR/CMS/CRM descendants show distinct recovery states and preserve browser saves')

    await navigation(page).getByRole('link', { name: 'Content management', exact: true }).click()
    const initialTitle = await page.locator('#edit-title').inputValue()
    const beforeExplanation = domainSaves(await context.storageState())
    const documentTimeOrigin = await page.evaluate(() => performance.timeOrigin)
    await page.locator('#edit-title').fill('Unsaved fictional title preserved across the explanation link')
    await page.getByRole('link', { name: 'How mock data is handled', exact: true }).click()
    await expect(unsaved(page)).toBeVisible()
    await expect(unsaved(page).getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
    await expect(unsaved(page).getByRole('listitem')).toHaveText(['CMS entry editor'])
    await unsaved(page).getByRole('button', { name: 'Leave and keep draft', exact: true }).click()
    await expect(unsaved(page)).not.toBeVisible()
    await expect(page.locator('#mock-data-handling')).toBeInViewport()
    await expect(page.locator('#mock-data-handling')).toBeFocused()
    await navigation(page).getByRole('link', { name: 'Content management', exact: true }).click()
    await expect(page.locator('#edit-title')).toHaveValue('Unsaved fictional title preserved across the explanation link')
    assert.equal(await page.evaluate(() => performance.timeOrigin), documentTimeOrigin, 'The explanation link must preserve the current document and mounted portal session')
    assert.deepEqual(domainSaves(await context.storageState()), beforeExplanation, 'Reading the shared explanation must not save or discard a draft')
    await page.locator('#edit-title').fill(initialTitle)
    checks.push('Explicit Leave and keep draft at the shared explanation link preserves the mounted session, exact unsaved CMS input and domain saves; its target receives focus and scroll')

    await page.locator('#edit-title').fill('Shared shell save summary fixture')
    await page.getByRole('button', { name: 'Save draft revision', exact: true }).click()
    await navigation(page).getByRole('link', { name: 'Portal directory', exact: true }).click()
    await expect(page.getByRole('status', { name: 'CMS save status', exact: true })).toContainText('Browser save: Saved')
    await expect(unsaved(page)).not.toBeVisible()
    for (const label of ['HR', 'CRM']) await expect(page.getByRole('status', { name: `${label} save status`, exact: true })).toContainText('Browser save: Ready')
    await page.reload()
    await expect(page.getByRole('status', { name: 'CMS save status', exact: true })).toContainText('Browser save: Saved')
    await expect(page.getByRole('status', { name: 'CMS save status', exact: true })).toContainText('sample restored from this browser')
    await page.screenshot({ path: join(artifactDir, 'portal-directory-save-summary.png'), fullPage: true })
    checks.push('CMS saved status updates immediately in the directory and retains the provider restoration message after refresh; HR/CRM stay Ready')
    await context.close(); context = undefined

    for (const fault of ['recovered', 'unavailable']) {
      ;({ context, page } = await newIsolatedContext(browser, origin, problems, warnings))
      await page.addInitScript(kind => {
        if (kind === 'recovered') localStorage.setItem('webappx.demo.cms', '{deliberately malformed synthetic storage fixture')
        else Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage denied by synthetic test fixture', 'SecurityError') } })
      }, fault)
      await page.goto(`${origin}/portals`)
      await expect(page.getByRole('status', { name: 'CMS save status', exact: true })).toContainText(`Browser save: ${fault === 'recovered' ? 'Recovered' : 'Unavailable'}`)
      if (fault === 'recovered') for (const label of ['HR', 'CRM']) await expect(page.getByRole('status', { name: `${label} save status`, exact: true })).toContainText('Browser save: Ready')
      else for (const label of ['HR', 'CRM']) await expect(page.getByRole('status', { name: `${label} save status`, exact: true })).toContainText('Browser save: Unavailable')
      await context.close(); context = undefined
      checks.push(`Directory displays ${fault} from actual provider loading under an isolated synthetic storage fault`)
    }
    assert.deepEqual(problems, [], 'Foundation checks require zero external/provider/backend requests, failed HTTP requests, console errors and uncaught exceptions')
    await writeFile(join(artifactDir, 'foundation-focus.json'), JSON.stringify(focus, null, 2) + '\n')
    return { checks, warnings, focusObservations: focus.length }
  } catch (error) {
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(artifactDir, 'failure.png'), fullPage: true }) } catch { /* Preserve the primary failure. */ }
    error.smokeEvidence = { checks, problems, warnings }
    throw error
  } finally {
    if (context) await context.close()
  }
}
