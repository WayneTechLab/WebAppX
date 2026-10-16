# CRM merge and optional adoption artifact verification — 2026-10-15

**Agent 0 acceptance: 22 original criteria complete at the scopes recorded below.**
Five criteria cover native fictional CRM behavior; seventeen cover reviewed optional designs,
contracts, runbooks and checklists. All required local gates passed on `4e025a3b5c21d0accef4e2e02add2c7eff54d589`.
The separate [existing-work reconciliation](EXISTING-WORK-RECONCILIATION-QA-2026-10-15.md) accepts 23
additional original criteria. Together they add **45 completions** to the published 134-item
baseline: **179 done / 821 remaining**. The complete 1,000-item goal remains active.

## Source and completed gates

| Observation | Exact result |
| --- | --- |
| Published predecessor | `317f47806b7f86dce00f15ee5ced7c0e0bae6116` |
| Final examined source | `4e025a3b5c21d0accef4e2e02add2c7eff54d589` |
| Complete CI | `npm run ci:all`; terminal **0**, all **68 stages** in maintained order |
| CI log | `webappx-crm-adoption-ci-all-68-run5.log`; SHA-256 `066d306b255b1dc6ce98eb79ada2b4924272c574575e6f159289ec94f2f56061` |
| Separate Hosting preflight | `npm run deploy -- hosting --preflight`; terminal **0** on the same source in an owned exact-commit clone |
| Preflight log | `webappx-crm-adoption-hosting-preflight-4e.log`; SHA-256 `550f76c44d1ae0c97806ccb575ba2daf9e7a85c79afea60718663ab3a49c6529` |
| Independent final review | `webappx-crm-adoption-ci-verification.json`; SHA-256 `58bcf57c53b94637a5c3a4fca8263824e39cf8dcfdc983e74a880b7aa3ff35d9` |
| Exact runtime | **145 files**, [freeze 3](evidence/crm-merge-runtime-2026-10-15.json), SHA-256 `f1588c3ed32d5c198aa74f7a673ebdd32422eacc659d754e73fac03bc68e4d7e` |
| App / deployment | **3.4.0 / deploy count 0**; preflight skipped push and deployment |

The [machine-readable local-gate facts](evidence/crm-adoption-local-gates-2026-10-15.json)
retain the complete 68-stage list and individual browser report fingerprints. CI executes
the committed source before this status/documentation follow-up. Publication and metadata
checks retain their separate receipts. No production deployment was authorized or performed.

## Exact original criteria and dependencies

