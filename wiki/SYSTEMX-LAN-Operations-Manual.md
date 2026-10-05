# SYSTEMX LAN Operations Manual

This page is the detailed staff and builder runbook for the SYSTEMX Local
Control surface in the WebAppX. It explains what the LAN is, how a
session starts, how the WebApp and local Firebase emulators fit together, how
the builder edits the current checkout, what evidence is created, and when an
operator must stop.

The LAN is a local control plane for the repository that is currently open on
the operator's machine. It is not a hosted administration product and it is
not a replacement for the public WebApp. The current Generation 1
implementation is a guarded template-edit vertical slice. It is intentionally
narrower than a finished visual site builder.

## Quick links

- [SYSTEMX LAN Builder](SYSTEMX-LAN-Builder) — architecture, research overlay,
  editor layout, provider model, and LAN Builder Designer roadmap.
- [SYSTEMX LAN API Reference](SYSTEMX-LAN-API-Reference) — local routes,
  session authority, request bodies, confirmations, and error boundaries.
- [Unified Login and Admin Operations](Unified-Login-and-Admin-Operations) —
  public WebApp login, local Auth emulator, claims, and admin-shell parity.
- [SYSTEMX Logs and Evidence](SYSTEMX-Logs-and-Evidence) — JSONL operation
  records, backups, manifests, status files, and review rules.
- [Testing & QA](Testing-and-QA) — repeatable local quality gates.
- [Deployment](Deployment) — production preflight and Firebase deployment.
- [Project Structure](Project-Structure) — root versus SYSTEMX ownership.
- [Update Log](Update-Log) — human-readable public release history.
- [SYSTEMX LAN Builder Designer Master Plan](SYSTEMX-LAN-Builder-Designer-Master-Plan) —
  research-backed future Designer waves and acceptance gates.

## Status and truth rule

The page distinguishes three states:

| State | Meaning | Operator language |
| --- | --- | --- |
| Supported | Implemented and verified in the current checkout. | The LAN can do this locally. |
| Guarded | Implemented behind a token, exact confirmation, backup, allowlist, or review gate. | The LAN can stage this after the gate passes. |
| Planned | Described in the roadmap or UI contract but not implemented as a complete capability. | Do not promise this yet. |

The presence of a rail, card, menu item, manifest entry, or future contract does
not promote a planned feature to supported. The machine-readable
[capability manifest](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/LAN/Builder/contracts/capability-manifest.json)
is the authoritative capability classification for the current checkout.

Current Generation 1 supported or guarded behavior includes:

- local loopback-only LAN hosting;
- session-owned Vite, Firebase Auth, Firestore, and Storage emulator
  processes;
- automatic free-port selection per session;
- public WebApp preview at the selected Vite port;
- local /login email/password authentication with the Auth emulator;
- claim-gated local /admin shell;
- current-template read models;
- local page metadata and node-tree fixtures;
- local CMS/CRM record and user fixtures;
- selected, allowlisted source-file reading and guarded source writes;
- local reusable-component registry entries;
- font catalog, optional Google Fonts metadata, and guarded font changes;
- inventory-only ingest of an existing project;
- sanitized local status, operation evidence, and backup records.

The following are not current Generation 1 production claims:

- a hosted LAN URL;
- arbitrary shell execution from the browser;
- direct cloud writes from a generic builder button;
- a finished LAN Builder Designer document graph;
- structural AST editing of every React component;
- automatic conversion of an arbitrary existing website into a safe editable
  project;
- production user provisioning from the local fixture screen;
- a production deploy without the existing preflight and operator controls.

## The mental model

~~~mermaid
flowchart LR
    Operator["Operator"] --> Session["SYSTEMX session supervisor"]
    Session --> Vite["Vite development server"]
    Session --> Emulators["Firebase Auth, Firestore, Storage emulators"]
    Session --> LAN["SYSTEMX LAN loopback service"]
    Vite --> WebApp["Current WebApp /login /admin"]
    LAN --> Builder["Local builder and read models"]
    LAN --> Sources["Allowlisted source files"]
    LAN --> Fixtures["Local pages, CMS, CRM, user fixtures"]
    LAN --> Evidence["Logs, backups, manifests, status"]
    Emulators --> LocalAuth["Disposable local identity"]
    Builder --> Preview["Same-origin Vite preview"]
    Preview --> Operator
