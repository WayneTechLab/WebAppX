# SYSTEMX LAN Co-Management Control Plane

Status: **planned execution contract**

Target: **local-only management of the current SFWA-WTL-G1 checkout**

Authority: **`.SYSTEMX` CLI, manifests, logs, backups, diffs, and explicit operator gates**

## 1. Purpose

The LAN builder is expanding from a visual page editor into a local
co-management screen for the complete codebase. It must help an operator
understand what is happening in the repository, run the approved tools, edit
allowlisted application and backend source, diagnose failures, and see the
evidence needed to decide what happens next.

The LAN is a local control plane, not a hosted administration product:

```text
operator
   │
   ▼
SYSTEMX LAN dashboard ── loopback only
   │
   ├── read-only repository and tool inspection
   ├── allowlisted source and backend editing
   ├── quality and diagnostic actions
   ├── sanitized logs and mission checkpoints
   ├── provider/emulator preflight
   └── deploy evidence and explicit handoff
```

The public template build must not import, copy, route, or deploy this
control plane. The existing `dist/` boundary and production leakage guard
remain non-negotiable.

## 2. Humanized operating states

Every operation must resolve to one of these states:

| State | Meaning | Operator action |
| --- | --- | --- |
| `planned` | Known work that has not started | Start only when its prerequisites are ready |
| `running` | An allowlisted action is executing | Wait, cancel safely, or inspect streamed output |
| `done` | The action passed and produced evidence | Continue to the next gate |
| `broken` | The action ran and failed | Read the failure, repair, then rerun the same gate |
| `blocked` | The action could not safely run | Resolve the named prerequisite or request approval |
| `needs-review` | The action produced a result requiring human judgment | Review the diff, target, provider, or security finding |
| `skipped` | The operator intentionally did not run the action | Record the reason and do not present the lane as green |

The UI should use plain-language summaries alongside the machine state:

```text
DONE       TypeScript check passed in 4.2s.
BROKEN     ESLint found 3 errors in 2 files.
BLOCKED    Deploy is waiting for a clean working tree.
REVIEW     Firebase target differs from the expected project.
```

Colors are not the only state signal. Each result includes text, an icon or
status label, the exit code, the next action, and a link to evidence.

## 3. Control-plane lanes

### 3.1 Repository and source lane

The source lane must show:

- current repository root, branch, commit, and dirty paths;
- source ownership and edit policy for each file;
- frontend, backend, configuration, test, and documentation classifications;
- a source viewer with line numbers and search;
- a controlled editor for allowlisted files;
- an automatic backup and unified diff before every write;
- secret-marker scanning before a write is accepted;
- type-aware validation before a write is marked `done`.

Backend editing is an explicit extension of the existing frontend allowlist.
It must support `functions/`, server modules, Firebase rules, SQL Connect
schema/operation files, and provider configuration only after each class has
an independent path rule and validator. A browser text area must never become
an unrestricted `/shell` or arbitrary file writer.

### 3.2 Tool and quality lane

The control plane should expose named tool actions rather than shell strings:

| Action ID | Default risk | Purpose |
| --- | --- | --- |
| `repo.inspect` | read | Branch, commit, dirty paths, merge/conflict state |
| `tools.inspect` | read | Node, npm, Vite, Firebase, GCloud, Stripe, Playwright versions |
| `quality.typecheck` | read | Run the project TypeScript contract |
| `quality.lint` | read | Run ESLint with the repository configuration |
| `quality.test` | read | Run the configured Node/Vitest/Playwright test lane |
| `quality.build` | read | Build the public application and run leakage checks |
| `systemx.audit` | read | Validate structure, agent files, packet manifests, and drift |
| `systemx.sync` | read | Compare source, generated adapters, plans, and local state |
| `firebase.preflight` | read | Inspect Firebase CLI account, project, emulator, rules, and indexes |
| `gcloud.preflight` | read | Inspect ADC/account/project without printing credentials |
| `stripe.test-preflight` | read | Verify test-mode CLI and configuration presence only |
| `deploy.preflight` | read | Assemble target, branch, build, security, and rollback evidence |
| `deploy.dry-run` | staged | Construct the deployment invocation without publishing |
| `source.write` | mutation | Write a backed-up, allowlisted file after exact confirmation |

