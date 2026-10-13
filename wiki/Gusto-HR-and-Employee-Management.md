# Gusto HR and employee management

The WebAppX HR extension standardizes management, employee, manager and
contractor pages around a portable `.SYSTEMX/GUSTO/` contract. The default preview
uses fictional data and requires no Gusto account.

Start with [Gusto setup and testing](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md),
[Firebase architecture](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-FIREBASE.md),
and the [portable package](https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/GUSTO).

| Surface | Entry point | Implemented boundary |
| --- | --- | --- |
| HR entry | `/hr` | Connection requirements and preview navigation |
| Management preview | `/hr/demo/admin` | Employee directory, onboarding tasks, native module views, reporting and payroll previews |
| Employee preview | `/hr/demo/employee` | Own synthetic profile, checklist, pay/documents, time and time-off requests |
| Manager preview | `/hr/demo/manager` | Scoped team records and sample time-off approvals |
| Contractor preview | `/hr/demo/contractor` | Separate fictional profile, onboarding and payment previews |
| Gusto SDK proof | `/hr/demo/sdk` in `npm run dev` | Actual SDK employee directory, three tab queries and wire-format fixtures |
| Connected portals | `/admin/hr`, `/employee`, `/manager/hr`, `/contractor` | Guarded; live integration remains unconfigured in the reusable template |

The SDK directory contract pins version 0.56.6 and API date 2026-06-15.
The local development middleware refuses writes, credentials, unknown endpoints
and foreign-company IDs. Payroll previews do not send payroll or transfer funds.
Other Gusto flows require their own verified backend adapters and Demo acceptance.

## Credentials and ownership

Gusto documents application-specific credentials through a Developer Portal
account; it does not document a shared/public test key. Its
[hosted Flows demo](https://docs.gusto.com/embedded-payroll/docs/try-it-now) is
available without API keys for visual exploration. See the
[Embedded setup](https://docs.gusto.com/embedded-payroll/docs/getting-started)
before a real sandbox integration.

Gusto remains authoritative for payroll/tax/bank/provider documents. The app
owns tenant membership, identity mapping, restricted HR storage and native
recruiting, policies, assets, training, performance and access workflows.
The package records page sections, role permissions, empty/error states and
implementation phases so a specification is not mistaken for a working adapter.

## Start locally

```bash
npm ci
npm run dev
```

Open Vite's printed URL at `/hr/demo`, then choose a synthetic portal/role.
Preview state resets on refresh. Use `/hr/demo/sdk` to inspect the genuine SDK
directory. Production builds retain the HR preview; the SDK mock API is local
development only.

Follow [Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
for checks, fixtures, optional Firebase module activation and the phased migration
to actual Gusto Demo and production. Return to [Home](Home.md) or
[Unified Template Guide](Unified-Template-Guide.md) for the rest of WebAppX.