~~~

The working rule is:

1. The WebApp is the thing being edited and previewed.
2. The LAN is the operator surface that reads the repository and stages
   controlled changes.
3. The session supervisor owns only the processes it started.
4. Firebase emulators provide local-only Auth, Firestore, and Storage lanes.
5. Cloud providers are described and prepared locally, but generic Generation 1
   LAN controls do not silently mutate production.
6. Every meaningful mutation leaves a reviewable trail or stops before writing.

## What belongs where

| Surface | Purpose | Local or public | Typical authority |
| --- | --- | --- | --- |
| Public WebApp at the selected Vite URL | Render the current React application. | Local during development; production after deploy. | React routes and Firebase client configuration. |
| Public WebApp /login | Exercise the local authentication boundary. | Local in a SYSTEMX session. | Firebase Auth emulator and local provider registry. |
| Public WebApp /admin | Show the Level 4/5 management shell and backend status. | Local in a SYSTEMX session. | Local claim state plus read-only status models. |
| LAN through the Vite bridge | Use the builder with same-origin preview inspection. | Loopback only; Vite development only. | LAN session token and allowlisted actions. |
| LAN direct service | Operate the LAN without depending on the Vite bridge. | Loopback only. | LAN session token and Host/Origin checks. |
| Firebase emulators | Run local Auth, Firestore, and Storage behavior. | Local only. | Session supervisor and emulator configuration. |
| Firebase/GCloud/Stripe project | Real external services. | Outside the local safety boundary. | Explicit authenticated CLI or future approved adapter. |
| dist/ | Production WebApp artifact. | Deployable. | Vite production build and Firebase Hosting. |
| .SYSTEMX/LAN | LAN source, contracts, builder code, and local-only server. | Tracked source; never a public build input. | Repository controls and production isolation checks. |

The LAN source can be committed in the template while the LAN runtime remains
local. A source directory being present in Git does not make it a public URL.
The production boundary is the build graph: the normal Vite production build
uses the public application input and the production leakage guard rejects LAN
markers or files in dist/.

## Local topology and dynamic ports

Never assume a familiar port belongs to this project. The session supervisor
checks loopback availability and selects a safe free port for each owned child.
A preferred port is only a starting point.

The active session has this topology:

~~~text
public Vite app       http://127.0.0.1:<app-port>/
LAN bridge            http://127.0.0.1:<app-port>/__systemx/
LAN direct service    http://127.0.0.1:<lan-port>/
Firebase Auth         http://127.0.0.1:<auth-port>/
Firestore emulator    http://127.0.0.1:<firestore-port>/
Storage emulator      http://127.0.0.1:<storage-port>/
~~~

The Vite bridge and direct LAN URL may show the same dashboard, but they serve
different operational purposes:

- Use the bridge when selecting elements inside the running WebApp. The
  browser needs a same-origin path so the LAN can inspect the Vite preview.
- Use the direct LAN service for an independent control surface, diagnostics,
  or when Vite is being restarted.
- Use the URLs printed by the current session. Do not copy a URL from a
  different project, an older browser tab, or a previous session.

The session record is ignored local state. It records the current session ID,
owned process IDs, selected ports, URLs, and ownership data. It is not a
credential and it must not be committed.

### Port ownership rules

The supervisor:

1. checks the requested port on both loopback families where supported;
2. selects the next safe port when the preferred port is occupied;
3. passes the selected values to every child through environment variables;
4. writes the selected Firebase emulator configuration for this session;
5. records process ownership in the local session record;
6. reports URLs only after children are started;
7. stops only children that belong to this repository's active session.

The stop command must not kill another project's process merely because it is
using the same preferred port. A port collision is a routing problem, not
permission to terminate unrelated work.

### Start commands

From the repository root:

~~~bash
npm run dev:systemx
~~~

The owned session starts Vite, the LAN service, and the Firebase Auth,
Firestore, and Storage emulators. An alias is available for the Firebase
development lane:

~~~bash
npm run dev:firebase
~~~

To inspect an existing session without starting another:

~~~bash
npm run systemx:session:status
~~~

To stop only the repository-owned session:

~~~bash
npm run systemx:session:stop
~~~

The raw Firebase emulator lane is separate:

~~~bash
npm run dev:firebase:raw
~~~

Use the raw lane only when you deliberately do not need the WebApp/LAN
supervisor. It does not provide the same session ownership or URL handoff.

### Start-of-day session checklist

Run this sequence in order:

1. Confirm the terminal is in the intended repository.
2. Check the branch and working tree before editing.
3. Read the last local status or handoff note.
4. Start npm run dev:systemx.
5. Record the printed app, bridge, direct LAN, and emulator URLs.
6. Run npm run systemx:session:status.
7. Open the public app URL and confirm the URL shows the active port.
8. Open the bridge LAN URL and confirm the session banner reports the same
   session ID.
9. Open /login and use a disposable local email/password identity.
10. Open /admin only after local login/claim state is appropriate.
11. In LAN, check Command, Canvas, Sync, and Evidence before editing.
12. Confirm the repository, branch, active ports, and working-tree state.
13. Choose one bounded task and one evidence target.
14. Edit only after the preflight is understood.

The LAN dashboard is useful only when the operator knows which checkout and
session it is controlling. A page that loads is not proof that it is the
correct project.

### End-of-day session checklist

1. Finish or explicitly hand off the current task.
2. Save or revert pending local builder changes.
3. Review the Evidence drawer and operation log.
4. Review backups and note any change that still needs human approval.
5. Run the relevant quality gate or record why it was deferred.
6. Check the repository diff and identify generated/runtime files.
7. Stop the session with npm run systemx:session:stop.
8. Confirm the owned processes are gone.
9. Confirm no unrelated local project was stopped.
10. Leave a concise handoff in the appropriate .SYSTEMX/status or task record.
11. Close stale browser tabs that point to an old session port.
12. Do not describe a cloud deploy as complete unless a real deploy result and
    rollback reference exist.

## Session lifecycle

~~~mermaid
sequenceDiagram
    participant O as Operator
    participant S as Session supervisor
    participant P as Port checker
    participant F as Firebase emulators
    participant L as LAN service
    participant V as Vite
    participant B as Browser
    O->>S: start the owned development session
    S->>P: Check app, LAN, Auth, Firestore, Storage ports
    P-->>S: Safe free ports
    S->>F: Start with session Firebase config
    S->>L: Start loopback LAN with session token
    S->>V: Start Vite with bridge and dynamic env
    L-->>B: Print direct LAN URL
    V-->>B: Print app and bridge URLs
    B->>L: Read health/status and builder data
    B->>L: Send guarded mutation with session token
    L-->>B: Backup, result, evidence, next gate
    O->>S: Stop the owned development session
    S->>L: Stop owned child
    S->>V: Stop owned child
    S->>F: Stop owned child
~~~

A healthy session has all of the following:

- the app port answers the Vite health probe;
- the bridge path renders the LAN dashboard;
- the direct LAN service answers the LAN health endpoint;
- emulator processes belong to the current session;
- the LAN session token is present in the dashboard meta tag;
- status reports the same session ID and selected ports;
- unrelated processes remain untouched.

If one of these conditions fails, stop and use the troubleshooting section. Do
not repair a port problem by killing all Node processes.

## LAN interface anatomy

The dashboard is a compact editor/control plane, not a second public website.
The layout is designed to preserve the center preview while keeping controls
reachable.

### Top command bar

The top bar contains:

- product/session identity;
- Design, CMS, Insights, and SYSTEMX work modes;
- the command input or quick-find path;
- the workspace menu toggle;
- current session and health indicators;
- a compact hamburger menu for global workspace actions.

