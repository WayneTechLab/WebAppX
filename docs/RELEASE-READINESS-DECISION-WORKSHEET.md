# Release readiness decision worksheet

Status: **artifact design reviewed; runtime unadopted**. Prepared 2026-10-15. Agent 0 reviewed the proposed policy choices after independent source/artifact review. Actual identities, resource selections, approvals and runtime observations remain unselected. This is an optional adoption artifact, not an executed procedure or authorization.

Historical drafting basis: `42818dd7baf3d335f27c401c37d048bd842617fa`, supplied by Agent 0. The original preparation read then-current primary files without resolving Git revisions or running gates. The source tables retain those historical bytes; they do not bind the later CRM integration tree. Original draft/TODO wording describes preparation history; consult the [canonical catalog](backlog/webappx-1000-todo.json) for actual status. Final source re-review after CRM freezes is pending. See the [adoption index](ADOPTION-CONTRACTS.md) and [source-review record](evidence/adoption-contract-source-review.json).

## Original criterion

- ID: `WX-0850`; title: **Create a release readiness decision worksheet**.
- Priority `P1`; phase `production-readiness`; gate `operator`.
- Dependencies: `WX-0835`.
- Canonical source: `docs/TEMPLATE-MAINTENANCE.md`.
- Original acceptance, unchanged: “For optional operator-approved adoption: The worksheet records required local gates, optional provider evidence, unresolved blockers and operator deployment approval as distinct decisions.”


## Dependency and intended use

The original dependency `WX-0835` is canonically done: the repository identity tool can produce a bounded read-only origin/branch/direct-remote/worktree receipt before an already authorized publication. That historical acceptance is **not a fresh receipt for this candidate**. The tool's direct query can contact the selected public remote; no such query or Git operation was run during this drafting task.

Use this worksheet for one exact candidate source and artifact. It separates local readiness, optional adoption/provider evidence, source publication and operator deployment approval. The maintainer can complete local-artifact review without claiming any deployment. The original drafting assignment supplied historical source context `42818dd`; this worksheet does not turn that short context or an in-progress CI report into a verified full revision or pass.

## Proposed decision rules

- `blocked`: any required local result is missing/failed/incomplete, source or target binding drifts, a blocking finding remains, or a mandatory adopted-feature acceptance is absent.
- `local-ready`: every required local gate is complete for the exact candidate; review records its limitations. This does not authorize source publication or deployment and does not imply provider/platform/manual acceptance.
- `approved-for-exact-source-publication`: separate existing maintainer authorization binds repository, source revision and intended source/wiki operations after the identity receipt. It does not authorize Hosting.
- `approved-for-exact-deployment`: an authorized operator separately approves one artifact/action/target and states accepted residual risks and expiry. No inference from checkmarks or a local-ready result.
- `deployed-observation-pending`: an authorized mutation was attempted but complete independent observation is not yet available; uncertainty is not success. `deployment-observed` requires the actual result/version/readback and preserves the preceding approval.

Proposed bounds: one candidate, 68 current CI stage entries, at most 30 additional evidence references, 20 blockers and 20 adopted feature decisions. Refuse a complete-readiness conclusion on truncation/overflow; deliberately extend the packet instead of hiding entries. An approval expires after 24 hours or on any source, artifact, target, credential capability, finding or relevant provider-condition change. Never edit historical receipts to fit a later source.

## 1. Candidate and current actual status

| Field | Current entry |
| --- | --- |
| Worksheet owner / independent release reviewer / deploying operator | unassigned / unassigned / unassigned |
| Intended release scope and changes | draft only; no release selected by this worksheet |
| Exact full source revision / clean-state observation / repository identity receipt | unobserved / unobserved / unobserved |
| Package/version source / artifact digest / runtime and configuration manifest | source examined only; actual candidate artifacts unobserved |
| Intended source repository/wiki target | unselected |
| Intended Hosting project/site/channel/environment or other mutation target | unselected |
| Observation dates/log references and authorized custody | unobserved / unselected |
| Decision | blocked: actual release packet is unfilled |
| Source publication / deployment approval | not authorized / not authorized |

Do not paste origin URLs with credentials, absolute host paths, env values, browser storage, private exports or service account material. Store sensitive operational evidence in restricted adopter records; portable summaries contain only safe identifiers, digests, outcome labels and observation times.

## 2. Required local gate ledger

