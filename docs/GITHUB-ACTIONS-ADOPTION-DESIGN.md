# Optional GitHub Actions pull request workflow design — v2

Status: **artifact design reviewed; runtime unadopted**. Prepared 2026-10-15. Agent 0 reviewed the proposed policy choices after independent source/artifact review. Actual identities, resource selections, approvals and runtime observations remain unselected. This is an optional adoption artifact, not an executed procedure or authorization.

Historical drafting basis: `42818dd7baf3d335f27c401c37d048bd842617fa`, supplied by Agent 0. The original preparation read then-current primary files without resolving Git revisions or running gates. The source tables retain those historical bytes; they do not bind the later CRM integration tree. Original draft/TODO wording describes preparation history; consult the [canonical catalog](backlog/webappx-1000-todo.json) for actual status. Final source re-review after CRM freezes is pending. See the [adoption index](ADOPTION-CONTRACTS.md) and [source-review record](evidence/adoption-contract-source-review.json).

**Version 2 amendment:** the original five delivery drafts remain preserved; the original Actions draft SHA-256 is `23b97526696bd03f78f8e9cf89b243ffd777f6c25453093992913ad3d8fb23b7`. This version adds explicit `edited` events, base-retarget handling and literal cases after independent review. It changes no existing workflow, source or required gate.

## Original criterion

- ID: `WX-0802`; title: **Create an optional GitHub Actions adoption workflow design**.
- Priority `P1`; phase `production-readiness`; gate `operator`.
- Dependencies: none.
- Canonical source: `scripts/check-template.sh`.
- Original acceptance, unchanged: “For optional operator-approved adoption: A reviewed plan runs the existing required gates on pull requests with explicit permissions and no production deployment credentials.”


## Design decision and trust boundary

Propose one required check named `webappx-required-gates` for **every pull request** to the adopter's selected integration branch; no path filters may skip it. Execute the existing `npm run ci:all` entry point without selective stage removal. A pull request contains untrusted code, including dependency lifecycle scripts and tests. Run it in an isolated disposable environment with no production/provider credentials, private records, internal network access or reused private caches.

Use the ordinary `pull_request` event, not `pull_request_target`, for this validation design. GitHub documents that privileged target-trigger workflows must not check out and execute untrusted PR code with secrets or a privileged token. Explicit token permissions and immutable action pins are required design choices, supported by GitHub's [workflow permission reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions), [secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) and [target-event security guide](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target). These links were examined on 2026-10-15; repository/account policy and runner availability were not observed.

Proposed explicit workflow/job permissions are `contents: read`; all unspecified token permissions are `none` under GitHub's documented permission semantics. Do not add `id-token: write`, deployment/repository write permissions, production environment access, provider secrets or secret inheritance. Artifact upload, if adopted, must use reviewed capabilities without broadening repository permissions; otherwise retain bounded logs through the platform's reviewed default job logging. No credential is needed merely because a test runs.

## Concrete execution contract

This is a workflow **design**, not a newly installed workflow or an executed job. No fabricated action SHA, runner label or account settings are supplied. An adopter must bind the proposed slots below before installing the workflow; unresolved slots block activation rather than silently selecting a tag or broad runner.