Use the command input for navigation and known actions. It is not a terminal.
It must not accept arbitrary shell text.

### Left structure rail and dock

The left side is the structure side of the builder. It contains icon-first
navigation for:

- Command;
- Canvas;
- Pages;
- Navigator;
- Components;
- Assets;
- Content;
- Providers;
- Sync.

The selected left tool opens one left panel at a time. The rail remains visible
when the panel is collapsed. The panel width is local UI state and does not
change the WebApp source.

### Center preview plane

The center is the live Vite preview of the current WebApp. It is the only
place where the operator should judge page appearance and normal interaction.
The preview is not a screenshot and does not imply a production deploy.

The bottom application bar controls:

- device preset;
- explicit preview width in pixels;
- Fit mode;
- Inspect versus Interact mode;
- Evidence drawer;
- Vite endpoint status.

When the width changes, the preview plane flexes within the available space.
The side panels must reduce the available center width rather than covering the
preview. At narrow widths, the selected panel can replace the canvas, but it
must not remain as an unreadable overlay.

### Right tool rail and inspector

The right side is the property and operations side. Its inspector groups are:

| Group | Tabs |
| --- | --- |
| Design | Style, Settings |
| Data | Content, Users |
| Build | Source, Providers |
| Ops | Agent 0, MCP, Sync |

Open one context at a time. Clicking canvas chrome outside the preview returns
to the canvas context and collapses a transient inspector. Selecting an element
inside the preview keeps or opens the relevant Settings context. A pinned
inspector is an explicit operator preference and may remain open.

### Bottom application bar and Evidence

The bottom bar is for viewport and evidence controls, not a permanent log wall.
Device and pixel controls stay centered so they do not become attached to the
preview content. Evidence is a button that opens a drawer only when needed.

Evidence should be reviewed at:

- the start of a task;
- after every guarded write;
- before a source or module is staged;
- before a quality gate;
- at end of day.

### Auto and Always shown

Each side has a close control and a visibility policy:

- Auto lets SYSTEMX close an unpinned side when the opposite side opens, the
  canvas needs width, a save refreshes the model, or a narrow viewport requires
  a full-panel view.
- Always shown is an explicit Keep open choice. It is useful during a repeated
  style or source review.
- A manual close clears the pin. The UI does not report Always shown while the
  dock is manually collapsed.
- A save-loop reconciliation checks the actual classes, collapsed flags, and
  pin flags before storing layout state.
- Opening a heavy inspector closes the bottom Layers dock so nested menus do not
  overtake the editor plane.
- Clicking the canvas plane closes transient side menus unless the operator
  explicitly chose Always shown.

The layout preference is local browser state. It is not a project design token
and it is not part of the public build.

## Start a bounded builder task

Every task should have one intent, one lane, and one evidence target.

Use this task frame:

~~~text
Intent:
Current page or source target:
Expected local outcome:
Allowed files:
Confirmation required:
Verification command:
Evidence to retain:
Stop condition:
~~~

Example:

~~~text
Intent: change the home page heading
Current page or source target: /
Expected local outcome: heading text changes in Vite preview
Allowed files: allowlisted page or source target only
Confirmation required: SAVE LOCAL CHANGE
Verification command: npm test && npm run build
Evidence to retain: source backup, diff, operation record, browser result
Stop condition: secret scan, path rejection, or preview mismatch
~~~

Do not combine a visual edit, cloud provider setup, auth policy change, and
production deploy in one unbounded task.

## Command surface

The Command view is a routing and status surface:

- open a named tool;
- see current session and repository state;
- see the current builder mode;
- review the next recommended gate;
- open the appropriate panel.

A command should resolve to a known action or navigation target. If a command
would need arbitrary shell input, use the approved terminal and the SYSTEMX CLI
instead. The browser should never become a generic command execution endpoint.

Useful repository commands include:

~~~bash
npm run wtl:menu
npm run wtl:setup -- --check
npm run system:audit
npm run sync:system:check
npm run diagnostics
npm test
npm run docs:links
~~~

