# SYSTEMX LAN API Reference

This page documents the local HTTP contract exposed by the SYSTEMX LAN service
for the current WebAppX. It is an implementation reference for the
dashboard, Playwright smoke tests, approved local tooling, and future adapters.
It is not an invitation to expose the LAN over a network.

Read [SYSTEMX LAN Operations Manual](SYSTEMX-LAN-Operations-Manual.md) first for
the operator workflow, port lifecycle, editor behavior, evidence policy, and
stop conditions. Read [SYSTEMX LAN Builder](SYSTEMX-LAN-Builder.md) for the
architecture and roadmap.

## Contract status

The current API is a local control contract, not a public API.

| Boundary | Current contract |
| --- | --- |
| Bind address | 127.0.0.1 only. |
| Port | Dynamic per session; default preference is 7331, not a guarantee. |
| Base URL | Direct LAN URL printed by the session, or the same-origin Vite bridge at the active app port followed by /__systemx. |
| Browser authority | A random per-session token carried by the dashboard meta tag and request header. |
| Mutation model | Fixed named routes with server-side validation. |
| Generic shell | Not exposed. |
| Secret reads | Not exposed. |
| Production use | Not supported. |
| Cloud mutation | Not enabled by generic Generation 1 builder actions. |

A browser tab from a previous session may render a dashboard while holding an
expired token or stale port. Always use the URLs and session ID from the
current session record.

## Start a testable local session

From the repository root:

~~~bash
npm run dev:systemx
npm run systemx:session:status
~~~

The session prints:

~~~text
public app:       http://127.0.0.1:<app-port>/
LAN bridge:       http://127.0.0.1:<app-port>/__systemx/
LAN direct:       http://127.0.0.1:<lan-port>/
Auth emulator:    http://127.0.0.1:<auth-port>/
Firestore:        http://127.0.0.1:<firestore-port>/
Storage:          http://127.0.0.1:<storage-port>/
~~~

Use the bridge for preview inspection because it shares the Vite origin. Use
the direct URL for independent LAN diagnostics. The active app, LAN, Auth,
Firestore, and Storage ports are passed to the children through the current
session environment. Do not hard-code the preferred ports in a client or test.

The session supervisor stores ignored runtime state under SYSTEMX state. The
status command is the first diagnostic because it reports ownership and the
current URL set without killing or attaching to another project.

## Request authority

### Host and Origin

The server accepts only the active loopback Host and the local Origin values
for the current app and LAN ports. Requests with a different Host or Origin
should fail closed.

The direct service is not a LAN service in the network sense. It binds to the
loopback interface so other computers cannot use it by default. If a process
is found listening on a physical interface, stop the session and investigate.

### Session token

The dashboard receives a random token in its HTML meta data. Mutating requests
must send the token in the header:

~~~text
x-systemx-session: <current-session-token>
~~~

The token is a session capability. It is not a Firebase credential, account
claim, API key, or substitute for host security. Never commit it, paste it into
a ticket, or include it in a log.

Read requests do not replace normal authentication or grant cloud authority.
Mutation requests require the token and the route's exact policy.

### Confirmation phrases

Some actions require an exact operator phrase in the JSON body:

| Operation | Exact confirmation |
| --- | --- |
| Source write | SAVE LOCAL CHANGE |
| Font/project typography write | SAVE FONT CHANGE |
| Component registry write | SAVE MODULE |
| Existing-project inventory | SCAN EXISTING PROJECT |
| Browser text-edit UI handoff | SAVE TEXT CHANGE before the server receives SAVE LOCAL CHANGE |
| Local record fixture | Server policy may require an explicit local action; no production account is created. |

A confirmation phrase is a human-friction control, not authorization by itself.
The server still checks path, content, session, secrets, current repository,
and action-specific validation.

## Common response behavior

Successful responses are JSON and generally include a status/result field plus
the read model or action evidence. The dashboard treats the response as
untrusted data and renders only the fields it expects.

Error responses should contain a safe human-readable error and, where useful,
an error code. They must not contain environment files, session tokens,
credentials, raw private keys, or full child-process environments.

Common failure classes:

