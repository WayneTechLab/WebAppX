# HR, CMS and CRM portals for the reusable template

WebAppX should support three connected business workspaces: people operations
(HR), publishing (CMS) and customer relationships (CRM). This document records
the source inventory and proposed adoption architecture as of October 14, 2026.
The account-free HR talent workflows, CMS editorial core and CRM relationship
workspace are implemented in this update. The broader adoption architecture
and shared backend described below remain proposed. Browser and repository
verification are recorded in the [talent and portals QA receipt](HR-TALENT-QA-2026-10-14.md). No live
business portal is activated by the HR preview or an administrator signing in.

## What exists today

| Surface | Implemented source | Current boundary |
| --- | --- | --- |
| Public website | [App router](../src/router.tsx), public pages and shared layout | React/Vite routes; no CMS-backed publication pipeline |
| Demo portal directory | [Template portal shell](../src/pages/TemplatePortalsPage.tsx) | Account-free navigation between separately scoped HR, CMS and CRM samples; keeps modules mounted while switching demo portals |
| Staff entry | [Admin dashboard](../src/pages/AdminDashboardPage.tsx) | Firebase sign-in and trusted Level 4/5 claim gate; readiness cards link to local tools |
| HR workspaces | [HR portal](HR-PORTAL.md) and host-owned `src/hr/` | Working synthetic employee/manager/management workflows; browser session state, separate protected live boundary |
| CMS workspace | [CMS demo](../src/cms/CmsDemo.tsx), [CMS transitions](../src/cms/model.ts), [CMS tests](../tests/portals/cms.test.mjs) | Working account-free draft/review/publish/retire core with frozen in-app public projection; no network publishing or durable storage |
| CRM workspace | [CRM demo](../src/crm/CrmDemo.tsx), [CRM transitions](../src/crm/model.ts), [CRM tests](../tests/portals/crm.test.mjs) | Working account-free companies/contacts, lead conversion, opportunity pipeline and tasks; owner-scoped records and local receipts, no messaging or external sales operations |
| CMS and CRM local fixtures | [LAN server](../.SYSTEMX/LAN/server.mjs), [LAN guide](../.SYSTEMX/LAN/README.md) | Guarded local record editing in the developer control plane; not a deployed business portal |
| Page/source editing | [LAN stack contract](../.SYSTEMX/LAN/UNIFIED-AUTH-AND-STACK-CONTRACT.md) | Local source/page/metadata operations with backup, diff and confirmation controls |
| CMS design contracts | [Designer CMS schema](../.SYSTEMX/LAN/Builder/contracts/designer-cms.schema.json) | Collection, item, query, binding and form schema; not proof of an end-user publishing engine |
| Shared identity | [Firebase runtime](../src/config/firebase.ts), [account levels](../src/auth/accountLevels.ts) | Public/member/customer/staff shell access; no complete tenant/module membership service |
| Optional HR storage foundation | [Gusto Firebase guide](GUSTO-FIREBASE.md) | Explicit adoption work remains before durable live portal mutations |

The LAN is a developer/operator control plane. Deployed CMS and CRM portals
should be application routes with their own scoped services and records.
Keep LAN routes and source-edit capabilities outside production bundles.

## Shared shell and separate module permissions

Use one application shell for organization selection, navigation, search,
notifications, accessibility and session status. Each workspace owns its
navigation, records, role checks and mutations. A shell account level does not
grant every HR, CMS or CRM capability.

Proposed organization membership:

```text
organizations/{orgId}
  memberships/{authUid}
    status: active | suspended
    modules:
      hr: [employee | manager | hr-admin | payroll-admin | auditor]
      cms: [author | reviewer | publisher | viewer]
      crm: [representative | manager | administrator | auditor]
    scopes: named team / assignment / employee references
```

