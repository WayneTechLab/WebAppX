# Reviewed HR role examples

These are concrete synthetic examples from the reviewed fixture. Use the
[canonical cross-portal capability matrix](PORTAL-CAPABILITIES.md) for the complete vocabulary, role scopes and provider boundary.
A role example is an actor, resource, action and current state; opening a route does not establish permission for its domain transitions.

Review basis: ` 7a582ed4a5396d54aa94e3ca780667d1b07f179e ` and proposal ` WX-0908 `.
Original criterion: A documentation generator derives the HR role examples from reviewed capability fixtures, links the canonical cross-portal matrix and fails its consistency check when documented actions drift from the fixture definitions.

The revision above names the supplied published baseline. The fingerprints below bind the explicitly reviewed recruiting working tree.
Agent 0 froze 123 application source files by exact bytes; the source-manifest SHA-256 is `5a48242850a2f840d61478ebc55c427e05cb6135c24b61ed2f50af232df39569`.
This source-only review establishes no new commit, browser observation, provider operation or production acceptance.

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

Company administration uses known employee resources; simulated payroll separately requires a chosen period and explicit fictional hourly rates. It cannot impersonate a review author or assigned manager.

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

Onboarding review and simulated payroll are separate from profile editing and time approval. This role can configure fictional rate timelines and prepare a chosen-period run, but cannot approve or return employee time.

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

The actor is employee-001; approval or reasoned return requires submitted unpaid direct-report time and excludes the manager’s own entries. Own unpaid draft time can be corrected or explicitly deleted before resubmission.

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

The actor is employee-002; self service requires that exact known employee and the current workflow stage. Own unpaid draft time can be corrected or explicitly deleted; submitted, approved and receipted time stays protected.

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

- Included: Saved HR performance self-review and manager drafts, survey draft answers, fictional rate timelines, chosen payroll periods, time-return reasons, payroll snapshots and mock receipts where present.
- Included: Unpublished CMS drafts and review metadata, captured release members with exact approval and previous/activated publication snapshots; CRM records belonging to other representatives and saved ownership-change metadata.
- Included: Saved HR employment instances, captured checklist versions and archived onboarding receipts, explicit simulation dates, lifecycle events, directory old/new history, correction requests/outcomes and instance-bound offboarding assignments where present.
- Excluded: Unsaved form inputs, running timers, restore-point history and the separate SDK mock session.
- Excluded: Retained navigation drafts, the volatile CMS editor/recovery buffer and origin-local checkpoint preferences; these are not saved domain records.
- Excluded: Unconfirmed HR lifecycle, CMS release and CRM ownership preview comparisons; their volatile confirmation values are not saved authority records.

An HR contractor or auditor can therefore export saved private draft content that is absent from their visible pages. A CMS viewer export contains unpublished content, and a CRM representative export contains other representatives’ saved records.
The module and combined codecs validate complete fictional graphs and file compatibility; they receive no actor and apply no role or field filtering. A portal selection during restore does not narrow the export.

Readable JSON backups and synthetic role choices do not authenticate a person, grant Firebase claims or tenant membership, or authorize provider access. Dirty-form choices and required destination checkpoints protect local editing/replacement but grant no role permission. Production export needs its own trusted actor, resource and field policy.

## Reviewed source fingerprints

These fingerprints bind the examples to reviewed local source bytes. They are review evidence, without a current deployment or provider acceptance claim.

