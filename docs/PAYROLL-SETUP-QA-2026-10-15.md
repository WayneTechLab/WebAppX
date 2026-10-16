# Payroll controls and developer setup verification — 2026-10-15

Status: **ACCEPTED — Agent 0 accepted the twelve original criteria below on
2026-10-15 after the local 68-stage CI and separate Hosting preflight both exited
0 at implementation commit `42818dd7baf3d335f27c401c37d048bd842617fa`.** The
canonical catalog now records **134 done / 866 TODO**. Remaining priorities are
56 P1 / 654 P2 / 156 P3; remaining gates are 699 local / 127 operator / 40 provider.
These are local criterion acceptances. No production deployment or live-provider
acceptance occurred.

The completed CI ran before this acceptance metadata and the later three-guide
freshness patches. Final metadata/document checks, freshness mapping and
publication remain separate follow-up work; they are not attributed to the
completed source run.

The published starting checkpoint is
`49a9efe345c815c2bead1cbbeb83204d31e64290`. Its previously accepted recruiting
wave and its 63-stage/198-browser observation retain their separate
[dated receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md). Those historical gates
are not payroll/setup verification. This wave's earlier focused observations were
made against authorized working changes above that checkpoint. The final CI and
preflight examined the committed implementation `42818dd7baf3d335f27c401c37d048bd842617fa`;
this receipt does not claim that the unchanged starting commit ran the new tests
or that the implementation has been published remotely.

The [payroll contract](PAYROLL-CONTROL-CONTRACT.md), especially section 12,
[payroll guide](HR-PAYROLL-CONTROLS.md) and
[setup implementation plan](SETUP-CONTRACTS-IMPLEMENTATION-PLAN.md) describe the
assigned scope. Earlier QA receipts remain historical; this new receipt does not
replace their source revisions, dates or results.

## Original criteria and acceptance boundary

The following titles, acceptance text and dependencies are taken from the
canonical `docs/backlog/webappx-1000-todo.json`. Setup rows are P2 / foundation /
setup / local. Payroll rows are P1 / portal-maturity / hr-payroll / local.
Original source fields, priorities, phases and gates remain unchanged.
WX-0014 depends on WX-0013; all other selected rows have `dependsOn: []`.
Neither payroll criterion depends on the other. Agent 0 accepted exactly these
twelve rows, with completion evidence pointing to this receipt and source base
`42818dd7baf3d335f27c401c37d048bd842617fa`; original criterion definitions and
dependencies were preserved. WX-0013 was accepted with this wave, satisfying the
unchanged dependency of WX-0014.

| ID and exact original title | Exact original acceptance | Accepted evidence / scope boundary |
| --- | --- | --- |
| WX-0011 — Add a setup troubleshooting decision tree | A new developer can follow distinct instructions for dependency install, runtime mismatch, occupied port and emulator startup failures. | Accepted local documentation scope: distinct setup/recovery branches, source/example review and fresh command checks. No actual emulator failure recovery claimed. |
| WX-0012 — Document recovery from an interrupted dependency install | The guide identifies which generated dependency paths can be rebuilt and preserves ignored environment and emulator state. | Accepted local documentation scope: rebuild/preservation procedure and reviewed examples; no real interrupted installation or emulator recovery claimed. |
| WX-0013 — Add a package-script discovery command | A read-only command lists maintained scripts by setup, app, portal, SYSTEMX, wiki and release purpose using the real manifest. | Lane A cases passed again in the fresh 50-test setup stage; actual 134-script report. Discovery does not execute listed scripts. |
| WX-0014 — Validate command examples against package scripts | A documentation check flags npm script names in maintained command examples that do not exist in the root manifest. | Fresh setup cases and 153-document / 1,261-example check passed at the implementation commit; WX-0013 is accepted. Later document changes require their own checks. |
| WX-0016 — Add a fixture seed inventory command | A read-only command lists fictional fixture sources and identifies which reset action restores each source. | Lane B cases passed again in the fresh 50-test setup stage; eight reviewed groups / 30 public sources. Inventory performs no Reset, generator, model import or provider operation. |
| WX-0019 — Report starter parity by feature group | The template check groups app, dependency, asset and configuration differences so a maintainer can locate the relevant starter drift. | 28 focused template tests, fresh template/integration stages, grouped report and independent source review; no automatic starter synchronization. |
| WX-0020 — Add a scaffold identity checklist | New-app adoption lists repository name, package name, site branding, deployment target and project records that require deliberate replacement. | Authored five-category adoption checklist; no private application adoption, repository creation or deployment claimed. |
| WX-0022 — Verify shell-free child process examples | A source check identifies new script call sites that build executable shell strings and points maintainers to argument-array examples. | 15 tests, actual finite AST report and independent inert parser probes; not complete security analysis or shell-script parsing. |
| WX-0023 — Add filenames-with-spaces setup coverage | A temporary-copy smoke run installs no services and verifies key setup commands from a repository path containing spaces. | Fresh full-CI owned-copy macOS smoke: seven commands in the spaces context, all exit 0, source bytes preserved and owned copy removed. |
| WX-0024 — Add non-ASCII project path coverage | Temporary-copy checks exercise project configuration and read-only status from a path containing Unicode characters. | Fresh full-CI owned-copy macOS smoke: seven commands in the Unicode context, all exit 0, source bytes preserved and owned copy removed. |
| WX-0159 — Add mock pay-period closure | Closing a submitted sample period prevents new entries from silently changing its frozen payroll totals. | Fresh core/guard/codec/UI/host stages plus OlwijH and independent full-CI GORDlT browser passes; exact closure inventory, stale pointer and inclusive-window refusal observed. |
| WX-0160 — Add fictional payroll correction runs | A correction references the original receipt and records a separate adjustment without rewriting submitted history. | Fresh cumulative-chain, immutable-history, scoped projection and recovery stages plus both final browser passes; separate original-linked signed deltas observed without rewriting originals. |