Record **actual** command, exact source/input manifest, start/end, terminal exit, complete log digest, reviewer and limitations for each row. `unobserved` is the current value for every execution row below.

| Required local evidence | Existing command / exact scope | Current execution result |
| --- | --- | --- |
| Locked installation/runtime | Reviewed `npm ci` procedure and package/lock/runtime pins; optional Functions dependency context separately recorded. Installation is preparation, not a test pass. | unobserved |
| Complete CI | `npm run ci:all` delegates to `bash scripts/check-template.sh`; all 68 current stages in unchanged order, no skipped/unknown stages and complete required reports. The full list is transcribed in [the PR workflow design](GITHUB-ACTIONS-ADOPTION-DESIGN.md). | unobserved |
| Managed host drift | `npm run sync:system:check`; CI currently includes this at stage 30. Reuse the exact complete CI evidence only when the source/input scope is identical. | unobserved |
| Template integrity | `npm run template:check`; CI currently includes this at stage 27; also required before copying the reusable template. | unobserved |
| Hosting preflight | `npm run deploy -- hosting --preflight`; a distinct required pre-publication gate, not one of the 68 CI stages and not a deployment. Capture its generated artifact/input scope. | unobserved |
| Publication identity | `npm run repository:identity` immediately before the already authorized source publication; bind exact expected repository and capture direct remote separately from cached refs and tracked/staged/untracked state. Tests of this command are not this observation. | unobserved |
| Evidence completeness | All owned browser/server shutdown, failed diagnostics retained, input manifest equality, exact stage/report totals, independent audit and no unresolved verification gaps. Checks/groups are not necessarily unique assertions. | unobserved |

A CI network/audit failure or missing required browser prerequisite stays failed/unavailable. Local macOS output cannot be labeled Windows x64/ARM64 or manual assistive-technology evidence. Source-only documentation review does not refresh a historical browser receipt. Re-run affected gates when inputs change; a harness-only change still requires its scoped verification and accurate source/runtime labels.

### Current manifest review boundary

Root/starter runtime pins are Node `24.22.0`, npm `11.11.0`; the optional Functions context declares Node 22. The CI plan is a reviewed source classification rather than a run. Its 68-stage source includes unit/source/browser/audit/build gates, but does **not** include the root emulator `security:rules:test`, an actual direct-remote identity observation or production/provider acceptance. Attach per-stage results from the actual run rather than assuming every feature has the same proof.

## 3. Optional adoption/provider evidence ledger

Each enabled feature gets its own decision. Use `not adopted` only with an explicit configuration/scope reason and reviewer; it does not mean `passed`. Actual provider fields remain unselected.

| Optional scope | Required decision/evidence if adopted | Current entry |
| --- | --- | --- |
| Beyond-loopback private preview | Fictional data, secret review, indexing choice, real visitor access controls, exact target and exposure approval. Use [the preview checklist](PRIVATE-PREVIEW-PUBLICATION-CHECKLIST.md). | not selected; no exposure approved |
| GitHub Actions | Reviewed workflow permissions, actual runner resources, immutable actions, isolated PR execution and exact required-gate run. | not selected; no account/job observed |
| Cloud deploy identities | Distinct preview/production subjects and actual minimal effective grants, credential custody and negative-boundary evidence. | not selected; no grant/credential provisioning |
| Firestore/Storage rules | Applicable emulator policy results, complete merged rules, actual project review and separate deployment approval/readback. Use [the rules checklist](FIREBASE-RULES-DRY-RUN-CHECKLIST.md). | not selected; no emulator/cloud result |
| Gusto/provider/business actions | Exact adopted capability, credentials/scopes, provider environment and workflow-specific acceptance; payroll/money actions need their own explicit authority. Native fictional workflows do not satisfy this. | not selected; no provider acceptance |
| Other live integrations | Name service, exact feature/target, data/secret/access scope, provider prerequisites and evidence. Unknown integrations block claims about them. | unselected |
| Windows x64/ARM64 / manual AT | Actual native platform or named human observation when claimed, with unavailable cells retained. A runner plan or source check is not runtime acceptance. | unobserved; no such acceptance claimed |

## 4. Unresolved blocker ledger

| ID | Actual finding | Severity / affected scope | Assigned resolver / evidence | Disposition |
| --- | --- | --- | --- | --- |
| `actual-packet-missing` | Source, artifacts, runtime receipts, target and approvals have not been selected/observed in this draft. | blocks any actual release/deployment conclusion | unassigned / none | open |

