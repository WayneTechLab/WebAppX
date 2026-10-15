# Template Portals — HR, CMS and CRM

WebAppX 3.4.0 includes independent native business-workspace demos. They use
fictional browser-local records and require no Gusto account, Firebase sign-in,
provider credentials or external service. Use sample names/content and `.invalid`
addresses; validation does not remove personal information from free text.

## Start locally

```bash
npm ci
npm run hr:test
npm run portals:test
npm run dev
```

Open Vite's printed URL and choose **Template Portals**:

| Route | Workspace |
| --- | --- |
| `/portals` | Shared demo directory |
| `/hr/demo` | HR management, employee, manager and contractor previews |
| `/cms/demo` | Content authoring, separate review and simulated publication |
| `/crm/demo` | Companies, contacts, lead conversion, opportunities and follow-up tasks |

Each native module saves domain actions to its own versioned `localStorage`
snapshot. Refreshing or leaving and returning restores the last successfully
saved records in the same browser and origin. **Reset** clears only that
module’s saved snapshot and restores its fixtures. The modules do not
automatically share identities, HR records, customer information or content.
Opening `/hr/demo/sdk` may unmount native HR; returning restores the saved native
HR snapshot. The SDK’s independent sample state is not saved by this adapter.

### What is saved and how to reset it

Save or complete the displayed domain action before refreshing. Onboarding,
elections, approved time, payroll receipts, talent records, CMS revisions and
CRM relationship/pipeline changes are native domain state. Unsaved form fields,
active timers and transient messages are not guaranteed to restore.

- The same browser profile and **origin** are required. A different hostname,
  scheme or port uses separate storage; `localhost` and `127.0.0.1` differ.
- A module’s **Reset** clears only its saved snapshot. Clearing site data or
  ending private-browsing sessions can remove saved samples.
- The workspace shows storage status. Blocked/full storage visibly falls back
  to memory; malformed or unsupported snapshots load fresh fixtures with a notice.
- Tabs do not merge live edits. Each tab starts from its loaded snapshot and the
  last successful write wins. Avoid concurrent editing in multiple tabs.
- Saved records are accessible to the browser user and same-origin scripts.
  Fictional role projections do not secure browser storage. Use fictional data
  only; never enter real employee/customer information, credentials or secrets.

Read the [persistence QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-PERSISTENCE-QA-2026-10-14.md)
for the current checked paths. Earlier receipts retain their original scope.

Preview identities are module-specific test controls. They do not authenticate
staff, modify Firebase claims or grant real organization memberships. Production
role services and tenant-scoped server storage remain separate adoption work.

## Back up, restore or move a workspace

Use **Export workspace** in HR, CMS or CRM to download that portal’s validated
current domain snapshot as a JSON file. Export all three separately if needed;
there is no combined bundle. Save/complete domain actions before exporting.
Unsaved fields, running timers, most interface selections and the SDK preview’s
independent session are excluded. Native HR retains its saved role/employee choice.

1. Copy the exported file to the destination browser/computer and open the
   matching native portal. A different scheme, hostname or port is supported
   through the file transfer; storage at each origin remains independent.
2. Export the destination first if its current records need a backup. Choose
   **Import workspace** and select the local JSON file; nothing is uploaded.
3. Inspect the preview’s module, export time and file, then choose **Replace HR
   workspace**, **Replace CMS workspace** or **Replace CRM workspace**. Choose
   **Cancel import** to preserve current records. Import replaces the whole matching
   portal; it does not merge or synchronize workspaces.
4. Check the save status and refresh. A successful import restores from that
   browser’s own storage. The other two portals and SDK session are unchanged.

Size, format/version, module and full nested schema checks run before replacement.
Invalid/incompatible or wrong-module files preserve current records. If browser
storage cannot save the import, the prior workspace remains active with a visible
error. Existing browser-storage snapshots retain their format; create portable
files with **Export workspace** rather than copying local-storage JSON.

Files are plain text containing the whole fictional workspace, including private
review/survey drafts, feedback and mock receipts. The active preview role does
not filter exports. The files are not encrypted or signed; validation cannot
prove editable file contents are true, and an imported receipt is not evidence
of provider payroll or publication. Use fictional data only. Downloaded backups
are independent files and are not removed by the portal’s Reset.