## Examined implementation and source freezes

| Reference | Examined value |
| --- | --- |
| Published assignment basis | `49a9efe345c815c2bead1cbbeb83204d31e64290` |
| Final implementation commit used by CI and preflight | `42818dd7baf3d335f27c401c37d048bd842617fa` |
| Final application runtime | 130 source files, freeze 3 |
| Exact-byte manifest | [payroll-control-runtime-2026-10-15.json](evidence/payroll-control-runtime-2026-10-15.json) |
| Freeze-3 manifest SHA-256 | `6adc613e9cb4681668200c742b08716259833a678ba03cc95c9ea7fdb5af8666` |
| Independent completed-run source verification | Exact 130-file roster; all current and committed bindings equal the public freeze; final browser runtime/harness/artifact dictionaries verified |
| Source-integration receipt | `webappx-payroll-setup-integrated-source.json`; source-only integration, before acceptance |

Runtime source hashing is exact bytes. Role/capability source-review bindings
have their own declared text/hash policies. A manifest identifies examined
bytes; browser, CI and preflight observations are separately recorded below.

Two earlier freezes remain preserved:

| Preserved reference | SHA-256 | Subsequent change |
| --- | --- | --- |
| [Freeze 1](evidence/payroll-control-runtime-freeze-1-2026-10-15.json) | `cabec0c791e624e5e82cae717bcefb64e93ca01d555af81dd2e18eb84927842b` | Freeze 2 changes only the writer payroll wrapper in `HrWorkspace.tsx` to an explicit `min-w-0` / single-column grid after the third browser diagnostic. |
| [Freeze 2](evidence/payroll-control-runtime-freeze-2-2026-10-15.json) | `19225a46ac9d9aa778afa0b73417783b2452764b703ef728a0a5586056758a1d` | Freeze 3 adds explicit single-column grid containment to the own statement root in `HrInsights.tsx` and auditor receipt inventory in `HrWorkspace.tsx`, following the fifth run's post-run full-bounds finding. |

These final layout repairs changed grid class bytes, without changing payroll
authority or domain branches. Source-binding review independently checked the
exact changed bytes and preserved the unchanged bindings. Earlier focused logs
remain historical observations at their recorded pre-geometry scope. The final
standalone browser and the complete CI examined freeze 3; no earlier failed or
partial result has been relabeled as a freeze-3 pass.

## Focused local observations

The following are local macOS observations. Saved logs were read directly for
this receipt; owner-reported tool receipts are explicitly identified. Counts in
different rows are test entries from their respective runs, not a deduplicated
assertion total. These earlier focused logs predate the final layout repairs;
the later integrated-CI results have their own section and source identity.

| Scope | Actual recorded result | Evidence |
| --- | --- | --- |
| Payroll core/controller | 42 tests passed, zero failed/skipped; includes the two independent-review repairs | `webappx-payroll-control-focused-4.log` |
| Payroll UI, integration, host and inspection | Separate 42 tests passed: 16 UI callbacks + 11 native/codec/recovery integration + 9 host + 6 inspection | `webappx-payroll-integrated-focused.log` |
| Standalone host checkpoint | 9 tests passed; actual root callback bodies and real unsaved-work controller | `webappx-payroll-host-focused.log`; overlaps the separate integrated-focused row |
| Setup Lane A | Owner-reported terminal exit 0: 24 passed, zero failed/skipped, 177.630916 ms | Tool receipt `181d5b`; no standalone saved TAP log. Command: `node --test tests/setup/package-script-discovery.test.mjs tests/setup/doc-commands.test.mjs` |
| Setup Lane B | Owner-reported terminal exit 0: 11 passed, zero failed/skipped, 1347.914125 ms | Tool receipt `81a67a`; no standalone saved TAP log. Command: `node --test tests/setup/fixture-inventory.test.mjs` |
| Setup Lane D | 15 tests passed; actual source report has 45 maintained source files, six reviewed exact occurrences and zero diagnostics | `webappx-child-tests-final.log`, `webappx-child-report-final.json`, `webappx-setup-D-E-evidence.json` |
| Setup Lane E | Four tests passed; two owned copies executed fourteen actual setup commands in total, all exit 0 | `webappx-setup-paths-sixth.log`, `webappx-setup-D-E-evidence.json` |
| Starter parity | Complete 28 tests passed: 14 prior + 14 additive cases | `webappx-setup-starter-parity-complete.log`; actual report and preservation companion below |
| CI planner | 14 tests passed; this validates discovery/classification, not execution of the planned stages | `webappx-payroll-setup-ci-plan-tests.log` |
| Execution-plan tooling | Eight focused tests passed; generated plan retains original counts and assigned scope | `webappx-payroll-plan-focused.log` |
| Script discovery | Saved read-only report: 134 real manifest scripts, no unclassified or stale classifications | `webappx-script-discovery.json` |
| Documentation npm-name check | Saved report: 152 documents / 1,261 references / zero diagnostics | `webappx-setup-docs-command-check.json`; historical snapshot before this QA receipt was added; the fresh CI later checked 153 documents / 1,261 examples |

