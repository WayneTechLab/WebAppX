# Reviewed HR role examples

These are concrete synthetic examples from the reviewed fixture. Use the
[canonical cross-portal capability matrix](PORTAL-CAPABILITIES.md) for the complete vocabulary, role scopes and provider boundary.
A role example is an actor, resource, action and current state; opening a route does not establish permission for its domain transitions.

Review basis: ` aae465ae033f3191a69ed7d40056b0c6e2159e17 ` and proposal ` WX-0908 `.
Original criterion: A documentation generator derives the HR role examples from reviewed capability fixtures, links the canonical cross-portal matrix and fails its consistency check when documented actions drift from the fixture definitions.

The [reviewed fixture](../tests/fixtures/hr-capability-examples.json) supplies each action, prerequisite and literal expected result.
The independent [domain tests](../tests/hr/role-examples.test.mjs) exercise the actual HR transitions, ownership checks, projections and complete backup codecs.
Synthetic preview choices and local MOCK receipts do not authenticate people, assign account grants, establish tenant membership or enable provider operations.

## Regenerate and check

```bash
node scripts/hr-role-examples.mjs --check
node --test tests/hr/role-examples.test.mjs
node scripts/hr-role-examples.mjs --write
```

Check mode is the default and writes no files. Explicit write mode regenerates this page.
The consistency check compares the complete generated page with the fixture and verifies the reviewed source digests. UTF-8 text uses LF-normalized SHA-256; CRLF and LF checkout line endings are equivalent. Source drift requires reviewing the behavior and refreshing the fixture, then rendering.
Importing the generator performs no I/O. It does not import application models, inspect credentials or contact providers.

## Actor and resource examples

### ` employer-owner `

Synthetic actor: ` {"role":"employer-owner"} `.

Company administration uses known employee resources; it cannot impersonate a review author or assigned manager.

Visible employee IDs: ` ["employee-001","employee-002","employee-003"] `. Visible document IDs: ` ["document-001","document-002","document-003"] `.
Compensation visibility for ` employee-002 `: **visible**. A saved draft self-review for employee-002 is **excluded** in this actor’s performance helper projection.
These helper projections do not add routes; the current auditor performance page remains unavailable.

#### owner-change-known-profile — ALLOW

Action: Save a fictional work email for a known employee.
Actor: ` {"role":"employer-owner"} `; resource: ` employee-002 `; domain: ` workflow `.

- Prerequisite: Employee exists in the synthetic fixture.

Attempted event: ` {"type":"change-profile","employeeId":"employee-002","workEmail":"reviewed.example@example.invalid"} `.

Expected: The known employee profile email changes in copied mock state.
Observable result: ` profileEmails.employee-002 ` equals ` reviewed.example@example.invalid `.

#### owner-cannot-impersonate-self-review — DENY

Action: Attempt to save another person’s self-review.
Actor: ` {"role":"employer-owner"} `; resource: ` review-seed-employee-002 `; domain: ` performance `.

- Prerequisite: The review exists in draft; its subject is employee-002.

Attempted event: ` {"type":"save-self-review","reviewId":"review-seed-employee-002","comments":"Fictional self review draft."} `.

Expected: Administrative role does not satisfy the bound self author requirement.
Exact refusal: ` Only the employee can write or submit their own sample self-review. `.

### ` payroll-admin `

Synthetic actor: ` {"role":"payroll-admin"} `.

Onboarding review and simulated payroll are separate from profile editing and time approval.

Visible employee IDs: ` ["employee-001","employee-002","employee-003"] `. Visible document IDs: ` ["document-001","document-002","document-003"] `.
Compensation visibility for ` employee-002 `: **visible**. A saved draft self-review for employee-002 is **excluded** in this actor’s performance helper projection.
These helper projections do not add routes; the current auditor performance page remains unavailable.

#### payroll-review-onboarding — ALLOW

Action: Review the profile prerequisite in employee onboarding.
Actor: ` {"role":"payroll-admin"} `; resource: ` employee-003 `; domain: ` workflow `.

- Prerequisite: Employee exists; onboarding stage is draft.

Attempted event: ` {"type":"review-profile","employeeId":"employee-003"} `.

