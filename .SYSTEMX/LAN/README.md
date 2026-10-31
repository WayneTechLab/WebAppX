# .SYSTEMX LAN — Local Builder and Control Surface

`.SYSTEMX/LAN` is the local-only control plane for editing the current
checkout, previewing it through Vite and Firebase Emulator Suite, and checking
that the local project is synchronized with its Firebase and Google Cloud
configuration.

It is not a second public website, an admin route inside the product app, or a
replacement for the Firebase CLI. The LAN surface is a loopback tool that
helps an operator work on this repository safely.

Start the current-template builder session:

```bash
npm run systemx:lan
```

Open:

```text
http://127.0.0.1:7331/
```

When the combined session is running, the same dashboard is also available
through the dev-only Vite bridge at the printed app origin:

```text
http://127.0.0.1:<app-port>/__systemx/
```

To start the public app, LAN service, and Auth, Firestore and Storage emulators
together:

```bash
npm run dev:systemx
```

Without an explicit app origin, `dev:systemx` selects free loopback ports,
starting from app port `5173` and LAN port `7331`. Use the printed URLs or
`npm run systemx:session:status` to find this session. To keep browser saves at
the same app address across launches, select a fixed origin:

```bash
npm run dev:systemx -- --host 127.0.0.1 --port 5185
```