The fourteen path-smoke commands are seven per context: developer doctor,
script discovery, actual npm script discovery, fixture inventory, managed status,
configured offline doctor and documentation-command checking. The contexts were
named `WebAppX setup spaces` and `WebAppX Café 東京 setup`. Each copied 689
files / 33,319,574 bytes. The report records source/copy bytes, ignored fictional
sentinels and directory inventories preserved, the configured-check trap not
executed, and both owned copies removed. These are the earlier standalone copy
sizes; the fresh CI's separate 693-file observations are recorded below. No
install or service was performed.
This is macOS execution; Windows x64/ARM64 behavior remains unobserved here.

The starter report inventories 43 mapped public files across app (22), dependency
(2), asset (2) and configuration (17). The preservation companion records all 43
starter-file bytes and all 14 prior test bodies unchanged. Agent 0 deliberately
reviewed the root package-script/test-wiring change before rebinding its one
mapping fingerprint. Grouped reporting does not authorize copying or updating
the starter.

Lane A/B stdout was not saved independently. Their reported passing counts are
qualified tool receipts. The completed CI now supplies a separate durable run
of all 50 setup cases, including those Lane A/B cases. Lane B
also reported an earlier 9/11 diagnostic failure on macOS canonical temporary
paths before its entry-path realpath repair; that earlier attempt is not counted
as a pass.

Their reported test-source bindings are
`package-script-discovery.test.mjs` SHA-256
`bd2a98efdc9ff1223ec809611f15adb610fb17f59472a1b7f46baecb2949781a`,
`doc-commands.test.mjs` SHA-256
`7db21cd6ac2442b59d597a9124eec8808573b11222f99c8f332728e8e2566de0`,
and `fixture-inventory.test.mjs` SHA-256
`54174cbc413340473e0619d0a1871c00d5765b03ff49649cf5777d82ea1445a4`.

## Implemented payroll boundaries examined by source and focused tests

- Closing is explicit and company-wide for an exact recorded date window. Every
  exact-period receipt and consumed link participates; unresolved time,
  nonidentical overlaps and periodless known-date conflicts refuse. Ordinary
  add/edit/submit/approve/return/delete and overlapping preparation paths cannot
  bypass a closure. A saved overlapping pending pointer remains unchanged and
  derives a stale/closed-window result.
- Corrections are manual fictional cumulative integer-cent targets. Each event
  references the immutable original receipt and records separate previous,
  proposed and signed delta amounts, with an exact preceding-adjustment link.
  They can target an open or closed qualified original and do not depend on a
  closure. Original hours, rates, benefit captures, paid links, submitted history
  and ordinary totals remain unchanged. No correction applies an automatic 20%
  tax rule or represents funding, a debit, a reversal or recovery of money.
- Native fractional gross uses the original input order and rounds once after
  each employee's sum of products. Periodless qualified legacy data retains
  missing dates/periods and unknown chronology. Unsupported legacy receipts stay
  readable/exportable with controls absent and are not silently repaired.
- New control presence opts the complete envelope into strict descriptor-first
  plain JSON. One authoritative event sequence, first-use exact anchors and
  bounded replay govern accepted records. Private one-use preview bindings use
  the complete source/raw fixture, actor, epoch and generation; the latest root
  functional callback validates before memory/save. No second HR store or live
  adapter is introduced.
- The writer UI receives permitted DTOs and narrow ports. Exact dirty groups,
  linked all-field summaries, cancellation and callback focus requests are tested
  as component behavior; those tests are not actual DOM/keyboard observations.
  Queueing/Keep does not consume the preview. Explicit Discard can clear listed
  time/payroll drafts before a later stale refusal, with no domain acceptance.
  Accepted memory alone rebases the successful form; browser-save warnings stay
  separate and commands are not retried automatically.
- Mounted ordinary source changes retain raw form text and stale the handle.
  Deliberately accepted import/restore/Undo/Reset retain existing dirty,
  checkpoint and epoch semantics and may remount/clear the selected HR temporary
  UI. This receipt does not promise raw text survives an explicitly accepted
  Discard plus replacement. Hidden retained command callbacks read route
  visibility live before actions.
