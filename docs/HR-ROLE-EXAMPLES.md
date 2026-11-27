# Reviewed HR role examples

These are concrete synthetic examples from the reviewed fixture. Use the
[canonical cross-portal capability matrix](PORTAL-CAPABILITIES.md) for the complete vocabulary, role scopes and provider boundary.
A role example is an actor, resource, action and current state; opening a route does not establish permission for its domain transitions.

Review basis: ` 9b7555671289d1af7d54dfcb6e533dbb7d990148 ` and proposal ` WX-0908 `.
Original criterion: A documentation generator derives the HR role examples from reviewed capability fixtures, links the canonical cross-portal matrix and fails its consistency check when documented actions drift from the fixture definitions.

The revision above identifies the integration base. The source fingerprints include the foundation walkthrough, storage and navigation changes reviewed on November 26, 2026.
The October 15 CRM review recorded 145 application files in the [runtime source manifest](evidence/crm-merge-runtime-2026-10-15.json); its SHA-256 is `f1588c3ed32d5c198aa74f7a673ebdd32422eacc659d754e73fac03bc68e4d7e`.
The current roster includes 107 files. Nine storage and navigation dependencies cover adapter selection, owned keys, durability messages and focus restoration. Fifteen CRM files cover imports, replay, private preview and historical projections. The fixture specifies seven HR roles and eighteen cases.
Complete CRM backups may include retired/retained merge captures and the first-merge baseline/ordered journal; role-scoped screens remain narrower. This source review adds no provider scope.
This review covers the listed source files. Browser, provider and production observations have separate evidence.

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
| [src/hr/mock-workflows.ts](../src/hr/mock-workflows.ts) | ` ab87d8c22e622785196d083ed40036ad5c1853dcd4fbfc96fa551410f78546db ` |
| [src/hr/performance.ts](../src/hr/performance.ts) | ` e4dd5404f9c826a162981904fbc0417588b64252998fa4ac1ca7c0477c8c716f ` |
| [src/hr/surveys.ts](../src/hr/surveys.ts) | ` 5bc231e4a19c62c3a2b7520e93026f885d1f0f636e89306ccfa76d0a7f0a2b85 ` |
| [src/hr/persistence.ts](../src/hr/persistence.ts) | ` 1c313c6ebd78b7eccec8cb6373e1b2e510f12a744883b6f8054fe0c112e6a8e0 ` |
| [src/portals/backup.ts](../src/portals/backup.ts) | ` b65026ffc361a10b03a9585ae720d54f9c14f53f0ea5c9bf2b3c6dad53a26a1a ` |
| [src/portals/combined-backup.ts](../src/portals/combined-backup.ts) | ` 186c9b29a0ce2d74b81bacba0713675ea85713bc452d1ee6a5dc26927b96a726 ` |
| [src/portals/DemoWorkspaceBackup.tsx](../src/portals/DemoWorkspaceBackup.tsx) | ` 637945c53e417984eb56a8589bff16523ce9c13dec9d0feda25b12d1dca8b02e ` |
| [src/portals/CombinedWorkspaceBackup.tsx](../src/portals/CombinedWorkspaceBackup.tsx) | ` 33aa5df00df9374666d4401eacc130f66ba0a9ea4abcd994b21a276bb297a55e ` |
| [src/hr/components/HrWorkspace.tsx](../src/hr/components/HrWorkspace.tsx) | ` fefca0ec535d5096a68795f921498877248d8e0c72010b250ddbd34dafc2ed35 ` |
| [.SYSTEMX/GUSTO/mock/fixtures/demo-company.json](../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json) | ` 14cd9ed231dedfaca1fd9c10395c652d469fb89beae6ed7850994bda93acb1c3 ` |
| [src/portals/unsaved-work-core.ts](../src/portals/unsaved-work-core.ts) | ` f5f7db3ae4ff9c70edb4c3dfd7052075c0b5f3fe3e7c36333ebf311ff0623e14 ` |
| [src/portals/unsaved-work.tsx](../src/portals/unsaved-work.tsx) | ` 5cd946782d51eb160c014b8e5b6bc1e7cc5dd9d22c99812e2c9f2f3b76004316 ` |
| [src/lib/navigation.ts](../src/lib/navigation.ts) | ` 484de4b24bb55a2c310f1e2654477922ce9be5bf232d8aa604a5beb4d15a8da4 ` |
| [src/router.tsx](../src/router.tsx) | ` c7d7458003ed602b8796577e8e8749885153e0c71eab3a844373c91f0d7949b4 ` |
| [src/hr/components/useHrFormDraft.ts](../src/hr/components/useHrFormDraft.ts) | ` d93f943cad287eb323ea80799d9f807d1e537aaf1dd9032b51a6e6c50c9265e7 ` |
| [src/hr/components/PeopleOperations.tsx](../src/hr/components/PeopleOperations.tsx) | ` a6f6ade235d7c4ce8dec497cbc5a4c6fbf9fe6553efb71f5e30f6b99683e3d0b ` |
| [src/hr/components/HrServiceDesk.tsx](../src/hr/components/HrServiceDesk.tsx) | ` 584ce87da135d5bdc04c56fd9c4789d5e8269c42e7a9f8308ef42adaf8ba1267 ` |
| [src/hr/components/HrRecruiting.tsx](../src/hr/components/HrRecruiting.tsx) | ` f2f4b25642cecddd1433d23c6a3fb2f4c1fb109b890ed5763169aec5457e7857 ` |
| [src/hr/components/HrPerformance.tsx](../src/hr/components/HrPerformance.tsx) | ` 7c27e5b9a36dc02f69725c101e21568661b9820b613bca0fe44e781f81090357 ` |
| [src/hr/components/HrSurveys.tsx](../src/hr/components/HrSurveys.tsx) | ` ba28cb8d4bdc1d5a3e313be89f4272bbd340dedbb3d1d9008609a48b71a794ef ` |
| [src/cms/model.ts](../src/cms/model.ts) | ` 2bd7580d3fd0e42a27810fe65ccf04aae0e3a2a69ac01df05a7acc9c7cf28bbf ` |
| [src/cms/CmsDemo.tsx](../src/cms/CmsDemo.tsx) | ` fdbb13c0325f90a76cb49b11009fa30955c80b04870fdb25fac44476fbbf17e2 ` |
| [src/cms/editor-recovery.ts](../src/cms/editor-recovery.ts) | ` 0806b91c571018ebb5735130a670a5cf0fcd9d5d00227e9b6f425a49a982ac27 ` |
| [src/portals/PortalWorkspaceProvider.tsx](../src/portals/PortalWorkspaceProvider.tsx) | ` c9d6f8edfa7fb39034b50d6c6cafbdfcbef193a9ca975716702554a731a15408 ` |
| [src/portals/useDemoPersistence.ts](../src/portals/useDemoPersistence.ts) | ` bb2a2a6d5a61e323477013d41690e72e2f1d13ff61bc41e6ea4d77cfd49050e8 ` |
| [src/portals/recovery-preferences.ts](../src/portals/recovery-preferences.ts) | ` 0104715273131dfc397c991b3fe201d525e32903b21b265ddc17bd5fe3391859 ` |
| [src/portals/replacement-recovery.ts](../src/portals/replacement-recovery.ts) | ` 4d80db30057b7ddd1974400e0a8555b33158ec7b8ce55633726b2f8de839dc2c ` |
| [src/portals/DemoWorkspaceReset.tsx](../src/portals/DemoWorkspaceReset.tsx) | ` 26524f2302ea4abe3ae132687613f556a43c19ecbd25133654cb907489c5d6d8 ` |
| [src/portals/RecoveryCheckpointPreview.tsx](../src/portals/RecoveryCheckpointPreview.tsx) | ` d72197540693245a14bc215bef24f0cd0e00fafe73349ab51d9e4c4957ba0a3e ` |
| [src/portals/restore-points.ts](../src/portals/restore-points.ts) | ` d80d770440de2db847fd5cd933a960fbe2cc88adb4f80d9bd9ae13e97ce89e1b ` |
| [src/portals/RestorePointHistory.tsx](../src/portals/RestorePointHistory.tsx) | ` a664941a1d65fb248e98764c9e26b1d3f53296ee844950fad9e927afca473eca ` |
| [src/portals/restore-workspaces.ts](../src/portals/restore-workspaces.ts) | ` 1e84b45222b119e9d02e75efa1ba251584353ef0ff2142db5350f009e2797cce ` |
| [src/portals/workspace-inspection.ts](../src/portals/workspace-inspection.ts) | ` 727428394a48cc9d03d232da15d7b9f72535746ffa88f0bf6f7229294ca1616e ` |
| [src/portals/WorkspaceInspection.tsx](../src/portals/WorkspaceInspection.tsx) | ` 6a6e47b6ca0ded2c518866944f21d9b72630b85bf0bac7261313e3ed095e0dbc ` |
| [src/crm/CrmDemo.tsx](../src/crm/CrmDemo.tsx) | ` 760cba846954766b0d7f980c507ea47ee76a1cdfaa0fba915efdae220a5e0d21 ` |
| [src/hr/lifecycle-types.ts](../src/hr/lifecycle-types.ts) | ` 3d4330aa6bea5a438ba55c6e3d7ee8dab4332d538793adad81e0fe6bb955de27 ` |
| [src/hr/lifecycle.ts](../src/hr/lifecycle.ts) | ` db1c8cd09a3145d6c0e4dfc48215d961127bb33be0306e7fcec7994ea838fb68 ` |
| [src/hr/components/HrDirectoryCorrections.tsx](../src/hr/components/HrDirectoryCorrections.tsx) | ` 84b456d3d44cf83b2cedbf2d253a932a11522beb29e31e71510572d8779e953c ` |
| [src/hr/components/HrEmploymentLifecycle.tsx](../src/hr/components/HrEmploymentLifecycle.tsx) | ` bc9c99cba0b2dc9ffd7f8d8c399bc9be4d5c5ca946366d46264139e23f0db699 ` |
| [src/cms/release-types.ts](../src/cms/release-types.ts) | ` 9b14e7617331c5c02752fa4232348b16fead327528c1b6c9d73d32ac9ba46360 ` |
| [src/cms/release-bundles.ts](../src/cms/release-bundles.ts) | ` ed159266af4cf6346cc49506d8e55d80e5c090e48c67c0001e718bad96c9ab24 ` |
| [src/crm/ownership.ts](../src/crm/ownership.ts) | ` a44534d58da5be15f447fb37808fbcf1bfef8ec74504485b795949f5ff981706 ` |
| [src/hr/linked-operations.ts](../src/hr/linked-operations.ts) | ` 2e66e04000c9fd1dec82d8afcd4079a9daaaa238c0fbf0f9574290d70b7cf4ab ` |
| [src/hr/recruiting.ts](../src/hr/recruiting.ts) | ` 034cd80e1f9dfc29f47b609e40dfd51b550d1e2f307c2796b32a9288c4af9d84 ` |
| [src/hr/recruiting-link.ts](../src/hr/recruiting-link.ts) | ` 1995589d100b58fc2db37629f9dfe0feed730b6ce89b65c3b2e2b24e49c01839 ` |
| [src/cms/persistence.ts](../src/cms/persistence.ts) | ` ba4c010799c4af240382936308a8a946ffc3ecd1600a8626417d7f44ffa4e430 ` |
| [src/crm/model.ts](../src/crm/model.ts) | ` a26e9d9d5302eaa1e3770980ec535b590a5e99f8340dbf304d9812ff66211b56 ` |
| [src/crm/persistence.ts](../src/crm/persistence.ts) | ` 58a589d4304d8c4df304bca62d56a71a30715596f34bd917cba59d031ee46ca3 ` |
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
| [src/components/layout/Layout.tsx](../src/components/layout/Layout.tsx) | ` 79fce2aa3d9e53eead6ea3b7026a853e3cc9ecd31172ee70dc0adc31d99cb422 ` |
| [src/pages/TemplatePortalsPage.tsx](../src/pages/TemplatePortalsPage.tsx) | ` b752c0c1a0005b0fb8ed7d2ff10b90fc817335a4e70270abc66906847876a4e2 ` |
| [src/portals/RetainedPortalSurface.tsx](../src/portals/RetainedPortalSurface.tsx) | ` 31bf40cda4f2bddc6bfb1eb68113ebf59374ea291284161df0473c85009bb82a ` |
| [src/hr/payroll-control-types.ts](../src/hr/payroll-control-types.ts) | ` 8f6867ae6723d5929e0d85ab4cbedda8d7b89dd247fc662782a1e1acada3c68d ` |
| [src/hr/payroll-control-value.ts](../src/hr/payroll-control-value.ts) | ` a470bbee2013a153f9d2f208fada3b6bb4e3519341555d286a6c1cd9872b014a ` |
| [src/hr/payroll-control.ts](../src/hr/payroll-control.ts) | ` d754c27c69a5050cad26a952666b38fb08efd86409fa8feed8ef7750b0b25059 ` |
| [src/hr/payroll-control-controller.ts](../src/hr/payroll-control-controller.ts) | ` 5dd06613faf50dc6e525f4aeb8f65c8378582ed9f48aa6388527a3457e7a1970 ` |
| [src/hr/payroll-control-host.ts](../src/hr/payroll-control-host.ts) | ` 13771680bcb323fc58a9ffa20fd3b159d79cd305316bbce1108fd5bf387e97e6 ` |
| [src/hr/components/HrPayrollControl.tsx](../src/hr/components/HrPayrollControl.tsx) | ` cc089b5d3a77db56d9697da8c3c33d97696dc0a65cb6663669bb7a5303238a4d ` |
| [src/hr/components/HrPayrollControlHost.tsx](../src/hr/components/HrPayrollControlHost.tsx) | ` 57e81d72dc665fa24fcb9893c19c755f1634e61e5320f9fa559a9591ce0dde3b ` |
| [src/hr/components/HrInsights.tsx](../src/hr/components/HrInsights.tsx) | ` 923fd14fbee0f903b547f0e5a036166dad705aa5363e6b951e05e87c84c5b876 ` |
| [src/crm/types.ts](../src/crm/types.ts) | ` 45548840eb64ccb52f20e018a38d5d458696dd18e5f6d16788f6fc4625511e0b ` |
| [src/crm/kernel.ts](../src/crm/kernel.ts) | ` 6572c0e1911faf2c23d6f9dc6f0e780062f1b68f6a89ae5d8eeed36f0803f001 ` |
| [src/crm/legacy-validation.ts](../src/crm/legacy-validation.ts) | ` e5053318849c3b7c4f8568f15a85c6b8ea408a36543242fc23a7cfdcc3736afd ` |
| [src/crm/merge-types.ts](../src/crm/merge-types.ts) | ` 0bdfa340508cab3c30515ea7df2443773d918157e3f2a2f2505a27bfd19e0766 ` |
| [src/crm/merge-value.ts](../src/crm/merge-value.ts) | ` 84cc60ba4cb0b28e3c3f80d9422e214ea801ec01839af83507bb6be76af494fd ` |
| [src/crm/merge.ts](../src/crm/merge.ts) | ` 0a5929352893536af23458b0150b96278b3bf204c71de03fd2a4fd13a3818971 ` |
| [src/crm/merge-history.ts](../src/crm/merge-history.ts) | ` c96a806fbc3a1cfbf328f23202220b7a40fd892d82896f9dfb9b6d768ce8a41e ` |
| [src/crm/merge-public-types.ts](../src/crm/merge-public-types.ts) | ` 5b426a2cdb5b57e5ca00f77825a6d8e05ed8ddd49c7f7d61aa608079251fb350 ` |
| [src/crm/merge-report.ts](../src/crm/merge-report.ts) | ` 861a8f59eee4ac8a13a04229ee3880dc38f804bb92636969c5381ccda9ad7738 ` |
| [src/crm/merge-projection.ts](../src/crm/merge-projection.ts) | ` 44ce54fe7eb4ccd8cada15822fcc377477745ec67e53f7f3c61c937eaa705401 ` |
| [src/crm/merge-controller.ts](../src/crm/merge-controller.ts) | ` cbb4c930850ef50c9ad75940d7ce4d17ba9f546406674db5ec94a2561c655fd7 ` |
| [src/crm/merge-host.ts](../src/crm/merge-host.ts) | ` 85c1148a3813a4d12ec80fcadd194e7f13175f3814664a93eded1ed81934c3a2 ` |
| [src/crm/draft-tabs.ts](../src/crm/draft-tabs.ts) | ` 80522aa0c263a658ab5054d22db29d81ba4261c260dcb1b495b5649cf666021d ` |
| [src/crm/CrmMergeHost.tsx](../src/crm/CrmMergeHost.tsx) | ` a4ff5b6acb79786d339d5cc6ab2ba17127232f5cdee24a2dfdfe126736364a00 ` |
| [src/crm/CrmMerges.tsx](../src/crm/CrmMerges.tsx) | ` be7bb9232fb9bee64e1f5d7d526781f28d76e0dedb0ef5cec44a080e0ef61270 ` |
| [src/portals/portal-runtime.ts](../src/portals/portal-runtime.ts) | ` e8b206e158ffc35feb77f975953eaa179f1ee566cc5fddb17844f3466d5cb147 ` |
| [src/portals/portal-runtime-context.tsx](../src/portals/portal-runtime-context.tsx) | ` e6fb22b0e5446598e25f5dd8b96f8ac2eff8a95e9d6717444c2d0b4acc3aa3bf ` |
| [src/portals/owned-mock-storage.ts](../src/portals/owned-mock-storage.ts) | ` 1b8316ea5e52833722a1dec8c5a83ad0ea3886fa203ff23caed650f20378be0f ` |
| [src/portals/storage-presentation.ts](../src/portals/storage-presentation.ts) | ` 81ac083221d84305d08991195f5dfd88413e867fe3b4469761f73bcb4921b119 ` |
| [src/lib/navigation-types.ts](../src/lib/navigation-types.ts) | ` 44bdbe9cae0c2c312cc9fcc3ab17bdc6131d3b5b3cee64193cd58701a1e17694 ` |
| [src/lib/navigation-focus.ts](../src/lib/navigation-focus.ts) | ` 4f9480604dfe55aeee6c829a6f1fd0cac459819dd903482744146c45fd46024c ` |
| [src/lib/navigation-focus-dom.ts](../src/lib/navigation-focus-dom.ts) | ` 366afc0cdf672aeebd6b30e87fecde7d9d44c135f88949b2f5f4cb5f6f229e53 ` |
| [src/lib/useCommittedNavigationFocus.ts](../src/lib/useCommittedNavigationFocus.ts) | ` bbaa9adaa6492be04d2cc883c6ac7af0bdb7e2710ce912f9bba21e5c7f63e254 ` |
| [src/components/navigation/AppLink.tsx](../src/components/navigation/AppLink.tsx) | ` a8bd199938ecd4f29fcbe80174fa5d629c91dac3d20d5a37cd2cfdd25494d3a2 ` |