Expected: The profile prerequisite becomes reviewed; onboarding is still draft.
Observable result: ` onboarding.employee-003.profileReviewed ` equals ` true `.

#### payroll-cannot-edit-profile — DENY

Action: Attempt to change an employee profile email.
Actor: ` {"role":"payroll-admin"} `; resource: ` employee-002 `; domain: ` workflow `.

- Prerequisite: Employee exists; a payroll role does not grant profile editing.

Attempted event: ` {"type":"change-profile","employeeId":"employee-002","workEmail":"reviewed.example@example.invalid"} `.

Expected: Profile editing is refused without modifying the source state.
Exact refusal: ` This demo role cannot change that employee profile. `.

### ` hr-admin `

Synthetic actor: ` {"role":"hr-admin"} `.

Company people operations exclude compensation and payroll amounts; HR cannot write an assigned manager review.

Visible employee IDs: ` ["employee-001","employee-002","employee-003"] `. Visible document IDs: ` ["document-001","document-002","document-003"] `.
Compensation visibility for ` employee-002 `: **excluded**. A saved draft self-review for employee-002 is **excluded** in this actor’s performance helper projection.
These helper projections do not add routes; the current auditor performance page remains unavailable.

#### hr-approve-submitted-time — ALLOW

Action: Approve a known employee’s submitted time entry.
Actor: ` {"role":"hr-admin"} `; resource: ` time-001 `; domain: ` workflow `.

- Prerequisite: Entry belongs to employee-002 and is submitted.

Attempted event: ` {"type":"approve-time","entryId":"time-001"} `.

Expected: The submitted entry becomes approved in copied mock state.
Observable result: ` timeEntries.0.status ` equals ` approved `.

#### hr-cannot-impersonate-manager-review — DENY

Action: Attempt to write the assigned manager’s review.
Actor: ` {"role":"hr-admin"} `; resource: ` review-seed-employee-002 `; domain: ` performance `.

- Prerequisite: Review records employee-001 as the assigned manager.

Attempted event: ` {"type":"save-manager-review","reviewId":"review-seed-employee-002","comments":"Fictional manager review."} `.

Expected: HR administration cannot replace the assigned direct manager.
Exact refusal: ` Only the assigned direct manager can review or publish this sample cycle. `.

### ` manager `

Synthetic actor: ` {"role":"manager","employeeId":"employee-001"} `.

The actor is employee-001; approval requires a submitted direct-report record and excludes the manager’s own entries.

Visible employee IDs: ` ["employee-001","employee-002","employee-003"] `. Visible document IDs: ` ["document-001","document-002"] `.
Compensation visibility for ` employee-002 `: **excluded**. A saved draft self-review for employee-002 is **excluded** in this actor’s performance helper projection.
These helper projections do not add routes; the current auditor performance page remains unavailable.

#### manager-approve-direct-report — ALLOW

Action: Approve submitted time for a current direct report.
Actor: ` {"role":"manager","employeeId":"employee-001"} `; resource: ` time-001 `; domain: ` workflow `.

- Prerequisite: Actor employee-001 is the current manager of employee-002.
- Prerequisite: The time entry is submitted, and its subject differs from the actor.

Attempted event: ` {"type":"approve-time","entryId":"time-001"} `.

Expected: The direct report’s submitted entry becomes approved.
Observable result: ` timeEntries.0.status ` equals ` approved `.

#### manager-refuse-draft-time — DENY

Action: Attempt to approve a direct report’s draft entry.
Actor: ` {"role":"manager","employeeId":"employee-001"} `; resource: ` time-002 `; domain: ` workflow `.

- Prerequisite: Actor employee-001 manages employee-003.
- Prerequisite: The time entry is draft, rather than submitted.

Attempted event: ` {"type":"approve-time","entryId":"time-002"} `.

Expected: The reporting line does not bypass the submitted-state prerequisite.
Exact refusal: ` Approval requires a submitted entry within this role and team scope; self-approval is unavailable. `.

#### manager-refuse-unrelated-report — DENY

Action: Attempt to approve submitted time outside the actor’s reporting line.
Actor: ` {"role":"manager","employeeId":"employee-003"} `; resource: ` time-001 `; domain: ` workflow `.