- Employee adjustments are projected only for the selected employee and remain
  separate from original statements. Auditor DTOs contain bounded IDs/dates/
  counts without money, reasons or names. Complete local exports still contain
  complete records; preview roles do not create trusted authentication.

## Independent review and corrected findings

`webappx-payroll-control-independent-review.md` preserves the original two P2
findings and pre-repair source hashes. Subsequent narrow read-only review cleared
both repairs on core SHA-256
`d754c27c69a5050cad26a952666b38fb08efd86409fa8feed8ef7750b0b25059`:

1. A current submitted pointer now resolves to exactly one fully equal history
   record independently of the targeted original, at activation and present
   replay. Legacy absence and nonhistorical pending pointers remain supported.
2. The periodless inventory now validates consumed-link facts and reconciles
   known frozen/current dates before excluding a record from the closing window;
   omitted historical fields remain omitted.

Host review also found invalid writer shapes/unknown bound identities reaching
the dirty decision. The reviewed fix applies exact actor authorization and known
identity checks before dirty-scope enumeration. A live route callback additionally
denies hidden commands while retaining their form/DTO. The nine host tests cover
these denials, safe handle consumption, Keep, a timer becoming dirty after the
dialog opened, authorized Discard followed by stale refusal, synchronous latest
acceptance and transition callback updates without store-publication loops.

`webappx-setup-source-independent-review.md` retains the setup scanner findings:
spread precedence, aliased JavaScript/Python mutation, multiline inline code spans
and seven stale exact documentation-context occurrences. Its final narrow closure
records all four resolved. The context-rebind proof preserves the other 28 of 35
records and protected context fields; the child-process baseline remains six
exact exceptions/occurrences, with no new exception. The finite AST check neither
imports scanned modules nor executes their commands, and does not parse shell
scripts or establish complete security coverage.

`webappx-starter-parity-independent-review.md` records a clear source review,
including finite grouped mapping, unlisted additions, alias/symlink refusal,
portable text versus exact asset hashing and preservation of the former integrity
validation. Source review and focused parser probes remain distinct from app,
browser, operator or provider acceptance.

The durable payroll review now appends the targeted post-repair closure while
preserving its original prefix and findings. Its current SHA-256 is
`aaac279d190f093c07607bcba76596f4d95f99ada0c30d43c7c983eb293527ce`.
The reviewed controller is
`5dd06613faf50dc6e525f4aeb8f65c8378582ed9f48aa6388527a3457e7a1970`;
the host is
`13771680bcb323fc58a9ffa20fd3b159d79cd305316bbce1108fd5bf387e97e6`,
with React wrapper
`57e81d72dc665fa24fcb9893c19c755f1634e61e5320f9fa559a9591ce0dde3b`.
The original two core findings and the invalid-actor/live-route host findings
are resolved in that source review. Its 42-core / nine-host log references are
historical pre-geometry observations, not additional reruns by the reviewer.

### Role, capability and prior-guide source review

`webappx-payroll-source-binding-independent-review.md` and the final
`webappx-payroll-source-binding-freeze-3-proof.json` record deliberate review of
the payroll authority, controller, UI, host and inspection boundaries, followed
by exact review of both layout repairs. The role fixture has 83 bounded source
bindings and the Gusto capability map has 84. Their finite limits reject one
over those bounds. The seven role projections, eighteen literal transition
cases, complete-export boundary, 33 native/SDK/adopter capability narratives,
three actual SDK components, SDK pin/license/inventory and canonical capability
and route bytes remain protected. Unchanged source bindings were retained; new
hashes were not applied as a blanket refresh.

The focused 58-test binding log predates the geometry repairs. Final guide
render checks and exact source proof identify freeze 3, and the fresh full CI
then reran the role and gap suites: 35 + 23 = 58 passing test entries. Source
bindings establish reviewed source, not provider support or a browser result at
the historical review basis.

`webappx-payroll-prior-guides-freshness-review.md` distinguishes the older
recruiting receipt/source checkpoint from the final payroll source. Agent 0
copied three reviewed guide patches only after CI and preflight completed;
those later document bytes were not part of the completed commands. The old 21
QA receipts remain byte-preserved. Their recorded inventory digest is
`4c66a682b5f92ff83b7749186bcf732464ac68feb4ec84c5b57f9b13313db36d`;
this new receipt is outside that historical inventory. Final documentation
checking, freshness mapping and publication remain follow-up work.

## Browser attempt history and final standalone pass

All six standalone attempts are preserved in
`webappx-payroll-browser-run-history.json`. UTC timestamps below fall on
2026-10-15 locally in America/Los_Angeles. Every report records six owned contexts
closed with traces, browser/server closure and child exit 0 without a signal.
A passing subset or behavior-only pass does not replace a failed overall or
unaccepted visual gate.