| Failure | Meaning | Correct response |
| --- | --- | --- |
| 400 | Invalid JSON, missing field, invalid enum, invalid route, or bad confirmation. | Correct the bounded request. |
| 403 | Host, Origin, token, path, or secret policy rejected. | Do not weaken the guard; reload the current session or stop. |
| 404 | Unknown route, missing file, or unsupported operation. | Use the documented route or the CLI. |
| 405 | Method not allowed. | Use the route's documented method. |
| 409 | Conflicting local state, duplicate action, or unsafe mutation condition. | Review current state and diff before retrying. |
| 413 | Payload too large. | Reduce the bounded request; use a normal source workflow. |
| 500 | Unexpected local failure. | Review sanitized logs and stop if data integrity is uncertain. |

## Read endpoints

All read endpoints are local status/read-model endpoints. They do not prove
that a remote Firebase, Google Cloud, or Stripe service is reachable unless
the response explicitly reports a verified operation.

### GET /api/health

Purpose: determine whether the loopback LAN process is online.

Typical fields:

~~~json
{
  "status": "online",
  "mode": "local-only",
  "host": "127.0.0.1",
  "port": "<lan-port>"
}
~~~

Use this as a process probe. It does not prove that Vite or Firebase
emulators are healthy.

### GET /api/status

Purpose: return the current co-management read model.

The status model includes:

- repository branch, cleanliness, and changed-file summary;
- Vite listening state and active URL;
- current session ID, LAN URL, app URL, bridge URL, port policy, and owner PID;
- selected Auth, Firestore, and Storage emulator ports;
- builder mode, current-template flag, write policy, and active waves;
- pages, components, registry count, design tokens, and source-file summary;
- providers and authentication state;
- local collections, users, pages, and environment presence;
- detected Node, npm, Vite, Firebase, GCloud, Stripe, and Playwright tools;
- file and evidence summaries.

The status response reports presence and readiness, not secret values. It is the
main bridge between the public WebApp admin shell and the LAN dashboard.

The `operating` object reads the managed installation and outer project records:

| Field | Meaning |
| --- | --- |
| `installed` | Whether an installation record was read |
| `selectedVersion`, `pinnedVersion`, `updatePolicy` | Recorded selected release and policy |
| `taskCount`, `tasksByStatus` | Counts from the outer task ledger |
| `agentRoles` | Registered role IDs and role names |
| `childProjectCount` | Registered child-project count |
| `authority` | `records-only` |

The dashboard renders this summary in its Agent 0 panel. The endpoint does not
run the immutable integrity check, execute project commands, start workers, or
inspect their liveness. Use `systemx:status` and `systemx:validate` for those
separate installation/record checks. Unreadable record files fall back to an
unavailable installation or empty summary, so counts alone are not validation.

### GET /api/auth/providers

Purpose: report the actual local and production-readiness provider registry.

Generation 1 local truth:

- Firebase Auth emulator is the local environment;
- email/password is the enabled local provider;
- Google, email link/code, custom token, and OIDC/SAML are not local enabled
  providers;
- production provider rows can be planned or configured without being a live
  local login path;
- the response includes the dynamic emulator URL and ports.

This endpoint does not create accounts, grant claims, or validate a production
identity.

### GET /api/fonts/catalog

Purpose: return the checked-in offline font catalog and optional metadata.

If the LAN process has the optional Google Fonts Developer API key, the server
may enrich metadata. The key itself is never returned. Without the key, the
offline catalog remains the safe baseline.

The response is a catalog, not a license grant. The project owner remains
responsible for font licensing, privacy, performance, and fallback behavior.

### GET /api/fonts/project

Purpose: report the current controlled project typography state.

The response can include:

- selected family;
- controlled CSS import or CSS2 URL metadata;
- token presence;
- source path;
- line or file summary;
- loaded preview metadata when available.

It must not expose unrelated environment values or arbitrary files.

### GET /api/builder/workspace

Purpose: return the builder workspace contract for the current checkout.

The workspace model includes:

- repository root and branch;
- target current-repo;
- mode template-edit or project-edit;
- backup-diff-confirm write policy;
- known page routes and metadata;
- registered components;
- design tokens;
- local collections;
- source-file summaries.

The mode describes the management target. Generation 1 is current-template
editing; it does not silently create a new project.

### GET /api/builder/data

Purpose: return local builder fixtures and page/content state.

This is local model data. It is not a mirror of production Firestore, a CRM
export, or a cloud database backup. The response may include local collections,
users, pages, and environment presence flags, but never passwords or secrets.

### GET /api/builder/components

Purpose: return reusable component/module registry entries.

