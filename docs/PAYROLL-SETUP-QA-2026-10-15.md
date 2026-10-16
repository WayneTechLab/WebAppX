# Payroll controls and developer setup verification — 2026-10-15

Status: **PRE-ACCEPTANCE — focused local evidence recorded; final browser,
integrated CI, preflight and Agent 0 acceptance pending.** The canonical catalog
remains **122 done / 878 TODO**. All twelve original criteria below remain TODO.
This receipt does not accept twelve items or claim that the planned 68-stage CI
has run.

The published starting checkpoint is
`49a9efe345c815c2bead1cbbeb83204d31e64290`. Its previously accepted recruiting
wave and its 63-stage/198-browser observation retain their separate
[dated receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md). Those historical gates
are not payroll/setup verification. This wave's focused observations were made
against authorized working changes above that checkpoint, rather than executing
the unchanged published commit.

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
Neither payroll criterion depends on the other.

| ID and exact original title | Exact original acceptance | Current evidence / remaining boundary |
| --- | --- | --- |
| WX-0011 — Add a setup troubleshooting decision tree | A new developer can follow distinct instructions for dependency install, runtime mismatch, occupied port and emulator startup failures. | Authored setup/recovery instructions; source/example review. Final criterion review pending. |
| WX-0012 — Document recovery from an interrupted dependency install | The guide identifies which generated dependency paths can be rebuilt and preserves ignored environment and emulator state. | Authored rebuild/preservation procedure; no real interrupted installation or emulator recovery claimed. Final criterion review pending. |
| WX-0013 — Add a package-script discovery command | A read-only command lists maintained scripts by setup, app, portal, SYSTEMX, wiki and release purpose using the real manifest. | Lane A tests and actual 134-script discovery report; discovery does not execute listed scripts. |
| WX-0014 — Validate command examples against package scripts | A documentation check flags npm script names in maintained command examples that do not exist in the root manifest. | Lane A lexer/membership tests and maintained-document report; WX-0013 acceptance remains its prerequisite. |
| WX-0016 — Add a fixture seed inventory command | A read-only command lists fictional fixture sources and identifies which reset action restores each source. | Lane B tests and reviewed finite source/reset descriptors; no Reset, generator, model import or provider operation is performed by inventory. |
| WX-0019 — Report starter parity by feature group | The template check groups app, dependency, asset and configuration differences so a maintainer can locate the relevant starter drift. | 28 template tests, grouped actual report and independent source review; no automatic starter synchronization. |
| WX-0020 — Add a scaffold identity checklist | New-app adoption lists repository name, package name, site branding, deployment target and project records that require deliberate replacement. | Authored five-category adoption checklist; no private application adoption, repository creation or deployment claimed. |
| WX-0022 — Verify shell-free child process examples | A source check identifies new script call sites that build executable shell strings and points maintainers to argument-array examples. | 15 tests, actual finite AST report and independent inert parser probes; not complete security analysis or shell-script parsing. |
| WX-0023 — Add filenames-with-spaces setup coverage | A temporary-copy smoke run installs no services and verifies key setup commands from a repository path containing spaces. | Actual owned-copy macOS smoke: seven commands in the spaces context, preserved bytes and removed copy. |
| WX-0024 — Add non-ASCII project path coverage | Temporary-copy checks exercise project configuration and read-only status from a path containing Unicode characters. | Actual owned-copy macOS smoke: seven commands in the Unicode context, preserved bytes and removed copy. |
| WX-0159 — Add mock pay-period closure | Closing a submitted sample period prevents new entries from silently changing its frozen payroll totals. | Core, native guards, complete-codec, UI callback and host tests; successful final browser and integrated gates pending. |
| WX-0160 — Add fictional payroll correction runs | A correction references the original receipt and records a separate adjustment without rewriting submitted history. | Core cumulative-chain, immutable-history, scoped projection, UI callback and recovery tests; successful final browser and integrated gates pending. |

## Current source freeze