| Report basename | Source and actual result | Owned resources |
| --- | --- | --- |
| `webappx-browser-payroll-5tzadH/report.json` | Freeze 1; 2026-10-15 23:52:02.896–23:52:24.103 UTC. Overall **failed**: eight legacy checks passed, five new lanes failed on rate-control/closure-option/checkpoint-text harness expectations. One of 35 statuses observed. | Preview PID 29188 / runner 29147 / port 62262. |
| `webappx-browser-payroll-gYwUq8/report.json` | Freeze 1; 2026-10-15 23:53:23.312–23:53:38.737 UTC. Overall **failed**: ten checks recorded, including the eight legacy and two storage-fault behaviors; four lanes failed on a nested Correction reason selector. Nine of 35 statuses observed. | Preview PID 39047 / runner 39003 / port 62541. |
| `webappx-browser-payroll-owaboW/report.json` | Freeze 1; 2026-10-15 23:54:30.135–23:54:50.893 UTC. Overall **failed**, eleven checks / eleven statuses: real narrow writer-control overflow, auditor-region expectation and receipt-option wait. | Preview PID 47338 / runner 47299 / port 62752. |
| `webappx-browser-payroll-N2sZDf/report.json` | Freeze 2; 2026-10-15 23:57:16.753–23:57:38.453 UTC. Overall **failed**, fifteen checks / 21 statuses: a harness expected one heading in a preview that correctly contained its main heading plus four money-section headings. The selector was made specific; headings were retained. | Preview PID 67668 / runner 67599 / port 63240. |
| `webappx-browser-payroll-I4o6Hd/report.json` | Freeze 2; 2026-10-15 23:58:05.623–23:58:38.411 UTC. Report behavior result **passed**, 21 checks / 35 statuses, but its visual gate was **explicitly unaccepted** after post-run full-bounds review found own/auditor heading overflow. This is not the accepted final visual run. | Preview PID 73924 / runner 73806 / port 63412. |
| `webappx-browser-payroll-OlwijH/report.json` | Freeze 3; 2026-10-16 00:00:56.439–00:01:30.132 UTC. **Final standalone pass:** 21 checks, all 35 expected statuses observed, strict full-bounds/hit checks and grayscale witnesses verified. | Preview PID 92456 / runner 92415 / port 63929. |

The third run prompted the writer-wrapper repair. Its auditor attempt used the
writer-only route; denial was correct. The harness moved to the existing
permitted `/hr/demo/admin/payroll/history` route without widening authorization.
The fifth run prompted the two further grid containment repairs and stronger
full-bounds assertions. These failures, repairs and source freezes are retained
as distinct observations.

### Final standalone evidence

OlwijH used the named `webappx-portal-smoke-v1` seed, SHA-256
`ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02`.
Its exact manifest verifies 130 runtime files, fourteen harness files and 184
artifact bindings against freeze 3. The six fresh contexts were `legacy-eight`,
`native-A`, `fractional-F`, `platform-faults`, `scoped-M` and `declared-imports`.
The verification companion independently confirmed both owned PIDs absent and
no listener on the owned port after completion.

| Observed scope | Final standalone evidence |
| --- | --- |
| Original regression journey | The eight unchanged payroll checks still reach `MOCK-PAYROLL-0006`: 17.75 hours, gross 532.50, illustrative withholding 106.50, benefits 25.00 and net 401.00. Reloaded own statements and exact consumed-input refusal preserve the original records. |
| Native closure | Complete exact-window inventory, unapproved/unconsumed rows and nonidentical submitted overlaps are exercised. Two exact-window native submissions close together with two immutable anchors in history order. Inclusive closed-window entry operations and wider/narrower/touching preparation refuse; adjacent October 16 time and open-period preparation succeed. |
| Existing prepared pointer | A natively reached wider pending pointer survives closure byte-for-byte, is visibly stale and has its three later ordinary stages disabled. |
| Cumulative corrections | An open original corrects before closure. Later positive, downward, benefits-only and manually entered withholding targets yield four separate literal events, signed deltas, original/previous/proposed links, no-op refusal and exact control sequence six without rewriting original/history/paid inputs. Two employees have independent adjustment chains. |
| Fractional original | Actual returned/editable 0.125 + 0.125 hour rows at 30.04 produce 751 cents, not 752. The separate correction's gross/withholding/benefit/net deltas are +249 / −50 / 0 / +299 cents; both frozen fractional inputs and history remain exact. |
| Legacy and strict import boundaries | Qualified periodless known-date originals correct with an explicit September 30 date and unknown period. Unknown consumed dates and four unsupported receipt spellings remain readable/exportable without actionable choices. Known-date periodless overlap and an unrelated ordinary adjustment-namespace collision refuse. Fifteen independently authored malformed present-control imports refuse the whole replacement without changing accepted memory or raw slots. |
| Dirty, stale and authority behavior | Actual all-field errors, exact raw decimals, Keep, Escape, role refusal and a mounted rate-change stale preview retain raw input and accepted records. Hidden writer actions remain denied; HR admin has no writer controls, payroll admin remains a native writer. |
| Scoped output | Own views contain only the selected employee's original/correction money and no other employee's reason or amount in DOM/AX. Auditor output contains metadata only. Complete local backup capability remains disclosed. |
| Platform faults and recovery | Required import/Reset refuse before replacement when history writes fail, preserving complete memory/raw slots. Removing only the fault permits one exact pre-import checkpoint. Default-off Reset restores seed/control absence without altering other portals/history/preferences. Under quota fault one correction accepts once in memory, attempts one save, preserves prior raw save and shows a truthful memory-only warning without automatic retry. |
| Actual layout, keyboard and AX observations | At 390 × 844 and 20 px text, all 35 literal status meanings have full-bounds, uncovered hit samples and monochrome PNG witnesses. Visible control names, exact raw input retention, actual Tab/native-date focus and distinct multi-adjustment scopes were exercised; own/auditor DOM/AX boundaries were checked. Agent 0 also viewed the final own and auditor heading PNGs and confirmed bounded, wrapped headings. |