| Checked ID / original title | Exact original acceptance | Original gate / dependencies |
| --- | --- | --- |
| [x] **WX-0369** — Add a CRM duplicate candidate report | The report identifies normalized company-name and email candidates within the actor's scope without merging automatically. | local / `[]` |
| [x] **WX-0370** — Preview same-owner contact merges | A merge proposal shows retained fields and linked records, and refuses incompatible ownership before confirmation. | local / `[]` |
| [x] **WX-0371** — Apply contact merges atomically | A confirmed local merge redirects valid references once and leaves no dangling opportunity or lead contact IDs. | local / `["WX-0370"]` |
| [x] **WX-0372** — Preview company merge consequences | The proposal lists contacts, opportunities and duplicate-name conflicts before any account records change. | local / `[]` |
| [x] **WX-0373** — Apply company merges with receipts | A valid same-owner merge moves all supported graph edges atomically and records source and retained IDs. | local / `["WX-0372"]` |
| [x] **WX-0511** — Specify trusted membership provisioning boundaries | For optional operator-approved adoption: A design records which backend creates memberships, who can approve assignments and how client-controlled role fields are ignored. | operator / `[]` |
| [x] **WX-0517** — Design optional owner recovery procedures | For optional operator-approved adoption: A runbook identifies owner recovery prerequisites, evidence and independent approval before any real identity is restored or elevated. | operator / `[]` |
| [x] **WX-0527** — Define optional custom-token issuer contract | For optional operator-approved adoption: The contract requires trusted issuer identity, audience, lifetime and scope while keeping token generation outside browser code. | operator / `[]` |
| [x] **WX-0534** — Define optional portal-specific permission bundles | For optional operator-approved adoption: A reviewed design groups CMS publication, CRM assignment and HR administration capabilities without deriving them solely from paid account level. | operator / `["WX-0501", "WX-0503"]` |
| [x] **WX-0612** — Define optional content security policy adoption | For optional operator-approved adoption: Produce a report-only policy proposal listing required Firebase, SDK, image and font origins; activation remains an operator-reviewed hosting change. | operator / `[]` |
| [x] **WX-0617** — Define optional webhook retention controls | For optional operator-approved adoption: An adoption design bounds stored webhook payload duration, redacts unnecessary provider fields and requires operator selection before collection. | operator / `[]` |
| [x] **WX-0627** — Design optional download authorization contracts | For optional operator-approved adoption: A future attachment design binds each download to tenant, resource and expiry rather than trusting a displayed URL or demo role. | operator / `[]` |
| [x] **WX-0628** — Prepare a private preview publication checklist | For optional operator-approved adoption: An operator adoption checklist verifies fictional data, no secrets, indexing choice and access controls before exposing a preview beyond loopback. | operator / `[]` |
| [x] **WX-0635** — Prepare optional incident evidence capture guidance | For optional operator-approved adoption: The runbook specifies revision, time, affected synthetic scope and redacted logs to preserve before any approved production incident changes. | operator / `[]` |
| [x] **WX-0637** — Design optional session step-up requirements | For optional operator-approved adoption: An adoption matrix identifies which sensitive export or owner action should require recent authentication and leaves enforcement disabled until reviewed. | operator / `[]` |
| [x] **WX-0760** — Design optional application error telemetry adapter | For optional operator-approved adoption: An opt-in adapter contract lists approved redacted fields, event volume limits and transport failure behavior before any external telemetry is configured. | operator / `[]` |
| [x] **WX-0802** — Create an optional GitHub Actions adoption workflow design | For optional operator-approved adoption: A reviewed plan runs the existing required gates on pull requests with explicit permissions and no production deployment credentials. | operator / `[]` |
| [x] **WX-0814** — Prepare optional deployment identity separation | For optional operator-approved adoption: An adoption design assigns distinct preview and production identities with minimal reviewed permissions and no secrets committed to workflow source. | operator / `[]` |
| [x] **WX-0820** — Prepare Windows x64 and ARM64 CI acceptance matrix | For optional operator-approved adoption: An optional runner plan identifies which host, import, test and build checks must run on each architecture and records unavailable runner coverage explicitly. | operator / `[]` |
| [x] **WX-0830** — Add Firebase rules dry-run evidence checklist | For optional operator-approved adoption: Document emulator policy evidence, target project review and deployment approval separately so local passing tests do not imply deployed rule acceptance. | operator / `[]` |
| [x] **WX-0850** — Create a release readiness decision worksheet | For optional operator-approved adoption: The worksheet records required local gates, optional provider evidence, unresolved blockers and operator deployment approval as distinct decisions. | operator / `["WX-0835"]` |
| [x] **WX-0953** — Add an optional OAuth state-binding design | An adoption test contract binds state, organization, initiating user, expiry and one-use callback without exposing a client secret. | provider / `[]` |

WX-0370 precedes WX-0371; WX-0372 precedes WX-0373. Previously accepted
WX-0501/WX-0503 and WX-0835 retain their original completion records. Every original
definition, priority, phase, source, gate and dependency is preserved.

## Native CRM contract and exercised behavior

- Duplicate reporting uses scoped normalized company names and emails. Reporting does not mutate records.
- Contact preview captures complete source/retained fields, linked opportunities and converted leads; incompatible ownership and hidden collisions refuse without disclosure.
- Company preview lists contacts, opportunities and duplicate-name consequences before confirmation. Apply redirects all supported edges atomically, retires only the source, and records source/retained IDs.
- The first accepted merge captures the complete accepted legacy baseline. Ordered subsequent commands and immutable captures replay to the exact final tables, order, receipts and sequence.
- Private one-use previews bind current state, actor, selection, policy, replacement epoch and controller lifetime. Confirmation rechecks the latest root inside its synchronous update boundary.
- Scoped report/preview/history screens expose finite approved DTOs; complete saves, exports, restore points and Undo retain private captures across owners.
- Raw selected IDs and unsaved text remain explicit when records retire. Dirty owners, Keep editing, preview Cancel and hidden retained surfaces preserve their existing focus and draft boundaries.
- Present optional history rejects unsupported shapes before structural reads. Legacy saves without history retain their original acceptance behavior.