| Reference | Examined value |
| --- | --- |
| Published assignment basis | `49a9efe345c815c2bead1cbbeb83204d31e64290` |
| Current application runtime | 130 source files, freeze 2; working implementation, not a publication or acceptance claim |
| Exact-byte manifest | [payroll-control-runtime-2026-10-15.json](evidence/payroll-control-runtime-2026-10-15.json) |
| Freeze-2 manifest SHA-256 | `19225a46ac9d9aa778afa0b73417783b2452764b703ef728a0a5586056758a1d` |
| Receipt-author source check | All 130 listed files rehashed equal to that manifest while preparing this receipt |
| Final implementation commit / final browser source | **PENDING — Agent 0 to record after final verification** |

Runtime source hashing is exact bytes. Role/capability source-review bindings
have their own declared text/hash policies. A manifest identifies inspected
bytes; it supplies no browser, CI, provider or business acceptance by itself.

The preceding freeze 1 is preserved as
[payroll-control-runtime-freeze-1-2026-10-15.json](evidence/payroll-control-runtime-freeze-1-2026-10-15.json),
SHA-256 `cabec0c791e624e5e82cae717bcefb64e93ca01d555af81dd2e18eb84927842b`.
Comparing the two dictionaries identifies only
`src/hr/components/HrWorkspace.tsx` as changed. Agent 0 applied explicit
`min-w-0` / single-column grid containment after the third browser diagnostic's
real narrow-layout failure. Focused results below retain their pre-geometry
source scope; they are not relabeled as fresh freeze-2 observations. Final
browser and complete CI must examine the final runtime.

## Focused local observations

The following are local macOS observations. Saved logs were read directly for
this receipt; owner-reported tool receipts are explicitly identified. Counts in
different rows are test entries from their respective runs, not a deduplicated
assertion total or an integrated-CI result.

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
| Documentation npm-name check | Saved report: 152 documents / 1,261 references / zero diagnostics | `webappx-setup-docs-command-check.json`; snapshot before this QA receipt was added, so final maintained-doc check remains pending |

The fourteen path-smoke commands are seven per context: developer doctor,
script discovery, actual npm script discovery, fixture inventory, managed status,
configured offline doctor and documentation-command checking. The contexts were
named `WebAppX setup spaces` and `WebAppX Café 東京 setup`. Each copied 689
files / 33,319,574 bytes. The report records source/copy bytes, ignored fictional
sentinels and directory inventories preserved, the configured-check trap not
executed, and both owned copies removed. No install or service was performed.
This is macOS execution; Windows x64/ARM64 behavior remains unobserved here.

The starter report inventories 43 mapped public files across app (22), dependency
(2), asset (2) and configuration (17). The preservation companion records all 43
starter-file bytes and all 14 prior test bodies unchanged. Agent 0 deliberately
reviewed the root package-script/test-wiring change before rebinding its one
mapping fingerprint. Grouped reporting does not authorize copying or updating
the starter.

Lane A/B stdout was not saved independently. Their reported passing counts are
qualified tool receipts, with a durable integrated log still required. Lane B
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

## Preserved browser diagnostics — no final pass yet

The three runs below used the 130-file runtime freeze 1. They are
**failed overall diagnostic runs**, not acceptance receipts. Harness-selector
repairs were ongoing when this skeleton was written; no application defect is
established merely by those selector failures. Reports and earlier artifacts are
preserved rather than overwritten.

| Report basename | Actual recorded result | Resource cleanup |
| --- | --- | --- |
| `webappx-browser-payroll-5tzadH/report.json` | 2026-10-15 23:52:02.896–23:52:24.103 UTC; eight legacy checks passed; five new lanes failed on rate-control/closure-option/checkpoint-text harness expectations. Overall `failed`; status coverage 1 observed / 35 expected. | All six contexts closed with traces; browserClosed/serverClosed true. Preview PID 29188 / runner 29147 / port 62262; child exited 0, no signal. |
| `webappx-browser-payroll-gYwUq8/report.json` | 2026-10-15 23:53:23.312–23:53:38.737 UTC; eight legacy checks plus two storage-fault behaviors recorded, ten checks total. Four new lanes failed to locate the nested Correction reason control. Overall `failed`. | All six contexts closed with traces; browserClosed/serverClosed true. Preview PID 39047 / runner 39003 / port 62541; child exited 0, no signal. |
| `webappx-browser-payroll-owaboW/report.json` | 2026-10-15 23:54:30.135–23:54:50.893 UTC; eleven checks recorded, including the legacy eight, two storage-fault behaviors and actual 751-cent fractional closure/correction. Overall `failed`: narrow receipt control overflow, auditor-region expectation and a receipt-option wait. | All six contexts closed with traces; browserClosed/serverClosed true. Preview PID 47338 / runner 47299 / port 62752; child exited 0, no signal. |

