# WebAppX 3.4.0 validation — 2026-10-13

This receipt covers the account-free mock workflow extension on macOS Apple
Silicon. The selected portable defaults remain dotSYSTEMX **1.9.0-alpha.6** at
**7f0d82b7ba8531ac04d897209d8c1ed263ee29cb**, with manifest SHA-256
**009e6b6c2f1359fa4c88e3961164d28cc89f65cea2a6682200fb2953caf326e3**.
The [original import receipt](../.SYSTEMX/imports/1.9.0-alpha.6.json) and all retained
snapshots stay unchanged. This release extends WebAppX host code; it does not
rewrite the portable release or populate reusable project records.

## Implemented mock coverage

- Native onboarding: profile/job/checklist review, summary, confirmation receipt
  and Active directory readback across portals.
- Native benefits: own eligible plan election/waiver, review, confirmation and
  subsequent fictional payroll deduction.
- Native time tracking: manual/timer draft, own submission, scoped manager
  approval and eligible payroll inclusion. Daily totals are bounded at 24 hours.
- Native payroll: approved, unpaid active-employee entries in the fixed
  2026-10-01–15 period, frozen inputs/elections, fictional calculation, review,
  simulated receipt and duplicate-hours exclusion.
- Genuine SDK 0.56.6 / API 2026-06-15: directory plus selected administrative
  onboarding and payroll execution paths through the Vite-only mock API.
  Issued sessions isolate records; bodies, fields, versions, resource IDs and
  methods are bounded. Browser credentials are omitted and refused by the mock.
- SDK onboarding completion separately verifies saved data and explicit simulated
  form/new-hire-report confirmations, updates status and reads it back. Summary
  navigation alone does not count as completion. I-9 is outside the sample.
- SDK payroll calculation/submission follow the published 202-empty-response and
  polling contract, with fictional zero-tax totals and local-only receipts.

## Observed browser checks

The native journey completed Jordan's onboarding and read Active in management.
Avery's health election was confirmed, eight hours dated 2026-10-15 were submitted
and approved by Morgan, and payroll prepared exactly that approved row and one
confirmed plan. It showed fictional gross **$240**, illustrative withholding
**$48**, benefit deduction **$25**, net **$167**, then a simulated submission
receipt. Reset cleared receipts and returned payroll to idle.

The genuine administrative SDK data wizard was traversed through Profile,
Compensation, Federal taxes, Texas state handling, Check payment, Deductions and
Summary. Summary correctly retained missing form/report requirements. The
separate explicit mock review completed the record; a GET verified completion
and the SDK Active directory showed Jordan. The work-address request was checked
in browser network evidence: its location-only payload is valid, so an omitted
effective date is accepted. Stable provider configuration/callbacks preserve flow
state while events are logged.

The genuine SDK payroll journey prepared the fixed October 5–18 regular payroll,
edited Avery's hours from 80 to eight, saved the row, calculated and opened the
review. It showed **$200** gross/company pay, **$0** taxes and debit, a fictional
masked account, and Check payment. Submit reached the SDK payroll summary plus
the host's simulated-processing notice. Reset restored the editable initial
80-hour/$2,000 fixture and cleared the processed state.

## Publication checks

- `npm run ci:all` passed: 235 shared tooling cases (five case-sensitive-filesystem
  cases skipped on this macOS volume), 30 host integration cases, eight security
  operations cases, 11 app/LAN cases and **39 HR cases** (14 native transitions,
  11 published-client mock cases and 14 backend cases).
- Template blank seeds, retained release integrity, both research packages,
  selected upstream receipt and version consistency passed. Host synchronization
  reported no drift.
- Lint, TypeScript, security/auth/agent standards and 730 Markdown file link
  checks passed. Root and optional HR backend audits reported zero vulnerabilities.
- Production build and LAN isolation passed. A final SDK event comparison cleanup
  was checked again with lint, TypeScript and build: the production SDK preview
  JavaScript chunk is 3.49 kB, with development SDK logic excluded.
- `npm run deploy -- hosting --preflight` passed on the final runtime source.
  It explicitly skipped changelog/commit, push and deployment; deployment count
  remains zero. Final documentation-only edits are rechecked before publication.

## Evidence limits

The native and SDK scenarios have separate state and illustrative calculation
rules. Neither is a tax engine or a provider acceptance test. SDK coverage is
limited to the documented sample paths, with no direct-deposit setup, I-9,
provider document signing, legal filing, payroll cancellation, receipt/paystub/
check PDF downloads, off-cycle/dismissal payroll or other
unimplemented operations. Real OAuth, forwarding, reconciliation and production
payroll remain disabled. Benefits and raw timesheets use native interfaces;
future time-provider adoption requires the applicable shift-level API contract.

Optional Firebase Functions/rules are unchanged; their prior emulator evidence
belongs to the [3.3.0 receipt](VALIDATION-3.3.0.md). No Gusto account, credentials,
real employee records, payroll execution or cloud deployment was used. Windows
x64/ARM64 and native Linux runtime were not tested in this release.