Read the [full merge contract](CRM-MERGE-CONTRACT.md) and
[walkthrough](CRM-DUPLICATES-AND-MERGES.md) for exact policy, privacy and capacity limits.
Source/controller/inspection reviews and independent literal expected browser fixtures cover
complete graphs, exports and raw saved envelopes. Tests do not construct their expected
accepted result by invoking the implementation reducer.

## Actual browser and rehearsal evidence

**226 named check groups:** 212 across fourteen native suites, eight in the owned
HR-disabled adoption rehearsal, and six in the owned LAN work-status browser.
All 226 group strings are unique. A group may contain several assertions; status/workflow
coverage overlaps and is not summed into a larger product-coverage total.

| Fresh native suite | Check groups | Report directory basename | SHA-256 |
| --- | ---: | --- | --- |
| smoke | 7 | `webappx-browser-smoke-WwJoX6` | `e992b0fb2166b7809c07a7707216586d14925ca0d10787470853871a904e717f` |
| keyboard | 10 | `webappx-browser-keyboard-2RC3qk` | `dc2aaea6d0b429e23cc2e172cdc08c195e81e973feb3360ce8cb141d8cf779f9` |
| foundation | 10 | `webappx-browser-foundation-Ipqfd4` | `23bcd796fb07b4d9a5473bfcd3c73783ce42b9bd27a451083fa1726f259c6d8c` |
| state-contract | 13 | `webappx-browser-state-contract-GJjdJZ` | `95ec1c15260da2472171be7396df77ce73a0bc81d8ec537f050d8b257f34f160` |
| lifecycles | 12 | `webappx-browser-lifecycles-FDBkSS` | `54b908a92261fe0a08da9579e0cc7181556265f1a9a73dd14ebba59fdaf7e575` |
| portal-lifecycle | 35 | `webappx-browser-portal-lifecycle-h5Tzs8` | `7dd52ddd3445c6a63bfdbc1a4b89cc8e960e64cf999f8a5d4be40d0258473408` |
| recruiting | 15 | `webappx-browser-recruiting-aPQxLr` | `a18b26e2178753d79c415ad759f7be45cd833846a329c3f2c5fd040170a33014` |
| payroll | 21 | `webappx-browser-payroll-jDdLNC` | `d1d581e5be56d2f028b9901da7484b238e7c45771fbed2f12cbd99ad15ffa91e` |
| evaluators | 25 | `webappx-browser-evaluators-g6Ip9v` | `17e9e73da7d9bf0670418685abda640c545d4807f72ed14446b83db17ff2548b` |
| maturity | 13 | `webappx-browser-maturity-NM1bP5` | `e15fba8d8c1c2a9d5ad6d4ba547ef1e5565166eca3d06d54f8ec48adbba5f419` |
| safety | 31 | `webappx-browser-safety-vSj76t` | `ee456303a4ed714b908b69dad60ca94af899902585ea0ab2e7387d3c25598fa8` |
| quality | 7 | `webappx-browser-quality-ad52QF` | `0f994a5560324f61a50679737459b507a83d1269e1e31a9efb89a2b60c7377b8` |
| sdk-quality | 5 | `webappx-browser-sdk-quality-Xu4ca4` | `d4fa30aa7bea9d0a506b669933db2f8385eeec1222de5153aff5823c50ad0cd2` |
| recovery-drill | 8 | `webappx-browser-recovery-drill-PbRstw` | `8a2a2e47d7a029942b33f0e0dc070bbed757fab28038ca1e261bf5a4a31bfca3` |

The composed lifecycle result is **35 = 20 preserved lifecycle + 15 CRM groups**.
Fresh CRM coverage observes all **24** declared status meanings once, including real
preview/cancel/confirmation, complete exports/reload, retained drafts, role changes,
selective recovery and storage refusal. Nine strict focus observations and two scoped
accessible-name ambiguity audits pass at 390px width.

The independent review rehashed six manifests: composed 145 runtime/18 harness/284 artifacts;
legacy subset 145/10/178; CRM subset 145/16/104; recruiting 145/12/152;
payroll 145/14/184; SDK quality seven selected source files/133 artifacts.
The SDK manifest is a selected-source dictionary. Older runner receipts without full
runtime dictionaries are qualified separately; the independent review verifies the full
145-file committed/current runtime and preserved harness bindings.

All fifty retained trace archives were inspected: **20,655 owned loopback resource events**
and **347 download events**, with no unowned origins, native API paths, action errors or
console errors. The unconfigured Firebase warning is expected. Ten fresh original PNGs
were visually readable. All 28 recorded native runner/preview PIDs were absent and their
fourteen ports had no listeners. The LAN fixture was removed and no matching fixture
server remained; its unrecorded PID/port metadata is not invented.