| Slot / step | Proposed exact behavior |
| --- | --- |
| Event and source | Explicit `pull_request` activity types `[opened, synchronize, reopened, edited]` against the selected current base branch; no path filter. Every matching `edited` event runs all gates, including retargets and title/body edits. Also add `merge_group` if the adopter uses a merge queue, following separate review. Capture workflow revision, base ref/SHA, PR head and tested merge SHA; never describe the head as tested when a merge tree was tested. |
| Runner | Disposable `reviewed-macos-arm64` **design profile**, not a GitHub label. Resolve actual available image/architecture and budget before adoption. Require Bash, locked Node/npm, Python and browser/OS dependencies; record exact versions. No shared personal or production runner. Windows x64/ARM64 acceptance remains separate. |
| Runtime and install | Current root/starter pins are Node `24.22.0`, npm `11.11.0`. Use reviewed setup action pinned to its reviewed full commit SHA, then the existing lockfile installation procedure. Optional Functions package has Node 22 requirements that must be met by an isolated reviewed install/runtime step rather than pretending root Node pin covers it. |
| Checkout | Reviewed immutable checkout-action SHA; do not persist credentials into Git configuration. Checkout the intended PR merge tree with no private submodules or credentials; capture SHA before and after gates. |
| Verify configuration | Compare current package/CI plan against the reviewed 68-stage contract below. A PR may propose a gate change, but it cannot make that change trusted by editing its own baseline. Require independent code review of workflow, manifest, gate runner and reviewed metadata changes. |
| Required gates | Run `npm run ci:all` once, preserving the literal existing order and terminal exit. No `--if-present` wrapper around the CI entry point, selective filters, success-on-error or unconditional green final step. Nested stage behavior remains the actual manifest behavior. |
| Artifacts and outcome | Capture stage terminal statuses, full terminal log digest, exact runtime/source manifest and browser reports/owned-process cleanup proof. Failure, timeout, missing report or unavailable prerequisite yields a failing/incomplete check, never a pass. Reports from PR code are untrusted evidence for review, not commands or authorization. |
| Release gate outside PR | `npm run deploy -- hosting --preflight` remains a separate required pre-publication/pre-deployment observation under AGENTS and maintenance instructions. A PR success does not approve publishing, deployment, providers or real employee data. |

Proposed bounds: one active job per repository/PR number, with the base/head/merge binding recorded for each run; a new matching event queues a fresh run and may cancel an older run, which is recorded as cancelled, not passed. Concurrency control must not deduplicate a retarget merely because the head SHA is unchanged. Hard job timeout 120 minutes, dependency-install substep 20 minutes and evidence bundle 250 MiB maximum, seven-day retention. These are proposal limits requiring resource review; if the complete required run cannot fit, mark unavailable and deliberately revise the limit rather than omitting gates or logs. Retain failed diagnostics with explicit omission/overflow labels. Do not upload browser storage, real exports, credentials, private records or host-specific paths.

### Edited events and base retargets

GitHub lists `edited` among supported `pull_request` activity types, outside the default opened/synchronize/reopened set; branch filters select the PR's base branch and the tested PR SHA represents its merge result. The design therefore explicitly subscribes to `edited`, captures the current base/head/merge binding anew, and requires another run when that binding changes. See the official [pull request event reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request) and [base-branch filter reference](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#using-filters-to-target-specific-branches-for-pull-request-events), rechecked 2026-10-15.

**Chosen policy:** do not inspect title/body text to decide whether an `edited` event matters. Run the complete 68 gates on every edited event whose current base matches the selected integration branch. This covers a still-open PR retargeted into that branch, or a changed base ref/SHA, even when its head commit and changed-file set are identical. No head-SHA-only cache, event deduplication or prior green result may replace the new merge-tree run. Title/body-only edits also rerun; no metadata-only optimization is proposed.

A PR retargeted away from the selected integration branch is outside that branch's workflow selection; its earlier receipt remains a historical observation for its old base/head/merge binding and cannot establish readiness for a different base. A later retarget back triggers fresh validation. Immediately before merge, the required-check decision must match the current tested base/head/merge binding under the adopter's separately reviewed branch/merge-queue settings. If the platform cannot supply the required merge-tree run, including an unresolved merge conflict or required run approval, mark validation unavailable/incomplete; never reuse a stale head-only pass. This draft does not configure those account settings or guarantee event delivery.

## Required current gate set — source transcription, no execution claim

`ci:all` delegates to `bash scripts/check-template.sh`; the runner currently iterates these 68 npm scripts in order. The proposed workflow must execute that entry point. This list is a review baseline, not a second implementation of CI.

