# HR demo: onboarding to simulated pay

Walk two fictional employees through onboarding, benefits, time approval and a
frozen payroll receipt. The suggested pacing below is designed for a five-minute
presentation after setup; it is not a measured completion-time claim. Preview
roles are fictional identities. These actions do not authenticate anyone,
authorize Gusto, calculate real taxes or move money.

## Prepare a fresh demo

From the repository root, install the app dependencies once with `npm ci`, then
start the account-free local server:

```bash
npm run dev:mock
```

Open the printed `/portals` URL in a new temporary browser profile or an isolated
browser context owned by this demo. Keep that exact address and context for all
eight steps. A new tab in an existing profile can reuse saved work. Preserve
existing profiles, saves and listeners; use another fresh context if the starting
state differs. Do not clear site data or reset someone else's workspace.

The native defaults correspond to the reviewed
[`webappx-portal-smoke-v1` seed](../../tests/browser/fixtures/portal-smoke-v1.json)
and its [recorded digest](../../tests/browser/fixtures/portal-smoke-v1.sha256).
The fixture is a source reference, not a file to import through the backup UI.
On **Portal directory**, expect **Choose a portal.** and **Browser save: Ready**
for HR, CMS and CRM. HR starts with three people, one submitted time entry,
no confirmed benefit elections and no submitted simulated payroll receipts.
The two starting time rows are Avery's eight hours and Jordan's six hours dated
2026-10-09. Jordan's row starts as a draft.

## Run the presentation

1. **0:00–0:20 · Presenter → Jordan Demo.** Open **People & HR**, then
   **Employee**. In **Synthetic employee identity**, select **Jordan Demo**
   (`employee-003`) and open **My onboarding**. In **Complete sample onboarding
   · Jordan**, expect **Review onboarding summary** and **Confirm simulated
   onboarding** to be disabled before the required reviews and checklist.

2. **0:20–1:00 · Jordan completes onboarding.** Activate **Review sample
   profile**, **Review sample job**, then the checklist button **Complete own
   profile** while it shows **Mark complete**. Activate **Review onboarding
   summary**, then **Confirm simulated onboarding**. Expect the completion status:
   `Simulated onboarding completed · MOCK-ONBOARDING-0001. Demo directory status is now active.`
   This makes Jordan active in the fictional directory so approved hours can
   enter the later sample payroll.

3. **1:00–1:40 · Avery Sample elects a plan and submits time.** Select **Avery
   Sample** (`employee-002`) in **Synthetic employee identity** and open **My
   benefits**. On **Demo health plan**, activate **Elect sample enrollment**,
   **Review sample election**, then **Confirm sample election**. Watch the status
   advance through `enroll · draft`, `enroll · reviewed` and
   `enroll · confirmed · MOCK-BENEFIT-0002`. The four election controls are now
   disabled. Open **My time**, enter **Work date** `2026-10-14` and **Hours**
   `1.25`, then activate **Add sample time** and **Submit own sample timesheet**.
   Expect `Own sample timesheet submitted. A different authorized manager must approve it.`
   Both Avery rows are submitted. The new row's ID, `MOCK-TIME-0003`, will be
   visible in the frozen inputs at step 7.

4. **1:40–2:20 · Jordan confirms a waiver and submits time.** Select **Jordan
   Demo**, open **My benefits**, and use **Demo retirement plan**. Activate
   **Elect sample waiver**, **Review sample election**, then **Confirm sample
   election**. Expect `waive · confirmed · MOCK-BENEFIT-0004`. Open **My time**,
   set **Work date** to `2026-10-14` and **Hours** to `2.5`, then activate **Add
   sample time** and **Submit own sample timesheet**. Expect the same submission
   message and a disabled **Submit own sample timesheet** button. Jordan's seed
   six-hour draft and new 2.5-hour row are both submitted. The new row is
   `MOCK-TIME-0005` in the later frozen inputs.

5. **2:20–3:00 · Morgan Example approves four team entries.** Open **Manager**,
   confirm the identity reads **Morgan Example · manager · fictional identity**,
   then open **Team time**. In **Sample timesheet journey**, use **Approve sample
   time** on exactly these four rows: Avery, `2026 10 09 · 8 hours`; Jordan,
   `2026 10 09 · 6 hours`; Avery, `2026 10 14 · 1.25 hours`; Jordan,
   `2026 10 14 · 2.5 hours`. Each row must show **approved**. No **Approve sample
   time** buttons remain. The approved input is `8 + 6 + 1.25 + 2.5 = 17.75`
   hours across two employees.