These are proposed backend records. Roles must come from a trusted membership
issuer and be checked for every query and mutation. Validate organization
membership and record ownership independently. The organization in the URL or
browser selector is a request, not authority. Owner status may administer
memberships through a reviewed backend; it should not bypass every module's
sensitive-data policy implicitly.

Keep the existing HR role vocabulary for HR. CMS and CRM roles are additions,
not substitutes for employee/payroll roles. Customer subscription tiers remain
separate from staff permissions. The current local demo identity selectors
continue to control fictional records only.

### Proposed role matrix

| Role | HR | CMS | CRM |
| --- | --- | --- | --- |
| Employee | Own permitted profile, assignments, leave, reviews and statements | Published employee-facing content if assigned | No customer access by default |
| HR administrator | Scoped people/recruiting workflows; compensation restrictions still apply | No publishing access by default | No customer access by default |
| Payroll administrator | Approved payroll scope | No content access by default | No customer access by default |
| CMS author | No HR access by default | Create/edit assigned drafts and request review | No customer access by default |
| CMS reviewer | No HR access by default | Review an exact revision and return feedback | No customer access by default |
| CMS publisher | No HR access by default | Publish approved revisions; retire/restore through recorded actions | No customer access by default |
| CRM representative | No HR access by default | Read published sales content | Assigned contacts, companies, opportunities and activities |
| CRM manager | No HR access by default | No publishing access by default | Team assignments, pipeline and approved reports |
| Module auditor | Allowed module metadata and audit views | Read authorized revisions and publishing receipts | Read approved records and audit metadata; no mutation |
| Organization administrator | Assign reviewed module memberships | Assign reviewed module memberships | Assign reviewed module memberships |

A person can hold multiple explicit roles. The dashboard should render only
authorized modules and actions; services must still enforce those checks when
called directly.

## Proposed route and file structure

Retain existing HR URLs. The account-free entry points are `/portals`,
`/cms/demo`, `/crm/demo` and the existing `/hr/demo/...` family. The proposed
expanded subroutes and protected CMS/CRM routes below are not implemented:

| Workspace | Account-free routes | Protected adopted routes |
| --- | --- | --- |
| Portal overview | `/portals` with availability labels | `/admin` with permitted workspace links |
| CMS | `/cms/demo`, `/cms/demo/collections`, `/cms/demo/content/:id`, `/cms/demo/reviews`, `/cms/demo/assets`, `/cms/demo/locales`, `/cms/demo/preview/:id` | `/admin/cms/...` |
| CRM | `/crm/demo`, `/crm/demo/contacts`, `/crm/demo/companies`, `/crm/demo/leads`, `/crm/demo/opportunities`, `/crm/demo/activities`, `/crm/demo/tasks`, `/crm/demo/reports` | `/admin/crm/...` |
| HR | Existing `/hr/demo/...` family | Existing protected HR route family |

Proposed host-owned modules:

```text
src/portals/       # module catalog, shell links, organization context, shared UI
src/cms/           # model, permissions, mock transitions, fixtures, views
src/crm/           # model, permissions, mock transitions, fixtures, views
src/pages/         # CmsPage.tsx and CrmPage.tsx entry points
integrations/cms/  # optional server adapter and content delivery boundary
integrations/crm/  # optional server adapter and import/export boundary
tests/cms/         # workflow and permission regressions
tests/crm/         # workflow and permission regressions
```

Keep product runtime extensions in the host tree. The imported managed
`.SYSTEMX` release and research archives remain immutable. Reuse visual
primitives and navigation helpers; share domain records only through explicit
projections rather than importing another module's full state.

## CMS: content model and publication workflow

The implemented CMS mock supports **pages and articles**, collection/title/slug
search, a plain-text content editor, draft/review/publish/retire states,
deterministic activity receipts and a frozen local public projection. Use
`/cms/demo` and switch its fictional author, reviewer, publisher and read-only
viewer identities. All controls act on synthetic browser memory. The shared
demo shell preserves each module when switching among HR, CMS, CRM and the
portal directory. Refresh or leaving the demo area clears the session; **Reset
CMS samples** resets only CMS. The model enforces permissions independently of
visible buttons.