Use the LAN for local read models and guarded builder actions; use the CLI for
the full SYSTEMX menu, setup packets, quality sequence, deployment preflight,
and governance operations.

## Pages view

Pages is the page-model lane for the current checkout.

### What Pages can do now

- list known routes and page metadata;
- create a local page-model entry with a validated route;
- update title, description, and SEO metadata;
- add typed node-tree fixture data;
- remove a non-root node from local page-model data;
- show the current page source mapping where known;
- record a backup before page-model mutation.

### What Pages does not claim

Creating a page-model entry does not automatically create a React route,
component file, Firebase Hosting rewrite, SEO production artifact, or
deployable page. The page model is local management data until a future
source-round-trip adapter is implemented and verified.

### Page workflow

1. Select Pages.
2. Choose the target route.
3. Review existing metadata and node tree.
4. Make one local operation.
5. Review the proposed result.
6. Confirm the operation only if it is the intended local change.
7. Inspect the backup and operation record.
8. Open Source if a real React file must be changed.
9. Run the appropriate tests.
10. Do not deploy until the route exists in the public source and build.

Routes are normalized to lower-case slash paths. New page-model routes cannot
be arbitrary wildcard routes.

## Navigator and canvas selection

Navigator is the structured view of the preview/page tree. Use it when a visual
click is difficult or when nested elements overlap.

In Inspect mode:

1. Hover a rendered element to see its boundary.
2. Click to select it.
3. Review the route, source file, DOM path, and element summary.
4. Use the breadcrumb or Up key to select the parent.
5. Use arrow keys to move through the selected hierarchy.
6. Right-click to choose Select, Parent, Module, Component, Source, Navigator,
   or Close.
7. Turn Inspect off before testing a link, menu, form, or normal app behavior.

The selected element is a review target. It is not automatically a source write
target.

## Source view and text editing

Source is intentionally allowlisted. Current editable paths are:

- src/pages/<file>.tsx;
- src/components/layout/<file>.tsx;
- src/components/navigation/<file>.tsx;
- src/components/shell/<file>.tsx;
- src/config/siteControls.ts;
- src/index.css;
- src/router.tsx.

The server rejects paths outside this set. This is a safety boundary, not an
inconvenience to work around.

The safe text flow is:

1. Select text in the same-origin Vite preview.
2. Confirm the mapped source path.
3. Open Source and review the exact original text.
4. Enter the replacement text.
5. Use the UI confirmation SAVE TEXT CHANGE.
6. The LAN sends the server confirmation SAVE LOCAL CHANGE.
7. The server requires the original text to occur exactly once.
8. The server checks non-empty content, size, path, and secret markers.
9. The current file is backed up.
10. The new source is written through a temporary file and atomic rename.
11. The operation record includes the path, line counts, backup, and next gate.
12. Refresh Vite and review the visual result.
13. Revert from the backup or normal Git diff if the result is wrong.

The source editor is not an unrestricted IDE. Large structural refactors,
dependency changes, rules changes, secrets, and arbitrary generated files
belong in the repository and CLI workflow.

## Components and modules

The Components view stages reusable local registry metadata inspired by the
reference builder. It is designed for patterns such as a header, footer,
navigation block, card, or repeated section.

A component record should identify:

- human-readable name;
- source file or mapped location;
- tags;
- slots or expected content regions;
- width/placement contract;
- current status;
- review notes.

The current registry does not rewrite every instance into a new component or
perform a full visual component extraction. Use it as a controlled registry
and handoff artifact. The exact UI confirmation is SAVE MODULE; the server
does not accept a generic component mutation without that confirmation.

Before saving a module:

1. Verify the selected element is the intended boundary.
2. Check whether the source is already a shared component.
3. Confirm props, slots, responsive width, and data dependencies.
4. Review whether the element contains user-specific data or secrets.
5. Save the registry metadata.
6. Review the export and operation evidence.
7. Add source refactoring as a separate bounded task if needed.

## Style, font, and settings

Style is the design-token and typography context. Settings is the selected
element or page context.

The Font browser has three lanes:

1. checked-in offline catalog;
2. optional Google Fonts metadata query when the LAN process has
   SYSTEMX_GOOGLE_FONTS_API_KEY;
3. local Vite preview inventory from document.fonts.

The key is never returned to the browser or written to an operation log. Font
preview does not write the project. A project font change requires
SAVE FONT CHANGE, creates a backup, updates the controlled CSS import and font
token, and records evidence.

When editing style, distinguish:

- preview-only browser state;
- local project token or source change;
- future site-wide design-system change;
- production asset or external font licensing responsibility.

The LAN does not grant a font license. The project owner must verify licensing,
privacy, performance, accessibility, and offline fallback requirements.

## Content, CMS, CRM, and users

The Content and Users views are local fixtures and management read models for
the current template. They demonstrate how a future CMS/CRM adapter can be
connected to the same front-end and LAN contract without making local UI
actions equal to production account operations.

Current local behavior:

- records are stored in local builder data;
- user fixtures receive local IDs and status/provider markers;
- provider state is shown separately;
- no production Firebase Auth user is created by the fixture action;
- no real Stripe or cloud record is mutated by a generic button.

Use disposable values. Never place passwords, API keys, service-account JSON,
private keys, or payment secrets in local fixture forms.

## Providers and storage lanes

The provider panel separates capability from connection. A capability card means
the stack knows what the provider could support; it does not prove that the
current project is authenticated or synchronized.

| Provider lane | Typical role | Current Generation 1 behavior |
| --- | --- | --- |
| Firestore | Document data, local CMS/CRM fixtures, app state. | Local emulator/read model supported; production adapter remains explicit. |
| Firebase Realtime Database | Realtime JSON state. | Capability documented; no generic production write. |
| Firebase SQL Connect / Cloud SQL for PostgreSQL | Relational data and SQL-backed application models. | Capability documented for a future adapter; not a claim that every Firebase project has SQL enabled. |
| Cloud Storage for Firebase | User/media objects and uploads. | Local Storage emulator lane supported; production writes require explicit provider setup. |
| Google Drive or Shared Drive | Team documents and controlled reference files. | Capability documented; credentials and scopes are not enabled by generic LAN UI. |
| Google Cloud Storage | Build artifacts, exports, backups, and larger objects. | Capability documented; use approved GCloud CLI or adapter and least privilege. |
| Stripe or another payment provider | Commerce, billing, and webhook state. | Provider readiness can be shown; no live mutation from the generic builder. |

Firebase has multiple storage patterns. Do not call every one Firebase SQL:
Firestore and Realtime Database are non-relational products, while Firebase SQL
Connect is a separate relational integration that uses Cloud SQL. The correct
choice depends on query shape, transactions, ownership, latency, cost, retention,
and regulatory requirements.

A provider task must record:

- provider and environment;
- project or account identifier without secrets;
- intended capability;
- required scopes or roles;
- local emulator or staging target;
- verification command;
- rollback or disable path;
- owner and next action.

## Ingest an existing project

The LAN can inventory an existing project for planning. The current operation is
SCAN EXISTING PROJECT and is deliberately inventory-only.

The ingest flow:

1. Choose the existing project root.
2. Confirm it is a directory.
3. Review the scope and read-only behavior.
4. Run the scan.
5. Review pages, likely components, tooling, and findings.
6. Review the secret safety result.
7. Save or export the manifest for human review.
8. Decide which parts can be adopted into this template.
9. Create a separate implementation task for any migration.
10. Never assume the scan installed SYSTEMX, changed routes, or made a live
    site editable.

The manifest reports needs-review, blocked, or ready. A ready inventory still
requires an architecture decision, source diff, tests, and operator approval
before integration.

## Authentication and admin parity

The public WebApp and LAN should tell the same truth about the local stack.

Local Generation 1 policy:

- local email/password is the enabled Auth emulator provider;
- use a disposable local account;
- Google, email-link/code, custom token, and OIDC/SAML are readiness states,
  not local enabled providers;
