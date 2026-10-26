# LAN Navigator QA receipt — 2026-10-25

**Status:** locally accepted bounded Navigator slice. Final dependency candidate
`dcca2b7300464a4df9a41460959ab907b9c58968` passed **16 Navigator browser groups**, **19 npm tests**,
all **68 CI stages with terminal exit 0**, and separate **Hosting preflight exit 0**.
Agent 0 confirmed independent review. App 3.4.0 retains deployment count 0;
production deployment was skipped. Source/wiki publication is a separate receipt.

**Source baseline:** WebAppX `e73aa4fddba5dbc4f6b853750af9fb482266bba4`, with a
local Navigator increment. The baseline commit does not contain the increment.
The file fingerprints below identify the accepted fourth frozen runtime,
reproduced unchanged in the final dependency candidate. Publication is separate.

## Scope and behavior

The change retains the existing LAN shell, structure rail, center Vite preview,
right inspector, responsive controls, and guarded source APIs. It extends
read-only orientation within one live preview document:

- Bounded hierarchy discovery beyond the former ten-immediate-child view.
- Expansion/collapse independent of selection and unrelated DOM updates.
- Search by tag, ID, class, explicit name, or component metadata, including
  `#id` and `.class` forms; no bulk descendant text or input-value search.
- Selection shared by canvas, Navigator, breadcrumb, Settings, and Components.
- Ancestor breadcrumb selection, selected-path reveal, and off-screen scroll
  when the target has an available rendered box.
- ARIA tree rows, roving focus, local arrow/Home/End handling, and explicit
  Enter/Space selection that retains tree focus.
- Current-document/connected-target checks and debounced live DOM refresh.
- Labeled hidden/inert metadata and honest unavailable reveal without changing
  app visibility, hierarchy, or app focus.

Selected leaf-text editing continues through the existing explicit preview,
revert, and confirmation-gated source-save flow. Selection labels use a bounded
leaf fallback; they do not aggregate a selected container's descendant text or
name form controls from their contents.

A full iframe reload may safely clear selection while the application remounts;
automatic anchor restoration is not an acceptance guarantee. The operator can
select the current target again. A stale object from the previous document must
never be used to select a different current element.

## Bounds and evidence limits

| Surface | Bound and behavior |
| --- | --- |
| Traversal | At most 1,500 examined nodes and 40 descendant levels below Body. Excluded executable/document metadata nodes do not enter the tree. |
| Metadata | First 500 raw characters per searchable attribute, clipped before whitespace normalization. Oversized metadata is disclosed. |
| Search | 160 query characters; the first 120 inspected matches include their ancestor paths. Literal matching uses only the permitted metadata. |
| Rendered view | At most 500 rows. Truncation is explicit; a zero-match result over an incomplete scan is described as incomplete. |
| Selection | The actual element must be connected and belong to the current preview document's Body. Detached or old iframe references cannot select a replacement by index or label. |
| Reveal | Scrolls an available rendered target. Hidden/inert or unrendered targets stay inspectable and receive an unavailable message; no app visibility or hierarchy mutation occurs. |

The tree is runtime DOM inspection. It does not establish a canonical
DesignerDocument, stable source identity, discovery of unmounted routes or
closed shadow roots, cross-origin iframe access, drag/reorder, structural source
editing, undo/redo, token/cascade provenance, or production readiness. Existing
source/API/session controls are preserved and remain separate from navigation.

## Fourth frozen source fingerprints

SHA-256 values were captured after the two narrow pre-review repairs (preserve
collapsed branches on unrelated DOM refresh and avoid container/form-content
aggregation in selection labels), the leaf-indicator repair, and removal of an
existing CSS rule that blocked ordinary iframe clicks in Interact mode while
the right inspector was open. Disclosure clicks toggle branches; clicking a
leaf's dot selects the leaf normally. Interact mode must allow actual product
links and controls even when an inspector remains open.

