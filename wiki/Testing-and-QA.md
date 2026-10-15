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
for the earlier portal wave's source, test and browser evidence boundaries. The
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

### Native workspace export/import checks

Automated verification: **116 HR tests + 54 portal/storage/backup tests passed**
(**170 total**, including 18 new backup/import cases). Full `npm run ci:all`
passed with production build and LAN isolation.

HR, CMS and CRM each export/import a separate JSON file without an account or
upload. The [backup QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-BACKUP-QA-2026-10-14.md)
records this update’s browser evidence, automated totals and gate results.
Earlier persistence and talent results below retain their original checkpoints.

**Browser checkpoint — 2026-10-14:** all three native portals passed actual
Export workspace downloads and file-picker imports from numeric loopback into
`localhost`, followed by preview, explicit replacement, refresh and re-export.
Every final `data` payload matched its source file exactly. These are two
independent storage areas in the same in-app browser, not a certification of
Safari, Firefox, Windows or another browser engine.

| Area | Observed result |
| --- | --- |
| HR | Confirmed Avery health plan, approved eight hours and submitted `MOCK-PAYROLL-0002` retained $240 gross/$48 illustrative withholding/$25 benefit/$167 net after import and refresh. |
| CMS | `Portable CMS sample backup` revision 3 restored with two content records, one publication and two actions. Cancel preserved target revision 1, and confirmed replacement cleared an unsaved target field. |
| CRM | Three companies, contacts, leads and opportunities plus six actions restored with $1,500 won/$6,500 open. Reimport removed a target-only lead and retained the source records. |
| Rejected files | CMS rejected an HR file, malformed JSON, version 999 and an 8,002,049-byte file without changing revision 3. HR rejected a broken time-entry employee reference; its submitted payroll receipt survived refresh. |

Storage-denial/write-failure preservation is covered by automated tests; browser
permissions were not changed for these checks. Read the receipt for final gate
results and the separate automated scope.

Use fictional data and verify each module independently:

1. Save identifiable domain changes, export the workspace and retain the file.
   Verify saved workflow stages/linked receipts are included and unsaved edits,
   running timers and the independent SDK session are excluded.
2. Change or Reset that module, import its file, inspect the preview and cancel.
   Verify cancellation preserved the destination. Import again and explicitly
   confirm the named replacement; refresh and verify the backed-up records return.
3. Repeat at another browser/origin to verify file portability, independent
   destination saving and absence of account/server requests.
4. Give one portal another module’s file, malformed JSON, unsupported envelope
   versions, invalid nested records and an oversized file. Each rejection must
   preserve current records and display the failure.
5. Verify a replacement save failure preserves the prior in-memory workspace
   and browser snapshot. Successful import must not change the other two portals.
6. Inspect plain-text exports with the expectation that the complete fictional
   workspace includes private drafts/answers/receipts, independent of the current
   role projection. Schema acceptance does not prove provider execution.

