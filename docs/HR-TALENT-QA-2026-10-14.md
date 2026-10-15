# HR talent, CMS and CRM verification — 2026-10-14

This local update extends WebAppX 3.4.0 from published baseline
`029d585821da0865b8bb453dd1404767e445935c`. It adds recruiting, performance
reviews and identified surveys to the native HR dashboard, plus independent
account-free CMS and CRM workspaces in the shared `/portals` shell.

The earlier [HR portal receipt](HR-PORTAL-QA-2026-10-14.md) and its 70-test result
remain historical. This update uses fictional records only, with Firebase
initialization disabled in the local Vite session. No account, credentials,
provider request, real publication, outbound message or payment is required.

## Model checks

The HR suite now passes **109 tests**: the previous 70, four additional talent
insight cases, eight recruiting cases, six hire-to-HR integration cases, ten
performance cases and 11 survey cases. The CMS and CRM suites add **20 tests**
(ten each). Model tests cover actual pure transitions and scoped projections.
They do not establish browser, provider or production acceptance.

## Browser verification

Browser checks used isolated local tabs. Build/preflight commands completed
before the final shared-session pass, so development reloads did not invalidate
that preservation check. The separate genuine SDK UI was outside this update.

| Area | Observed result |
| --- | --- |
| Recruiting | Published the seeded support job; moved Casey through applied, screening, interview and offer to hired. The new identity appeared in the four-person directory and employee selector with pending onboarding and unconfigured compensation. |
| Hire-to-HR link | Casey completed profile/job/checklist review, received a completion receipt and 40 vacation/24 sick sample hours. Eight submitted October 15 hours were approved by Morgan and consumed by `MOCK-PAYROLL-0003`; Casey's own statement reconciled $240 gross, $48 illustrative withholding, $0 benefits and $192 net. |
| New-hire display fix | The browser initially showed the generated ID as the timesheet heading because the new employee did not have the fixture's optional `name` field. The table now derives the display name from first/last name. Casey Fiction was verified before approval. |
| Performance | Avery saved and submitted a self-review; Morgan saved and published feedback; Avery acknowledged the locked review. Self drafts were absent from the manager view before submission, and manager drafts were absent from the employee view before publication. |
| Goals/dashboard | Saved sample goal progress and completed the goal. Avery's dashboard showed one completed goal and zero open own reviews. Management showed one completed goal, one remaining review, one completed hire and one active candidate. |
| Survey privacy | Published the saved survey to Avery and Jordan. A saved but unsubmitted answer produced zero HR results. Submission removed repeat/edit controls; the other employee saw their own form. |
| Survey results | Submitted ratings 5 and 3: two of two assigned respondents, average 4.00, distribution one at 3 and one at 5. Closed receipt `MOCK-SURVEY-0007`; management dashboard showed one closed survey and two submitted responses. Feedback is explicitly identified. |
| CMS review | Saved revision 2, requested review, returned with reviewer feedback, revised to 3 and received separate approval. Publisher simulated revision 3 publication in `MOCK-CMS-0007`. |
| CMS frozen snapshot | Edited to revision 4. The public-shaped preview retained revision 3 and excluded the new draft title; publication was disabled until a new review/approval. Revision 4 then published successfully. |
| CMS retirement/guards | Retiring removed the article from the published projection. The editorial viewer had zero create/publish controls. Duplicate `welcome` slug was refused; a distinct fictional draft was created successfully. |
| CRM lead/pipeline | Qualified and converted Jules once into a linked company/contact/opportunity; conversion replay controls disappeared. Moved discovery → proposal → negotiation → won at $1,500 fictional value. |
| CRM follow-ups | Created a sample follow-up and completed it plus the seeded task. Riley's dashboard showed $2,500 open pipeline, $1,500 won and zero open follow-ups. |
| CRM directory/forms | Created Fictional Beacon Studio and Demo Partner with `.invalid` email, then created/qualified/converted Taylor's lead. Conversion reused the same-owner company; totals were three companies/four contacts, and the new $1,500 opportunity reached won. |
| CRM permissions | Riley could not see the owner-created Beacon deal or Sam's Orbit deal. Auditor views exposed no create or stage-mutation controls. |
| Shared portal session | A CMS draft survived visits to HR and CRM; the new HR employee and CRM won amount survived return visits. Browser navigation remained within the shared demo routes. |
| Isolated reset | Reset CMS removed its draft while CRM retained $1,500 won and HR retained four people. Refresh and leaving the demo shell clear memory. Opening the separate SDK preview resets native HR; that exception is documented. |

The CMS viewer is an editorial read-only role that can inspect draft metadata.
Only **Published sample preview** is a public-shaped, frozen projection. It
excludes author/reviewer details and draft feedback. No website is deployed.
No HR records were copied into CRM or CMS.

## Repository gates

- `npm run ci:all` passed: blank-template/import/research checks, 235 shared
  tooling tests (five case-sensitive-filesystem cases skipped), 30 host
  integration tests, eight security operations tests, 11 app/LAN tests,
  109 HR tests and 20 CMS/CRM tests.
- Full ESLint, TypeScript, root and optional HR backend audits, security/auth/AI
  checks, documentation links, production build and LAN isolation passed.
  Dependency audits reported zero vulnerabilities.
- Hosting preflight passed with no deployment, Git or version mutation.
- After the timesheet display-name correction, TypeScript, full ESLint and all
  109 HR tests passed again. Final Hosting preflight and documentation checks
  were repeated before publication.

Version stays 3.4.0 and deployment count stays zero. Managed dotSYSTEMX defaults,
immutable release snapshots, research packages and blank adoption seeds are
preserved. These are local mock results, not provider, legal, employment,
production, sales or publication acceptance.