| Repository-relative file | SHA-256 |
| --- | --- |
| `.SYSTEMX/LAN/Website/dashboard.js` | `86f9e47af76a180b8072ba1d82ab2d16828f69a0eea7a68341906f54ba35e052` |
| `.SYSTEMX/LAN/Website/dashboard.css` | `acfa35f8df79c76a16660b43a6fda05bd85bb8b18232a066dca9f4510623adc7` |
| `.SYSTEMX/LAN/Website_Dashboard.html` | `d5f20ea40eb3c7df0f78d0c8fa00afb25527aa022a7e375c5eef8403aa98964e` |
| `.SYSTEMX/LAN/Website/preview-navigator.js` | `76ede06eb1be383d9b86b9ebd09a131a6baca48f57493088af8218e97082ce78` |
| `.SYSTEMX/LAN/tests/preview-navigator.test.mjs` | `0726e4ff9bb291c9cb732866870a2a636bdbb297867a352eb35adc605c481303` |

## Verification recorded so far

| Check | Observed result | Boundary |
| --- | --- | --- |
| `node --test .SYSTEMX/LAN/tests/preview-navigator.test.mjs` | 8 passed, 0 failed after the last repair. | Pure model fixtures: hierarchy width/expansion, metadata-only search, hidden/inert inheritance, excluded nodes, budgets, stale scope, and DOM replacement/reparenting. This does not verify browser layout or event behavior. |
| `node --check .SYSTEMX/LAN/Website/dashboard.js` and model syntax check | Passed after the last repair. | Syntax only. |
| Targeted ESLint with `--max-warnings=0` for dashboard, model, and focused test | Passed after the last repair. | Static lint only. |
| First browser attempt | Partial run retained; its route-picker assertion expected a legacy label that differed from the actual existing UI. It is not a passing suite or acceptance receipt. | First frozen implementation, before the two review repairs. |
| Second rendered browser attempt | Failed after 10 completed checks because its reload assertion required automatic About-heading selection restoration. The accepted contract permits safe clear/reselection instead. The retained result records no page errors, read-only requests, preserved protected bytes, and matching before/after second-freeze hashes. | Partial evidence on the second frozen source; not final acceptance. Its completed checks include preserved branch collapse and poisoned-container privacy. |
| Third rendered browser attempt | Failed after 12 completed checks when a genuine About-page link click was blocked in Interact mode with Settings open. The blocking `pointer-events: none` CSS rule was removed for the fourth freeze. | Actual UX defect; layout and other focus rules were preserved. The final rendered retest below passed. |
| Final rendered browser run | Passed all 16 groups against the fourth frozen runtime fingerprints. The result records 734 GET requests, zero page errors or refused requests, all 685 protected source/model files unchanged, and matching before/after runtime hashes. | Actual Home/About journeys and isolated DOM fixtures, with no source/provider write. The final artifact is `webappx-navigator-browser-FRaeCR`. |
| Independent integration review | Agent 0 confirmed approval of the bounded read-only capability after the final result. The leaf-indicator finding was repaired and tested. | Supports `lan.live-dom-navigator` only; planned kernel/authoring features remain planned. |
| Final aggregate CI and Hosting preflight | All 68 ordered CI stages passed with outer terminal exit 0 on the final dependency candidate; separate Hosting preflight exited 0. | Includes template, managed integrity/host drift, research checksums, both required dependency audits, production build and LAN isolation. Deployment skipped. |

The browser test source is
[navigator-browser.mjs](../.SYSTEMX/LAN/tests/navigator-browser.mjs); the focused
model test is
[preview-navigator.test.mjs](../.SYSTEMX/LAN/tests/preview-navigator.test.mjs).
Browser screenshots, result JSON, source-fingerprint comparisons, and exact
retained evidence locations come from the actual browser run. No result or
artifact has been inferred from source presence or a worker's intention.

The first complete fourth-freeze report ran from `2026-10-26T05:56:05.345Z` through
`2026-10-26T05:56:14.868Z` (2026-10-25 in America/Los_Angeles). Its retained
artifact is `webappx-navigator-browser-FRaeCR`, containing:

- `result.json`, `protected-before.json`, and `protected-after.json`.
- `01-actual-home-three-panels.png`, `02-fixture-beyond-ten.png`,
  `03-fixture-breadcrumbs-reveal.png`, `04-fixture-bounded-scan.png`, and
  `05-actual-home-final.png`.
- `trace.zip` for the full run.