`webappx-payroll-browser-final-verification.json` records all 35 full-bounds and
uncovered checks true. The independent grayscale companion checked 35 captures /
853,723 pixels, zero pixels outside its grayscale tolerance of two, and all image
widths at most 390. That pixel check is distinct from Agent 0's visual review and
from browser AX/keyboard checks. No manual screen-reader or native Windows/device
observation is inferred.

## Fresh complete CI and separate Hosting preflight

The actual `npm run ci:all` command at
`42818dd7baf3d335f27c401c37d048bd842617fa` reached terminal exit 0. Its completed
receipt and log are independently bound by
`webappx-payroll-setup-ci-verification.json`: all 68 configured stages appeared
in the exact maintained order, no unknown stage classification, 3,736 passing
assertions and zero failing assertions. The log retains five case-sensitive
filesystem test skips on this macOS filesystem; this is not an all-platform run.
The production build and LAN production-isolation checks passed. The bundle-size
notice was nonfatal, and the audit command reported zero vulnerabilities at this
local checkpoint.

| Fresh full-CI observation | Actual result |
| --- | --- |
| Setup source contracts | 50 tests passed, including Lane A 24 + Lane B 11 + child-process source 15; earlier tool-only receipts are not relabeled as saved standalone TAP. |
| Maintained npm-name check | 153 documents / 1,261 examples passed at the committed implementation. |
| Fixture inventory | Eight reviewed groups / 30 public sources verified; no generator or Reset executed by the inventory. |
| Spaces/Unicode setup smoke | Two distinct owned copies, **693 files / 33,396,839 bytes each**, seven actual commands each, all fourteen exit 0. Both copies removed and source bytes preserved. These are fresh CI copy sizes, separate from the earlier 689-file observations. |
| Payroll and shared suites | HR 390; portal 192; maturity 79; safety 150 test entries passed. New payroll core, UI, integration, host and inspection suites are included by the maintained wiring. These are suite totals, not additional deduplicated payroll assertions. |
| Role and capability checks | Both generators/checks passed; 35 role + 23 gap tests passed against final source bindings. |
| CI and execution-plan contracts | Fourteen CI-planner tests and eight execution-plan tests passed. |
| Documentation links | 738 maintained files passed at the implementation commit. |
| Common browser suites | Fourteen actual reports passed: smoke 7, keyboard 10, foundation 10, state contract 13, lifecycles 12, portal lifecycle 20, recruiting 15, payroll 21, evaluators 25, maturity 13, safety 31, native quality 7, SDK quality 5 and recovery drill 8 — **197 common checks**. |
| Separate adoption/LAN rehearsals | HR-disabled adoption eight checks + LAN work-status six checks; total common browser and rehearsal checks **211**. |

The fresh full-CI payroll report is
`webappx-browser-payroll-GORDlT/report.json`, recorded
2026-10-16 00:12:34.648–00:13:28.386 UTC. It independently passed the same 21
groups and 35 expected statuses in six contexts. Its manifest verified all 130
runtime / fourteen harness / 184 artifact bindings and exact freeze-3 runtime.
All six contexts closed with traces; browser/server closure was recorded, and
preview PID 13713 / runner 13674 / port 49884 were independently confirmed absent
after completion. This is a fresh CI observation, separate from the preceding
OlwijH standalone run.

The independent audit checked all fourteen common browser child/runner PIDs and
listener ports after completion, in addition to report-reported browser closure.
The HR-disabled and LAN receipts retain less process identity: their terminal
success, available cleanup/source evidence and removed owned fixture are
recorded without inventing missing PID/port checks. The HR-disabled capture
contains 135 committed public files with six explicit adoption overrides,
excludes HR/Gusto runtime, and preserves the old HR/recovery slots unread. Its
eight rehearsal checks do not establish a downstream production adoption. The
SDK companion remains its separate fictional local API session and grants no
provider access. No remote GitHub Actions execution is claimed; the implementation
commit used `[skip ci]`, and this receipt describes the actual local command.

The separately executed `npm run deploy -- hosting --preflight` at the same
implementation revision also exited 0. It is **not** part of the 68 stages or the
211 browser/rehearsal checks. Its completed receipt and exact log hash were
independently checked. The tracked source tree was clean at preflight completion;
version **3.4.0** and deploy count **0** were retained. Changelog/commit, push and
deployment were explicitly skipped. This is a build/readiness observation, not a
production Hosting deployment or live-site verification.