| Order | Existing npm gate |
| --- | --- |
| 1 | `development:check` |
| 2 | `development:test` |
| 3 | `scripts:check` |
| 4 | `docs:commands:check` |
| 5 | `fixtures:check` |
| 6 | `source:shell:check` |
| 7 | `setup:contracts:test` |
| 8 | `environment:check` |
| 9 | `environment:test` |
| 10 | `repository:identity:test` |
| 11 | `dev:mock:test` |
| 12 | `systemx:session:test` |
| 13 | `ci:plan:test` |
| 14 | `backlog:plan:check` |
| 15 | `backlog:plan:test` |
| 16 | `backlog:evidence:check` |
| 17 | `backlog:evidence:test` |
| 18 | `backlog:impact:test` |
| 19 | `docs:freshness:test` |
| 20 | `systemx:work-status:test` |
| 21 | `doctor` |
| 22 | `doctor:test` |
| 23 | `browser:smoke:test` |
| 24 | `browser:keyboard:test` |
| 25 | `backlog:check` |
| 26 | `backlog:test` |
| 27 | `template:check` |
| 28 | `systemx:status` |
| 29 | `systemx:validate` |
| 30 | `sync:system:check` |
| 31 | `research:validate` |
| 32 | `systemx:tools:test` |
| 33 | `systemx:integration:test` |
| 34 | `security:controls:test` |
| 35 | `ci:lint` |
| 36 | `ci:typecheck` |
| 37 | `ci:test` |
| 38 | `hr:test` |
| 39 | `hr:roles:check` |
| 40 | `hr:roles:test` |
| 41 | `gusto:capabilities:check` |
| 42 | `gusto:capabilities:test` |
| 43 | `portals:test` |
| 44 | `maturity:test` |
| 45 | `safety:test` |
| 46 | `adoption:hr-disabled:test` |
| 47 | `adoption:hr-disabled` |
| 48 | `browser:smoke` |
| 49 | `browser:keyboard` |
| 50 | `browser:foundation` |
| 51 | `browser:state-contract` |
| 52 | `browser:lifecycles` |
| 53 | `browser:portal-lifecycle` |
| 54 | `browser:recruiting` |
| 55 | `browser:payroll` |
| 56 | `browser:evaluators` |
| 57 | `browser:maturity` |
| 58 | `browser:safety` |
| 59 | `browser:quality` |
| 60 | `browser:sdk-quality` |
| 61 | `browser:recovery-drill` |
| 62 | `browser:work-status` |
| 63 | `hr:backend:audit` |
| 64 | `docs:links` |
| 65 | `ci:security` |
| 66 | `ci:ai` |
| 67 | `ci:audit` |
| 68 | `build` |


The source gate list contains `repository:identity:test`, not a fresh direct-remote `repository:identity` observation. It contains `docs:freshness:test`, not current guide acceptance. Root `security:rules:test` is not one of these 68 stages. Network-dependent audits require reviewed public network access; no provider credentials are implied. A network outage is an unavailable result, not an audit pass. Build does not replace the earlier typecheck stage.

## Actual adoption record — not selected

| Required field | Current value |
| --- | --- |
| Repository / integration branch / required-check policy | unselected / unselected / unobserved |
| Workflow reviewer / installing operator | unassigned / unassigned |
| Approved workflow source digest / action SHAs | unobserved / unselected |
| Actual runner image, architecture and account entitlement | unselected / unverified |
| Runtime/browser/Python prerequisites and clean isolation evidence | unobserved |
| Repository/org event, fork approval and token policies | unobserved |
| PR / tested head and merge revisions / run URL / terminal status | unselected / unobserved / unobserved / unobserved |
| Gate/report completeness and permission/secret absence review | unobserved |
| Production/provider credentials | prohibited; none selected |

## Literal fictional cases — not runs