Import performs full replacement, not merging. Export the destination first if
its records must be retained. See [Template Portals](Template-Portals.md#back-up-restore-or-move-a-workspace)
for the user-facing steps and portability limits.

### Earlier native HR, CMS and CRM persistence checks

Automated verification: **116 HR tests and 36 portal/storage tests passed**
(152 total).

Read the [persistence QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-PERSISTENCE-QA-2026-10-14.md)
for this update’s browser and automated results. The older talent, connected-HR
and four-flow receipts below preserve their own checkpoints.

**Selected browser results — 2026-10-14:** all three native portals passed
same-origin refresh and isolated Reset checks.

| Area | Observed result |
| --- | --- |
| HR hire/onboarding/payroll | Refresh restored Casey as the fourth person, then completed onboarding `MOCK-ONBOARDING-0001`. Submitted eight hours and prepared payroll restored at their checkpoints; submitted `MOCK-PAYROLL-0003` restored $240 gross/$48 illustrative withholding/$0 benefits/$192 net. |
| HR benefits/performance/survey | Refresh restored Avery’s health enrollment `MOCK-BENEFIT-0004`, goal progress 40% and saved self-review draft. A saved survey rating 4/text restored; submitted `MOCK-SURVEY-0003` remained locked after refresh. |
| CMS | Saved revision 2 restored, then separate review/approval/publication `MOCK-CMS-0004` restored. Saved draft revision 3 restored while the published projection stayed at revision 2. |
| CRM | Created lead restored; qualification/conversion and the $1,500 won deal restored with $6,500 open pipeline, three companies, three contacts and six successful actions. |
| Navigation and reset isolation | HR restored after SDK preview and About/back. All three module Reset→refresh checks restored only the chosen fixtures and preserved the other modules’ saved records. |

These observed UI paths do not replace the separate malformed-save,
storage-failure and direct domain tests. Follow the current receipt for the
final gate totals and scope.

Verify each native module at the same browser origin:

1. Complete saved domain actions, record their IDs/counts, refresh, and confirm
   the corresponding records and workflow stage return. Unsaved form fields and
   active timers are outside the restoration guarantee.
2. Leave for an ordinary page and return; for HR also visit `/hr/demo/sdk` and
   return. Native data should restore independently of SDK sample state.
3. Reset one module, refresh, and verify only that module returns to fixtures;
   the other two retain their saved domain changes.
4. Verify visible fallback/recovery notices for blocked/unavailable storage and
   malformed or unsupported snapshot versions. A failed write must not make a
   claim that changes were saved across refresh.
5. Verify that changing role projections does not grant real authentication or
   provider access. All local saved data remains inspectable by the browser user.

Storage is versioned and separate per module. Private browsing, site-data
clearing and a different scheme/hostname/port can remove or hide saved samples.
Multiple tabs do not merge updates live; the last successful write wins. Test
with fictional data only. No local persistence result establishes production
server storage, membership enforcement, managed backup/retention or provider execution.

### Talent wave verification

The recruiting, performance and survey modules have their own test and
browser evidence. Review sequential candidate stages and atomic hire-to-native
onboarding, self/direct-manager review authorship, private draft projections,
identified submitted-only survey results, duplicate/final-state guards and
role-scoped dashboard counts. Use fictional `.invalid` candidate emails and
feedback. Do not infer this wave's test total or browser acceptance from the
historical 70-test checkpoint below. The earlier talent
[talent/CMS/CRM QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-TALENT-QA-2026-10-14.md)
records the separate results.

The earlier talent checkpoint passed **129 model tests**:

| Suite | Tests |
| --- | ---: |
| HR, including talent and hire integration | 109 |
| CMS | 10 |
| CRM | 10 |

The HR total includes the earlier 70 checks plus four talent insight cases,
eight recruiting, six hire-to-HR integration, ten performance and 11 survey
cases. Browser results remain separately scoped in the QA receipt.

That earlier talent browser checkpoint included:

- Casey's mock hire connected to native directory/onboarding.
- Private self/manager review drafts stayed behind their projection gates before
  publication and employee acknowledgment.
- Identified survey ratings 5 and 3 produced 2/2 submissions and mean 4; private
  drafts contributed zero results and closure produced `MOCK-SURVEY-0007`.
- CMS returned revision 2 for feedback, approved/published revision 3
  (`MOCK-CMS-0007`), preserved that publication while revision 4 changed, required
  new review before replacement publication, and removed the retired article.
  Viewer mutation controls were absent and duplicate slugs were refused.
- CRM qualified/converted a lead once, advanced $1,500 through discovery,
  proposal and negotiation to won, and completed follow-ups. Riley's dashboard
  showed $2,500 open/$1,500 won/0 follow-ups. Owner conversion reused a compatible
  company; representatives could not see foreign-owner records and auditor
  mutation controls were absent.
- Shared navigation preserved a CMS draft, HR's four people and CRM's $1,500 won
  value. Reset CMS removed only its draft, leaving HR and CRM intact.
- Casey completed native onboarding and the eight-hour October 15 payroll
  journey: `MOCK-PAYROLL-0003` and own statement matched $240 gross, $48
  illustrative withholding, $0 benefit and $192 net.

These observations do not establish real staff review, anonymous feedback,
external publication, provider execution or production acceptance.

Run the independent CMS/CRM model suites with:

```bash
npm run portals:test
```

These cover exact CMS revision/approval/publication and CRM owner/relationship
scope, conversion, opportunity stages and task transitions. Browser acceptance
must also verify cross-portal record preservation, isolated Reset and full
reload behavior. Read [Template Portals](Template-Portals.md) for the workflows.

### Earlier portal automated checks

At that checkpoint, `npm run hr:test` passed **70 tests**:

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

### Earlier portal browser verification — 2026-10-14

The earlier [portal QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md)
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
Saved native HR actions restore from the versioned browser-local snapshot
after same-origin refresh; the SDK sample state remains independent. Other SDK
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