The 16 groups include real Home heading selection; the 36th sibling and leaf
indicator; permitted metadata search and typing safety; ARIA tree navigation;
collapse persistence; poisoned-container privacy; breadcrumb and off-screen
reveal; hidden/inert/unrendered inspection; selected-node removal; actual page
picker and safe-clear About reload; native AppLink interaction with Settings
open and same-document route refresh; 1,700-node and 45-level budget fixtures;
and final preservation checks. Fixtures existed only in the owned browser's
iframe DOM. They were not persisted app content or local builder models.

The harness used a supplied, already owned loopback Vite/LAN session. It created
and closed its own Chromium/context, and did not start or stop application
processes. Non-read methods and external requests were refused by the harness
before dispatch; the passing run attempted neither. Same-origin Vite HMR
websockets were permitted. Source-save, production/provider mutation, and owner
acceptance were outside the browser proof.

The second attempt's retained evidence artifact is
`webappx-navigator-browser-UdanJd`: `result.json`,
`01-actual-home-three-panels.png`, `02-fixture-beyond-ten.png`,
`03-fixture-breadcrumbs-reveal.png`, `failure.png`, and `trace.zip`. Its result
is explicitly `failed`; the final passing report must remain a separate
artifact. Host-local absolute locations belong in the integration handoff,
rather than reusable template paths.

The third attempt's retained artifact is
`webappx-navigator-browser-6SaiS7`, with `result.json`, screenshots, and
`trace.zip`. It records 12 completed groups followed by the genuine Interact
click failure, 734 GET requests, no page errors or refused requests, and all
685 protected source/model files preserved. This is a failed attempt against
the preceding freeze, retained separately from the final repair proof.

## Integration environment and publication gates

The implementation is committed as
`84f718e8d4f2b75f664fedd86fb6ce070df347b5`, matching the four frozen runtime
fingerprints above. Browser execution originally observed the earlier base plus
those exact working files; it is not relabeled as an execution of a later commit.
Local checks used macOS Apple Silicon, Node 25.8.1, Python 3.14.5 and Java 21.
The template's Node 24.22.0 pins and native Windows acceptance boundaries remain.

- `npm test` passed 19 tests (the existing characterization/security tests and
  eight new Navigator model fixtures) in the named isolated checkout.
- `npm run ci:plan:test` passed 14 tests. Script names remain 134; the maintained
  CI runner still has 68 ordered gates.
- The prepublication full CI attempt passed gates 1–59 and stopped at gate 60,
  `browser:sdk-quality`. Its app never mounted because the SDK harness refused
  a Vite asset URL containing encoded spaces from borrowed dependency paths.
  The failed report has no SDK observations or mock API requests. It remains
  failed; gates 61–68 did not run in that attempt.
- Installed dependencies were copied into the isolated checkout without a
  download, lockfile change, test modification or request-filter exception.
  The unchanged standalone SDK suite then passed five workflow groups and
  all 44 expected status meanings. The source and test hashes are unchanged.
- `npm run deploy -- hosting --preflight` passed with terminal exit 0 on this
  implementation and review metadata. It skipped commit/push/deploy and retained
  app 3.4.0 with deployment count 0. Build output passed LAN production isolation.
- The environment-corrected full CI rerun passed gates 1–62, including all 15
  main browser suites (218 check entries) and the separate eight-check HR-disabled
  rehearsal. It stopped at gate 63 on a newly reported backend dependency audit
  finding. Its 226 combined browser/rehearsal checks do not establish full CI.
  Gates 64–68 did not run in that failed attempt. The dependency-corrected full
  rerun below passed all 68 stages with terminal exit 0.
- Documentation freshness source review at the implementation commit retained
  five affected guides with explicit rationales and preserved the 33-record
  decision prefix, for 38 total decisions. Original guide/receipt dates and
  source qualifications remain unchanged. This review performs no execution.

### Compatible dependency audit repairs

Current registry audits reported three affected package families. The root and
starter locks now resolve **Vite 8.1.6** and **Zod 4.6.6**. Vite's required
Rolldown/platform bindings, picomatch and OXC type updates accompany that fix.
The Gusto backend lock now resolves **body-parser 2.4.0** and its required
**qs 6.16.1**. Direct dependency specifications and all three package manifests
remain unchanged; no overrides, audit exceptions or provider configuration were
added. There are no package-record additions or removals.