**Worked design case `pr-fiction-01`:** PR `example-pr-17` has head `fiction-head-A` and merge tree `fiction-merge-M`. A hypothetical disposable reviewed runner obtains only a read token and public dependencies. All 68 exact gates would need terminal success plus complete reports before `webappx-required-gates` could pass for M. A later merge tree N requires another run. These labels are fictional and are not valid commit/run identifiers.

**Denied cases:** a fork PR requests a provider key for tests: deny. A target-trigger job executes PR scripts with write token access: deny. A PR edits the runner to omit `browser:recruiting`, then updates its own expected stage count: independent review required; no trusted green conclusion. Stage 65 cannot reach the public audit service: failed/unavailable, not skipped success. A job exceeds 120 minutes with only 61 observed stage completions: incomplete and failing. A 300 MiB diagnostics bundle overflows the proposed cap: preserve available local evidence, record omission, fail completeness; do not silently discard the failure report. A hosted ARM64 runner is unavailable to the account: activation blocked, no imaginary substitute or architecture pass.

### Additional literal v2 cases — not workflow observations

| Case | Literal fictional event/binding | Required design outcome |
| --- | --- | --- |
| `pr-fiction-retarget-into` | PR `example-pr-17` stays open with head `fiction-head-A`; its base changes from `fiction-feature` to selected integration branch `fiction-main`. Current base SHA is `fiction-base-B`; merge result changes from `fiction-merge-M` to `fiction-merge-N`. | Explicit `edited` handling selects the new base and runs all 68 gates for B/A/N. An earlier M result cannot pass N, even with the same head A. Missing new run is incomplete. |
| `pr-fiction-retarget-back` | The same PR leaves `fiction-main`, then is edited back to it with merge result `fiction-merge-P`. | The old receipt remains historical; the return into the selected branch triggers a fresh full run for P. No reuse of M or N. |
| `pr-fiction-title-only` | `edited` changes only a fictional title; current base/head/merge binding is unchanged. | Run all 68 gates again under the chosen simple policy; do not parse untrusted title/body text into shell or silently deduplicate the event. |
| `pr-fiction-retarget-race` | A run for merge M is still running when edited base binding N arrives, with unchanged head A. | Queue a fresh N run; per-PR concurrency may cancel M, recorded as cancelled. N cannot be suppressed by a head-only concurrency/cache key or inherit M's success. |

## Acceptance mapping and root decisions

This plan runs existing required gates on PRs, fixes the proposed permission set and isolates all deployment/provider credentials. Agent 0 reviewed the proposed event, check name, runner profile and limits as artifact design choices. Actual workflow creation, immutable action selection, repository settings/runner entitlement and first PR execution remain separate adoption work. This task created no `.github` workflow, account setting, job or deployment.

## Historical examined source and provenance

Repository-relative paths and SHA-256 of examined bytes:

| Public source | SHA-256 |
| --- | --- |
| `scripts/check-template.sh` | `059480f0a672973732e21d53b44176692ce94054213a7062df07c3136c8e8e9c` |
| `package.json` | `9dfe138a4cc64035e703cd7219d67a9bd95a346fc7c0e5cd4f21295bef61475d` |
| `scripts/ci-plan.mjs` | `c1e0933c2e07f782d023335f8a1786e0d9a0516aeea5876696c95a23b5b84051` |
| `.nvmrc` | `a1c56e968c358e10872d64220b3ae759ffe7feaffc4da95fae425dbcca43fe44` |
| `.node-version` | `a1c56e968c358e10872d64220b3ae759ffe7feaffc4da95fae425dbcca43fe44` |
| `docs/DEPENDENCY-INSTALLATION.md` | `5e24cb3c07e429aadf7653b70eac52d6dd3879e2e52549496dcee9bd5bec392f` |
| `docs/TEMPLATE-MAINTENANCE.md` | `d11316e53524deb4cdaac69a08be09b3c73872e5556dcea891c248eda93fb85d` |

These are historical supplied-basis source observations only. They do not establish current deployed settings, cloud access, a successful CI run, account availability or operator acceptance. Re-review a changed source or target before adoption.
