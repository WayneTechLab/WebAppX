# Gusto mock browser verification — 2026-10-14

This local verification covers WebAppX 3.4.0 at published baseline
`bc86ae97f4f32667cf1e5be7d311b2f9133b4641` with the host fixes described below.
The native HR workspace ran in Vite on macOS Apple Silicon with Firebase
initialization disabled. An isolated browser tab preserved the original preview.
No Gusto account, credentials, provider call or financial action was used.

## Reproduced failures and repairs

1. **A profile edit retained a stale onboarding review.** Review Jordan's profile,
   job, checklist and onboarding summary; change the work email in My profile;
   return to onboarding. Before the repair, confirmation remained enabled.
   Profile email now belongs to the same canonical mock state as onboarding.
   Changing it before completion invalidates profile and summary review. An
   unchanged save preserves review. A later contact edit after completed hiring
   preserves active employment and the historical completion receipt.
2. **A running timer transferred to a different employee.** Start as Jordan,
   switch to Avery, then stop. Before the repair, elapsed time was recorded for
   Avery. Timers now bind employee, role and original work date. Identity/role
   changes and Reset cancel the running timer; the model also rejects a stop
   under another identity. Reset clears stale profile input values too.

Implementation: [workspace UI](../src/hr/components/HrWorkspace.tsx),
[mock state transitions](../src/hr/mock-workflows.ts) and
[regression checks](../tests/hr/mock-workflows.test.mjs).

## Browser results after repair

| Check | Observed result |
| --- | --- |
| Timer employee switch | Start as Jordan, switch to Avery: Start sample timer replaces Stop, and Avery receives no timer entry. |
| Timer Reset | Start a timer, Reset: timer is canceled and original entries are restored. |
| Timer normal stop/date | Start as Jordan on October 15, change the form date to October 14, then stop: a Jordan draft retains its original October 15 date. |
| Pending onboarding gate | Submit Jordan's eight new October 15 hours and approve only that entry as Morgan. Payroll preparation refuses it while Jordan remains onboarding. |
| Profile review invalidation | After summary review, save a changed fictional email: profile becomes pending, stage draft, summary and confirmation disabled. |
| Onboarding completion | Review the changed profile and summary again, confirm: `MOCK-ONBOARDING-0002`; the management directory shows Jordan Active with the saved email. |
| Unconfirmed benefit | Review Jordan's eligible retirement enrollment without confirming. Payroll includes one eight-hour row and zero benefit deductions. |
| Prepared snapshot | Confirm retirement after preparation. Calculation retains the frozen zero-benefit snapshot: $240 gross, $48 illustrative withholding, $192 net. |
| New preparation | Prepare again: exactly eight hours and one enrolled plan; $240 gross, $48 withholding, $25 benefit deduction, $167 net. |
| Review/submission | Review and simulate: `MOCK-PAYROLL-0004`; submission becomes disabled and the time row reads included in that receipt. |
| Duplicate-hour exclusion | Prepare again without any other eligible approved time: refused; the existing receipt remains intact. |
| Waiver and employee isolation | Confirm Avery's health waiver, approve Avery's preloaded eight-hour entry and prepare. Jordan's paid hours and enrollment are excluded; Avery has zero benefit deductions and $192 net. |
| Second receipt | Review and simulate Avery's run: `MOCK-PAYROLL-0007`; both separate receipts remain visible. |
| Auditor scope | Auditor has no Payroll workspace navigation; Payroll history shows aggregate receipts without payroll mutation controls. |

Jordan's original six-hour fixture remained submitted and unapproved. The small
timer entry remained draft. Neither entered either payroll receipt. All sample
payroll inputs were inside the fixed October 1–15, 2026 period.

## Code checks

- `npm run hr:test`: **41 tests passed** — 16 native model/workflow tests,
  11 published SDK-client mock tests and 14 optional backend boundary tests.
- TypeScript and full repository ESLint checks passed.
- Production build and LAN isolation passed.
- Template validation preserved blank records, immutable releases, both research
  packages and version metadata. Host synchronization reported no drift.

### Publication recheck — 2026-10-14

- `npm run ci:all` passed: 235 shared tooling cases (five case-sensitive-filesystem
  cases skipped on this macOS volume), 30 host integration cases, eight security
  operations cases, 11 app/LAN cases and the 41 HR cases above. Lint, TypeScript,
  security/auth/agent standards, root and optional HR backend audits, Markdown
  links, production build and LAN isolation passed. Audits reported zero
  vulnerabilities.
- `npm run deploy -- hosting --preflight` passed. It skipped version/changelog
  changes, commit, push and deployment; the deployment count stayed zero.
- Final documentation links and `git diff --check` passed before the source
  commit. The app version remains 3.4.0; this is a fixes/documentation update.

These results establish the integrated native mock behavior. The separate SDK
sample has its own state; native timesheets and elections are not exported into
that fixture. This session did not retest the SDK onboarding/payroll UI, deploy
Firebase services or establish provider, tax, benefits or production acceptance.
See [Gusto setup](GUSTO-SETUP.md) and the earlier
[3.4.0 release receipt](VALIDATION-3.4.0.md) for those documented boundaries.
