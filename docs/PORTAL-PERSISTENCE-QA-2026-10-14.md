# HR, CMS and CRM browser persistence — 2026-10-14

This follow-up to WebAppX 3.4.0 adds account-free browser persistence to the
native portal demos. The source baseline was
`e6418cd1d22fa9ed5bca0ed44b8d984d8c29a56a`. The earlier
[talent and portal receipt](HR-TALENT-QA-2026-10-14.md) describes its historical
memory-only behavior; this receipt records the persistence update.

## Storage contract

The same browser profile and origin restore separate schema-1 localStorage
snapshots at `webappx.demo.hr`, `webappx.demo.cms` and `webappx.demo.crm`.
Saved actions write synchronously; original fixtures do not write until an
action is saved. HR stores its linked domain state in one snapshot so hires,
onboarding, balances and payroll references restore together. CMS retains the
frozen published revision separately from the editable draft. CRM retains its
linked company/contact/lead/opportunity/task records and receipts.

Each Reset removes only its module's snapshot and restores its fixtures.
Malformed or unsupported saves open fresh fixtures with a visible recovery
notice. Denied or full storage leaves the demo usable in memory with a warning.
If removing storage fails, the Reset warning explains that an older save may
return after refresh. No account, Firebase write, provider request, actual
publication, message, payment or production deployment is needed.

These are inspectable fictional samples, not a secure personal-record store.
Unsaved fields, running timers and most view selections are transient. Changing
host/port/protocol, private browsing, or clearing site data can hide or remove a
save. Tabs do not merge live; the last successful write wins. The separate SDK
preview is outside this persistence contract; native HR reloads its own save on
return.

## Browser observations

| Area | Result observed in the local browser |
| --- | --- |
| CMS draft | Saved the article as `Refresh-safe fictional update`, revision 2. Refresh restored its title, revision and `MOCK-CMS-0001` activity. |
| CMS publication | Requested review, approved as the separate reviewer, simulated publication as publisher, then refreshed. Frozen revision 2 and `MOCK-CMS-0004` returned. |
| CMS draft/publication separation | Saved revision 3 as `Unpublished revision survives refresh`. Refresh restored the editable draft while the published projection retained revision 2 and its earlier title. |
| CRM lead | Created `Refresh Demo` at `refresh@fiction.invalid` for Fictional Refresh Studio. Refresh restored the lead. |
| CRM conversion and pipeline | Qualified and converted that lead once; advanced the linked $1,500 opportunity through proposal and negotiation to won. Refresh restored $1,500 won, $6,500 open pipeline, three companies, three contacts and six successful actions. |
| HR hire | Published the seeded job and hired Casey through screening/interview/offer. Refresh restored the hire, linked identity and one remaining active candidate. |
| HR onboarding | Selected Casey, completed profile/job/checklist review and confirmation. Refresh restored completion and `MOCK-ONBOARDING-0001`. |
| HR time and payroll | Added eight Casey hours, submitted and refreshed; approved as Morgan. Prepared payroll and refreshed: one entry/eight hours remained prepared. Calculated, reviewed, submitted and refreshed: `MOCK-PAYROLL-0003`, $240 gross, $48 illustrative withholding, $0 benefits and $192 net were intact. |
| HR benefits | Avery enrolled in the fictional health plan, reviewed and confirmed it. Refresh retained the confirmed election and `MOCK-BENEFIT-0004`. This later election did not change Casey's already frozen payroll. |
| HR performance | Saved Avery's goal at 40% and a fictional self-review draft. Refresh retained both values and the employee identity. |
| HR surveys | Published the seeded survey, saved Avery's rating 4/text and refreshed. Both draft answers returned; submission followed by refresh retained `MOCK-SURVEY-0003` and locked answers with zero responses still due for Avery. |
| Native HR remount | Opened the separate SDK preview and returned to native HR; then visited About and used Back. HR restored four people, a confirmed election, one submitted payroll receipt and the talent state. No SDK data was merged. |
| CMS Reset | Reset CMS and refreshed: original article revision 1 and one published sample returned. CRM still had $1,500 won; HR still had four people and one submitted receipt. |
| CRM Reset | Reset CRM and refreshed: two companies/two contacts, zero activity and $0 won returned. HR still had four people and its submitted receipt. |
| HR Reset | Reset HR and refreshed: three seeded people, zero benefit elections and zero submitted receipts returned. Independently saved CMS draft `HR reset preserves this CMS draft` and CRM lead `Portal Reset Demo` survived. |

## Verification gates

- `npm run hr:test`: **116 passed**, including seven new composite HR persistence
  cases for linked records, complete nested validation and JSON round trips.
- `npm run portals:test`: **36 passed**: 20 existing CMS/CRM workflow cases, nine
  CMS/CRM persistence cases and seven shared storage cases. The shared storage
  cases include malformed/unsupported envelopes, denied reads, quota/write
  failures, failed removal, serialization errors, size limits and reset isolation.
- Browser checks above used real saved actions and refresh/navigation controls.
  Storage-denial and corrupted-envelope recovery were verified with injected
  storage doubles in the model suite, not browser privacy-setting changes.
- A bounded independent integration review found no actionable persistence
  defects. Reset feedback was kept neutral so the storage notice remains the
  authority if removing a saved snapshot fails.

- `npm run ci:all` passed, including the production build and LAN isolation;
  235 shared SYSTEMX cases (five case-sensitive-filesystem cases skipped),
  30 host integration cases, eight security operations cases and 11 app/LAN
  cases. Lint, TypeScript, template/import/research integrity, SYSTEMX drift,
  security/auth/AI checks and documentation links passed. Root and optional
  HR backend dependency audits reported zero vulnerabilities.

- `npm run deploy -- hosting --preflight` passed with build and LAN isolation.
  It skipped changelog/commit, push and deployment, retained version 3.4.0 and
  deployment count zero.
- Final documentation links and SYSTEMX drift checks passed before publication.

Version remains 3.4.0; managed SYSTEMX snapshots, research packages and reusable
blank project records retain their existing provenance.