Agent 0 accepted the twelve criteria only after both commands completed and the
independent CI audit passed. The completed commands examined the pre-acceptance
catalog at 122 done / 878 TODO. The subsequent 134 / 866 completion metadata,
three reviewed guide patches and final receipt/freshness/publication work are
later source changes; those document/catalog bytes are not claimed as part of
the completed CI or preflight.

## Evidence fingerprints

The following temporary artifact basenames identify the read local evidence;
they are not portable repository links or promised permanent downloads. This
receipt records hashes without embedding machine-specific temporary paths.

| Artifact basename | SHA-256 |
| --- | --- |
| `webappx-payroll-control-focused-4.log` | `7f0effd3461fb87a6206a44581e39658eb5bee4bbfc98b267d3c7d98f39d8fea` |
| `webappx-payroll-integrated-focused.log` | `dc89cbb03d33fe23a98d90798ab20c00f90fb1a4c6f45198498fe6f1707a14fa` |
| `webappx-payroll-host-focused.log` | `672b75415de904b7c4e94682b356886b963b81a9f8fab14799bbea23e7c6cc6f` |
| `webappx-payroll-setup-ci-plan-tests.log` | `fbcd4287018631a49ed5c68b2bf3ee5b020ac330074da145dea98e7470726881` |
| `webappx-payroll-plan-focused.log` | `63e3cc01c917755c7b238c029a446512f94e8aa30d9604002a858fae14fb931a` |
| `webappx-script-discovery.json` | `f4c572d149b05bf6c7cda7c2078c04fe0ed0a8b18f09087b05c9562c67f1181e` |
| `webappx-setup-docs-command-check.json` | `b587c91021dfc6fc48d7ffdeff6d47a02e3bd67a58696bab0ded37c56c2fd5a1` |
| `webappx-setup-D-E-evidence.json` | `14f1a1fca6a67f7090bb00fe1a53f009e350056df3790ed43d7daf67e06974ea` |
| `webappx-child-tests-final.log` | `b675f8b937a383b9ac4bacb72ba5d83e2d99ced083f33c94bdbc89a05a98962b` |
| `webappx-child-report-final.json` | `98a5f6841a275b8b2bdb9932bf8706453ff1a173990f76d5c5fc01fdb23f0d1c` |
| `webappx-setup-paths-sixth.log` | `0125ecfd99253e56fb93eb0464f475f9b1aa51299640fef2614a4b526695fa03` |
| `webappx-setup-starter-parity-complete.log` | `bed48ac6b11c19202279daaf10f752c61acbd920c37e83de1c2d42c89d733131` |
| `webappx-setup-starter-parity-current-report.json` | `f29ba146a07ae03257dc52bd0a46ed4fcfe93ed9d5d0359dce54d0a21d2f0585` |
| `webappx-setup-starter-parity-preservation.json` | `3a85c8642b4653cef520bf483c8602023a8a87bfef0cf42612bfd9f603c45c6e` |
| `webappx-payroll-control-independent-review.md` | `aaac279d190f093c07607bcba76596f4d95f99ada0c30d43c7c983eb293527ce` |
| `webappx-setup-source-independent-review.md` | `39768200d5c36d7a7f8d3130f750568c489cffe5cc925357443bf64e8fbbed11` |
| `webappx-starter-parity-independent-review.md` | `d543329d1628f211b79b4d85dcbf984ed631d9181253fd01f0b9680a1aaeb94b` |
| `webappx-setup-doc-context-rebind.json` | `aa2db583b7016acb514803f224ab3908c701e8c26ab281df5127b3440f2c2a43` |
| `webappx-browser-payroll-5tzadH/report.json` | `41e875f1edaf65bf04253f011a0321bb1b8ab7d73738fcdb1a12cd2ee995ac15` |
| `webappx-browser-payroll-5tzadH/payroll-control-manifest.json` | `d7949d771070646e599e35546d39f7eb237ae6ee05a39462f70431760aee3a8c` |
| `webappx-browser-payroll-gYwUq8/report.json` | `8d6cd49a8dc7a25707b2a02cf437d4b1d30f36771f980027af15f1d30706451c` |
| `webappx-browser-payroll-gYwUq8/payroll-control-manifest.json` | `d6cededbc9fd0bd049eb566433bab130c83ae95bf0899dc07102644e4d454c65` |
| `webappx-browser-payroll-owaboW/report.json` | `8ea8de16fe1fe77734afcced72185c2f9da6d19d205fa3fed2601102c2a3629b` |
| `webappx-browser-payroll-owaboW/payroll-control-manifest.json` | `c93521f6c553dbc0008d69d3d7092def9352592d2ccdd9587d97a6bf7e5e1967` |
| `webappx-browser-payroll-N2sZDf/report.json` | `b5600c50b8e4a6fe55837aa6ff2a6cf4838d5d9df7cf6480a0dc74b85f98c6c1` |
| `webappx-browser-payroll-N2sZDf/payroll-control-manifest.json` | `072e2c50efdc17b1e31c17115c4836f55d596ca5c530f171fa5bbb5d4048d529` |
| `webappx-browser-payroll-I4o6Hd/report.json` | `c5ba9ed80f47a4d22b626c433b7c73aee36fe9106d519020a08e08b5bf9e2a59` |
| `webappx-browser-payroll-I4o6Hd/payroll-control-manifest.json` | `b3240502a7cc1600cbe334e7a70cb988b94f91e221dc66b613cfbce7ac8397f6` |
| `webappx-browser-payroll-OlwijH/report.json` | `89a5cb84faa26110982f5ddd12c6d918632d90523d1b3390a41fde451d786398` |
| `webappx-browser-payroll-OlwijH/payroll-control-manifest.json` | `73bdb63ea32d3fcc70d5078b3c862e1aa598841ede99786178e0baa5e6fceda5` |
| `webappx-payroll-browser-freeze3-run6.log` | `7762d835c9f720a80589129e932d5c8ebe5b069a8db3669536b70a12941c0331` |
| `webappx-payroll-browser-final-verification.json` | `10c503d2266aa9693589e0e3230b4a34a7a21d6acc286f8ddfc59fa7b5ec073f` |
| `webappx-payroll-browser-grayscale-verification.json` | `04fdbc180b1b366aeb4e3549e05fd695c3a15349a9f30ff29222c46c2f8732f3` |
| `webappx-payroll-browser-run-history.json` | `5b053ce9d5c81329fc31f23f475d91db13411845d3a1412b2319380f2ed3b5cc` |
| `webappx-payroll-source-binding-freeze-3-proof.json` | `c8462dc90bc872cb0c4418620081606176d0c529c9c03ecb562359a3368e45c5` |
| `webappx-payroll-source-binding-independent-review.md` | `313c55d04614365b5fc8ddd67e4f3a141a43c6bad5249117880c189b0dff053b` |
| `webappx-payroll-prior-guides-freshness-review.md` | `1fc3aad37b837f9cd1f1040d8d5c369550f22878f3f18f861fc400c226684875` |
| `webappx-payroll-setup-integrated-source.json` | `66090875faea1474d3922189868cfb93443b0d3a66678027278c9874dd562e8d` |
| `webappx-payroll-setup-ci-completed.json` | `87fab5e1b4b7dc2517176d556011386dc588bac4ee6d195ba7930119c92eb0e1` |
| `webappx-payroll-setup-ci-all-68.log` | `8f7ae01d91b918d3f6b06f6125ad7baab0b2498bebac5f7aef1ce3a7fa733635` |
| `webappx-browser-payroll-GORDlT/report.json` | `9e9407541b0d6bbb929119f31e20567f35641f50867ade5317f34fba4f2c0621` |
| `webappx-browser-payroll-GORDlT/payroll-control-manifest.json` | `05df1a81c7f38dcb8bd58f0158a4e130f5467f17a670676df34fae975217030e` |
| `webappx-payroll-setup-ci-verification.json` | `c861abdf21cf790704eec2a5c32ce79b5deb28096b1fff855cbaac3275d7e222` |
| `webappx-payroll-setup-preflight-completed.json` | `b7fee6f38b1b53f899ba05ec878eabb3801c67b327234389e150decdaa0532c5` |
| `webappx-payroll-setup-hosting-preflight.log` | `398e6a1a435afcacdb71c8c0de8e612b0839fe8bf8e40e73939488f2feb0f4c0` |

