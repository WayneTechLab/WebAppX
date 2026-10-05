# WSG 20-Phase Canonical Outline

1. Machine and repo sync
2. OS target and downloads path
3. Stack mode selection
4. Edition selection
5. Identity and project goal
6. Operator instructions and constraints
7. Business plan and launch outcome
8. First-phase todo and delivery order
9. Repo learning and pattern extraction
10. Module and page-plan resolution
11. Frontend UI and UX planning
12. Backend and integration planning
13. Data model and environment planning
14. Firebase, GCloud, and provider setup
15. Security, account levels, and MFA
16. Commerce, email, and external services
17. CI, MCP, validation, and automation
18. Build, deploy, and smoke verification
19. Monitoring, runbooks, and handoff
20. Post-launch ownership and next actions

## Builder-track overlay

The local builder is delivered across the canonical phases:

| Builder concern | Canonical phases |
| --- | --- |
| Workspace and port/session discovery | 01-04 |
| Current-template route/page import | 05, 09-10 |
| Node tree, modules, components, tokens | 10-12 |
| Firebase emulator and provider registry | 13-16 |
| SQL Connect/Cloud SQL and Drive/GCloud adapters | 13-16 |
| Security, roles, audit, backup, and diff gates | 15-17 |
| Preview, publish preflight, and rollback evidence | 18-20 |

The builder implementation waves and exit gates are maintained in
[`../../LAN/BUILDER-SYSTEM-PLAN.md`](../../LAN/BUILDER-SYSTEM-PLAN.md). The
canonical 20 phases remain the source of truth for project setup and handoff.

Current checkpoint: Waves 0 and 1 are complete, and Wave 2 is a working
guarded local-edit slice. The LAN console can edit the current template's
allowlisted source files, page metadata, typed local modules, CMS/CRM fixture
records, and local user fixtures. Wave 3+ provider adapters are intentionally
not inferred from the UI: Firestore/Storage/Auth emulators, Firebase SQL
Connect/Cloud SQL, Drive/GCS, and Stripe test workflows each require their own
local or authenticated verification gate.

The Wave 2 builder now also has a reusable-component registry and an
inventory-only existing-project ingest lane. Components can be tagged by role,
slots, and responsive width and exported as a standard `systemx-component`
manifest. Ingest detects a target project's structure and writes only an
ignored review manifest; bridge installation remains a later, explicit gate.

The existing 10-phase setup remains available as a compatibility map under
`phases/` and `steps/`.

## SYSTEMX LAN co-management overlay

The LAN is also the local operations screen for the repository itself. It
connects the visual builder to the `.SYSTEMX` control plane without turning
the browser into an unrestricted terminal.

| Operations concern | Canonical phase | Required evidence |
| --- | --- | --- |
| Repository, branch, port, and tool discovery | 01-02 | Machine packet, session ownership, tool versions |
| Agent 0 mission, wave, start checkpoint | 06-08 | Mission record, assumptions, blockers, owner |
| Frontend/backend source inspection and edit policy | 09-13 | Allowlist, backup, diff, secret scan |
| TypeScript, lint, tests, Vite, and SYSTEMX checks | 17-18 | Run ID, exit code, sanitized output, next action |
| Firebase/GCloud/SQL/Drive/GCS/Stripe readiness | 14-17 | Provider capability, local/live target, auth state |
| End-of-day archive and handoff | 19-20 | JSONL log, summary, unresolved blockers, next mission |
| Deploy preflight and release decision | 18-20 | Branch, commit, project, gates, rollback, operator decision |

The co-management control plane uses these humanized states:
`planned`, `running`, `done`, `broken`, `blocked`, `needs-review`, and
`skipped`. The state is always paired with a plain-language summary so an
operator can understand whether to continue, repair, review, or stop.

### Execution waves

1. **Wave 2.5 — Read-only operations bridge:** typed action registry,
   repository/tool diagnostics, redacted results, and last-deploy read model.
2. **Wave 3 — Quality runner and checkpoints:** typecheck, lint, test, build,
   audit, start/end-of-day, Agent 0 mission, and subagent handoff evidence.
3. **Wave 4 — Controlled backend/source editing:** functions, rules, SQL
   Connect, provider configuration, symbol discovery, backup/diff/restore,
   and post-write checks.
4. **Wave 5 — Provider and emulator operations:** Firebase emulators, SQL
   Connect/local PostgreSQL, GCloud, Drive, GCS, and Stripe test-mode gates.
5. **Wave 6 — Deploy evidence and handoff:** dry runs, rollback evidence,
   explicit confirmation, and the existing `.SYSTEMX` deploy authority.

The LAN must label any incomplete wave as local preview capability. It must
never imply that a provider is connected, a backend edit is safe, or a deploy
is authorized merely because a card is visible in the UI.

Detailed contract:
[`../../LAN/CONTROL-PLANE-PLAN.md`](../../LAN/CONTROL-PLANE-PLAN.md).