Read the [backup QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-BACKUP-QA-2026-10-14.md)
and [detailed backup/adoption guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/TEMPLATE-PORTALS.md#export-and-import-without-an-account).

### Browser backup checkpoint — 2026-10-14

HR, CMS and CRM each passed a real JSON download, file-picker import, preview,
explicit replacement, refresh and re-export. The final exported `data` matched
the source payload exactly in all three portals. Source `127.0.0.1` and target
`localhost` used independent storage areas in the same in-app browser; other
browser engines and operating systems were not certified.

- **HR:** retained Avery’s confirmed health plan, eight approved hours and
  submitted `MOCK-PAYROLL-0002`: $240 gross, $48 illustrative withholding,
  $25 benefit and $167 net.
- **CMS:** restored `Portable CMS sample backup` revision 3, two content records,
  one publication and two actions. Cancel preserved target revision 1; confirmed
  import cleared a target unsaved edit.
- **CRM:** restored three companies/contacts/leads/opportunities, six actions,
  $1,500 won and $6,500 open. Reimport removed a target-only lead, preserving
  the source payload and demonstrating replacement.
- **Rejection:** wrong portal, malformed JSON, unsupported version 999 and an
  oversized file preserved CMS revision 3. An invalid HR employee/time link was
  rejected without losing the submitted payroll receipt after refresh.

The [backup QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-BACKUP-QA-2026-10-14.md)
keeps these observations separate from automated storage-failure checks.

## HR: people operations and talent

Use the management, employee and manager portals for onboarding, submitted
time/approval, benefit elections, fictional payroll, own pay statements, leave,
assignments/asset returns and HR requests. Native talent modules add:

- **Recruiting:** owner/HR drafts and publishes a job, advances fictional
  candidates through screening/interview/offer, then creates an onboarding
  employee. A mock hire starts with compensation unconfigured.
- **Performance:** own goal progress and self-review, assigned direct-manager
  feedback/publication, then employee acknowledgment. Draft comments have
  separate author and publication gates; auditor views omit review text.
- **Surveys:** identified feedback with owner/HR authoring, assigned employees'
  own answer drafts/submissions, submitted-only results and closure. Submitted
  names/answers are visible to owner/HR and the read-only auditor. This is not
  anonymous or confidential-feedback infrastructure.

See [Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md),
[the native portal guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL.md)
and [Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md).
The genuine SDK preview has its own development-only fixture session. Native HR
does not write into it or contact Gusto.

## CMS: review an exact revision before publication

The CMS has **Pages** and **Articles** collections with plain-text title, slug
and body fields. Slugs are unique within a collection across current drafts and
published snapshots.

| Identity | Available action |
| --- | --- |
| Author | Create/edit own drafts and submit a saved revision for review |
| Reviewer | Approve the exact submitted revision or return it with feedback |
| Publisher | Simulate publication of the approved revision, or retire its publication |
| Viewer | Read-only editorial preview, including draft metadata/feedback |

1. As **author**, create a sample page/article; creation saves its initial draft.
   If editing an existing draft, change its content and **Save draft revision**
   before requesting review. An unchanged save does not create another revision.
2. Switch to **reviewer**. Inspect the submitted revision, then approve it or
   return it for changes. A changed author save increments the revision and
   invalidates the previous approval.
3. Switch to **publisher** and **Simulate publication**. Only the current revision
   with a separate reviewer's approval can publish.
4. Inspect the **Published sample preview**. It projects only published content,
   revision and receipt, excluding editorial approval/feedback and unpublished
   draft text.
5. Edit published content as author. The old published snapshot remains visible
   while the replacement draft goes through a new review. The publisher can
   instead **Retire published sample**.

The editorial viewer is not a public-only role. Current state retains a draft,
its current publication and activity receipts, not a complete revision-content
history or rollback service. No action changes the actual public website,
Firebase Hosting, a provider or files in the repository.

## CRM: owned records and a linked sales pipeline

The owner and sales manager can manage the sample workspace. Each sales
representative sees and changes owned records with visible linked company,
contact and opportunity relationships. The auditor reads without mutation.

1. Create a fictional company/contact, or create a lead using an unused
   `.invalid` email such as `alex.lead@example.invalid`.
2. Qualify the new lead before converting it. Conversion runs once and creates
   or reuses compatible company/contact records with the same owner, plus a
   new discovery opportunity.
3. Move the opportunity **discovery → proposal → negotiation → won**. It may be
   lost from any open stage. Won/lost opportunities are locked; there is no
   reopening or reassignment workflow.
4. Add a follow-up task while an opportunity is open, then complete it once.
   A task that already exists can still complete after its opportunity closes.
5. Switch between sales representatives and the auditor to inspect record scope
   and the absence of auditor write controls.

Pipeline totals sum open opportunities; won totals sum fictional won amounts.
They do not represent received revenue, payments, invoices or financial records.
Local activity describes record-owner-scoped actions, without a complete audit
identity of who acted. No outbound messages, provider synchronization or HR
record import is performed.

## Earlier refresh verification — 2026-10-14

The [persistence QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-PERSISTENCE-QA-2026-10-14.md)
records the selected browser checks, which passed for all three native portals:

| Workspace | Records restored after refresh |
| --- | --- |
| HR | Casey’s hire/four-person directory, completed onboarding `MOCK-ONBOARDING-0001`, submitted eight hours and prepared payroll, then submitted `MOCK-PAYROLL-0003` at $240 gross/$48 illustrative withholding/$0 benefits/$192 net. Avery’s confirmed health enrollment, 40% goal progress, saved self-review draft and saved/submitted survey answers also restored. |
| CMS | Saved revision 2 and its separately approved publication `MOCK-CMS-0004`; saved draft revision 3 restored without replacing published revision 2. |
| CRM | A new fictional lead, one conversion and its $1,500 won opportunity, with $6,500 open pipeline, three companies, three contacts and six successful actions. |

Native HR also restored after the SDK preview and About/back. Each module’s
Reset followed by refresh restored its own fixtures and preserved saved markers
in the other two modules. These are account-free local UI results; no provider
execution, external publication, real staff/customer records or production
storage was enabled.

## Evidence and production adoption

The earlier talent checkpoint passed **129 model tests**: **109 HR**, **10 CMS**
and **10 CRM**. Current persistence evidence is recorded in the separate receipt above.
The earlier HR portal receipt's **70 tests** and browser results remain historical.
That talent/CMS/CRM wave has separately scoped browser evidence; the presence of
source code or a passing model test does not establish browser, provider or
production acceptance.
Read the [talent and business-portal QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-TALENT-QA-2026-10-14.md)
for that earlier wave's separate checked results.

| Selected browser path — 2026-10-14 | Observed result |
| --- | --- |
| HR talent and pay | Casey completed native onboarding and an eight-hour October 15 payroll journey. `MOCK-PAYROLL-0003` and own statement matched $240 gross/$48 illustrative withholding/$0 benefit/$192 net. Performance draft privacy and acknowledgment followed their role gates. |
| Identified survey | Ratings 5 and 3 produced 2/2 submitted responses and mean 4, then closed with `MOCK-SURVEY-0007`. Saved drafts contributed no results. |
| CMS | Revision 2 was returned for feedback; revision 3 was separately approved/published (`MOCK-CMS-0007`). Revision 4 edits left publication 3 visible until new approval/publication; retirement removed the article. Viewer mutation controls were absent; duplicate slugs were refused. |
| CRM pipeline | Riley qualified/converted Jules once, then advanced the $1,500 opportunity to won. Both follow-ups completed; Riley's dashboard showed $2,500 open/$1,500 won/0 follow-ups. |
| CRM relationships/scope | Owner created a fictional company/contact and converted a new lead while reusing that company. Representatives could not see foreign-owner companies; auditor creation/advancement controls were absent. |
| Shared navigation/Reset | A CMS draft, four HR people and CRM's $1,500 won value survived shared navigation. Reset CMS removed only its draft; HR/CRM records remained. |

Read the [portal architecture and adoption guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/TEMPLATE-PORTALS.md)
for trusted module memberships, persistent tenant records, revision/permission
checks, audit retention, privacy, notifications and phased production adoption.
The local LAN's developer CMS/CRM fixtures remain a separate control-plane
surface. Native business demos do not expose LAN editing authority or activate
the optional Firebase/Gusto backend.

Return to [Home](Home.md) or [Testing & QA](Testing-and-QA.md).