- /admin requires the configured Level 4/5 claim boundary;
- a browser login does not elevate its own claims;
- provider readiness does not mean a production account is authenticated;
- a production identity provider must be configured and tested separately.

The admin screen is a front-end status and management shell. LAN actions still
require the LAN session token and server-side policy. A visible admin card is
not authorization.

## Evidence, backups, and logs

A task is not finished when a button says success. It is finished when the
operator can explain what changed and show evidence.

Review these evidence classes:

| Evidence | What it proves |
| --- | --- |
| Health/status response | The current session and process topology at a point in time. |
| Session record | Which child processes and ports belong to this checkout. |
| Source backup | The pre-write contents for a guarded source change. |
| Git diff | The current repository change, including changes outside LAN. |
| Operation JSONL | Action, time, session, result, and redacted details. |
| Page/component manifest | The local builder model after a guarded model change. |
| Ingest manifest | Inventory findings from an existing project, not adoption. |
| Quality output | The named gate and its exit result. |
| Browser smoke result | The visible page and interaction behavior at the active URL. |
| Deploy result | A real Firebase operation, target, project, and rollback reference. |

Runtime paths are local and ignored. The exact current locations can be
confirmed through SYSTEMX-LAN-Builder, SYSTEMX-Logs-and-Evidence, and the status
response. Never commit local session tokens, emulator data, logs with sensitive
values, or generated backups.

Every guarded write should follow:

~~~text
read -> validate -> backup -> diffable write -> record -> preview -> verify
~~~

If any stage fails, the write should stop or be reverted. Do not manually
delete a backup to make a status card green.

## Security boundaries

The LAN server is intentionally restricted:

- binds to 127.0.0.1;
- checks the Host and Origin against the active session;
- uses a random per-session token for mutations;
- does not expose a generic shell or /exec endpoint;
- uses fixed server-side action routes;
- never accepts a client-provided executable;
- restricts source writes to an allowlist;
- scans proposed content for secret-shaped values;
- avoids returning environment files or credentials;
- serves only the dashboard and approved Website assets;
- does not expose Temp, Backup, Files, server source, or arbitrary SYSTEMX
  paths;
- sets no-store, noindex, nosniff, no-referrer, CSP, and related headers;
- keeps the dashboard outside the production Vite build;
- uses a production leakage guard against LAN files and markers.

The local token is a session capability, not a substitute for authentication,
authorization, or network security. Do not paste it into tickets, commit it, or
treat a loopback dashboard as safe on a compromised workstation.

Stop immediately if:

- the LAN is reachable on a non-loopback interface;
- an unknown Host or Origin is accepted;
- a mutation works without the session token;
- a source path outside the allowlist is accepted;
- a secret marker is written or returned;
- a runtime directory is served;
- a public build contains LAN markers;
- a provider card claims a live write that was not observed;
- a process stop would affect another project;
- the browser URL does not match the current session record.

## Agent 0, subagents, and tool routing

Agent 0 owns the mission, lane assignment, checkpoint quality, and final
handoff. Subagents may inspect or propose work in isolated lanes, but they do
not receive unlimited authority from the LAN.

A safe LAN task mesh is:

~~~mermaid
flowchart TD
    Mission["Agent 0 mission"] --> Intake["Scope and constraints"]
    Intake --> Wave["Wave with one bounded outcome"]
    Wave --> LaneA["Read-only repository lane"]
    Wave --> LaneB["UI or source proposal lane"]
    Wave --> LaneC["Quality and browser evidence lane"]
    LaneA --> Checkpoint["Checkpoint: files, evidence, blocker"]
    LaneB --> Checkpoint
    LaneC --> Checkpoint
    Checkpoint --> Review["Agent 0 review"]
    Review -->|accepted| Next["Next wave or handoff"]
    Review -->|blocked| Stop["Stop and escalate"]
~~~

Each lane should state:

- mission and wave;
- allowed paths;
- read versus write authority;
- tool, SDK, or MCP used;
- expected evidence;
- token or runtime budget;
- blocker and next action.

Use the lowest-cost tool that can answer the question:

1. local file or read model;
2. SYSTEMX CLI or check;
3. LAN read endpoint;
4. browser or Playwright smoke test;
5. official provider CLI in a local or staging target;
6. explicit production operation.

Do not ask a subagent to make everything work without a file boundary,
acceptance test, and stop condition. Archive completed lane details into the
appropriate log or handoff so the next agent does not reread the whole session.

## Quality and release sequence

Use this order for a local template change:

1. Confirm the session and repository.
2. Review the source diff.
3. Run focused tests for the changed lane.
4. Run typecheck and lint as applicable.
5. Run npm test for LAN characterization.
6. Run npm run docs:links when documentation changed.
7. Run npm run build.
8. Run the public-build isolation check.
9. Use Playwright or browser tools against the current dynamic URL.
10. Review Evidence and status.
11. Run deployment preflight only after local gates are green.
12. Deploy only with the intended project, account, target, and rollback plan.
13. Record the actual result in the update or handoff path.

A build passing is not a browser smoke test. A browser smoke test is not a
Firebase deployment. Keep those claims separate.

## Troubleshooting

### The old URL refuses the connection

The session may have moved to a safe port or stopped. Run:

~~~bash
npm run systemx:session:status
~~~

Use the URL printed by the current session. Close old tabs. Do not force the
project back onto a port owned by another project.

### The LAN loads but the preview is blank

Use the direct LAN URL for control and the bridge URL for preview inspection.
Confirm Vite is listening in the status view. Check the browser console and the
Vite terminal output. Do not add a public route for the LAN to fix a
development bridge problem.

### A mutation returns unauthorized

The dashboard may be from an old session or a stale browser tab. Reload the
current bridge URL so the page receives the active session token. If the token
is still missing, restart the owned session. Never disable the token check.

### A source save is rejected

Check:

- the path is in the allowlist;
- the original text occurs exactly once;
- replacement content is non-empty and within size limits;
- no secret-shaped marker was included;
- the exact confirmation is present;
- the current session token is used.

If the change is larger than a bounded text replacement, use a normal source
branch or commit workflow instead of weakening the LAN guard.

### A side menu covers the editor

Use the side close chevron, set the side to Auto, close the opposite heavy
dock, or reduce the device width. If the menu reopens after save, reload the
current session and verify the layout state migration. Do not treat the
browser's cached layout as a project defect.

### Firebase appears offline

Confirm the Auth, Firestore, and Storage emulator ports in the current session
record. The UI must use those dynamic values rather than hard-coded ports. If
the emulator child is not owned by this session, restart npm run dev:systemx.

### The public build contains a LAN marker

Stop before deploy. Remove any import or copy from .SYSTEMX/LAN, run the
production leakage guard, inspect the Vite inputs, and verify dist/ again. The
correct fix is build-graph isolation, not a hidden route.

### Ingest reports secrets or unexpected files

Stop the ingest task. Keep the manifest local, do not paste sensitive output
into an agent prompt, rotate anything that may have been exposed, and review
the source project manually. Inventory is not permission to import.

## Handoff record

At end of day or when a lane stops, leave this compact record:

~~~text
SYSTEMX LAN HANDOFF
Session:
Repository / branch:
Task / wave / lane:
Current URL set:
Files read:
Files changed:
Backups:
Tests and exit codes:
Browser evidence:
Provider/auth state:
Blocker:
Risk:
Next action:
Owner:
~~~

The record should point to evidence without copying secrets or the full session
token. If no evidence exists, the task is not complete; mark it blocked or
needs-review.

## Definition of done for a LAN task

A local builder task is complete only when:

- the task was bounded;
- the correct repository and session were confirmed;
- the change stayed within its allowed files;
- the proper confirmation was used;
- backup and diff evidence exist for a mutation;
- no secrets entered the source, log, or prompt;
- the public build boundary remains intact;
- focused tests and required quality gates pass;
- the visible result was reviewed at the current dynamic URL;
- the handoff names the result, evidence, and next action.

A task can be useful without being complete. Use blocked, needs-review, or
planned honestly rather than converting uncertainty into a green status.