The maintainer sources identify the fixed
[Vite backport](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22),
[Windows editor fix](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm),
[Zod collection validation fix](https://github.com/colinhacks/zod/pull/6652) and
[body-parser fix](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828).
All three lock audits reported **zero vulnerabilities** after the changes.
Installed root dependencies, the complete 68-stage CI pipeline and separate
Hosting preflight then passed. The required root and backend CI audits both
reported zero vulnerabilities. Registry audit results remain observations of the
retrieval date; they are not a claim of exhaustive security or deployed fixes.

The running local session uses an explicit fixed Vite origin so a restart
preserves the browser's mock-storage origin. Other projects' listeners are not
owned or stopped by this session. The separate local emulators establish no
provider account, production identity, payroll, deployment or Windows acceptance.

## Final dependency-candidate acceptance

The final complete CI command was `npm run ci:all` on committed source
`dcca2b7300464a4df9a41460959ab907b9c58968`. It completed all 68 maintained stages in order and
returned terminal exit 0. Its log is retained as
`webappx-lan-ci-all-2026-10-25-final-dependencies.log`; no earlier failed run
is converted into a pass. Only append-only documentation review metadata was
pending in the working tree; functional source and all lockfiles matched the
committed candidate throughout. Later README/wiki/receipt updates are metadata.

Independent report review counted **218 check entries across 15 main browser
gates**, all passed, plus the separate **eight-check HR-disabled adoption
rehearsal**. The combined 226 reported entries are not unique assertion counts.
The SDK suite observed all 44 expected status meanings with no missing or
unknown meanings. The 16 live Navigator groups below remain separate.

A fresh live Navigator run on that same commit and installed Vite 8.1.6/Zod
4.6.6 passed all 16 groups. Artifact `webappx-navigator-browser-1a7wgA`
records 734 browser GET requests plus four explicit GET probes, no browser
errors or refused/write requests, only same-origin Vite HMR, and all 685
protected fingerprints preserved. Its before/after aggregate is
`339451dd61ab4edb20a01f63c814de9ead3eb717592208dd9e3bbaf4394f62d2`.
The four Navigator runtime hashes match the fourth-freeze table above.

A separate fixture-free screenshot capture on the final dependency basis
shows the real Home heading selected from the `h1` query, with Navigator,
canvas, breadcrumbs, Settings and source mapping visible. Its screenshot is
`06-final-dependencies-home-selected-h1.png`, with `screenshot-only.json`
and `screenshot-trace.zip`. It passed with 162 browser GET requests, no errors
or refused requests, and preserved runtime/model bytes. It is not a second
count of the 16-group suite.

Separate Hosting preflight on this candidate returned exit 0 and skipped
version, changelog, commit, push and deployment. Its final build passed LAN
production isolation; the existing large-chunk advisory remains nonfatal.
Neither source publication nor these local checks establish production,
provider, native Windows or backend Node 22 runtime acceptance.

The final source-review report identifies six affected documentation guides
at this dependency candidate. Six explicit retain decisions preserve the prior
38-record prefix, for 44 total decisions. Original guide/receipt bytes, dates
and observation revisions remain intact. Review metadata does not repeat tests
or accept unrelated catalog work. The original checklist remains 179 done /
821 remaining, and the saved foundation bundle remains unapplied.

## Research and acceptance boundary

The [2026-10-25 Webflow research refresh](../.SYSTEMX/LAN/WEBFLOW-RESEARCH-2026-10-25.md)
links the current first-party workspace, Navigator, and keyboard documentation.
Hierarchy selection/reveal and selectable breadcrumbs inform this increment.
Navigator metadata search is a LAN requirement; this research did not establish
that Webflow's Navigator provides equivalent text search. No comparative
usability or performance claim is accepted without measurement.

The original research packages/checksums and managed release snapshots remain
untouched. This increment does not complete the planned kernel waves, accept
unrelated backlog items, apply the saved unfinished HR foundation, publish a
provider artifact, or authorize production deployment. The
[capability manifest](../.SYSTEMX/LAN/Builder/contracts/capability-manifest.json)
adds only `lan.live-dom-navigator`, backed by the focused `npm test` entry, the
final browser artifact, and Agent 0's independent review confirmation.
Publication still requires the repository's normal checks and explicit
production authorization.
