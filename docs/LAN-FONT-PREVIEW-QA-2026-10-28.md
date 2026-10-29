# LAN font revisions and draft preview QA — 2026-10-28

Status: **implementation and verification in progress; no new acceptance yet**.
Baseline: `42886165e315f8d7b6c89c754d2b81221a9c7972`.
The accepted program baseline is 75/10,000 requirements and 15/2,000 capabilities.
LAN-00051–LAN-00060 remain TODO until Agent 0 reviews terminal evidence from an
exact functional candidate and binds each definition to that source revision.

See the [active iteration](LAN-ACTIVE-ITERATION.md),
[generated program plan](LAN-10000-EXECUTION-PLAN.md) and
[F001 checklist](backlog/lan-10000/F001.md).

## Selected scope

- Font source reads expose the raw-byte revision of the fixed `src/index.css`
  target. Confirmed writes require that observed baseline, including no-op
  attempts; success reports both predecessor and resulting revision. Stale or
  unavailable targets must produce no source, backup, operation or temporary
  effects. An open raw CSS draft keeps its own older baseline.
- A bounded literal source-draft snapshot records the loaded path and raw source
  revision, exact displayed draft digest, observed current revision and freshness.
  Snapshot and freshness actions read source only; they do not execute code,
  compile JSX, promote preview content or create write authority. Edits, target
  switches, errors and late replies must remain explicit without losing drafts.

## Verification to record

The evidence will distinguish focused API checks, disposable browser workflows,
actual local read-only observations, full CI, Hosting preflight, metadata checks
and provider publication. No planned run is recorded as passing. Earlier failed
attempts will retain their actual result and subsequent repair separately.

## Preserved boundaries

Only disposable synthetic fixtures may receive test source writes or simulated
external changes. Real app source, reusable project records, managed release
snapshots, both research packages, user browser state and unrelated listeners
remain preserved. Runtime paths, tokens, emulator data and private trace files
stay outside Git. App version 3.4.0, managed SYSTEMX 1.9.0-alpha.6 and deployment
count 0 remain unchanged. Production deployment is not authorized here.

The original WebAppX catalog remains 179 done / 821 remaining; the historical
foundation bundle stays unapplied and unaccepted.
