# Gusto and the standard HR workspace

WebAppX provides a credential-free HR preview, a real Gusto React SDK directory
contract, and an optional Firebase backend foundation. The portable specifications
live in `.SYSTEMX/GUSTO/`; React code lives in `src/hr/`, and server adapters in
`integrations/gusto/`. Read each capability's implementation status before adoption.

## Try the template without an account

```bash
npm ci
npm run dev
```

Open the URL printed by Vite and visit:

| Route | What you can test |
| --- | --- |
| `/hr` | Entry points and connection requirements |
| `/hr/demo` | Synthetic management, employee, manager and contractor workspaces |
| `/hr/demo/admin/employees` | Employee search, status filters and fictional records |
| `/hr/demo/employee/onboarding` | App-owned checklist actions |
| `/hr/demo/employee/time` | Sample time entry |
| `/hr/demo/employee/time-off` | Sample request and scoped management approval |
| `/hr/demo/admin/payroll` | Synthetic payroll preview; money movement is unavailable |
| `/hr/demo/sdk` | Genuine Gusto SDK employee list with local wire-format fixtures |

Demo roles apply only to synthetic preview data and do not alter Firebase claims.
Changes in the HR preview live in React state and reset on refresh. Do not enter
real employee information. Connected routes such as `/admin/hr`, `/employee`,
`/manager/hr` and `/contractor` require Firebase sign-in and an adopted server
integration; the reusable template keeps their live data/actions unavailable.

The SDK preview pins `@gusto/embedded-react-sdk` **0.56.6**, its published API
dependency **0.3.1** and API date **2026-06-15**. It uses the SDK's
`EmployeeManagement.EmployeeList` block against a development-only same-origin
mock endpoint. Active, Onboarding and Dismissed reads use synthetic snake_case
JSON, version headers and pagination. Writes, credentials, foreign companies and
unknown endpoints are refused. This proves the directory contract, not full
company onboarding, payroll execution, tax calculations or provider acceptance.
The local mock server is not included in Hosting or `npm run preview`.

## Is there a test key?

No shared/public integration key is documented. Gusto Embedded Demo requires a
Developer Portal account, organization and application, which supplies that app's
own client ID and secret. That sandbox setup is separate from opening a live
payroll company. See [Gusto's getting-started guide](https://docs.gusto.com/embedded-payroll/docs/getting-started).

Gusto's [hosted Flows demonstration](https://docs.gusto.com/embedded-payroll/docs/try-it-now)
can be viewed without API keys. It does not supply reusable API credentials.
The local WebAppX mocks are the account-free development path.

Embedded Payroll and App Integrations are separate programs. Embedded fits the
onboarding/payroll/contractor flows in this architecture. SDK installation alone
does not grant API or production access; review the
[program comparison](https://docs.gusto.com/app-integrations/docs/app-integrations-vs-embedded-payroll)
before selecting a Gusto program for an adopted app.

## Package and ownership

Read [the portable package](../.SYSTEMX/GUSTO/README.md),
[route specifications](../.SYSTEMX/GUSTO/ROUTES.json),
[capability ownership](../.SYSTEMX/GUSTO/CAPABILITIES.json), and
[the Firebase adapter](GUSTO-FIREBASE.md).

The selected immutable SYSTEMX release supplies shared defaults. Existing outer
`.SYSTEMX/GUSTO/` copies become project owned on adoption and are preserved by
future imports. Keep local fixtures/configuration out of managed snapshots.
Do not populate the reusable template's coordination or employee records.

| Layer | Owner |
| --- | --- |
| Payroll, tax/bank setup, payment execution and provider documents | Gusto; real execution needs an approved integration |
| Tenant memberships, trusted identity mappings and redacted projections | Adopted app backend |
| Recruiting, organization, checklists, policies, assets, training and performance | App-owned HR modules; page specifications distinguish previews from implemented workflows |
| SDK components and endpoint inventory | Pinned Gusto artifact, with retained upstream license/provenance |
| `.SYSTEMX/GUSTO` contracts and synthetic examples | Portable standard |

## Adopt the Firebase module

The optional module in `integrations/gusto/functions/` has its own package and
lockfile. It is not registered in root `firebase.json` and is disabled by default.
Read its configuration and [Firebase setup](GUSTO-FIREBASE.md) before activation.

Use a Standard-compatible Firestore model under `organizations/{orgId}`.
Membership, role, employee/company mappings, OAuth material, webhook inboxes and
provider projections are backend managed. Store minimal directory/status
projections separately from restricted HR records. SSNs, bank accounts, tax
answers, raw paystubs and sensitive provider responses are not mirrored by default.
The backend tests exercise membership/resource boundaries independently of page
visibility. Root account level and a role selected in the public preview do not
authorize Gusto endpoints.

## Migration and checks

1. Build and review synthetic navigation, forms, role policy and data contracts.
2. Adopt trusted memberships and native HR storage; validate emulator rules.
3. Obtain application-specific Demo credentials through Gusto's program.
4. Implement the token vault/serialized refresh and curated proxy operations.
   Verify company/self bindings, SDK wire shapes, API date, scopes and conflicts.
5. Verify webhook signatures and representation against actual Demo evidence,
   then validate deduplication and reconciliation with authorized resources.
6. Validate each enabled provider workflow in Demo, including payroll/contractor
   write gates. Demo scope behavior is not production authorization proof.
7. Complete Gusto program/QA and the adopted app's production release gates.

The current optional adapter is a tested foundation, with connected transport
disabled. The module does not claim full SDK mock coverage or production payroll
readiness. Production deployment and financial actions require their own operator
authorization in the adopted app.

```bash
npm run hr:test
npm run systemx:status
npm run systemx:validate
npm run ci:all                         # maintain this blank reusable template
npm run deploy -- hosting --preflight
```

See [managed imports](SYSTEMX-INTEGRATION.md) and
[template maintenance](TEMPLATE-MAINTENANCE.md) for publication and preservation.
