# Portal confirmation and Undo focus verification — 2026-10-15

Status: **full local integration passed; WX-0708 and WX-0717 accepted by Agent 0**.
This receipt follows the [published lifecycle checkpoint](PORTAL-LIFECYCLE-QA-2026-10-15.md).
It records a bounded test-only change and does not finish the 1,000-item goal.

## Original acceptance and dependency

The canonical definitions, source fields, priorities and gates are unchanged.

| ID | Exact original acceptance | Gate and dependency |
| --- | --- | --- |
| WX-0708 — Create a reversible-action confirmation pattern | Restore and destructive previews consistently show selected scope, effect and a clearly labeled cancel action. | P2 / foundation / local; no dependencies |
| WX-0717 — Add undo preview focus containment | Opening and canceling an Undo preview keeps keyboard navigation predictable and returns focus to its launching control. | P1 / portal-maturity / local; depends on WX-0708 |

Agent 0 accepted WX-0708 first, then its dependent WX-0717, after the current
full CI, preflight and independent evidence audit completed. Original definitions
and dependencies are unchanged; the test title bypasses no prerequisite.
The existing Undo preview is an inline region. The original acceptance does not
require converting it into a modal or introducing a modal keyboard trap.

## Source boundary and freeze

| Reference | Examined value |
| --- | --- |
| Published starting source | `7a582ed4a5396d54aa94e3ca780667d1b07f179e` |
| Committed three-file harness | `998674759f11e17765c6724edfe2dae3d1c58c5a` |
| Unchanged application runtime | 100 source files; no `src/` difference between those commits |
| Previously reviewed 100-file runtime freeze | `48fb5c3a1b0aeebbb6d52f982aa95c5689c9c26b1b9e325c8c39b0b4a99d4882` |

The targeted browser runs used the exact reviewed test bytes now committed at
`9986747`; the runs preceded that commit. No runtime, schema, package, fixture,
helper, provider configuration or managed SYSTEMX snapshot changed in this lane.

| Reviewed harness source | SHA-256 |
| --- | --- |
| `tests/browser/keyboard-restore.mjs` | `67dd3cf2dd15d1287af85e2c7a9814a8418872e52397b9de51729ae52fb46144` |
| `tests/browser/portal-quality.mjs` | `107c519ea2d93fb94eda281c0ef7a3ba4b6a3a02587fff9da581c7e28ee77f7e` |
| `tests/browser/portal-safety.mjs` | `b434ab37f99b7aedce8ea70ffd1699b936fb2d808d7e559e45df3a618421face` |

## Real actions and complete-record assertions

- Selective restore visibly names HR and CMS, whole-workspace replacement,
  automatic capture, preserved unchecked portals and **Cancel combined restore**.
- Undo visibly names its captured HR/CMS scope, replacement of later saved edits,
  preservation of other portals, a new recovery point and **Cancel undo**.
  Keyboard cancellation returns to the exact launching Undo control.
- The new history-clear case opens the real confirmation with Enter, verifies
  heading focus and the history-only effect, then traverses Confirm/Keep with
  forward and reverse Tab. Enter on **Keep restore points** closes the preview,
  resets its expanded state and returns focus to the exact Clear opener.
- Every native HR/CMS/CRM import previews a pinned seed payload that differs from
  its edited live records. Keyboard Cancel must remove Ready/Replace/Cancel
  controls and show exactly `Import canceled. Current workspace unchanged.`
- Enabled CRM Reset names its module, capture-before-reset effect, original-record
  restoration, removal of only CRM's save, excluded unsaved forms/timers and
  unchanged neighbors. **Keep CRM workspace** preserves the accepted records.

Expectations come from the pinned native seed and handwritten changes in
`tests/browser/seed-contract.mjs`, not application reducers. They compare full
HR/CMS/CRM exports, every raw workspace/history/preference byte and the complete
selected-only point. That point must have kind `restore`, scope `['hr', 'cms']`,
the complete original HR/CMS payloads, unchanged observed ID/UTC timestamp and no
extra fields. After history Keep, HR retains its added `goal-1`/`MOCK-PERF-0001`,
CMS retains article revision 2/`MOCK-CMS-0001` and its frozen seed publication,
and unchecked CRM remains the complete seed. No new receipt or point appears.

## Independent review and retained diagnostic

Initial review found a harness gap: canceled individual imports offered records
identical to live state, and preview disappearance was not asserted. A no-op
Cancel or mistaken identical replacement could pass. The correction uses a
distinct pinned seed candidate, asserts that distinction, then requires absent
preview controls and the exact canceled status before export/navigation.
Independent review cleared the frozen correction. No product defect was found.

`webappx-browser-quality-DFxDTT/report.json` is retained as a superseded diagnostic:
it passed seven checks before that correction, with browser/server cleanup true
and owned Vite PID 58577 / runner 58519 / port 56984 / exit 0. It is not the
authoritative quality result. No failing browser run occurred in this lane.

## Authoritative targeted browser evidence

Reports are local ephemeral artifacts under
`/var/folders/92/3f91k8_j5q9gv5cccdlmq7ph0000gn/T/`:

