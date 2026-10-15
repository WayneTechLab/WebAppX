# Template Portals — HR, CMS and CRM

WebAppX 3.4.0 includes independent native business-workspace demos. They use
fictional browser-memory records and require no Gusto account, Firebase sign-in,
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

Navigation inside this demo area preserves each module's independent state.
**Reset** restores only that module's fixture. A full reload or navigation to a
normal public/live page unmounts the demo area and resets all three. A new tab
starts a separate session. The modules do not automatically share identities,
HR records, customer information or content.
The existing `/hr/demo/sdk` route is separate: opening it unmounts and resets
native HR, and returning creates a fresh native session. Its SDK fixture state
does not share the native preservation rule.

Preview identities are module-specific test controls. They do not authenticate
staff, modify Firebase claims or grant real organization memberships. Production
role services and durable storage remain separate adoption work.

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

## Evidence and production adoption

The current model suites pass **129 tests**: **109 HR**, **10 CMS** and **10 CRM**.
The earlier HR portal receipt's **70 tests** and browser results remain historical.
This talent/CMS/CRM wave has separately scoped browser evidence; the presence of
source code or a passing model test does not establish browser, provider or
production acceptance.
Read the [talent and business-portal QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-TALENT-QA-2026-10-14.md)
for this wave's separate checked results.

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