## Final gates and follow-up boundary

| Required conclusion | Actual result / remaining scope |
| --- | --- |
| Final standalone payroll browser and visual/AX/keyboard evidence | **Passed:** OlwijH, 21 groups / 35 statuses / six contexts at freeze 3; final own/auditor heading PNGs viewed by Agent 0. All prior diagnostics retained. |
| Exact implementation/runtime/harness/artifact verification | **Passed:** committed `42818dd7baf3d335f27c401c37d048bd842617fa`, 130-source freeze 3 and independently verified source/manifests. |
| Mandatory complete CI, preserving prior stages | **Passed:** actual local terminal exit 0; independent audit confirms 68/68 stages, 3,736 passing assertions / zero failures and 211 browser/rehearsal checks. |
| Separate Hosting preflight | **Passed:** actual terminal exit 0, same implementation source, version 3.4.0 / deploy count 0. No deployment or push performed. |
| Original-criterion acceptance | **Accepted by Agent 0:** exact twelve original IDs on 2026-10-15; catalog now 134 done / 866 TODO. Definitions/dependencies unchanged. |
| Later receipt/catalog/guide checks, freshness mapping and publication | **PENDING separate metadata follow-up:** changes made after the completed source commands require their own focused checks and publication. No rerun or push is inferred here. |

No provider, credential, real tax calculation, funding, filing, live Hosting,
operator/business, native Windows/device or manual screen-reader result is
inferred from these local checks. Preview roles and scoped DTOs remain fictional
local boundaries, with complete local exports explicitly disclosed.