An author saves a revision and requests review. A separate reviewer approves
that exact revision or returns it with feedback. The publisher simulates
publication. Editing an approved or published entry creates a new draft and
invalidates approval; the older public snapshot remains unchanged until the
new revision is approved and published. Publishing and retirement produce
local receipts. Case-insensitive slugs are reserved within their collection,
including the still-published slug while a draft uses a new one. The preview
renders text, never HTML supplied by an editor.

FAQ/announcement collections, locale filters, a complete retained revision
browser, review queue, asset library and durable publishing transport remain
adoption work. The proposed records below describe that expanded target; the
mock does not claim to persist these backend collections.

Proposed records under an organization:

| Record group | Minimum fields and rules |
| --- | --- |
| `cms_collections` | Schema ID/version, field definitions, permitted audience, validation rules |
| `cms_content` | Collection ID, slug, locale, owner, workflow state, draft revision ID, published revision ID |
| `cms_revisions` | Immutable validated field values, revision number, author, timestamp; no embedded credentials |
| `cms_reviews` | Content/revision ID, assigned reviewer, decision, feedback and receipt |
| `cms_assets` | Tenant-owned asset metadata, alt text, usage references and approved transport state |
| `cms_publications` | Exact approved revision, audience, publication/retirement time and receipt |

Workflow: **draft → in review → approved → published → retired**. Reviewers may
return a draft for changes. Editing an approved draft invalidates its approval.
Publishing selects the exact approved revision. A later draft must not replace
the published version until it completes review. Restoring old content creates
a new reviewed publication event. Locale variants have separate review states
and a unique collection/slug/locale combination.

The public site reads a minimal published projection containing only approved
public fields. Drafts, internal notes, reviewer identity and private asset URLs
stay outside that projection. A mock preview renders synthetic drafts inside
the application; it does not deploy, create a public URL or modify the live
website. Production publishing requires an adopted delivery adapter, server
authorization and an explicit operator publication policy.

## CRM: relationship model and pipeline workflow

The implemented CRM mock provides companies, contacts, leads, opportunity
stages, follow-up tasks, scoped activity and dashboard reports. It uses fixed
owner, sales manager, two representative and read-only auditor identities.
Representatives access their own linked records. All emails use fictional
`.invalid` domains. No external messages or customer systems are contacted.

The table below proposes the broader production data model; fields beyond the
working mock remain adoption work.

| Proposed record group | Minimum fields and rules |
| --- | --- |
| `crm_contacts` | Name, fictional work channels, company reference, owner, communication preferences and provenance |
| `crm_companies` | Organization name, synthetic domain, owner and linked contact IDs |
| `crm_leads` | Source, qualification state, contact/company references, assigned representative |
| `crm_opportunities` | Company/contact references, pipeline/stage, currency, value, expected close date, owner and outcome reason |
| `crm_activities` | Subject references, permitted note, activity type, author and occurrence time |
| `crm_tasks` | Subject reference, assignee, due date, status and completion receipt |
| `crm_stage_events` | Opportunity ID, previous/new stage, actor, reason and receipt |

Implemented lead flow: **new → qualified → converted**. Conversion checks
ownership and duplicate identities, reuses a company owned by the same
representative where appropriate, and creates a contact/opportunity exactly
once. Opportunity flow: **discovery → proposal → negotiation → won**, or an
open opportunity can be marked **lost**. Tasks inherit the linked opportunity's
owner and can complete once. Each action updates dashboard counts and the
sample activity timeline.

Disqualification, outcome reasons, reopening, due-date scheduling, bulk import,
advanced account relationships and communication preferences are proposed
expansions beyond this mock core.

Reports distinguish pipeline value from won value and label all amounts as
fictional. Neither state implies a contract, invoice, payment or sent message.
Account-free actions add local activity receipts; email, phone, bulk import,
export and external synchronization remain disabled until their own adapters
and authorization are implemented.