6. **3:00–3:45 · Employer owner prepares and submits the simulation.** Open
   **Management**, keep **Employer owner** in **Synthetic management role**, then
   open **Payroll workspace**. In **Run a simulated payroll**, choose **Sample
   period start 2026-10-01** and **Sample period end 2026-10-15**. In **Configure
   fictional hourly rates**, select Avery under **Rate employee**, enter **30**
   under **Fictional hourly rate (dollars)** and **2026-10-01** under **Rate
   effective date**, then activate **Add sample rate**. Repeat for Jordan. The
   initial seed has no configured hourly rates; these explicit fictional rates
   supply this demonstration's $30/hour arithmetic. Before preparation,
   **Calculate fictional totals**, **Review simulated payroll** and **Simulate
   payroll submission** are disabled. Activate **Prepare sample payroll**;
   expect **4 approved entries · 17.75 hours** and **1 enrolled-plan deductions
   frozen in this snapshot**. Activate **Calculate fictional totals** and
   check **Fictional gross $532.50**, **Illustrative withholding $106.50**,
   **Sample benefit deductions $25.00** and **Simulated net $401.00**. Submission
   stays disabled until **Review simulated payroll** is activated. Review, then
   activate **Simulate payroll submission**. Expect:
   `Simulated submission complete · MOCK-PAYROLL-0006. No money moved and no provider was contacted.`
   **Simulation receipts** contains exactly the new receipt row
   `MOCK-PAYROLL-0006 · 2026-10-01 to 2026-10-15 · 17.75 hours · fictional net $401.00`,
   followed by all four frozen hours/rate rows at **$30.00/hour (fictional)**.

7. **3:45–4:40 · Each employee reads their own frozen statement.** Reload, open
   **Employee**, select **Avery Sample**, and open **My pay**. In **Your simulated
   pay receipts**, expect one `MOCK-PAYROLL-0006` statement for **Avery Sample ·
   2026-10-01 to 2026-10-15** with the Avery totals below. Expand **View frozen
   time and benefit inputs**: the two rows are
   `2026-10-09 · 8.0000 hours × $30.00/hour (fictional) · time-001` and
   `2026-10-14 · 1.2500 hours × $30.00/hour (fictional) · MOCK-TIME-0003`; the benefit is **Demo health
   plan**. Select **Jordan Demo**, reload, and open **My pay**. The same receipt
   now shows only Jordan's statement and totals. Its frozen rows are
   `2026-10-09 · 6.0000 hours × $30.00/hour (fictional) · time-002` and
   `2026-10-14 · 2.5000 hours × $30.00/hour (fictional) · MOCK-TIME-0005`; benefit plans read **None**.
   Each identity sees its own statement, and their totals add to the shared
   payroll receipt.

8. **4:40–5:00 · Employer owner checks consumed-time protection.** Return to
   **Management → Payroll workspace** and activate **Prepare sample payroll**
   again. Expect the alert
   `Approve at least one unpaid time entry for an active sample employee in 2026-10-01 to 2026-10-15 before preparing payroll.`
   The submitted `MOCK-PAYROLL-0006` status and its single receipt remain. Reload
   once more to confirm the receipt persists.

| Frozen statement | Approved hours included | Gross | Illustrative withholding | Sample benefit deductions | Simulated net |
| --- | ---: | ---: | ---: | ---: | ---: |
| Avery Sample | 9.2500 | $277.50 | $55.50 | $25.00 | $197.00 |
| Jordan Demo | 8.5000 | $255.00 | $51.00 | $0.00 | $204.00 |
| Combined receipt | 17.75 | $532.50 | $106.50 | $25.00 | $401.00 |

The native simulation uses a fictional $30 hourly rate, flat 20% illustrative
withholding and one $25 enrolled-plan deduction. The older native **$167**
single-employee example and separate SDK **$200** fixture in
[Gusto setup](../GUSTO-SETUP.md) have different inputs. This walkthrough's expected
receipt is **$401.00**, from the four named rows above. Historical fixture payroll
and pay-statement panels are separate read-only examples.

## Rehearsal evidence and cleanup

Run the local evaluator from the repository root after installing the matching
Chromium binary with `npm run browser:install`:

```bash
node scripts/browser-evaluators.mjs
```

The evaluator's payroll contract is
[the two-employee browser lifecycle](../../tests/browser/payroll-lifecycle.mjs).
It checks complete exports, frozen employee inputs, reload persistence and
consumed-time rejection in its own fresh context. A successful automation run
does not measure a human's five-minute presentation time or establish provider
acceptance. Save the runner's actual report and artifact location when recording
a rehearsal result.

For a manual handoff, use **Portal directory → Export all workspaces** to keep a
fictional JSON backup, then close only the demo-owned context and stop only the
`dev:mock` process you started with Ctrl+C. Keep any existing browser profiles,
saves and other local servers intact. See the [state contract](../PORTAL-STATE-CONTRACT.md),
[HR guide](../HR-PORTAL.md) and [CMS five-minute demo](CMS-FIVE-MINUTE.md).