For a real packet include each finding's observed time, exact source/target, reproduction or evidence reference, proposed resolution and independent recheck. A risk acknowledgement cannot override failed mandatory evidence or create missing authority. Keep resolved entries and their original observation; append the resolution rather than deleting the failure. Stop after 20 rows and explicitly mark incomplete if more remain.

## 5. Four independent signoffs

| Decision | Required exact fields | Actual status |
| --- | --- | --- |
| Local verification review | Reviewer, date, source/artifact/input digests, complete required receipts, limitations, all blockers disposed or expressly nonblocking within scope. | unassigned / unobserved |
| Optional feature acceptance | One owner/provider/manual decision per adopted feature, evidence scope and reason for any nonadoption. | unassigned / unobserved |
| Source/wiki publication authorization and parity | Authorized actor, source/wiki target, exact intended revision/change, fresh identity receipt; after publication independently observed direct remote revisions and parity. | not authorized / unobserved |
| Operator deployment approval | Approver, literal time, expiry, exact artifact/action/project/resource/environment, credential capability, accepted residual risks, stop/recovery owner; then separate actual outcome/readback. | not authorized / unobserved |

No checkbox, draft reviewer signature, catalog completion, source push or CI success acts as production deployment authorization. No hosting version or deploy count is changed by this worksheet.

## Literal fictional decisions — not observations

**Worked local-only case `release-fiction-01`:** candidate `fiction-source-A` / artifact `fiction-artifact-A` has hypothetical complete 68-stage receipts plus drift/template/preflight observations and zero blockers. Native fictional modules are the only enabled features; provider integrations are explicitly not adopted. The hypothetical outcome is `local-ready`; deployment approval stays `not authorized`, Windows/manual cells remain unobserved, and source/wiki parity is unobserved until an authorized actual publication is observed.

**Worked target-specific case `release-fiction-02`:** following separate real-world review (not supplied here), an operator could approve only artifact A, action `hosting-only`, resource `fiction-production-resource-A` with 24-hour expiry. That fictional record cannot approve artifact B, rules, Functions, provider payroll or a different project. A mutation timeout would move to `deployed-observation-pending`, not success or retry.

**Denied cases:** 67 of 68 stages have reports: blocked. A prior dated browser receipt is cited for a changed runtime without re-execution: blocked for the affected claim. All local gates pass but the target is a placeholder: no deployment approval. Preview and production use one broad identity: adopted identity requirement unresolved. An optional provider is enabled but labeled “not adopted” to bypass acceptance: blocked. A direct remote source SHA matches but untracked private records remain unexplained: publication review incomplete. Manual screen reader evidence is absent: no manual acceptance claim, even if automated accessibility checks pass.

## Acceptance mapping and root decisions

The local ledger, optional feature ledger, blocker ledger and operator signoff are distinct decisions as required. `WX-0835` is explicitly recognized without inventing a current identity receipt. Agent 0 reviewed the proposed states, completeness rules and limits at artifact design scope; actual candidate, run receipts, target/operator selections and authorization remain separate work. No catalog status, Git state, provider configuration, source publication or deployment changed.

## Historical examined source and provenance

Repository-relative paths and SHA-256 of examined bytes:

| Public source | SHA-256 |
| --- | --- |
| `docs/TEMPLATE-MAINTENANCE.md` | `d11316e53524deb4cdaac69a08be09b3c73872e5556dcea891c248eda93fb85d` |
| `docs/REPOSITORY-IDENTITY.md` | `f985dc69d5671a4f854f040b7ce818f644c5df994c38996a773283d948ad1a10` |
| `scripts/check-template.sh` | `059480f0a672973732e21d53b44176692ce94054213a7062df07c3136c8e8e9c` |
| `scripts/ci-plan.mjs` | `c1e0933c2e07f782d023335f8a1786e0d9a0516aeea5876696c95a23b5b84051` |
| `package.json` | `9dfe138a4cc64035e703cd7219d67a9bd95a346fc7c0e5cd4f21295bef61475d` |
| `.SYSTEMX/scripts/deploy.sh` | `c07dd6ff0d631a663a3737fd719e566cf96a686a95230d5d8a00082d929dbfe2` |

These are historical supplied-basis source observations only. They do not establish current deployed settings, cloud access, a successful CI run, account availability or operator acceptance. Re-review a changed source or target before adoption.