Entries describe reviewed source locations, names, tags, slots, width
contracts, and registry state. They do not prove that every visual instance was
extracted or that source files were rewritten.

### GET /api/builder/components/export

Purpose: return a reviewable export of the local component registry.

Use this for handoff and evidence. It is not a production package publisher and
does not install a component into another repository.

### GET /api/builder/source?path=<allowlisted-path>

Purpose: read a bounded source file for inspection.

Current source allowlist:

~~~text
src/pages/<file>.tsx
src/components/layout/<file>.tsx
src/components/navigation/<file>.tsx
src/components/shell/<file>.tsx
src/config/siteControls.ts
src/index.css
src/router.tsx
~~~

The query path must resolve within the repository and match the server's exact
allowlist. The endpoint does not provide arbitrary repository browsing. It must
not read environment files, secrets, private keys, runtime directories, or
unbounded paths.

### GET /api/tools

Purpose: report detected local tooling and versions.

Typical tools include Node, npm, Vite, Firebase CLI, GCloud CLI, Stripe CLI,
Playwright, and browser/MCP-related readiness. Detection is not installation,
authentication, or proof that a provider operation can run.

## Mutation endpoints

Every mutation requires:

1. active Host and Origin;
2. current session token;
3. valid JSON;
4. action-specific field validation;
5. secret and path checks;
6. exact confirmation where required;
7. backup or local transaction policy;
8. sanitized operation evidence.

### POST /api/builder/font

Purpose: stage a controlled project font change.

Conceptual body:

~~~json
{
  "family": "Family Name",
  "confirmation": "SAVE FONT CHANGE"
}
~~~

The server validates the family against the catalog/metadata, creates a local
backup, changes only the controlled typography source, writes atomically, and
records the result. Previewing a family does not call this endpoint.

### POST /api/builder/source

Purpose: write a bounded replacement into an allowlisted local source file.

Conceptual body:

~~~json
{
  "path": "src/pages/HomePage.tsx",
  "original": "exact text that occurs once",
  "replacement": "replacement text",
  "confirmation": "SAVE LOCAL CHANGE"
}
~~~

Required policy:

- path matches the allowlist;
- original is non-empty and occurs exactly once;
- replacement is non-empty and below the server size limit;
- secret-shaped markers are rejected;
- current source is backed up;
- write goes through a temporary file and atomic rename;
- response identifies the backup and next quality gate;
- operation evidence is sanitized.

This is not a general patch, code-generation, dependency, rules, or file-upload
endpoint. Use Git and the normal engineering workflow for broad changes.

### POST /api/builder/page

Purpose: mutate local page-model data.

Supported operations are:

- create-page;
- update-meta;
- add-node;
- remove-node.

The request must identify the operation and target page data. Route values are
validated and normalized. The root node cannot be removed. The server backs up
the local page-model data before writing.

A page-model write does not automatically create a React route, update the
router, generate a component, add a Firebase Hosting rewrite, or deploy.

### POST /api/builder/component

Purpose: save reviewed local registry metadata for a reusable module or
component.

Conceptual body:

~~~json
{
  "name": "Site Header",
  "source": "src/components/layout/Header.tsx",
  "tags": ["layout", "navigation"],
  "slots": ["logo", "navigation"],
  "width": "full",
  "confirmation": "SAVE MODULE"
}
~~~

The server validates fields, writes registry state, and records evidence. It
does not infer that every matching DOM node should be rewritten.

### POST /api/builder/ingest

Purpose: inventory an existing project for human review.

Conceptual body:

~~~json
{
  "projectRoot": "/path/to/existing-project",
  "confirmation": "SCAN EXISTING PROJECT"
}
~~~

The server checks that the root exists and is a directory, then inspects
approved metadata. It writes an ingest manifest with pages, likely components,
tooling, findings, and security status. The operation is inventory-only:

- it does not install SYSTEMX;
- it does not edit the existing project;
- it does not install a bridge;
- it does not copy arbitrary source;
- it does not create cloud resources;
- it does not make a live website editable.

A manifest with status ready still needs an architecture decision and separate
migration work.

### POST /api/builder/record

Purpose: add a local CMS/CRM or user fixture for builder testing.

The record is local and receives a local ID/status/provider marker. It does not
create a Firebase Auth account, a production user, a Stripe customer, or a
cloud collection. Treat submitted values as test data and never include
credentials.

### POST /api/builder/preview

Purpose: return a local preview handoff or emulator note.