The third run prompted the actual payroll-wrapper containment fix recorded in
freeze 2. Its auditor attempt used the writer-only route; the denied result was
correct, and the harness was changed to use the existing authorized
`/hr/demo/admin/payroll/history` route without widening role permissions. The
receipt-option wait remains a diagnostic at this checkpoint; later harness
repairs and a final run need their own results.

The legacy subset exercised the original `MOCK-PAYROLL-0006` receipt with 17.75
hours / gross 532.50 / illustrative withholding 106.50 / benefits 25.00 / net
401.00 and unchanged consumed inputs. It supplies regression observations only,
not completion of the new closure/correction criteria. The second report's
storage-fault checks observed required replacement refusal without memory
acceptance and one correction accepted in memory under a quota fault without an
automatic retry or durable-save claim. Their passed subsets do not turn any
overall failed run into a successful browser gate.

The reports use the named `webappx-portal-smoke-v1` seed, SHA-256
`ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02`.
Their manifests report 130 runtime / 14 harness bindings and 38/69/83 artifact
bindings respectively. The first manifest's runtime dictionary was compared
equal to preserved freeze 1 while preparing this receipt. These are local
Chromium diagnostics, with no provider/account, production, Windows/device or
manual screen-reader acceptance.

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
| `webappx-payroll-control-independent-review.md` | `600a4ecc13fb3464e8039ebebb5db7e8b014abf12d24b68996e8c99ca8de1723` |
| `webappx-setup-source-independent-review.md` | `39768200d5c36d7a7f8d3130f750568c489cffe5cc925357443bf64e8fbbed11` |
| `webappx-starter-parity-independent-review.md` | `d543329d1628f211b79b4d85dcbf984ed631d9181253fd01f0b9680a1aaeb94b` |
| `webappx-setup-doc-context-rebind.json` | `aa2db583b7016acb514803f224ab3908c701e8c26ab281df5127b3440f2c2a43` |
| `webappx-browser-payroll-5tzadH/report.json` | `41e875f1edaf65bf04253f011a0321bb1b8ab7d73738fcdb1a12cd2ee995ac15` |
| `webappx-browser-payroll-5tzadH/payroll-control-manifest.json` | `d7949d771070646e599e35546d39f7eb237ae6ee05a39462f70431760aee3a8c` |
| `webappx-browser-payroll-gYwUq8/report.json` | `8d6cd49a8dc7a25707b2a02cf437d4b1d30f36771f980027af15f1d30706451c` |
| `webappx-browser-payroll-gYwUq8/payroll-control-manifest.json` | `d6cededbc9fd0bd049eb566433bab130c83ae95bf0899dc07102644e4d454c65` |
| `webappx-browser-payroll-owaboW/report.json` | `8ea8de16fe1fe77734afcced72185c2f9da6d19d205fa3fed2601102c2a3629b` |
| `webappx-browser-payroll-owaboW/payroll-control-manifest.json` | `c93521f6c553dbc0008d69d3d7092def9352592d2ccdd9587d97a6bf7e5e1967` |

## Final gates — reserved for Agent 0

| Required conclusion | Status at this receipt checkpoint |
| --- | --- |
| Final standalone payroll browser run, full expected exports and actual visual/AX/keyboard review | **PENDING** |
| Final examined implementation revision and exact runtime/harness/artifact verification | **PENDING** |
| Mandatory complete 68-stage CI on the implementation commit, preserving prior stages | **PENDING — planned, not run** |
| Hosting preflight and deployed/live boundary | **PENDING preflight; no production deployment authorized or performed by this wave** |
| Final maintained documentation/example checks including this receipt | **PENDING** |
| Agent 0 original-criterion acceptance and resulting catalog counts | **PENDING — current catalog remains 122 done / 878 TODO** |

No provider, credential, tax, funding, filing, live Hosting, operator/device,
Windows or manual screen-reader result is inferred from these local checks.
Completing the twelve selected criteria would require Agent 0's evidence review
and acceptance; this skeleton records neither that decision nor a forecast count.