## Proposed cross-module handoffs

| Link | Allowed projection and explicit action |
| --- | --- |
| HR recruiting → CMS job listing | HR approves a public job projection containing title, description, location label and application instructions. CMS reviews and publishes it. Candidate records and internal evaluations stay in HR. |
| CMS public form → CRM lead | An adopted form service creates a scoped lead only for an explicit customer inquiry with captured purpose/provenance. A mock submission creates fictional local data only. |
| CRM → CMS collateral | CRM may reference approved, published sales content by publication ID. It cannot read the draft review record. |
| Employee → CRM assignee | An explicit membership/assignment reference may identify an active staff owner. It does not copy HR compensation, health, absence or review data. |
| Shared dashboard → module action | Each module returns authorized aggregate counts and a permitted route. A shared inbox must not expose hidden record titles or sensitive note text. |

These handoffs are designs for adoption; the current demos do not transfer
records between modules. A recruiting candidate is not automatically a customer contact. A customer
contact is not automatically an employee. Matching email strings do not grant
permission to merge records or share personal information. Any approved handoff
uses an explicit action, selected fields, provenance, a destination permission
check and a receipt. Deletion/retention policies must remain explicit per module
when durable storage is adopted.

## Account-free development approach

1. Ship fictional fixtures and deterministic transition functions in each host
   module. No provider keys, login, billing, email delivery or cloud services
   are required for the mock route family.
2. Keep each mock session in browser memory with a visible synthetic label and
   reset action. The implemented demo shell preserves state during portal
   navigation; refresh begins clean samples. Provide at least two organizations for cross-tenant negative
   tests once organization selection is implemented.
3. Validate state transitions and role scope in shared domain functions used by
   the UI. Test direct calls with unknown IDs, foreign assignments and repeated
   actions, as well as happy paths.
4. Keep mock state separate from LAN fixtures and optional emulator records.
   Mock publish means an in-app published projection; mock CRM activity means a
   local receipt. Neither crosses into the operator control plane or provider.
5. Add durable storage behind an explicit adapter only after mock acceptance.
   Re-run workflow and permission checks through trusted server endpoints and
   storage rules before connecting real data.

## Delivery phases and acceptance

| Phase | Concrete deliverable | Acceptance evidence |
| --- | --- | --- |
| Portal foundation, implemented local shell | Shared demo catalog and navigation; independent module records/reset | Portal navigation preserves each mounted demo; production organization/membership contract remains proposed |
| CMS mock core, implemented | Page/article editor, separate exact-revision review, frozen local preview and publish/retire receipts | Ten domain tests cover transitions, permissions, stale revisions, slug uniqueness and public-field projection; release browser evidence must separately verify the UI |
| CMS expanded mock, proposed | Asset metadata, locale variants, full revision history and review queue | Locale and asset references remain scoped; each variant has independent review/publication state |
| CRM mock core, implemented | Contacts/companies, lead conversion, opportunity stages, tasks/activities and dashboard | Browser qualifies/converts once, advances and closes a sample opportunity, completes a task; foreign-owner actions and duplicate conversion are refused |
| Cross-module mock | Reviewed job projection and explicit synthetic inquiry handoff | Only selected fields move; no candidate/customer merge; dashboard count and destination record reconcile |
| Durable adopted app | Tenant membership, server adapters, rules, audit/retention and storage transport | Two-tenant isolation, direct endpoint rejection, restart persistence and independently scoped role checks pass |
| Optional providers/live publication | Selected CMS delivery, CRM messaging or integration adapters | Operator-approved setup, provider-specific verification and publication evidence; mocks remain usable without accounts |

The implemented mocks inform the proposed shared patterns. A passing synthetic
workflow does not establish server authorization or production publishing.
New app adopters should select required modules and complete their acceptance
evidence before enabling real business records or public publication.