- Prerequisite: Actor employee-003 is a known employee using the manager preview.
- Prerequisite: Employee-002 reports to employee-001, not employee-003.

Attempted event: ` {"type":"approve-time","entryId":"time-001"} `.

Expected: The manager role alone cannot approve another manager’s report.
Exact refusal: ` Approval requires a submitted entry within this role and team scope; self-approval is unavailable. `.

#### manager-refuse-self-approval — DENY

Action: Attempt to approve the manager’s own submitted time.
Actor: ` {"role":"manager","employeeId":"employee-001"} `; resource: ` MOCK-TIME-0001 `; domain: ` workflow `.

- Prerequisite: Actor employee-001 creates and submits their own draft in the setup steps.
- Prerequisite: The entry is submitted but its employeeId equals the actor.

Setup transitions, in order: ` {"actor":{"role":"manager","employeeId":"employee-001"},"event":{"type":"add-time","date":"2026-10-15","hours":1,"source":"manual"}} `; ` {"actor":{"role":"manager","employeeId":"employee-001"},"event":{"type":"submit-time","entryIds":["MOCK-TIME-0001"]}} `.

Attempted event: ` {"type":"approve-time","entryId":"MOCK-TIME-0001"} `.

Expected: Manager self approval is refused even after submission.
Exact refusal: ` Approval requires a submitted entry within this role and team scope; self-approval is unavailable. `.

#### manager-refuse-unsubmitted-review — DENY

Action: Attempt to publish a review before self submission.
Actor: ` {"role":"manager","employeeId":"employee-001"} `; resource: ` review-seed-employee-002 `; domain: ` performance `.

- Prerequisite: The actor is the recorded reviewer and current direct manager.
- Prerequisite: The review is still draft.

Attempted event: ` {"type":"publish-review","reviewId":"review-seed-employee-002"} `.

Expected: The correct manager cannot skip the self-submission prerequisite.
Exact refusal: ` The employee must submit the self-review before manager review. Published reviews are locked. `.

#### manager-publish-reviewed-cycle — ALLOW

Action: Publish a cycle after the employee submits and the assigned manager saves comments.
Actor: ` {"role":"manager","employeeId":"employee-001"} `; resource: ` review-seed-employee-002 `; domain: ` performance `.

- Prerequisite: Employee-002 saves and submits their own self-review.
- Prerequisite: Employee-001 is both the recorded reviewer and current direct manager and saves manager comments.

Setup transitions, in order: ` {"actor":{"role":"employee","employeeId":"employee-002"},"event":{"type":"save-self-review","reviewId":"review-seed-employee-002","comments":"Fictional self review draft."}} `; ` {"actor":{"role":"employee","employeeId":"employee-002"},"event":{"type":"submit-self-review","reviewId":"review-seed-employee-002"}} `; ` {"actor":{"role":"manager","employeeId":"employee-001"},"event":{"type":"save-manager-review","reviewId":"review-seed-employee-002","comments":"Fictional manager review."}} `.

Attempted event: ` {"type":"publish-review","reviewId":"review-seed-employee-002"} `.

Expected: The reviewed cycle becomes a published local sample.
Observable result: ` reviews.0.stage ` equals ` published `.

### ` employee `

Synthetic actor: ` {"role":"employee","employeeId":"employee-002"} `.

The actor is employee-002; self service requires that exact known employee and the current workflow stage.

Visible employee IDs: ` ["employee-002"] `. Visible document IDs: ` ["document-001","document-002"] `.
Compensation visibility for ` employee-002 `: **visible**. A saved draft self-review for employee-002 is **visible** in this actor’s performance helper projection.
These helper projections do not add routes; the current auditor performance page remains unavailable.

#### employee-edit-own-profile — ALLOW

Action: Save a fictional email for the bound employee.
Actor: ` {"role":"employee","employeeId":"employee-002"} `; resource: ` employee-002 `; domain: ` workflow `.

- Prerequisite: Actor employee-002 matches the known employee resource.

Attempted event: ` {"type":"change-profile","employeeId":"employee-002","workEmail":"reviewed.example@example.invalid"} `.

