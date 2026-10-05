# Unified Login and Admin Operations

This page describes the day-one identity path shared by the public WebApp and
the local SYSTEMX LAN builder.

## Start the owned local session

From the repository root:

```bash
npm run dev:systemx
```

The supervisor starts Vite, SYSTEMX LAN, and the Firebase Auth, Firestore, and
Storage emulators as owned child processes. It selects unused loopback ports
for each service, records them in `.SYSTEMX/state/local-session.json`, and
prints the active URLs. It never stops another project's process merely because
that project uses port 5173, 7331, 9099, 8080, or 9199.

`npm run dev:firebase` is an alias for the same owned session. The raw
`npm run dev:firebase:raw` command is available only for an operator who
intentionally wants the Firebase CLI without the WebApp supervisor.

## Local login

Open the printed public app URL and choose `/login`.

The local policy is deliberately fail-closed:

| Provider | Local state | Production direction |
| --- | --- | --- |
| Email + password | Enabled through Auth emulator | Firebase Auth Email/Password |
| Google | Disabled | Firebase Google provider + authorized domains |
| Email link / code | Disabled | Firebase email-link + sender/DNS setup |
| Custom auth code/token | Planned | Trusted server-issued short-lived token |
| OIDC/SAML SSO | Planned | Approved Firebase tenant/provider configuration |

Create or sign in with a disposable `.test` email. The browser never receives
Firebase Admin credentials, a service-account key, a Stripe secret, or a Google
Cloud token. The local project is `demo-systemx` and the Auth endpoint is shown
on the login screen.

## Admin dashboard

`/admin` is the public application's staff shell, not a replacement for server
authorization. A normal local email/password account is Level 1 and sees an
admin-claim stop page. The documented `Test-Admin@example.test` and
`Test-SU@example.test` identities may display Level 4/5 in the emulator lane so
the local UI can be exercised. This fixture mapping is never a production
authorization mechanism.

The management cards connect the operator to the corresponding LAN surfaces:

- Unified Auth and provider readiness;
- CMS/Firestore page and collection data;
- CRM/relational adapter planning for Firebase SQL Connect/Cloud SQL;
- GCloud, Firebase CLI, Storage, and deployment preflight;
- Stripe readiness without live payment mutation;
- SEO, route metadata, social metadata, and favicon ownership.

### What the front end reads from LAN

After a Level 4/5 session is present, `/admin` polls the read-only
`/__systemx/api/status` bridge. The screen and the LAN therefore agree on:

- whether Vite and the Firebase Auth emulator are online;
- the current app, direct LAN, bridge, Auth, Firestore, and Storage URLs/ports;
- `template-edit` mode, current-template status, write policy, branch, and
  changed-file count;
- local page, collection, and user counts;
- installed Node, npm, Vite, Firebase, gcloud, Stripe, and Playwright tooling;
- provider states such as local-ready, guarded, planned, or offline.

The status card refreshes on demand and on a short local polling interval. It
does not expose environment files, credentials, arbitrary shell commands, or
cloud mutation endpoints. Admin surface links simply take the authorized staff
member to the corresponding LAN view; the LAN still enforces session tokens,
allowlists, backup/diff/secret-scan checks, typed confirmation, and evidence.

If the local session is stopped, the front end displays `SYSTEMX LAN status is
unavailable` and tells the operator to run `npm run dev:systemx`. It does not
turn an unavailable backend into a green status. In production, the card is
documentation-only because the loopback LAN is excluded from the public build.

## SYSTEMX LAN relationship

Use `/__systemx/` through the Vite bridge for the local control plane. The
`Providers` panel reads the same
[`auth-provider-registry.json`](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/LAN/Builder/contracts/auth-provider-registry.json)
contract as the login page. Its `/api/auth/providers` read model reports the
actual dynamic Auth/Firestore/Storage ports, `local ready`, `disabled`, or
`planned` provider state, and the no-production-fallback policy.

The LAN can inspect and safely edit the current template's page models,
components, CMS/CRM fixtures, and allowlisted source files. A write still
requires a session token, backup, diff, secret scan, explicit confirmation, and
post-write quality evidence. A provider readiness card is not cloud mutation
authority.

## Verification checklist

```bash
npm run systemx:session:status
npm run typecheck
npm run lint
npm test
npm run build
npm run docs:links
```

In a browser smoke test, verify:

1. `/login` reports local emulator readiness;
2. a disposable account can be created and signed in;
3. a Level 1 account cannot enter admin controls;
4. an approved local fixture can render the Level 4/5 management shell;
5. the LAN `Providers` panel shows email/password as local ready and the other
   providers as disabled or planned;
6. the app, LAN, and emulator ports belong to this session only.
7. an authorized `/admin` session shows live LAN status and evidence-based
   surface labels instead of hard-coded availability claims;
8. a production build identifies the LAN as local-only/documentation-only.

Full implementation boundaries are documented in
[`SYSTEMX Unified Auth and Stack Contract`](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/LAN/UNIFIED-AUTH-AND-STACK-CONTRACT.md).