The endpoint can identify the active local app/preview relationship. It does not
deploy, publish, open a production release, or prove cloud synchronization.

## Request examples

The following examples use placeholders. Obtain the current direct LAN URL and
session token from the current session only. Do not paste a real token into
documentation or a shared terminal transcript.

Health probe:

~~~bash
curl --fail --silent http://127.0.0.1:<lan-port>/api/health
~~~

Status probe:

~~~bash
curl --fail --silent http://127.0.0.1:<lan-port>/api/status
~~~

Authenticated read:

~~~bash
curl --fail --silent \
  -H 'Accept: application/json' \
  http://127.0.0.1:<lan-port>/api/builder/workspace
~~~

Authenticated source read:

~~~bash
curl --fail --silent \
  -H 'Accept: application/json' \
  -H 'x-systemx-session: <current-session-token>' \
  'http://127.0.0.1:<lan-port>/api/builder/source?path=src%2Findex.css'
~~~

A local test may use the session token when the implementation requires it.
Never store the token in a shell history, CI secret, or source file.

## Write lifecycle and evidence

The normal mutation sequence is:

~~~mermaid
sequenceDiagram
    participant U as LAN UI or approved client
    participant L as LAN server
    participant G as Guard
    participant B as Backup
    participant W as Local write
    participant E as Evidence
    U->>L: Named action and bounded JSON
    L->>G: Host, Origin, token, path, secret, confirmation
    G-->>L: Accept or fail closed
    L->>B: Snapshot before mutation
    L->>W: Atomic local write
    W-->>L: New local state
    L->>E: Sanitized action record
    L-->>U: Result, backup, next gate
~~~

If a write fails after a backup is created, leave the backup and mark the task
blocked or needs-review. If the result is visually wrong, use the evidence,
backup, and Git diff to revert through a reviewed action.

## Path and secret policy

The API is intentionally narrower than a normal local editor.

Rejected categories include:

- environment files;
- service-account JSON;
- private keys;
- token/key/secret/password-shaped values;
- arbitrary command paths;
- runtime state;
- Temp, Backup, and Files directories;
- paths outside the current source allowlist;
- production-only credentials;
- client-supplied executable names.

A rejected request is evidence that the safety boundary worked. Do not turn a
rejected request into a request to widen the endpoint without a new contract,
tests, threat review, and explicit versioned change.

## Browser and Playwright testing map

A local smoke test should verify:

1. the current session URLs are printed;
2. public app URL loads;
3. bridge LAN URL loads;
4. direct LAN health responds;
5. dashboard reports the current dynamic ports;
6. Command, Canvas, Pages, Navigator, Components, Source, Providers, and
   Sync panels open without covering the center beyond the layout rules;
7. Inspect can select a visible element in the same-origin preview;
8. a missing or stale token rejects a mutation;
9. an allowlisted source read works;
10. a disallowed source path fails;
11. exact confirmations are required;
12. source/page/component writes create evidence and backups;
13. runtime folders are not served;
14. public production build has no LAN assets or markers;
15. session stop leaves unrelated processes untouched.

Use the repository test suite for deterministic route/guard coverage. Use
Playwright or browser tooling for visible layout and interaction evidence. Use
the CLI for build, lint, typecheck, docs, security, and deployment gates.

## Future extension rules

A new endpoint must not be added solely because a button needs a shortcut. It
must define:

- purpose and supported environment;
- request and response schema;
- authority and exact confirmation;
- path/provider scope;
- secret handling;
- backup or transaction behavior;
- concurrency behavior;
- audit/evidence record;
- rollback or disable path;
- tests;
- production-build impact;
- capability-manifest state.

Future Designer, CMS, Cloud, MCP, and publish endpoints should call shared
SYSTEMX action logic rather than duplicate behavior in the browser. Planned
features remain behind explicit readiness states until their acceptance tests
and security review pass.

## API definition of done

An API change is ready for the template only when:

- the route is named and documented;
- read and write authority are separate;
- Host, Origin, token, and confirmation rules are tested;
- secrets and arbitrary paths are rejected;
- backups and sanitized evidence are observable;
- dynamic ports work without interfering with another project;
- the public production build remains free of LAN assets;
- browser and CLI behavior agree;
- supported, guarded, and planned claims are synchronized in the capability
  manifest, README, .SYSTEMX docs, and Wiki;
- the current Wiki source is published separately only after local review.