Expected: The bound employee can change their own sample email.
Observable result: ` profileEmails.employee-002 ` equals ` reviewed.example@example.invalid `.

#### employee-refuse-foreign-profile — DENY

Action: Attempt to edit another employee’s profile using its known ID.
Actor: ` {"role":"employee","employeeId":"employee-002"} `; resource: ` employee-003 `; domain: ` workflow `.

- Prerequisite: Actor remains employee-002; the target is employee-003.

Attempted event: ` {"type":"change-profile","employeeId":"employee-003","workEmail":"foreign.example@example.invalid"} `.

Expected: Knowing a foreign employee ID does not satisfy ownership.
Exact refusal: ` This demo role cannot change that employee profile. `.

#### employee-refuse-unreviewed-benefit — DENY

Action: Attempt to confirm an own benefit election before review.
Actor: ` {"role":"employee","employeeId":"employee-002"} `; resource: ` benefit-001 `; domain: ` workflow `.

- Prerequisite: The plan is available to employee-002.
- Prerequisite: The employee has saved an election, but its stage is draft.

Setup transitions, in order: ` {"actor":{"role":"employee","employeeId":"employee-002"},"event":{"type":"elect-benefit","planId":"benefit-001","election":"enroll"}} `.

Attempted event: ` {"type":"confirm-benefit","planId":"benefit-001"} `.

Expected: An own election still requires the review transition.
Exact refusal: ` Review the sample election before confirming. `.

#### employee-confirm-reviewed-benefit — ALLOW

Action: Confirm an own available benefit election after review.
Actor: ` {"role":"employee","employeeId":"employee-002"} `; resource: ` benefit-001 `; domain: ` workflow `.

- Prerequisite: The plan is available to employee-002.
- Prerequisite: The employee elects and reviews the sample before confirmation.

Setup transitions, in order: ` {"actor":{"role":"employee","employeeId":"employee-002"},"event":{"type":"elect-benefit","planId":"benefit-001","election":"enroll"}} `; ` {"actor":{"role":"employee","employeeId":"employee-002"},"event":{"type":"review-benefit","planId":"benefit-001"}} `.

Attempted event: ` {"type":"confirm-benefit","planId":"benefit-001"} `.

Expected: The reviewed own election becomes confirmed with a mock receipt.
Observable result: ` benefitElections.0.stage ` equals ` confirmed `.

### ` contractor `

Synthetic actor: ` {"role":"contractor","contractorId":"contractor-001"} `.

The actor is contractor-001; its document projection excludes employee records. Contractor UI checklist toggles are local preview state.

Visible employee IDs: ` [] `. Visible document IDs: ` ["document-003"] `.
Compensation visibility for ` employee-002 `: **excluded**. A saved draft self-review for employee-002 is **excluded** in this actor’s performance helper projection.
These helper projections do not add routes; the current auditor performance page remains unavailable.

#### contractor-refuse-employee-time — DENY

Action: Attempt to create employee time from a contractor identity.
Actor: ` {"role":"contractor","contractorId":"contractor-001"} `; resource: ` contractor-001 `; domain: ` workflow `.

- Prerequisite: Actor is bound to a contractor, without an employee identity.

Attempted event: ` {"type":"add-time","date":"2026-10-15","hours":1,"source":"manual"} `.

Expected: Contractor page access does not grant employee time transitions.
Exact refusal: ` A bound synthetic employee identity is required. `.

### ` auditor `

Synthetic actor: ` {"role":"auditor"} `.

Company directory and metadata reads do not permit domain writes; auditor helper projections do not create additional page access.

Visible employee IDs: ` ["employee-001","employee-002","employee-003"] `. Visible document IDs: ` ["document-001","document-002","document-003"] `.
Compensation visibility for ` employee-002 `: **excluded**. A saved draft self-review for employee-002 is **excluded** in this actor’s performance helper projection.
These helper projections do not add routes; the current auditor performance page remains unavailable.

#### auditor-refuse-time-approval — DENY

Action: Attempt to approve a visible submitted company time entry.
Actor: ` {"role":"auditor"} `; resource: ` time-001 `; domain: ` workflow `.

