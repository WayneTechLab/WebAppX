# Testing & QA

The baseline ships Node suites for SYSTEMX LAN and Gusto/HR contracts, plus
TypeScript, ESLint, build, audit, and security gates. Vitest/Testing Library
and Playwright are optional playbook additions that projects enable when their
application needs them.

> Detailed source:
> [Step 10 — Testing & QA](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/Template/steps/10-testing-qa.md).

## What ships in the baseline vs. the playbook

- **Baseline (repo root):** LAN characterization, selected standalone-tool tests,
  import/mirror regressions, synthetic HR/SDK/backend contract tests, TypeScript,
  ESLint, strict dependency audit, research
  validation, documentation links, immutable integrity and build isolation.
- **Playbook (Step 10):** adds Vitest, Playwright, and a11y/security audits.

## Reusable-template release checks

```bash
npm run ci:all
npm run deploy -- hosting --preflight
```

`ci:all` runs the selected standalone distribution's tests, host import/mirror
regressions, app/LAN gates, research inventories and public template integrity.
It requires blank adoption seeds. `template:check` rejects populated tasks,
context or project records by design. Use these to maintain the reusable release.

## Adopted-project checks

Use `systemx:validate` for active project records and select your application's
checks in `.SYSTEMX/project.json`. Adapt the template-maintenance tests after
adoption; they are not evidence that an application's work ledger must stay blank.
The app/LAN checks remain separately runnable:

```bash
npm run systemx:validate
npm run ci:lint
npm run ci:typecheck
npm test
npm run hr:test
npm run ci:audit
npm run build
```

Consult the [HR portal QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md)
for the current portal wave's source, test and browser evidence boundaries. The
earlier [2026-10-14 browser QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-BROWSER-QA-2026-10-14.md)
retains the native HR fixes and historical 41-test checkpoint. The original
[3.4.0 release receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.4.0.md)
retains its October 13 revision and historical 39-test HR result. The historical
[3.2.0 release receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.2.0.md)
records 230 standalone tests (successful with 5 case-sensitive filesystem cases
skipped on the validation Mac), 27 host integration tests, 8 operational controls
and 11 app/LAN tests. The
[3.1.0 receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.1.0.md)
retains its historical scope. Recheck the current revision rather than treating
a release receipt as a new run.

For an Agent Y task, run the configured app checks against the returned worktree
and record their original output and checked revision before Agent 0 acceptance.
The controller's successful exit and an Agent Z score do not run those checks or
accept the task. Follow [Agent Y New App Setup](Agent-Y-New-App-Setup.md).

## Gusto and HR checks

```bash
npm run hr:test
npm run hr:backend:audit
```

`hr:test` exercises synthetic native HR state, route/resource guards, the SDK
directory/onboarding/payroll mock's request/response contracts, and backend membership, projection
and webhook foundation boundaries. It uses local fixtures and app/backend code;
it does not contact Gusto or establish Firebase deployment acceptance.
`hr:backend:audit` audits the isolated optional functions package's dependencies.

### Current portal automated checks

`npm run hr:test` passes **70 tests**:

| Group | Tests |
| --- | ---: |
| Native model/workflow | 17 |
| People operations and PTO | 9 |
| Scoped insights and pay statements | 7 |
| Linked policy/training assignments | 7 |
| HR service desk | 5 |
| SDK-client mock contracts | 11 |
| Optional backend boundaries | 14 |

These checks cover the added leave/assignment/asset flows, scoped activity,
dashboard/report projections, employee pay statements, per-employee payroll caps
and request lifecycle. Native and SDK datasets remain separate. Browser
acceptance is recorded independently in the
[portal QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md);
an automated pass is not evidence of provider execution or deployment.

### Portal browser verification — 2026-10-14

The current [portal QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md)
records the native combined run after a full reload, using fictional data with
Firebase initialization disabled:

- Policy/training links updated their explicit assigned tasks without completing
  unrelated onboarding. Non-tax document acknowledgment and scoped asset return
  worked; employees could not confirm the return themselves.
- October 19–20 displayed/submitted 16 leave hours. Reservations, overlap refusal,
  rejection, approval and cancellation reconciled the final vacation balance to
  40 hours.
- The employee/manager service lifecycle preserved seven actions through reopen
  and a second resolution; another employee saw no request.