| Command / report path beneath that directory | Result | Owned Vite / runner / port | Cleanup |
| --- | --- | --- | --- |
| `npm run browser:keyboard` · `webappx-browser-keyboard-cwOBfd/report.json` | 10 checks passed | 56473 / 56363 / 56930; exit 0 | browserClosed/serverClosed true |
| `npm run browser:quality` · `webappx-browser-quality-fy0idm/report.json` | 7 checks passed | 71476 / 71437 / 57357; exit 0 | browserClosed/serverClosed true |
| `npm run browser:safety` · `webappx-browser-safety-Qr8VgD/report.json` | 31 checks passed | 80426 / 80367 / 57616; exit 0 | browserClosed/serverClosed true |

The keyboard report records 508 focus observations: 133 onboarding and 375 restore.
Its `restore/keyboard-clear-history-preview.png` was visually inspected and is
readable; `keyboard-clear-history-canceled.png`, focus observations and complete
downloads are retained alongside it. The existing quality audit also observed
its 151 inventoried status meanings; that is separate from the new criterion count.

## Verification status and limits

Focused harness units passed **39 distinct tests**. The 12 quality auditor tests
were rerun after correction; they are not 12 additional distinct tests. Focused
ESLint passed with zero warnings, and `git diff --check` passed. The subsequent
full `npm run ci:all` completed with terminal **exit 0** at
`998674759f11e17765c6724edfe2dae3d1c58c5a`. Independent audit matched all
**62 configured stages exactly once and in their committed order**, through the
final build and LAN production-isolation success. The log SHA-256 is
`5d486a5ded7920502b0ff86ce24149edbd6021f46b8f257a671eebfb40d8d8ff`.

| Current full-CI browser suite | Passed checks/groups | Report suffix |
| --- | ---: | --- |
| Smoke | 7 | `smoke-DJaqqJ` |
| Keyboard | 10 | `keyboard-1MITm0` |
| Foundation | 10 | `foundation-saTnMr` |
| State contract | 13 | `state-contract-Qx6qeO` |
| CMS/CRM lifecycles | 12 | `lifecycles-XvFVKC` |
| Portal lifecycle | 20 | `portal-lifecycle-uAd7Mn` |
| Payroll | 8 | `payroll-JCFc0W` |
| Evaluators | 25 | `evaluators-BTtXXd` |
| Maturity | 13 | `maturity-lt12bN` |
| Safety | 31 | `safety-kOQplV` |
| Quality | 7 | `quality-oaoBtj` |
| SDK quality | 5 | `sdk-quality-EfxKlq` |
| Recovery drill | 8 | `recovery-drill-1DEwvY` |
| Common subtotal | **169** | Thirteen passed receipts. |
| HR-disabled adoption | **8** | Source-bound committed allowlist. |
| Owned LAN work status | **6** | Separate preserved-source result. |
| Aggregate | **183** | Groups, not unique assertions or status meanings. |

All thirteen common reports record browser/server closure and owned child exit
0 without a signal. Independent inspection found all thirteen recorded PIDs
absent and ports without listeners. The HR-disabled receipt binds this exact
commit, 105 copied public files and manifest
`3399783fc63d6baf0e1a564516a89277f6e0f579174c24f7671ebdd8471a4e63`;
independent reconstruction matches. The LAN result records six checks, zero page
errors and preserved source-record bytes. Its embedded schema and the adoption
schema do not expose the common runner's child/cleanup fields; those fields are
not inferred for them. Common receipts do not embed a Git revision: attribution
uses this completed CI, observed HEAD and exact unchanged committed sources.

`npm run deploy -- hosting --preflight` also passed on this commit: typecheck,
lint, build and LAN isolation, with push and deploy skipped. Version remains
3.4.0 and deployment count 0. The build's large-chunk advisory remains visible;
the successful gate does not establish bundle-size optimization.

Only WX-0708/WX-0717 status/completion records changed after acceptance. The
prior 109 completions, all original definitions and root metadata remain exact.
Regenerated checklist, CSV and execution plan record **111 done / 889 TODO**:
**69 P1 / 664 P2 / 156 P3**, with **722 local / 127 operator / 40 provider**
gates remaining. The all-1,000 goal remains active. Recruiting implementation
in an isolated worktree supplies no additional acceptance in this checkpoint.

Final documentation, preservation and GitHub/wiki parity checks are maintained
separately from these runtime observations. Freshness comparisons use a
supported owned clone at this explicit committed source with byte-bound local
documents; the native primary `worktreeconfig` layout remains unsupported.
No checker limit or Git configuration is changed to bypass that refusal, and
historical receipts keep their original dates and source qualifications.

All observations use owned local Chromium contexts, fictional native records,
real rendered controls and real uploads/downloads. The keyboard lane uses Tab,
Enter and Space; native file-chooser assignment is its documented OS exception.
Existing safety faults and rare-state quality fixtures remain explicitly labeled.
No account, provider credential, production write or hosting deployment is
established. This is automated local evidence, not manual screen-reader,
other-browser, native Windows, provider or accessibility-certification acceptance.