- Prerequisite: Entry is submitted and belongs to a known employee.
- Prerequisite: Auditor directory visibility does not grant approval.

Attempted event: ` {"type":"approve-time","entryId":"time-001"} `.

Expected: The auditor’s readable metadata does not permit domain mutation.
Exact refusal: ` Approval requires a submitted entry within this role and team scope; self-approval is unavailable. `.

## Complete mock exports and narrower visible projections

Every preview role can export the complete saved module workspace; the shared backup codecs take complete state and no actor argument. Combined export includes all three complete workspaces without a preview identity.

- Included: Saved HR performance self-review and manager drafts, survey draft answers, payroll state and mock receipts where present.
- Included: Unpublished CMS drafts and review metadata; CRM records belonging to other representatives.
- Excluded: Unsaved form inputs, running timers, restore-point history and the separate SDK mock session.

An HR contractor or auditor can therefore export saved private draft content that is absent from their visible pages. A CMS viewer export contains unpublished content, and a CRM representative export contains other representatives’ saved records.
The module and combined codecs validate complete fictional graphs and file compatibility; they receive no actor and apply no role or field filtering. A portal selection during restore does not narrow the export.

Readable JSON backups and synthetic role choices do not authenticate a person, grant Firebase claims or tenant membership, or authorize provider access. Production export needs its own trusted actor, resource and field policy.

## Reviewed source fingerprints

These fingerprints bind the examples to reviewed local source bytes. They are review evidence, without a current deployment or provider acceptance claim.

| Source | SHA-256 |
| --- | --- |
| [docs/PORTAL-CAPABILITIES.md](../docs/PORTAL-CAPABILITIES.md) | ` cc2053d3b5a1b871dcd21e48b5fabe079af3e313bb83bf9453932ccba7850e38 ` |
| [src/hr/model.ts](../src/hr/model.ts) | ` 32c3a83203c4a07a5cee5bb0d244a252f32992da71eef2b2cf61f3170e9e1f4e ` |
| [src/hr/mock-workflows.ts](../src/hr/mock-workflows.ts) | ` a9b18d468e6f0dd573c06ebaa6d9558eab2e200044373bcf588821e0f21aa235 ` |
| [src/hr/performance.ts](../src/hr/performance.ts) | ` e4dd5404f9c826a162981904fbc0417588b64252998fa4ac1ca7c0477c8c716f ` |
| [src/hr/surveys.ts](../src/hr/surveys.ts) | ` 5bc231e4a19c62c3a2b7520e93026f885d1f0f636e89306ccfa76d0a7f0a2b85 ` |
| [src/hr/persistence.ts](../src/hr/persistence.ts) | ` eb7fa71d65db06407ade439897ae5bc5c9cf305c05751b9cc77f8b9681a97c62 ` |
| [src/portals/backup.ts](../src/portals/backup.ts) | ` b65026ffc361a10b03a9585ae720d54f9c14f53f0ea5c9bf2b3c6dad53a26a1a ` |
| [src/portals/combined-backup.ts](../src/portals/combined-backup.ts) | ` 186c9b29a0ce2d74b81bacba0713675ea85713bc452d1ee6a5dc26927b96a726 ` |
| [src/portals/DemoWorkspaceBackup.tsx](../src/portals/DemoWorkspaceBackup.tsx) | ` 5c1028cd8b954c77fffbc3c5ac33d2f232874109f57929911b61a9608c57dc88 ` |
| [src/portals/CombinedWorkspaceBackup.tsx](../src/portals/CombinedWorkspaceBackup.tsx) | ` 3fb8f664f402c95fa4a3f78702ec0b98ffcf5483fe1c4a3808901a572f2cb6e6 ` |
| [src/hr/components/HrWorkspace.tsx](../src/hr/components/HrWorkspace.tsx) | ` 19c10913f74471430799b57b7f45c65cab428a131a48036f82526204e572fca6 ` |
| [.SYSTEMX/GUSTO/mock/fixtures/demo-company.json](../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json) | ` 14cd9ed231dedfaca1fd9c10395c652d469fb89beae6ed7850994bda93acb1c3 ` |