- `MOCK-PAYROLL-0003` and Avery's own pay statement matched $240 gross, $48
  illustrative withholding, $25 benefit and $167 net. The owner report reconciled
  consumed time, payroll and leave decisions; Jordan saw no statement, and
  auditor reports/history exposed no amounts or payroll controls.

This verifies the selected native host paths. The SDK UI was not rerun, and no
provider request, deployment, legal form, insurance or real payroll acceptance
was established. The earlier 41- and 39-test receipts remain historical.

### Earlier native browser verification — 2026-10-14

The dated receipt records **41 passing HR tests**: 16 native model/workflow,
11 SDK-client mock and 14 optional backend boundary tests. On macOS Apple
Silicon, the native browser check verified:

- Jordan's approved eight hours remain excluded until onboarding is completed
  and the directory reads Active. A changed work email invalidates pending
  profile/summary review.
- Unconfirmed retirement elections are ignored. Confirming after preparation
  preserves the frozen $192 net; preparing again captures the confirmed plan,
  producing $240 gross, $48 illustrative withholding, $25 benefit deduction and
  $167 net in `MOCK-PAYROLL-0004`.
- Avery's confirmed waiver and approved eight hours produce $192 net in
  `MOCK-PAYROLL-0007`, excluding Jordan's receipted hours and enrollment.
- Timers bind their employee, role and original date. Identity/role changes and
  Reset cancel them; a normal stop retains the original work date.

Model regression checks also cover unchanged profile saves and contact edits
after completed hiring, preserving accepted history in both cases.
These are linked native mock results with Firebase initialization disabled.
The SDK sample retains separate state; its onboarding/payroll UI was not
retested in this session. The historical October 13 39-test receipt remains
unchanged. Neither receipt establishes real provider, tax, benefits or production
acceptance, and this update retains version **3.4.0**.

For a browser check, run Vite development and open `/hr/demo` and `/hr/demo/sdk`.
The SDK 0.56.6 preview uses genuine directory, administrative onboarding and
payroll execution components with development-only mock reads and writes.
The mock API is absent from Hosting and `npm run preview`.
Native HR actions use synthetic React state and reset on refresh. Other SDK
workflows, authorized Demo integration, protected connected portals and live
payroll require their own evidence. The optional Firebase adapter is disabled by
default. See [Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md)
and [Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md).

## Unit / component tests (Vitest + Testing Library)

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
})
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Run them:

```bash
npm test              # retain the LAN suite
npx vitest run        # after installing the optional Vitest stack
```

## End-to-end tests (Playwright)

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright codegen http://127.0.0.1:5173    # use the printed port if it moves
```

SYSTEMX also exposes package shortcuts:

```bash
npm run browser:install
npm run browser:codegen
npm run mcp:chrome
npm run ai:standard:check
```

Use Playwright for repeatable local browser flows and Chrome DevTools MCP for
live browser inspection, console/network evidence, screenshots, and popup
diagnostics. Keep the target on localhost, emulators, or staging by default.

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
})
```

Example smoke test (`tests/smoke.spec.ts`):

```ts
import { test, expect } from '@playwright/test'
test('home renders + no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await expect(page).toHaveTitle(/.+/)
  expect(errors, errors.join('\n')).toHaveLength(0)
})
```

## Accessibility & security gates

```bash
npm install -D @axe-core/playwright    # a11y assertions inside e2e
npm audit                              # dependency vulnerabilities
```

## Wiring into local verification

Run the test stages locally before deploy:

```bash
npm run ci:test             # runs the checked-in LAN characterization suite
npm run browser:install
npx playwright test         # after adding a project Playwright suite
npm run ci:security
npm run build
```

## Verification gate

```bash
npm test                 # SYSTEMX LAN characterization green
npx vitest run           # optional component suite
npx playwright test      # optional project e2e suite
```

## Testing rules of thumb

- Use **test-mode** credentials and the **emulator suite** for e2e — never prod
  data.
- Keep a **rules unit test** (`@firebase/rules-unit-testing`) in the suite to
  catch data-exposure regressions.
- Run `npm audit` + secret scanning on every PR.
- Treat e2e fixtures/tokens as secrets — inject through local secret files or
  your chosen deployment platform, not the repo.
- Identify your **critical-path** journeys (auth, core CRUD, checkout) and ensure
  each has e2e coverage.
- If a popup, account prompt, or tool apply dialog blocks automation, record the
  blocker in the SYSTEMX recovery format instead of silently clicking through.
