# LAN graph/API synchronization QA — 2026-11-08

The saved F005/F006 implementation is qualified for experimental source and
wiki publication. This checkpoint does not accept the next 200 requirements.
**LAN-00401–LAN-00600 remain TODO**; accepted progress remains **400/10,000
requirements and 80/2,000 capabilities**. The previous completion ledger is
byte-identical. The separate original WebAppX catalog remains **179 done / 821
remaining**, and the historical foundation bundle remains unapplied.

The CI and Hosting preflight candidate is **`cd276dda34dd72dae71b19c86ae4e21ec7d4bbaa`**.
Later delivery-note changes contain documentation only. The separate source
browser candidate is **`d6906ac31add3a209bedff649d7785e689e19286`**; its only difference from the
CI candidate is the reviewed root README fingerprint in starter parity, with no
runtime implementation change.

## Terminal verification

| Gate | Observed result |
| --- | --- |
| Aggregate CI | `npm run ci:all`: all **75 required stages** passed, terminal exit 0, 914.504 seconds. |
| Graph/API unit and integration | **147 tests** passed in aggregate CI, covering graph invariants, recovery, migration, both contract versions, real service/HTTP composition and UI state. |
| Graph/API browser | **40/40 capability groups**, followed by the actual dashboard journey, passed in owned synthetic fixtures; zero page errors or unexpected requests. |
| Dashboard journey | Import/accept, findings, qualified lookup, wrong-kind refusal, comparison, download/reopen, isolated migration then acceptance, older 1.0 execution, future-version refusal and delayed-response draft retention passed. The preview stayed **700px** wide. |
| Existing source regression | **55 source-flow groups plus seven geometry checks** passed; source, seeds and implementation inputs were preserved, with zero page errors or unexpected requests. |
| Other retained browser suites | HR/CMS/CRM, keyboard, lifecycle, payroll, restore/recovery, SDK, work-status, source policy, identity and responsive LAN layout passed inside aggregate CI. |
| Hosting preflight | `npm run deploy -- hosting --preflight`: terminal exit 0, 20.979 seconds; commit, push and deployment skipped. |
| Candidate preservation | CI and preflight each preserved **2,144 tracked input fingerprints**. The original **957 protected fingerprints** remain exact. |
| Template and host | Template parity/seeds/research/versions and `sync:system:check` passed inside CI. Managed releases and reusable records were not edited. |

API 1.0 executes nine operations and 1.1 executes sixteen. Their current schema
revisions remain `2a14a768e5853266be44694dba89d30d2733a300a5a5e54c38f0df53c7c9fef8`
and `8723894206a80b10ce4f1a1432189efd6753d6eb1c1f8aba52363399d6cbcaa0`.
Graph actions manage memory-only metadata, not template source writes. History
is bounded and exports must be retained before service restart.

## Repairs and retained attempts

The paused final CI attempt failed at the child-process review gate. The Git
helper now constructs an explicit argument array. The owned Node fixture spawn
has one exact, reviewed baseline occurrence; the scanner still rejects changed
or additional constructions. Its focused regression suite passed 15 tests.
The next aggregate attempt caught the README fingerprint change in starter
parity. Only that reviewed root fingerprint was updated; starter bytes remain
unchanged. The subsequent complete 75-stage run passed.

The earlier source-browser run exited 1 when its owned browser was stopped
at the user's pause. The saved process identities and timing support that
external-interruption diagnosis; its original failure receipt remains intact.
A development rerun completed the flow but overlapped documentation edits and
is not counted as a stable-input pass. The later clean run passed completely.
Original graph-browser failures and their repairs also remain in local evidence.
None of these earlier outcomes were relabeled as successful runs.

## Evidence and remaining work

The private operator handoff retains full logs, input hashes, screenshots,
traces, manifests, original worker branches and all earlier receipts. Portable
log digests for this checkpoint are:

- CI: `9cd3e95df525bdccf640c91f2a640449d35fcc411c0238ae3cf8a301c929a3fb`.
- Hosting preflight: `2fa6407a9888e66efc10b677c6d7e329cc66119937c5666fa4abf578bc7e0011`.
- Source browser: `d37aa42686717dc17f9c1cc7d0d3f7e8de366a706573b0f00ada39c06dfae8b5`.
- Graph browser result: `4703bcef2277d1a0407aabc65661564ef176f5ccefe2e3bc9c6a993a959ec235`.

GitHub main/wiki synchronization is separate from original requirement
acceptance. Remaining work includes explicit F005 then F006 acceptance against
their original definitions, full WebAppX Pages reconciliation and an observed
operator-session graph workflow after a separately controlled restart with
emulator data preserved. The existing operator session was not restarted for
this synchronization. No production deployment, native editor, Windows/mobile
qualification, provider activation or app AI adoption is established here.

Read the [execution plan](LAN-GRAPH-API-PLAN-2026-10-31.md),
[graph guide](LAN-CANONICAL-GRAPH.md),
[versioned API guide](LAN-VERSIONED-API-CONTRACTS.md) and
[active iteration](LAN-ACTIVE-ITERATION.md).
