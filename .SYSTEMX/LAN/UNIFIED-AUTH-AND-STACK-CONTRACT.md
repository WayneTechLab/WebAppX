# SYSTEMX Unified Auth and Stack Contract

Status: **G1 local implementation**

This contract makes the public WebApp, the local Firebase development lane,
the Level 0–5 account model, the `/admin` shell, and the SYSTEMX LAN provider
read model describe the same system.

## Day-one local path

The supported local sequence is deliberately small:

```text
npm run dev:systemx
        │
        ├── Firebase Auth emulator :<auth-port>
        ├── Firestore emulator :<firestore-port>
        └── Storage emulator :<storage-port>

npm run dev:systemx
        │
        ├── public Vite app (auto-selected loopback port)
        ├── /login → Firebase Auth email/password
        ├── /admin → claim-gated management shell
        └── /__systemx/ → loopback LAN builder and provider read model
```

`npm run dev:firebase` is retained as an alias for the same owned local
session. `npm run dev:firebase:raw` is the unwrapped Firebase CLI lane for
advanced operators; it does not attach itself to the running WebApp.

The supervisor chooses each free loopback port at session start. The values
printed by the supervisor and returned by `GET /__systemx/api/status` are
authoritative for that session; `9099`, `8080`, and `9199` are only fallback
defaults used when the raw Firebase lane is run without the supervisor. This
prevents the template from stopping or reusing another local project's ports.

The browser never receives a Firebase Admin credential, service-account JSON,
Stripe secret, Google Cloud token, or arbitrary CLI capability. The Firebase
Web SDK configuration is client-safe, while production authorization remains
the responsibility of Firebase rules, trusted functions, claims, and provider
configuration.

## Provider matrix

The canonical machine-readable source is
[`Builder/contracts/auth-provider-registry.json`](Builder/contracts/auth-provider-registry.json).

| Provider | Local G1 | Production intent | Boundary |
| --- | --- | --- | --- |
| Email + password | Enabled through Auth emulator | Supported | The only automatic local login/create path |
| Google account | Disabled | Supported | Enable in Firebase Auth and configure domains |
| Email link / code | Disabled | Supported | Requires sender, authorized domains, and email configuration |
| Custom token / auth code | Planned in local UI | Supported | Mint only from a trusted backend; never accept arbitrary browser tokens |
| OIDC / SAML SSO | Planned in local UI | Supported | Requires approved tenant/provider metadata and redirect policy |

“Supported” means the contract and adapter boundary exist. It does not mean a
project's provider is configured, billed, or production-ready.

## Front-end surfaces

- `/login` is the single public identity entry point. In local development it
  initializes the Firebase Auth emulator with a non-secret `demo-systemx`
  configuration and exposes only email/password.
- `/admin` is the authenticated management shell. It requires Level 4 or
  Level 5 capability state; the browser does not promote itself to that level.
- `/admin` reads the LAN's status bridge after a Level 4/5 session is present.
  Its runtime card reports Vite, emulator, builder, port, repository, data,
  provider, and CLI evidence. Surface cards are derived from those live states;
  they are not an authorization mechanism and do not expose arbitrary backend
  commands.
- `.SYSTEMX/LAN/Website_Dashboard.html` is the local co-management surface for
  source, page, CMS/CRM fixture, provider, CLI, and evidence tools. It is not a
  public application route and is excluded from `dist` by the isolation gate.

The account level shown by the client is a convenience projection. Firestore
and Storage rules, trusted server code, and project claims are authoritative.
Local fixture email names may display their documented Level 0–5 role only in
the emulator lane; that mapping is never a production authorization strategy.

## Data and service planes

The builder keeps data classes distinct so a future adapter can be added
without hiding provider behavior:

| SYSTEMX surface | G1 state | Intended adapter |
| --- | --- | --- |
| CMS/page metadata | Local JSON fixture with guarded writes | Firestore or a project-selected CMS service |
| CRM/relational records | Local fixture contract | Firebase SQL Connect backed by Cloud SQL PostgreSQL, when selected |
| Web media | Local file boundary | Cloud Storage for Firebase |
| Operator kits/documents | `.SYSTEMX/KIT` and ignored LAN files | Google Drive/Shared Drive or GCS through explicit connector gates |
| Commerce | Readiness card only | Stripe SDK/CLI and verified webhooks in a separately authorized lane |
| SEO/meta/favicon | Current source files and route inventory | Guarded source editor plus future metadata schema |

The current LAN does not silently write any of these cloud services. The
provider cards indicate readiness and next gates; they are not cloud mutation
authority.

## Staff/front-end parity contract

The public WebApp and the LAN have a deliberate split of responsibility:

```text
/login
  identity entry + local provider matrix + session connection status

/admin
  Level 4/5 staff shell + live status summary + links to guarded LAN surfaces

/__systemx/
  local builder, source/page/CMS/CRM tooling, provider read models, evidence
```

The WebApp only consumes read-only status. Source writes, fixture writes,
provider actions, CLI/SDK/MCP actions, backups, secret scans, confirmations,
and operation evidence remain inside the loopback LAN and its allowlisted
SYSTEMX contracts. When `npm run dev:systemx` is stopped, `/admin` must say the
LAN is unavailable; it must not render green availability claims. In production,
the same page explains that the LAN is intentionally absent rather than trying
to contact a public control endpoint.

## Failure and stop rules

Stop the local workflow when:

1. the Auth emulator is unavailable for an email/password test;
2. an operator is asked for a production credential in the browser;
3. the `/admin` surface would need client-side elevation;
4. a provider has no explicit adapter, project, or environment boundary;
5. the LAN session reports a port owned by another project;
6. a source or provider write lacks a backup, diff, secret scan, exact
   confirmation, and post-write quality gate.

Use the LAN `Providers` panel, the `/api/auth/providers` read model, and the
JSONL operation evidence to diagnose the stop. Do not work around the gate by
calling an arbitrary shell endpoint or editing runtime folders manually.

## Verification

The minimum local checks are:

```bash
npm run typecheck
npm run lint
npm test
npm run build
node .SYSTEMX/scripts/verify-template-structure.mjs
```

With the Auth emulator running, smoke-test `/login` using a disposable `.test`
email and password, then confirm that `/admin` remains claim-gated for a normal
Level 1 user. The LAN provider panel must report `email-password` as local
ready and every other provider as disabled or planned for the local lane.