The fixed app port has no fallback. An occupied fixed port fails before any
child starts or runtime state is written; Vite also uses `--strictPort` to
catch a listener race. The [local session contract](#local-sessions) below
explains origin selection and independent readiness reporting.

The G1 builder can inspect controller health, the active Vite app, git state,
routes, provider plans, and important builder files. It also supports guarded
local edits: page metadata, typed local node-tree models, CMS/CRM fixture
records, local user fixtures, and allowlisted source files. Source writes
require a backup, the per-session token, secret-marker checks, and the exact
`SAVE LOCAL CHANGE` confirmation. Cloud writes remain a separate authenticated
and preflight-gated capability.

## Source access and host swarm — locally accepted 2026-10-30

Agent 0 accepted exactly **LAN-00101–LAN-00200** at functional candidate
`e1588c4ebe94b1ef5f1557641334d95aee9b8290`. The program is now
**200/10,000 requirements and 40/2,000 capabilities**; **F001 and F002 are
complete, with 9,800 requirements remaining TODO**. Previous one hundred
completion objects and their order remain exact. The separate original WebAppX
catalog remains **179 done / 821 remaining** and its historical foundation
bundle remains unapplied.

The source browser delivers bounded eligible metadata, canonical exact-case
no-link paths, strict encoding/size decisions, generated-file protection,
metadata filtering/search, read-only policy comparison, optional navigation
preferences and explicit inventory export. Loaded drafts and original bases
survive filtering/refusal; metadata operations do not grant write authority.
Read the [source-browser guide](../../docs/LAN-SOURCE-POLICY.md),
[completed plan](../../docs/LAN-SOURCE-POLICY-PLAN-2026-10-30.md),
[active iteration](../../docs/LAN-ACTIVE-ITERATION.md) and
[candidate-bound QA receipt](../../docs/LAN-SOURCE-POLICY-QA-2026-10-30.md).

The same candidate passed all **70 CI stages**, **114 core unit/API tests**,
**20 F002 browser capability groups**, **55 source regression groups plus seven
geometry checks**, **16 Navigator groups**, and separate Hosting preflight.
CI and preflight each preserved **2,078 tracked input fingerprints**. Actual
Home source-browser filtering, refusal, policy review and metadata export were
read back without new Home source changes. Historical F001 Home edits and their
original proofs remain preserved.

The additive [host swarm](../../docs/SYSTEMX-SWARM.md) has **20 stepwise commands**
and at most **10 isolated CLI slots**, with **32 local synthetic tests**.
Read its [operational map](../../docs/SYSTEMX-SWARM-MAP.md),
[access matrix](../../docs/SYSTEMX-SWARM-ACCESS-MATRIX.md) and
[manifest schema](../swarm/manifest.schema.json). Those tests do not establish authenticated AI-provider
sessions, live GitHub PR merges, permissions changes, native Windows operation,
IDE acceptance or production deployment. Swarm support adds no extra F002
acceptances. Managed SYSTEMX 1.9.0-alpha.6 and reusable seeds remain unchanged.

Source/wiki publication SHAs and fresh remote readback belong to the separate
final delivery handoff. This section records local acceptance rather than a
claim that publication already occurred. Hosting preflight skipped deployment;
app 3.4.0 and deployment count 0 remain unchanged.

## Operating contract

```text
Current repository checkout
        │
        ├── public app source          → root src/ and required root config
        ├── .SYSTEMX/LAN/Builder       → local builder source and contracts
        ├── .SYSTEMX/LAN/Temp          → ignored session/runtime state
        ├── .SYSTEMX/LAN/Backup        → ignored pre-write snapshots
        └── .SYSTEMX/LAN/Files         → ignored operator imports/exports

Vite development app                   → loopback, usually 5173
Firebase Emulator Suite                → loopback, discovered ports
.SYSTEMX LAN control service           → loopback, discovered port
Vite /__systemx bridge                 → dev-only proxy to LAN
Firebase Hosting deploy                → root dist/ only
```

The builder target is `current-repo`. Its primary job is to inspect and edit
this template in place. It must not silently scaffold a separate website,
copy the LAN dashboard into `public/`, import LAN code into the product router,
or add LAN files to `dist/`.

## Local sessions

The canonical app origin for a session is the exact HTTP scheme, hostname and
port printed as **Mock save origin** and recorded in `origin.url`. The summary
also prints the `/portals` directory URL. Browser mock saves belong to that
origin and browser profile: `http://localhost:5185` and
`http://127.0.0.1:5185` use different browser storage, as does another port,
profile or private-browsing context. Retain the printed address to reopen the
same browser saves.

Use `--host 127.0.0.1 --port 5185` to select an explicit origin, or
`--fixed-origin` to pin the defaults at `http://127.0.0.1:5173` when no origin
environment overrides are set. `--host` accepts `127.0.0.1` or `localhost`;
`--port` accepts an integer from `1024` to `65535`. Supplying either option,
`SYSTEMX_DEV_HOST`, or `SYSTEMX_APP_PORT` fixes the app origin.
`SYSTEMX_FIXED_ORIGIN=true` also fixes it. In this mode an unavailable app
port fails without choosing another port or stopping its listener. The LAN,
Auth, Firestore and Storage services bind to `127.0.0.1` and select their
ports separately from the app host.

With no fixed-origin option or environment setting, the supervisor checks
loopback port availability, including IPv4 and IPv6, and selects free ports.
Every Vite child still uses `--strictPort` after selection. The supervisor
plans all five ports before starting children, passes child arguments without
a command shell, and records the selected origin, URLs, process identities
and readiness in ignored `.SYSTEMX/state/local-session.json`. It refuses to
start another session while a recorded process remains alive.

### Readiness and status

The supervisor reports these components independently as `starting`, `ready`
or `failed`, with a URL, message and `checkedAt` timestamp under `readiness`:

| Component | Startup evidence reported by the supervisor |
| --- | --- |
| `app` | The `/portals` HTTP response contains the Vite client marker. This establishes a usable dev app response; it is not a browser workflow check. |
| `lan` | The LAN health endpoint reports `online` and `local-only`. |
| `auth` | The Auth emulator HTTP response reports `authEmulator.ready`. |
| `firestore` | The Firestore emulator returns its expected HTTP health response. |
| `storage` | The Storage loopback TCP listener is reachable. This does not establish Storage workflow readiness. |

Each startup check has a bounded wait. The app can become usable while an
emulator is still starting or has failed. A component failure does not make
the other components ready or failed; an exited child invalidates the
readiness of its own components. These are startup observations with process
exit updates, rather than continuous workflow monitoring.

```bash
npm run systemx:session:status
npm run systemx:session:restart:preview
npm run systemx:session:stop
```

`status` reads the recorded origin, URLs and readiness and adds current process
liveness and repository-ownership observations. Its `recorded` status is not
an aggregate health verdict; inspect the component messages and timestamps.
`offline` with `no-owned-session-record` means no owned record was found.
For a combined session on macOS, `stop` verifies the recorded live processes
and signals the owned supervisor; that owner shuts down its children and clears
runtime state. Unverified ownership refuses the stop and preserves record/files.
A familiar port alone never authorizes stopping a listener.

On Windows, combined-session `stop` exits `1` with `status: "refused"` and reason
`windows-combined-stop-requires-owning-terminal`. This applies even when all
recorded processes appear exited. It sends no signals and preserves session and
runtime configuration files because forced Windows termination cannot establish
descendant cleanup. Press **Ctrl+C in the terminal that owns the session** so
the supervisor can close its children, then inspect child processes and listeners
after shutdown. Inspect any remaining record/state before operator recovery.

A standalone Windows LAN stop can request termination of its single process
after verifying identity and recorded startup directory. It retains the record
until exit is confirmed. Wait for the process to exit, then rerun stop to clear
the verified exited LAN record if forced termination bypassed its cleanup handler.

### Read-only restart preview

The preview command is also available directly:

```bash
node .SYSTEMX/LAN/session-control.mjs restart --preview
```

It reads the recorded session and OS process/listener metadata, verifies
ownership, and describes a proposed launch preserving the recorded app
hostname and all five ports. The JSON includes `action: "restart-preview"`,
`readOnly: true`, process ownership states, replacement listener states, and
`proposedLaunch` when the recorded origin can be reconstructed. Its status is
`ready-for-review` or `refused`; `canRestart` describes only that snapshot.
Listener states distinguish `available`, `release-required`, `blocked` and
`unverified`, so an owned listener awaiting release is visible separately from
an unknown listener. Missing or unverified ownership, foreign listeners or an
unavailable OS snapshot refuse the preview.

Exit `0` means the proposal is reviewable, `1` means refusal, and `2` means an
invalid invocation. `restart` requires `--preview`; no mutating restart action
is implemented. Preview sends no process signals, starts no children, binds no
probe listener, and changes no session record, token or runtime configuration.
Recheck ownership and listener availability immediately before any later
restart operation because an OS snapshot can become stale.

### Demo saves, backups and recovery

Read the [portal state and browser retention contract](../../docs/PORTAL-STATE-CONTRACT.md)
for the complete save, navigation, replacement and recovery behavior, and the
[portal capability vocabulary](../../docs/PORTAL-CAPABILITIES.md) for each
synthetic role's actions and the export boundary. These contracts apply to the
native account-free HR, CMS and CRM demos opened at the session's app origin.
Preview roles do not grant Firebase claims, provider access or production
export permission.

Successful native actions retain complete workspace records in origin-scoped
browser storage. Exports are readable JSON downloads of current accepted
in-memory records, including saved drafts and accepted changes whose browser
save failed. A per-portal export contains the complete portal workspace, and a
combined export contains all three workspaces regardless of the selected
preview identity. Unsaved form inputs, live timers, recovery history and the
separate Gusto SDK mock session are excluded. Use fictional data only.

Imports and selective restore replace complete selected workspaces without a
merge. Combined selective restore and Undo first retain the current selected
records as a recovery point; only selected portal roots remount after success.
Single-portal import and Reset create no automatic recovery point. Reset
preserves existing restore history, so a later Undo can reintroduce reset
records. Clearing restore points removes that history separately from the
current workspace saves. Browser/site-data deletion can remove both, while
downloaded backup files remain separate.

If browser storage is unavailable, accepted records may exist only in the
open page's memory and can still be exported. A combined restore that cannot
save its automatic recovery point is not applied. Browser storage has no
multi-key transaction; if a write and its rollback fail, follow the displayed
export/recovery guidance before refreshing. The canonical state contract
defines the recovery budgets, damaged-save handling and temporary-UI behavior.

## Builder surfaces

The current local builder includes safe, reviewable local surfaces:

- current repository and route/page inventory;
- page, layout, component, and design-token inspection;
- visual preview against the running Vite app;
- content/data model inspection;
- Firebase Emulator Suite status;
- provider health and sync status;
- backup, validation, operation evidence, and local rollback material before a
  write;
- page metadata, node-tree module, local CMS/CRM, and local user fixture edits;
- an allowlisted source editor for the current React/Vite app;
- explicit publish preflight through the existing `.SYSTEMX` deploy command.

The next waves add emulator-backed persistence and provider adapters. The
current UI does not silently write production Firebase, SQL Connect, Google
Drive/GCS, or Stripe data.

The canvas is a projection of the current template. It is not a license to
rewrite arbitrary source files or to manufacture a new product without an
operator-selected target and evidence trail.

## Co-management control plane

The LAN is also the local backend for the backend: it is the planned home for
named TypeScript, lint, test, build, audit, emulator, provider-preflight, and
deploy-evidence actions. It reports humanized `done`, `broken`, `blocked`, and
`needs-review` states, keeps sanitized run logs, and ties Agent 0 missions and
subagent handoffs to start/end-of-day checkpoints.

The control plane may edit backend functions, rules, SQL Connect files, and
provider configuration only after each file class has its own allowlist,
validator, backup, diff, secret scan, exact confirmation, and post-write
quality gate. It will not expose an arbitrary shell endpoint or production
credentials in the browser.

Read the execution contract in
[`CONTROL-PLANE-PLAN.md`](CONTROL-PLANE-PLAN.md).

## Designer layout

The visual builder uses a viewport-locked editor shell: compact top command
bar, left structure rail and panel, center Vite canvas, right inspector panel
and grouped rail, and a bottom application bar with an on-demand Evidence
drawer. The side panels are docked grid tracks, not floating overlays. They
can be hidden independently or resized with mouse, touch, or keyboard; the
selected widths and active tabs persist locally.

The right inspector consolidates its tools into four groups:

- **Design:** Style and Settings;
- **Data:** CMS and Users;
- **Build:** controlled Code and Cloud/provider readiness;
- **Ops:** Agent 0, MCP, and quality/deployment Gates.

When the workspace cannot preserve the minimum canvas width, opening one heavy
panel closes the opposite panel. At phone widths, a panel uses focus mode and
replaces the canvas until the operator returns. The bottom application bar is
a dedicated editor row and never covers the preview.

The application bar centers quick breakpoint icons, the grouped device
selector, exact pixel width, and Fit mode for the actual preview iframe. Its
left side opens Evidence as a drawer; its right side controls Inspect/Interact
mode and shows the selected route, source file, and DOM path. The selector
includes desktop/laptop, Apple iOS/iPadOS, and Android phone/tablet lanes. The
selected device, custom width, inspection mode, and Evidence state persist
only as non-secret local layout preferences.

Through the same-origin Vite bridge, click any rendered element to select it.
Right-click exposes parent selection, mapped source, Navigator, and staging as
a reusable module or component. Header, footer, page menu, help desk, and
accessibility controls carry source metadata; normal page content resolves
through its route model. Turn Inspect off to exercise links and forms normally.
Direct LAN-port use remains read-only for iframe inspection because the app is
on a different origin. Source hints are emitted only in Vite development; the
mandatory post-build isolation scan rejects them from production `dist`.

Selecting a safe leaf-text element opens the Settings text field automatically.
The operator can preview a DOM-only change, revert it, open the mapped source,
or type `SAVE TEXT CHANGE` to persist one unambiguous source occurrence through
the existing backup/secret-scan/atomic-write gate. The live Navigator and
Components panel retain the same selected target and stack location. Nested
elements and ambiguous or unmapped source text fail closed to the controlled
source editor.

See
[`LAN-BUILDER-DESIGNER.md`](LAN-BUILDER-DESIGNER.md) for the panel contract,
workspace map, route rules, and acceptance checks. The supporting 56-record
de-identified public builder review is in
[`LAN-BUILDER-UX-RESEARCH.md`](LAN-BUILDER-UX-RESEARCH.md).

## Live preview Navigator

The Navigator shows a bounded hierarchy of the current same-origin preview
document before a canvas element is selected. Open it with the left rail or
`Z`, expand a branch, and select a row to inspect that element while retaining
Navigator focus. Canvas selection reveals the matching ancestor path in the
tree. The breadcrumb provides selectable ancestors, and **Reveal selection**
clears the current search, expands the selected path, and scrolls the preview
target into view when it has an available rendered box.

**Search live hierarchy** matches tags, IDs, classes, `data-systemx-name`, and
`data-systemx-component` metadata. Both raw names and `#id` or `.class` queries
work. The projection does not collect descendant text, input values,
placeholders, or accessibility labels for search. **Clear search** returns to
the unfiltered tree. Search displays matching elements together with their
ancestors; clear it before manually collapsing those filtered paths.

Within the tree, keyboard focus and selection are separate:

| Key | Tree behavior |
| --- | --- |
| Up / Down | Focus the previous or next visible row. |
| Right | Expand a collapsed branch, or focus its first visible child. |
| Left | Collapse an expanded branch, or focus its parent. |
| Home / End | Focus the first or last visible row. |
| Enter / Space | Select and reveal the focused element without opening Settings. |

These tree keys are scoped to tree rows. Inputs retain their native typing and
arrow behavior, and existing canvas parent/child/sibling shortcuts remain
available outside the tree. A deliberate click on a safe leaf-text element in
the canvas still opens the guarded text editor.

The inspection budgets are explicit:

| Budget | Limit |
| --- | ---: |
| Examined DOM nodes | 1,500 |
| Descendant depth below Body | 40 |
| Search query | 160 characters |
| Search matches included with ancestor paths | First 120 |
| Rendered tree rows | 500 |
| Searchable metadata per attribute | 500 characters |

The status explains when a node, depth, metadata, query, match, or row budget
limits the result. A search with no matches in an incomplete scan is identified
as incomplete. Script, style, head, template, and related executable/document
metadata nodes are excluded. Expand/collapse state is temporary UI state and
survives unrelated mutations in the same preview document; it is reset for a
new document. DOM replacement and route changes invalidate stale selections.
Every selection checks that its target is connected to the current preview
Body before using it. A full iframe reload may clear selection while React
mounts; select the current element again. Reload does not guarantee durable
source identity or automatic selection restoration.

Hidden, inert, and ARIA-hidden attributes are labeled, including inherited
states. These nodes remain inspectable as runtime metadata. Reveal reports
hidden/inert targets or targets without an available rendered box; it does not
remove visibility controls, change app hierarchy, or focus the app element.
CSS-hidden elements can remain present in the tree even when they have no
rendered box. Selecting one does not make it visible.

This hierarchy describes the rendered DOM of one current preview document.
Unloaded routes, unmounted/virtualized source objects, closed shadow roots,
and cross-origin iframe contents are outside that projection. The tree does
not supply stable source IDs, structural source editing, reorder, a command
journal, or a CSS cascade engine. Existing source saves retain their separate
allowlist, session-token, confirmation, backup, secret-scan, and atomic-write
controls.

The [dated Webflow research refresh](WEBFLOW-RESEARCH-2026-10-25.md) explains the
source basis and remaining roadmap. Official Navigator and workspace research
informs hierarchy selection, reveal, and breadcrumbs; Navigator text search is
a proposed LAN usability feature, rather than an established Webflow parity
claim. See the [dated Navigator QA receipt](../../docs/LAN-NAVIGATOR-QA-2026-10-25.md)
for the exact source fingerprints and verification status. Source
implementation, local browser evidence, aggregate checks, and publication
remain distinct acceptance boundaries.

## Directory rules

Committed local-control source belongs under `Builder/` and its contracts.
Runtime state, temporary imports, generated previews, and backups belong under
`Temp/`, `Files/`, and `Backup/` and remain ignored. The product's required
root files (`package.json`, `vite.config.ts`, `firebase.json`, `src/`, and
`dist/`) stay at the repository root because Vite, Firebase, TypeScript, and
their tooling require those standard entry points.

Read the implementation roadmap in
[`BUILDER-SYSTEM-PLAN.md`](./BUILDER-SYSTEM-PLAN.md) before adding a builder
feature.

The builder rails are independently docked. Use the chevron at the top of the
left rail or right rail to hide that panel; the central preview immediately
reclaims the column width. Selecting a tool on a hidden side reopens only that
side. Drag the slim divider beside a panel to resize it, or focus the divider
and press the left/right arrow keys. At narrow desktop widths, panel switching
protects the canvas budget instead of placing a menu over the editor.

Each dock header has a separate visibility control beside its close button. The
default state is **Auto**: a save, refresh, resize, or side switch may close an
unpinned opposite dock when the canvas needs the space. Use **Keep open** to
explicitly confirm **Always shown** for that left or right menu. A pinned menu
will not be auto-closed by `refresh()`, source saves, page-model saves, or
responsive canvas protection. The chevron remains a manual close action; if a
pinned menu is manually closed, SYSTEMX returns that side to Auto so the UI
status is honest. Every layout save reconciles the DOM classes, persisted
collapsed state, and pin status before writing local storage, preventing a
stale save cycle from reopening or collapsing the wrong menu.

The right toolbar chooses the inspector group; the tab row inside the open
inspector chooses the tool in that group. The context row retains `← Canvas`
and a collapse control. Clicking canvas chrome outside the preview, using
`← Canvas`, pressing Escape, or launching Preview collapses the active
inspector. Clicking a preview element retains or opens its Settings context.

The rails are intentionally icon-first at desktop widths so they do not
consume the editor plane. Hover or focus a rail icon for its label and
shortcut. The canvas page selector sits beside the breadcrumb, while the
bottom application bar owns breakpoint/device selection, exact pixel width,
Fit mode, Inspect/Interact, and the Evidence drawer. The current fresh-layout
keyboard map is `A` Add, `P` Pages, `Z` Navigator, `Shift+A` Components,
`J` Assets, `⌘K`/`Ctrl+K` Quick Find, and arrow keys for parent/child/sibling
navigation in the inspected preview.

The layer tree and page-model inspector live in a bottom canvas dock behind
the `Layers` control. The dock starts closed in `#canvas` so the running Vite
preview owns the center plane. Opening `Navigator` or pressing `Layers` shows
the page model tools; opening a right-side inspector closes that dock again.

## Font browser and typography tooling

The Style inspector includes a local **Font browser**. It reads the checked-in
`.SYSTEMX/LAN/Builder/contracts/font-catalog.json` first, so the builder still
works offline. Operators can optionally provide
`SYSTEMX_GOOGLE_FONTS_API_KEY` to the LAN server; the key stays server-side
and is used only to retrieve Google Fonts metadata. It is never sent to the
browser or written to an operation log. Export it before starting the session,
for example: `export SYSTEMX_GOOGLE_FONTS_API_KEY=...` followed by
`npm run dev:systemx`. If it is absent, the checked-in catalog remains active.

Selecting a family loads a precise Google Fonts CSS2 request into the same
origin Vite preview and reports the live `document.fonts` inventory. This is a
preview operation only. To change the project, type `SAVE FONT CHANGE` and use
**Save font to template**. SYSTEMX then updates the controlled
`src/index.css` import and `--wtl-font-family` token with the existing
backup, secret-scan, atomic-write, and operation-evidence policy. The project
keeps a system fallback and the production build remains independent of the
LAN dashboard.

Font project reads expose the exact `src/index.css` byte revision. The Font
browser retains that independent baseline and shows **Refresh font source** for
a deliberate refresh. A confirmed save requires `baseRevision`; stale requests,
including no-ops, are refused before backup/write/log effects. Success returns
predecessor and resulting revisions. Existing raw CSS drafts retain their own
text and loaded revision, so they detect the font edit rather than overwriting
it silently. Valid UTF-8/BOM and uniform LF/CRLF are supported; unsupported byte
encoding or mixed endings fail closed. Browser CSS/font requests remain separate
from the offline metadata catalog.

Google Fonts CSS2 requests are weight-specific and use `display=swap`; the
catalog does not request every available style. That keeps preview and future
production loads deliberate and smaller. See the official [Google Fonts CSS2
API documentation](https://developers.google.com/fonts/docs/css2) and
[Developer API documentation](https://developers.google.com/fonts/docs/developer_api)
for the upstream metadata and CSS request contracts.

## Reusable components and project ingest

Open the **Components** panel to inspect detected source components such as
navigation and footer files. Select a canvas node, choose its source (or keep
the local canvas model), add tags and slots, choose `fluid`, `contained`, or
`fixed` width behavior, and type `SAVE MODULE`. The result is a local
component-registry record that can be exported as
`systemx-component` JSON. It is a contract for the template; it is not a
production CMS publish operation.

The same panel provides **Inventory before install**. A staff member can type
an existing local project path and type `SCAN EXISTING PROJECT`. SYSTEMX scans
only metadata and safe file names for framework, routes, components, styles,
providers, and tooling. Secret files are not opened. The output is a review
manifest in ignored `.SYSTEMX/LAN/Temp/ingest/<run-id>/manifest.json` with
`detected`, `needs-review`, and `blocked` findings. Installing a SYSTEMX
bridge remains a separate, backup-first operation and is not implemented by
the inventory button.

## Unified WebApp authentication and management shell

The public template and LAN share
[`Builder/contracts/auth-provider-registry.json`](Builder/contracts/auth-provider-registry.json).
The local WebApp entry points are:

```text
/login  → Firebase Auth emulator email + password
/admin  → authenticated Level 4/5 management shell
/__systemx/ → local builder, provider readiness, CMS/CRM fixtures, and evidence
```

Start the owned Vite, LAN, Auth, Firestore, and Storage session together:

```bash
npm run dev:systemx
```

`npm run dev:firebase` is an alias for the same session. The supervisor records
the selected origin, ports and independent component readiness in
`.SYSTEMX/state/local-session.json`. Default launches select free loopback
ports; an explicitly fixed app origin fails if its app port is occupied. See
the [local session contract](#local-sessions) for status and read-only restart
preview. `npm run dev:firebase:raw` remains available for an advanced operator
who intentionally wants to run Firebase CLI without the WebApp supervisor.

Only `email-password` is enabled in the local lane. Google, email link/code,
custom token, and OIDC/SAML SSO are displayed as disabled or planned until a
project configures a trusted production adapter. The LAN endpoint
`/api/auth/providers` and the `Providers` panel are read-only status projections;
they never expose secrets or become cloud mutation authority. See the full
contract in [`UNIFIED-AUTH-AND-STACK-CONTRACT.md`](UNIFIED-AUTH-AND-STACK-CONTRACT.md).

## LAN delivery program and source revisions

The [10,000-requirement execution plan](../../docs/LAN-10000-EXECUTION-PLAN.md)
and [family index](../../docs/backlog/LAN-10000-TODO.md) track 2,000 proposed
capabilities across 100 families. Five delivery lanes keep behavior, refusal,
recovery, feedback and proof separate. Only reviewed, receipt-bound progress
checks a requirement; generating the list or querying readiness does not run it.
The original WebAppX catalog, blank seeds and research packages stay separate.

Source GET responses now expose exact file-byte revisions. Confirmed source
POST requests require the loaded `baseRevision`; stale saves return a safe 409
before backups, temporary writes or operation entries. The editor keeps its
draft and old baseline. Use **Reload latest source** to review the current file;
Cancel and failed loads keep the retained draft. Leaf-text editing has its own
loaded snapshot and cannot silently advance a separate dirty raw editor.

Unchanged valid UTF-8 textarea content preserves the loaded text despite browser
newline normalization. Edited uniform CRLF source retains CRLF; edited mixed
endings have no equivalent preservation claim. Hashes describe one allowed
file's bytes, separate from Git cleanliness, provider publication and locking.
See the [API contract](../../wiki/SYSTEMX-LAN-API-Reference.md) and
[dated QA receipt](../../docs/LAN-SOURCE-REVISION-QA-2026-10-26.md).

The [historical conflict-review milestone](../../docs/LAN-CONFLICT-REVIEW-QA-2026-10-26.md) added source comparison, missing-file draft
protection and explicitly reviewed replacement. The [QA receipt](../../docs/LAN-CONFLICT-REVIEW-QA-2026-10-26.md) records
the exact candidate, repairs, acceptance and limits.

**Historical conflict-review total: 75 requirements / 15 capabilities; 9,925
requirements remained TODO at that milestone.** The source-conflict batch adds 15 completions. Functional candidate
`d9bd9e7` passed all 68 CI stages, 21 source-flow browser groups, 16 Navigator
groups, three actual-app read-only observations and separate Hosting preflight.
Production deployment was skipped.

## Explicit emulator import

Start from an existing private Firebase export with
`npm run dev:systemx -- --emulator-import "/path/to/existing-export"`.
Validation runs before allocating ports or starting processes. The selected
export must have contained regular metadata and supported Auth/Firestore/Storage
trees without links or traversal. Keep the export unchanged through startup.
The default start does not import data. Session status emits complete JSON even
through a pipe; readiness reports listener health separately from workflow tests.
Exports and runtime paths belong outside tracked template files.

## Source-bound literal draft preview

Use **Build → Code → Preview draft** after loading and editing an allowlisted
file. The snapshot records its path, loaded raw-byte baseline, displayed draft
UTF-8 digest and fresh source observation. The complete snapshot is capped at 500,000 UTF-16 units; its literal excerpt is
capped at 20,000 units with explicit omission counts and surrogate-safe clipping. It does not execute source or claim compiled canvas equivalence.
**Check source** is a GET-only observation: advanced, unavailable or unknown
source never silently becomes a new loaded editor baseline. Edited drafts and
changed file bindings are identified separately from the captured snapshot.
**Close preview** keeps the editor draft. Snapshot actions create no source,
backup, temporary file, operation entry or replacement-save authority.

See the [font/preview QA receipt](../../docs/LAN-FONT-PREVIEW-QA-2026-10-28.md)
for actual verification and the [active iteration](../../docs/LAN-ACTIVE-ITERATION.md)
for the current selected batch. The Work sources board keeps the separate
original WebAppX catalog and reusable project records distinct from LAN progress.

The historical font/preview milestone was accepted at `781b624bc322c4d851fa3dfc91a165a087dea5d7`:
**85/10,000 requirements and 17/2,000 capabilities**, with 9,915 requirements TODO.
The final checks passed all 68 CI stages, 49 npm tests, 37 isolated browser groups
with four normal-dock geometry checkpoints, 16 actual Navigator groups and
separate Hosting preflight. The [dated receipt](../../docs/LAN-FONT-PREVIEW-QA-2026-10-28.md)
keeps the prior inventory, visual and reload failures separate from final passes.

## Historical F001 recovery and GUI proof — accepted 2026-10-30

LAN-00076–LAN-00090 were accepted at `04813b380cda7656650db752049a8e0661c55bc5`.
At that historical milestone the program reached 100/10,000 requirements and
20/2,000 capabilities, completing F001 with 9,900 requirements then remaining. Explicit browser-local Store/Review/Restore preserves the original
checkout/path/baseline. Comparison downloads require reviewed inclusion scope
and EXPORT COMPARISON. History reads bounded metadata and qualifies legacy and
unattributed observations. No source authority comes from storing, restoring,
exporting or reading history.

The actual Home Code/visual edits, three predecessor backups, account-free portal
entry points, recovered draft and confirmed comparison download were verified.
Read the [GUI workflow](../../docs/LAN-TEMPLATE-GUI-WORKFLOW.md),
[QA receipt](../../docs/LAN-RECOVERY-HISTORY-QA-2026-10-29.md) and
[active iteration](../../docs/LAN-ACTIVE-ITERATION.md). The 55-group source suite uses
the supported Keep open inspector setting and checks seven 336 px states;
Navigator separately passes 16 groups. Full 68-stage CI and Hosting preflight
pass. Production deployment and provider activation remain unperformed.

## Source policy browser

The host Code inspector provides bounded eligible source metadata, canonical
exact-case/no-link paths, strict UTF-8 and size decisions, generated read-only
labels, policy proposal comparison, optional navigation preferences and explicit
metadata-only export. Read the [source-policy guide](../../docs/LAN-SOURCE-POLICY.md)
and [completed F002 plan](../../docs/LAN-SOURCE-POLICY-PLAN-2026-10-30.md).
Agent 0 accepted the exact one hundred F002 requirements at `e1588c4`; the
[candidate-bound QA receipt](../../docs/LAN-SOURCE-POLICY-QA-2026-10-30.md)
records terminal qualification. These host extensions preserve the selected
managed release and reusable work records.