| Source | SHA-256 |
| --- | --- |
| [docs/PORTAL-CAPABILITIES.md](../docs/PORTAL-CAPABILITIES.md) | ` 145d912322bd3d4e9ffce7a8ca45131c1fd557f8801ef9d36ed348934368f6cd ` |
| [src/hr/model.ts](../src/hr/model.ts) | ` 32c3a83203c4a07a5cee5bb0d244a252f32992da71eef2b2cf61f3170e9e1f4e ` |
| [src/hr/mock-workflows.ts](../src/hr/mock-workflows.ts) | ` 4197404a605b370245d4a7542aba9a31ed620c852f1643e330cb42288c638136 ` |
| [src/hr/performance.ts](../src/hr/performance.ts) | ` e4dd5404f9c826a162981904fbc0417588b64252998fa4ac1ca7c0477c8c716f ` |
| [src/hr/surveys.ts](../src/hr/surveys.ts) | ` 5bc231e4a19c62c3a2b7520e93026f885d1f0f636e89306ccfa76d0a7f0a2b85 ` |
| [src/hr/persistence.ts](../src/hr/persistence.ts) | ` 052a06301f32565b5c89e8bdde9f2d075752ff08cd172293408116cb8e3a2d1f ` |
| [src/portals/backup.ts](../src/portals/backup.ts) | ` b65026ffc361a10b03a9585ae720d54f9c14f53f0ea5c9bf2b3c6dad53a26a1a ` |
| [src/portals/combined-backup.ts](../src/portals/combined-backup.ts) | ` 186c9b29a0ce2d74b81bacba0713675ea85713bc452d1ee6a5dc26927b96a726 ` |
| [src/portals/DemoWorkspaceBackup.tsx](../src/portals/DemoWorkspaceBackup.tsx) | ` 850d431bb60e39cb37577b078e6493ba2da7b2b262c4fbbf7df9f217f34f1809 ` |
| [src/portals/CombinedWorkspaceBackup.tsx](../src/portals/CombinedWorkspaceBackup.tsx) | ` cee65258b2e8644af2f4b477b27b26602b2226ccfff815d6d9460c0aca3e7f51 ` |
| [src/hr/components/HrWorkspace.tsx](../src/hr/components/HrWorkspace.tsx) | ` d37bc8bc39d8bd1af1a6b075f7193dda802dd8d7b184d0af90a87bac566749c3 ` |
| [.SYSTEMX/GUSTO/mock/fixtures/demo-company.json](../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json) | ` 14cd9ed231dedfaca1fd9c10395c652d469fb89beae6ed7850994bda93acb1c3 ` |
| [src/portals/unsaved-work-core.ts](../src/portals/unsaved-work-core.ts) | ` f5f7db3ae4ff9c70edb4c3dfd7052075c0b5f3fe3e7c36333ebf311ff0623e14 ` |
| [src/portals/unsaved-work.tsx](../src/portals/unsaved-work.tsx) | ` 5cd946782d51eb160c014b8e5b6bc1e7cc5dd9d22c99812e2c9f2f3b76004316 ` |
| [src/lib/navigation.ts](../src/lib/navigation.ts) | ` d759cb1b692746264a9846905d280deece2fef9cfcb793b378290fb09e0f2a24 ` |
| [src/router.tsx](../src/router.tsx) | ` ec93762a8acbb9bbfdf43ceab5858a55243491b8ca5e7404419d71df4ab359c7 ` |
| [src/hr/components/useHrFormDraft.ts](../src/hr/components/useHrFormDraft.ts) | ` d93f943cad287eb323ea80799d9f807d1e537aaf1dd9032b51a6e6c50c9265e7 ` |
| [src/hr/components/PeopleOperations.tsx](../src/hr/components/PeopleOperations.tsx) | ` a6f6ade235d7c4ce8dec497cbc5a4c6fbf9fe6553efb71f5e30f6b99683e3d0b ` |
| [src/hr/components/HrServiceDesk.tsx](../src/hr/components/HrServiceDesk.tsx) | ` 584ce87da135d5bdc04c56fd9c4789d5e8269c42e7a9f8308ef42adaf8ba1267 ` |
| [src/hr/components/HrRecruiting.tsx](../src/hr/components/HrRecruiting.tsx) | ` f2f4b25642cecddd1433d23c6a3fb2f4c1fb109b890ed5763169aec5457e7857 ` |
| [src/hr/components/HrPerformance.tsx](../src/hr/components/HrPerformance.tsx) | ` 7c27e5b9a36dc02f69725c101e21568661b9820b613bca0fe44e781f81090357 ` |
| [src/hr/components/HrSurveys.tsx](../src/hr/components/HrSurveys.tsx) | ` ba28cb8d4bdc1d5a3e313be89f4272bbd340dedbb3d1d9008609a48b71a794ef ` |
| [src/cms/model.ts](../src/cms/model.ts) | ` 2bd7580d3fd0e42a27810fe65ccf04aae0e3a2a69ac01df05a7acc9c7cf28bbf ` |
| [src/cms/CmsDemo.tsx](../src/cms/CmsDemo.tsx) | ` c44c65a9250f5263eb5c671418794225a0c10b446597dce15c5f72669b32a10d ` |
| [src/cms/editor-recovery.ts](../src/cms/editor-recovery.ts) | ` 0806b91c571018ebb5735130a670a5cf0fcd9d5d00227e9b6f425a49a982ac27 ` |
| [src/portals/PortalWorkspaceProvider.tsx](../src/portals/PortalWorkspaceProvider.tsx) | ` 186e0a0d6c4c20166e0879af7890b576c2552520a2cc2457edb010a5382408fa ` |
| [src/portals/useDemoPersistence.ts](../src/portals/useDemoPersistence.ts) | ` 7ea3895df10dc73752ee5fb622f3fed08957f0a4d031485d09b1a2747fda05ed ` |
| [src/portals/recovery-preferences.ts](../src/portals/recovery-preferences.ts) | ` 0104715273131dfc397c991b3fe201d525e32903b21b265ddc17bd5fe3391859 ` |
| [src/portals/replacement-recovery.ts](../src/portals/replacement-recovery.ts) | ` 4d80db30057b7ddd1974400e0a8555b33158ec7b8ce55633726b2f8de839dc2c ` |
| [src/portals/DemoWorkspaceReset.tsx](../src/portals/DemoWorkspaceReset.tsx) | ` 907be2ce4b8182c8207383136b327948b8fb5f9bf879e6080ebeb537c43b6d81 ` |
| [src/portals/RecoveryCheckpointPreview.tsx](../src/portals/RecoveryCheckpointPreview.tsx) | ` 537ac122bab47679253afe068c4af1aa3c158903bc13c7a9a501a7b3a9b7c71d ` |
| [src/portals/restore-points.ts](../src/portals/restore-points.ts) | ` d80d770440de2db847fd5cd933a960fbe2cc88adb4f80d9bd9ae13e97ce89e1b ` |
| [src/portals/RestorePointHistory.tsx](../src/portals/RestorePointHistory.tsx) | ` 883a619f1e6f78db5ffee7302b48b36b6f88823ddfe706699a0395ee6505183d ` |
| [src/portals/restore-workspaces.ts](../src/portals/restore-workspaces.ts) | ` 1e84b45222b119e9d02e75efa1ba251584353ef0ff2142db5350f009e2797cce ` |
| [src/portals/workspace-inspection.ts](../src/portals/workspace-inspection.ts) | ` 6af90c859a293c5cc6f1d80b702333af1aa39ce8dfc662139fefbf9f759b4a11 ` |
| [src/portals/WorkspaceInspection.tsx](../src/portals/WorkspaceInspection.tsx) | ` 2e5b584d1f61cb1331879b0f251c8355b6f9f74b638fcb40f82e0da1439db069 ` |
| [src/crm/CrmDemo.tsx](../src/crm/CrmDemo.tsx) | ` 5d2703a94ce2bcb75c1d72d68ae8d64c14df77e2d48b57ac95c7699c8b85501c ` |
| [src/hr/lifecycle-types.ts](../src/hr/lifecycle-types.ts) | ` 3d4330aa6bea5a438ba55c6e3d7ee8dab4332d538793adad81e0fe6bb955de27 ` |
| [src/hr/lifecycle.ts](../src/hr/lifecycle.ts) | ` db1c8cd09a3145d6c0e4dfc48215d961127bb33be0306e7fcec7994ea838fb68 ` |
| [src/hr/components/HrDirectoryCorrections.tsx](../src/hr/components/HrDirectoryCorrections.tsx) | ` 84b456d3d44cf83b2cedbf2d253a932a11522beb29e31e71510572d8779e953c ` |
| [src/hr/components/HrEmploymentLifecycle.tsx](../src/hr/components/HrEmploymentLifecycle.tsx) | ` bc9c99cba0b2dc9ffd7f8d8c399bc9be4d5c5ca946366d46264139e23f0db699 ` |
| [src/cms/release-types.ts](../src/cms/release-types.ts) | ` 9b14e7617331c5c02752fa4232348b16fead327528c1b6c9d73d32ac9ba46360 ` |
| [src/cms/release-bundles.ts](../src/cms/release-bundles.ts) | ` ed159266af4cf6346cc49506d8e55d80e5c090e48c67c0001e718bad96c9ab24 ` |
| [src/crm/ownership.ts](../src/crm/ownership.ts) | ` 513a052d85d9f3107869b71ed4fd8c71b35da484111fd44f7a123da045ed6ab0 ` |
| [src/hr/linked-operations.ts](../src/hr/linked-operations.ts) | ` 2e66e04000c9fd1dec82d8afcd4079a9daaaa238c0fbf0f9574290d70b7cf4ab ` |
| [src/hr/recruiting.ts](../src/hr/recruiting.ts) | ` 034cd80e1f9dfc29f47b609e40dfd51b550d1e2f307c2796b32a9288c4af9d84 ` |
| [src/hr/recruiting-link.ts](../src/hr/recruiting-link.ts) | ` 1995589d100b58fc2db37629f9dfe0feed730b6ce89b65c3b2e2b24e49c01839 ` |
| [src/cms/persistence.ts](../src/cms/persistence.ts) | ` ba4c010799c4af240382936308a8a946ffc3ecd1600a8626417d7f44ffa4e430 ` |
| [src/crm/model.ts](../src/crm/model.ts) | ` fbef9b656e5e286d3a6a22a93487a905e7909482b64972a33c5c90d86e91bed8 ` |
| [src/crm/persistence.ts](../src/crm/persistence.ts) | ` 1b4e2dcc0e4c44c5ac65b2256e49e5159f4580cc4d381dcb352717078b4c2170 ` |
| [src/hr/recruiting-lifecycle-types.ts](../src/hr/recruiting-lifecycle-types.ts) | ` 2ad4f9bf47610036ed5d2808690cb88d186062f1493b03d1c9b973bcee9463db ` |
| [src/hr/recruiting-lifecycle-value.ts](../src/hr/recruiting-lifecycle-value.ts) | ` 2a62ef990f090269b92e2bcf1f153dc67a758cd08e1f15995fc0ef8f110cc434 ` |
| [src/hr/recruiting-lifecycle-replay.ts](../src/hr/recruiting-lifecycle-replay.ts) | ` 42d903bf54c358ca667b53a547ec99151caff2db7ef9fe5e618a7cdbcaaa5329 ` |
| [src/hr/recruiting-lifecycle-projection.ts](../src/hr/recruiting-lifecycle-projection.ts) | ` 832533db77976ace5a6b0aaccf4cdf863d38a3e6541c9a4dbdadb74cf2ca332f ` |
| [src/hr/recruiting-lifecycle.ts](../src/hr/recruiting-lifecycle.ts) | ` c1f244edfa0df984548985fd1b896c5e4318bae7794a9ce7457c51fddc6ef40a ` |
| [src/hr/recruiting-controller.ts](../src/hr/recruiting-controller.ts) | ` 5a1a5c6e5b82ea496573ca8d6a8123b83ada9b67b06e4c5b55b4a13f366c48cb ` |
| [src/hr/recruiting-requisitions.ts](../src/hr/recruiting-requisitions.ts) | ` 1229e857cfe886effa7987ed8e998d9e372266ad6068fd278f09b06220d6a0f2 ` |
| [src/hr/recruiting-interviews.ts](../src/hr/recruiting-interviews.ts) | ` eb43b9c4a55b58af37276967dc0b01072a299dafef376b5ff1c6a14a1b99c317 ` |
| [src/hr/recruiting-hire.ts](../src/hr/recruiting-hire.ts) | ` a66c9c526b89ee91f3bcc8176ced533c2f4c585d1b03729ced36b514e5dc2c56 ` |
| [src/hr/recruiting-services.ts](../src/hr/recruiting-services.ts) | ` 2d093fdab506c35646fd2c1d2d78d1a446e8b402ba91d0c2dd678f7afdf8bc6a ` |
| [src/hr/recruiting-time-zone.ts](../src/hr/recruiting-time-zone.ts) | ` 2e3ed02882fdc7be480518934fe2e4c30392806c529241b5f3903579a096c288 ` |
| [src/hr/recruiting-employment-baseline.ts](../src/hr/recruiting-employment-baseline.ts) | ` 23ebd4ab55f4aaef1fbf96392366ef727b648495bd2f016faa654bad00130b4c ` |
| [src/hr/recruiting-lifecycle-validation.ts](../src/hr/recruiting-lifecycle-validation.ts) | ` dfd6a0be7859fa08f973a9663aa7ec4e721a09c9d1afc29b63765f6a6246aa30 ` |
| [src/hr/provider-adapter.ts](../src/hr/provider-adapter.ts) | ` 3422961870779a81018e25161604645220f2041b7bb71a5b3864d2e6bd4c579f ` |
| [src/hr/RecruitingPreviewProvider.tsx](../src/hr/RecruitingPreviewProvider.tsx) | ` 2e1c2792eff30457ec566aab12d6750b67aae338c05a9833b7594cbcb320f25e ` |
| [src/hr/components/HrRecruitingLifecycleHost.tsx](../src/hr/components/HrRecruitingLifecycleHost.tsx) | ` 19f613977cde5164ea528e3436697721463e186737dc04e1f310f5bd654cf146 ` |
| [src/hr/components/HrRecruitingApplications.tsx](../src/hr/components/HrRecruitingApplications.tsx) | ` b7fab6c09248b9c5773f698d257b29a5a86d27f3184de30d1da154467d70a1b5 ` |
| [src/hr/components/HrRecruitingHireSummary.tsx](../src/hr/components/HrRecruitingHireSummary.tsx) | ` 85387bce1a77ac70f4bd27d6dae1e3724b3854f23192da47ce2d9134a7e9637b ` |
| [src/hr/components/HrRecruitingRequisitions.tsx](../src/hr/components/HrRecruitingRequisitions.tsx) | ` 8f5d46726fdb7746519d93ec81ec61ca62743b1a8fb55277a2be9f50a17ea9c1 ` |
| [src/hr/components/HrRecruitingInterviews.tsx](../src/hr/components/HrRecruitingInterviews.tsx) | ` a7204ee9baaf233100b9eb2e8e7c9edef7de68e0f08254b0ef3280623503aada ` |
| [src/hr/components/HrRecruitingOwnScorecards.tsx](../src/hr/components/HrRecruitingOwnScorecards.tsx) | ` 89d0637278604a9e54ab0d2cf0aff5d49393b3238c8e6d490da475bb9adbfabe ` |
| [src/portals/ScopedPortalChrome.tsx](../src/portals/ScopedPortalChrome.tsx) | ` 4d068981ecff1b5e92b6b3b86fc0fb6729031ae065c2941763b75bce1c7c0ee8 ` |
| [src/components/layout/Layout.tsx](../src/components/layout/Layout.tsx) | ` 41937e488db1f41614d39d68fef41b80683ac57925bee092b4aadbb139b909a6 ` |
| [src/pages/TemplatePortalsPage.tsx](../src/pages/TemplatePortalsPage.tsx) | ` 0d76bcf1c6a32001c7efb66f3c8e95290427363ee7907c0c2575d38b9e7402da ` |
| [src/portals/RetainedPortalSurface.tsx](../src/portals/RetainedPortalSurface.tsx) | ` 31bf40cda4f2bddc6bfb1eb68113ebf59374ea291284161df0473c85009bb82a ` |