Every action is executed with Node `execFile`/argument arrays, `shell: false`,
the repository root as `cwd`, and an explicit environment allowlist. Windows
PowerShell, macOS Bash/Zsh, and Ubuntu/WSL must call the same action registry.

### First API contract

The first implementation should add these narrow loopback routes. The browser
submits an `actionId` and typed parameters; it never submits a command string.

```text
GET  /api/operations
     List recent sanitized runs and current running actions.

POST /api/operations
     Start one allowlisted action: { actionId, parameters }.

GET  /api/operations/:runId
     Read status, summary, exit code, and evidence for one run.

POST /api/operations/:runId/cancel
     Cancel an owned, cancellable local action.

GET  /api/evidence/last-deploy
     Read the last local preflight/dry-run record without secrets.

GET  /api/logs/summary
     Read redacted summaries, not raw environment or credential output.
```

The server must reject unknown action IDs, unknown parameters, duplicate
mutating runs, unsupported platforms, live targets in local-only actions, and
any request that lacks the current session token. The first release supports
read-only actions and dry runs; live cloud mutation is a later owner-gated
capability.

### 3.3 Diagnostic and error lane

The diagnostic view aggregates:

- TypeScript, ESLint, test, build, and dependency results;
- tool-not-found and version-contract failures;
- current Vite/Firebase emulator/LAN port ownership;
- recent source write, backup, and diff records;
- provider configuration presence without secret values;
- the last known deploy or preflight result;
- unresolved blockers and their owners;
- a recommended next action.

It must distinguish a code failure from an unavailable tool, a blocked
credential flow, a provider mismatch, a port conflict, and an operator
decision. These are different repair paths and must not be reduced to
`command failed`.

### 3.4 Evidence and log lane

Each run receives a local run ID and a sanitized JSONL record containing:

```json
{
  "runId": "run-2026-08-04T000000Z-example",
  "operationId": "quality.typecheck",
  "missionId": "mission-local-template-edit",
  "status": "done",
  "startedAt": "2026-08-04T00:00:00.000Z",
  "endedAt": "2026-08-04T00:00:04.200Z",
  "durationMs": 4200,
  "platform": "macos-arm64",
  "shell": "zsh",
  "branch": "main",
  "commit": "local-worktree",
  "exitCode": 0,
  "summary": "TypeScript check passed.",
  "nextAction": "Run lint and tests.",
  "artifacts": [".SYSTEMX/logs/run-...jsonl"]
}
```

Logs must redact token, key, secret, password, private-key, service-account,
and authorization-shaped values. They must never dump the process environment,
`.env` contents, request headers, or raw provider CLI output containing
credentials. Runtime logs stay ignored, capped, and rotated.

### 3.5 Deploy evidence lane

The LAN may assemble and display deploy evidence. It must not silently publish.

The deploy card must show:

- branch and commit;
- working-tree status;
- selected Firebase project and account identity, redacted as appropriate;
- emulator versus live target;
- public build result and leakage scan;
- typecheck, lint, test, audit, and security gate results;
- deployment target and exact generated invocation;
- last deploy/preflight timestamp and result;
- rollback or recovery information;
- explicit reason when deployment is blocked.

Actual production deployment remains in the existing `.SYSTEMX` deploy
command. A browser action can request a preflight or dry run, but a live
publish requires the existing high-friction confirmation, expected target,
green gates, and a human decision.

## 4. Start-of-day and end-of-day behavior

### Start of day

1. Discover the repository and active branch.
2. Verify loopback LAN, Vite, and emulator port ownership.
3. Recover the current SYSTEMX mission, wave, and unfinished blockers.
4. Inspect tools and version contracts.
5. Run the baseline repository, typecheck, and security diagnostics.
6. Present a short humanized briefing: `done`, `broken`, `blocked`, and
   `needs-review`.
7. Require an operator-selected mission before mutation actions are enabled.

### End of day

1. Stop only processes owned by the current SYSTEMX session.
2. Run the selected quality and security gates.
3. Save backups, diffs, operation logs, and the final checkpoint.
4. Record the last deploy/preflight state and unresolved blockers.
5. Archive verbose subagent/tool output into local summaries.
6. Produce a handoff packet with the next action and owner.
7. Leave other local projects, ports, credentials, and cloud resources alone.

## 5. Control levels