The HR-disabled rehearsal captures 150 committed public files at this source and emits
55 modules. Its eight real browser groups verify CMS/CRM edit/save/reload/export/import,
the distinct two-module backup, rejected old HR/recovery imports and unread preserved
legacy browser slots. It does not adopt generic recovery or provider services.

## Reviewed optional artifacts

The [fourteen-guide index](ADOPTION-CONTRACTS.md) covers seventeen original artifact criteria.
Identity provisioning, custom-token issuing, permission bundles, session step-up, owner
recovery, CSP, retention, downloads, OAuth, telemetry, Windows verification and delivery
are complete at their requested design/checklist scope. Runtime adoption remains disabled
or unselected. The 79-case identity matrix and sanitized protocol fixtures are paper
examples. They do not execute authorization, enrollment, callback exchange or telemetry.
Historical curation metadata and fingerprints remain preserved in the
[source-review record](evidence/adoption-contract-source-review.json). Its pending/draft
fields describe their recorded checkpoints; this receipt and the canonical catalog record
the later local gate and design-criterion acceptance.

## Preserved failed attempts and narrow repairs

| CI attempt / source | Actual outcome | Preserved log SHA-256 | Repair |
| --- | --- | --- | --- |
| 1 / 6537c010 | Exit 1 at fixture source inventory | `576a7b5664ab070796450dfbeaceafae01637e6daf8b9083f9356898e718327b` | Inventory follows extracted CRM kernel/types; 30 → 32 finite source bindings |
| 2 / ba858064 | Exit 1 at SYSTEMX setup-copy integration | `3c31e01a5ce69d751db5461d51473ebe20e9d6533264c31db7e61f420d4f38ec` | Add the two actual public inventory sources to the bounded setup-copy list |
| 3 / 3b8bb8eb | Exit 1 at portal test loading | `b13ab3be978ee801f8aba5c10c63915ae3da1d9579f70fc52a02c8c4168513fb` | Use the maintained module loader, exact enum source, and bounded adoption-copy closure |
| 4 / 8308237b | Exit 1 at stage 62 LAN status loading assertion; prior native suites passed | `b56d16003a0322320ba9b957cb681c7ba448a37ebc71f6a1f5bfc443a4ea3354` | Align locator assertions with the existing 15s page/action deadline |
| 5 / 4e025a3b | **Exit 0, all 68 stages** | `066d306b255b1dc6ce98eb79ada2b4924272c574575e6f159289ec94f2f56061` | Final examined source |

The LAN repair changes one import/configuration header. All six original assertion groups,
real API requests, stale-response checks, malformed-data checks, 90-second global cap and
cleanup body remain exact. Its official focused six-group run and scoped lint exited 0.
The independent static review is `webappx-lan-status-independent-review.json`,
SHA-256 `881ba61c8fc31e3203e3a157b37a331aa0c80c6d6af90628b506043056e9bea9`.
Separate diagnostic API durations of 877–3061ms do not measure the failed CI4 request.

Historical composed browser run 5 passed 35 groups at runtime freeze 2. Its independent
review `d14bd57b503a5b663a39267ddb5111a4aecd1536eef53e02015852ff62003fc6` remains qualified to that source.
Four earlier browser failures and two label diagnostics remain retained. Freeze 2 repairs
two accessible labels; freeze 3 removes one extra terminal LF from the model facade.
The fresh final run above executes freeze 3. No failed or historical result is relabeled.

## Preservation and acceptance limits

Selected SYSTEMX remains 1.9.0-alpha.6 with installation/release fingerprint
`009e6b6c2f1359fa4c88e3961164d28cc89f65cea2a6682200fb2953caf326e3`.
Immutable releases, both research packages/checksums and blank reusable project seeds
are preserved. All 1,000 original criteria and the prior 134 completion records remain
exact. Package names, dependency pins, 134 script names and the 68-stage sequence remain
unchanged. The production build reports a nonblocking chunk-size warning; no performance
criterion is accepted from that build.

This receipt establishes local native behavior and reviewed artifact criteria. Provider
operation, deployed rules/Hosting, actual Windows/device tests, manual screen-reader
announcements and business/operator runtime acceptance retain their separate requirements.
Source and native wiki publication are verified after committing this receipt.
