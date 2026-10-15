# Connected HR portal verification — 2026-10-14

This follow-up covers the WebAppX 3.4.0 host extension developed from published
baseline `2f3321ace50fd804bbc0f0355c35f83e01478662`. It preserves the earlier
[core-flow browser receipt](GUSTO-BROWSER-QA-2026-10-14.md) as historical evidence.
The new [portal guide](HR-PORTAL.md) describes implementation and remaining scope.

Verification uses fictional fixture records in an isolated local Vite browser
session with Firebase initialization disabled. The native and SDK previews use
separate state. No Gusto account, credentials, provider request or money movement
is part of this verification.

## Checks

The combined HR suite passes **70 tests**: 17 native model/workflow, nine people
operations, seven insights/pay history, seven cross-module linkage, five service
desk, 11 SDK-client mock and 14 optional backend boundary tests. Tests exercise
actual pure host transitions and projections; model tests do not establish
browser, live provider or production acceptance.

## Browser results

After the source stabilized, the browser was fully reloaded before the combined
run. This avoids retaining development hot-reload state. All navigation below
used portal links within that single new session.

| Check | Observed result |
| --- | --- |
| Policy and onboarding link | Avery acknowledged the welcome policy. The related task became completed (`MOCK-PEOPLE-0002`) and onboarding's policy item became checked. Profile/job review and explicit summary/confirmation were still required; completion produced `MOCK-ONBOARDING-0001`. |
| Document scope | Avery acknowledged the non-tax welcome record (`MOCK-PEOPLE-0003`). The tax document remained a placeholder without acknowledgment, download or signature controls. |
| Date preview and submission | October 19–20 displayed and recorded exactly 16 weekday hours. A browser-reproduced mismatch between visible dates and submitted state was repaired with named form values, a fresh FormData snapshot and input-driven preview updates. |
| Leave reservations | Avery's 16 new hours plus the original 16 pending hours left eight vacation hours available. Repeating the overlapping request was refused. |
| Leave decisions | Morgan rejected the original request and approved the new 16 hours. Avery saw 24 hours available, then canceled the approved request and saw all 40 restored. |
| Employee training and assets | Avery completed own orientation, acknowledged the laptop and requested return. Employee return-confirmation controls were absent. Morgan confirmed return (`MOCK-PEOPLE-0011`). |
| Team training link | Morgan completed Jordan's starter training; Jordan's related task became completed (`MOCK-PEOPLE-0013`). Jordan's profile onboarding remained pending with confirmation unavailable. |
| HR request lifecycle | Avery created a fictional equipment request. Morgan assigned it to himself, started, resolved, reopened, started and resolved it again. Avery saw its resolution and seven activity actions; Jordan saw zero requests. Company seed cases stayed outside Morgan's queue. |
| Payroll source inputs | Avery confirmed health enrollment; Morgan approved Avery's original eight-hour October 9 time row. Draft Jordan hours and absence requests stayed out of payroll. |
| Payroll and employee receipt | Native submission `MOCK-PAYROLL-0003` produced $240 gross, $48 illustrative withholding, $25 sample benefits and $167 net. Avery's pay history showed the same frozen amounts, eight hours, `time-001` and Demo health plan. |
| Pay isolation | Switching to Jordan showed no simulated or historical pay statement. |
| Auditor | Reports showed no currency amounts or payroll controls. Payroll history showed receipt/entry/status metadata and historical fixture counts without amounts. |
| Management reports | Owner reports reconciled one consumed time entry, zero eligible unpaid hours, one enrollment, zero pending absence requests, one rejected and one canceled request, and the submitted $240/$48/$25/$167 totals. |

No real employee, banking, tax, medical or identity data was entered. The genuine
SDK UI was not rerun for this host enhancement; its existing contract tests
remain in the combined suite.

## Repository checks

`npm run ci:all` passed, including:

- Template blank-record and managed-release checks, host synchronization and
  both research package validations.
- 235 shared tooling tests (five case-sensitive-filesystem cases skipped),
  30 host integration tests, eight security operations tests, 11 app/LAN tests
  and all 70 HR tests.
- Full ESLint, TypeScript, documentation links, security/auth/agent checks,
  root and optional HR backend dependency audits, production build and LAN
  production isolation. Dependency audits reported zero vulnerabilities.

The new pure model checks include per-employee benefit caps and penny totals,
receipt replay/consumption guards, role and identity isolation, absence
reservation/release, multi-employee assignment normalization and atomic links.
These local checks do not establish production, provider, legal or payroll
acceptance. See [remaining adoption scope](HR-PORTAL.md#work-remaining-toward-a-production-hr-portal).

`npm run deploy -- hosting --preflight` also passed. It skipped version/changelog
mutation, commit, push and deployment. Version remains 3.4.0 and deployment count
remains zero. Final documentation links and whitespace checks were repeated
before source publication.

Final review also removed an existing dead employee-profile link for auditors.
Browser verification showed three directory records and zero View record links
as auditor, then three View record links as owner. Full CI and Hosting preflight
preceded this small navigation guard; TypeScript, full ESLint and all 70 HR tests
were repeated afterward. The local workspace was then reloaded to a clean owner
dashboard for further manual testing.