| Level | Allowed operations |
| --- | --- |
| Observer | Read status, source, logs, providers, tools, and previous evidence |
| Builder | Run local quality actions, edit allowlisted files, create backups/diffs |
| Operator | Run emulator/provider preflight and deployment dry runs |
| Owner | Approve high-risk writes, live deploy requests, and security-sensitive changes |

The local fixture roles in the builder are not a replacement for production
authentication or authorization. They represent the control-plane workflow
until a separately verified Firebase Auth/custom-claims integration exists.

## 6. Execution waves

### Wave 2.5 — Read-only operations bridge

- Create a typed action registry and operation result schema.
- Add read-only repository, tool, diagnostic, and last-deploy read models.
- Return sanitized stdout/stderr summaries and exit codes.
- Add tests for unsupported actions, unsupported platforms, and redaction.

Exit gate: no arbitrary command endpoint; all read-only actions are named,
logged, and safe to rerun.

### Wave 3 — Quality runner and checkpoints

- Add typecheck, lint, test, build, audit, and SYSTEMX structure actions.
- Add start/end-of-day checkpoints and mission/wave ownership.
- Stream or poll operation progress without exposing a terminal shell.

Exit gate: one local run can produce a complete humanized quality report.

### Wave 4 — Controlled backend/source editing

- Add backend path classes and validators for functions, rules, SQL Connect,
  and provider configuration.
- Add source symbol/function discovery without executing untrusted code.
- Require backup, diff, secret scan, exact confirmation, and post-write checks.

Exit gate: a backend edit can be reviewed, rejected, restored, and verified
without a production connection.

### Wave 5 — Provider and emulator operations

- Add Firebase Auth/Firestore/Storage emulator controls and safe seed/export.
- Add SQL Connect/local PostgreSQL preflight and migration review.
- Add GCloud/Drive/GCS/Stripe test-mode readiness without secret display.

Exit gate: provider status clearly distinguishes local, configured, planned,
blocked, and live targets.

### Wave 6 — Deploy evidence and release handoff

- Add deploy target construction, dry-run, rollback evidence, and last-deploy
  records.
- Wire the existing `.SYSTEMX` deploy command only after all gates pass.
- Add a final publish confirmation and an immutable local handoff packet.

Exit gate: the LAN can explain exactly why a deployment is allowed or blocked,
but cannot bypass the deploy authority.

## 7. Definition of done

The co-management control plane is complete when:

- every action is allowlisted, typed, cross-platform, and logged;
- `done`, `broken`, `blocked`, and `needs-review` states are understandable to
  a non-specialist operator;
- backend and frontend source writes share the same backup/diff/secret scan;
- typecheck, lint, test, build, audit, emulator, and deploy-preflight results
  are visible from one local screen;
- last deploy evidence and rollback information are retained locally;
- start/end-of-day behavior creates reproducible handoff evidence;
- no raw shell, arbitrary executable, environment dump, secret proxy, or
  production bypass exists;
- the LAN files are absent from `dist` and Firebase Hosting output;
- the public template can be deployed without exposing the control plane.

Until these conditions are met, the LAN must label the feature as a local
builder/control-plane preview and not as a production administration system.

## 8. Reusable modules and existing-project ingest

The builder now has two related contracts:

1. **Component registry:** a local, versioned manifest of reusable modules.
   Each record carries a stable ID, source path or local-model reference, role,
   tags, named slots, responsive width behavior, status, and the
   `systemx-component` export format. A selected canvas node can be saved as a
   module without changing React source. Headers, footers, shells, sections,
   CMS blocks, and provider widgets can therefore be standardized before a
   source adapter is approved.
2. **Existing-project ingest:** an inventory-only scan that detects framework,
   routes, page candidates, components, styles, provider files, test tooling,
   and package scripts. The scan produces a manifest under ignored
   `.SYSTEMX/LAN/Temp/ingest/` and never installs SYSTEMX, reads secret
   contents, or overwrites the target project.

The ingest sequence is deliberately two-stage:

```text
local project path
  -> inventory-only scan
  -> detected / mapped / unknown / blocked / needs-review report
  -> operator review and backup
  -> explicit bridge plan
  -> optional SYSTEMX adapter installation
```

The LAN may show a bridge plan after review, but it must not silently copy
control-plane files into `public/`, `dist/`, a production router, or a cloud
project. The registry schema lives at
`Builder/contracts/component-registry.schema.json`; the ingest manifest schema
lives at `Builder/contracts/ingest-manifest.schema.json`.
