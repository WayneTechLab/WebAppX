# Portal safety, recovery and display QA — 2026-10-15

**Agent 0 accepted all 14 original local criteria after independent review.**
The canonical catalog now records **91 done / 909 remaining**: **82 P1, 670 P2
and 157 P3**, with **742 local, 127 operator and 40 provider** gates remaining.
Original acceptance definitions and dependencies are unchanged. The all-1,000
goal remains active. Full integrated CI and Hosting preflight remain pending;
local acceptance does not establish publication or production acceptance.

## Starting source and frozen runtime

Implementation started from public main
`532cc4ad63d18a4fe911b0a9b18e258b85ef3416`, verified clean and equal to direct
GitHub main before edits. This is the starting base, not a claim that the new
application existed there. Environment: macOS Apple Silicon, Node 25.8.1,
npm 11.11.0 and Python 3.14.5.

| Runtime record | Exact SHA-256 and scope |
| --- | --- |
| Native runtime freeze | `e62175eabb14b744bb8e5dfc2ce288ea438414b5d4f5834b01a6916790b54926`; manifest of all 93 application source files before final native browser runs |
| Final runtime freeze | `1642bd7bbeacf1c4150b3579f66b9eebbf9941fe9848e37b8fbcf278dc16199d`; final manifest of the same 93 application source files, verified against current source |
| Sole application-source exception between those freezes | `src/hr/gusto/GustoSdkPreview.tsx`: `f23c83b15c170227ebb5d1970880d8c54c30865dbc19ccd971905a44da7df2a5` → `2997c3af94e9d89225ee670c439241de5b65adf68c75cc5cf198c16f495978cd`; supported SDK receipt translations now state fictional processing without a provider-partnership claim |

The other 92 application files remain byte-identical between the freezes.
The SDK exception was separately reviewed and verified by the final SDK report.
The local mock receipt endpoint and its tests are also part of this wave's
examined source; they are outside the 93-file `src/` manifest. The manifests do
not claim to hash the complete repository, browser binaries or generated docs.
Source bindings retain their supplied-baseline qualification and hash modes.

The owned verification worker uses `watch: null` and `hmr: false` with its
owned connection/error WebSocket retained. This prevents unrelated generated
files and Tailwind updates from replacing a measured DOM during frozen-source
verification. The passing final reports observed no mid-run page reload.
These runs verify frozen source; they do not test ordinary development hot reload.

## Original criteria and accepted evidence

The [implementation plan](PORTAL-SAFETY-IMPLEMENTATION-PLAN.md) retains the
assignment and original scope. All rows below were accepted locally by Agent 0.

| ID | Original outcome | Examined and executed evidence |
| --- | --- | --- |
| WX-0059 | Keep editing or discard unsaved forms without intercepting a completed save | Shared synchronous form registrations plus final safety navigation checks across HR/CMS/CRM, hidden retained owners, exact accepted-action baselines, failed validation and disclosed Back/Forward fallback; foundation and state-contract regressions also pass. |
| WX-0285 | Visible restored-revision comparison with explicit reload/reapply | Same numeric revision with different restored content, only edited-field reapplication, unchanged frozen publication, read-only actor refusal, missing record, repeated replacement and no write until ordinary Save; pure recovery cases and final safety browser proof. |
| WX-0455 | Independently enabled destination capture before individual import, refusing required-capture failure | Default-off and enabled settings, write-free module-only preview, exact capture kind/scope/label, cross-page changed-setting refusal and denied-history-write preservation in the final safety report; ordered writes/rollback covered by model cases. |
| WX-0456 | Independently enabled previewed capture before Reset with documented default behavior | Separate Reset preference, preview/Keep/Confirm, exact pre-Reset capture, failed required capture refusing seed acceptance, stale preview refusal and known-off one-click Reset; existing history and unrelated portal bytes preserved. |
| WX-0459 | Inspect changed CMS revisions/publication before whole-module replacement | Current/target draft, approval and frozen-publication projections, revisions and allowed reviewer/receipt metadata; final safety restore and reverse Undo use the same bounded comparison engine. |
| WX-0460 | Inspect changed CRM companies, contacts, lead states and opportunities | Current/target ownership, relationship IDs, lead states and opportunity stages; hidden free text still changes record comparison without being displayed; actual selection/restore/Undo preserves unchecked HR. |
| WX-0655 | Detect ambiguous visible selectors with hidden modules mounted | Nine native accessible-name scenes, semantic entity scopes and zero unresolved ambiguities; negative fixtures reject duplicate imports/actions, absent status badges and hidden UUIDs used to conceal otherwise identical scopes. |
| WX-0720 | Status meanings remain understandable without color | All 151 native meanings and 44 selected SDK meanings have actual product text/shape witnesses in retained monochrome evidence, plus safety and drill branches. Independent visual review is clear; rare render fixtures are identified separately from performed transitions. |
| WX-0722 | Existing x-large text retains forms and recovery controls | Actual Extra large preference at 390 × 844 and computed 20px root text; HR/CMS/CRM edits, Tab/Enter, all individual import confirmations, selective restore and Undo; full independent exports and exact saved envelopes checked. |
| WX-0756 | Preserve exports, explicitly discard unusable history and verify saves without claiming repair | Ordered [damaged-history guidance](PORTAL-RECOVERY-FAILURE-DRILL.md), final drill export-before-clear, refused restore, explicit history-only removal and independent current/save/export checks after reload. |
| WX-0757 | Worked uncertain-slot example with memory export before reload and per-portal verification | The drill records the exact partial-write/rollback sequence and mixed slot outcomes, keeps old memory open, downloads a rescue file before reload, and verifies each portal independently after recovery. |
| WX-0775 | Execute a local drill for bad import, unavailable storage, failed restore and portable recovery | Eight final drill checks cover all four conditions with complete expected records, real downloads and exact unaffected bytes. Storage faults are isolated harness fixtures. |
| WX-0847 | Launch an owned loopback preview, retain its handle and clean up only that process | Real forked Node child with recorded runner/child PID, strict allocated loopback port, bounded shutdown and exact-handle cleanup; 25 runner/seed/process tests include sentinel preservation, startup/assertion failure and interruption during cleanup. Every final browser report records the owned child's exit. |
| WX-0860 | Populated fictional adopted fixture preserves ledgers/configuration through reviewed imports | The actual importer applies retained alpha.5 → alpha.6 snapshots twice in an owned temporary adopted fixture; 326 exact preserved fingerprints, all 20 fictional host paths and prior receipt preservation verified, with temporary fixture cleanup. |

## Current behavior and deliberate boundaries

### Unsaved navigation and CMS recovery

Registered groups own their current values and accepted baselines synchronously.
Successful in-memory actions clear only their completed group, including when
persistence is unavailable. Failed validation retains the group. Eligible
portal/directory moves offer **Leave and keep draft**; leaving the shell checks
hidden retained groups too. These are temporary inputs outside saves, exports
and restore points. Native unload warning requests remain a separate boundary.

All dirty Back/Forward decisions use the disclosed **current-history-slot
fallback**. Keep preserves the approved view and drafts; Discard opens the
requested URL in that slot. The fallback adds no history entry or forward
truncation, but Back/Forward entries can differ afterward. Clean traversal and
ordinary AppLink pushes remain normal. No exact-stack repair is promised;
the final driver issues no asynchronous repair/replay `History.go()` calls.

A dirty CMS author editor is the deliberate replacement-remount exception.
Individual import, selective restore and Undo preserve its exact raw text for
escaped baseline/restored/unsaved comparison. **Reload restored draft** discards
it; **Reapply unsaved text** requires the restored assigned author and existing
record, and reapplies only meaningfully changed fields. A stale token or second
replacement requires another review. Invalid reapplied values remain editable
with normal validation; ordinary **Save draft revision** is still required.
Choices themselves change no saved revision, receipt or publication. Accepted
**Reset CMS samples** explicitly clears this volatile editor. Other selected
ordinary forms and timers keep their replacement clearing behavior.

### Checkpoints, inspection and recovery

Individual import and Reset preferences are independent, origin-local and off
by default. They are outside portable backups and captured workspace payloads.
Unknown/damaged preferences refuse replacement. Every native individual import,
including default-off, binds its explicit reviewed confirmation; enabled Reset
also binds its preview. Current/target/settings/history changes invalidate that
confirmation before writes. Enabled replacement saves its required module-only
checkpoint first and accepts no replacement memory on failure. Exact affected
history/save bytes are rolled back where possible; uncertain rollback explicitly
requires keeping the page open and exporting memory before reload.

Known-off Reset retains the existing one-click behavior: fresh seed acceptance
and temporary UI clearing can succeed even when old save removal fails, with a
warning that the old save may return after refresh. Reset preserves existing
history. Manual capture and rename write history only. Inspection/differences
are pure reads with bounded metadata and exact omission counts; actual restore
and Undo remain separate confirmed whole-module replacements.

Read the [state contract](PORTAL-STATE-CONTRACT.md),
[capability vocabulary](PORTAL-CAPABILITIES.md),
[safety wiki guide](../wiki/Portal-Safety-and-Recovery.md),
[recovery drill](PORTAL-RECOVERY-FAILURE-DRILL.md) and
[status inventory](PORTAL-STATUS-INVENTORY.md) for the detailed scopes.

## Focused model and source verification

| Check | Result and limit |
| --- | --- |
| Current safety/model/auditor collection | **143/143 passed**, including final navigation fallback and SDK auditor regressions; model/source evidence is separate from browser rendering. |
| Owned preview process, seed and runner collection | **25/25 passed**, including actual separate-PID listener cleanup and an unrelated sentinel. |
| Reviewed role and capability examples | **56/56 passed**: 34 role and 22 capability cases; 37 role/43 gap source bindings, seven role projections, 18 literal transitions and 33 SDK mappings retain their explicit review rules. Both generated guides pass current checks. |
| Selected SDK mock API | **12/12 passed**, including the actual published client and independently authored complete fictional receipt response. |
| Import rehearsal | **Passed**: real importer applied twice; 326 preserved, one expected installation-selection change, 220 expected additions and zero missing fingerprints. Returned path examples are paginated (25 of 326); aggregate checks cover the complete selection. No live adopted records or network public-main observation were used. |

The importer fixture retains both immutable release snapshots and their exact
manifest fingerprints. Its Git commits are explicitly synthetic. Public source
snapshots, reusable blank seeds, project-specific fictional ledgers/configuration
and the first receipt remain unchanged. No real adopted app was copied or changed.

## Final actual browser evidence

Run identities below name retained artifact directories containing `report.json`,
traces/screenshots and real downloads. Local machine-specific parent paths stay
outside this public receipt. All six reports are **passed**, with both owned
browser and preview closed; each child exited with code 0.

| Suite | Final retained run | Passing checks / recorded scope | Owned child PID |
| --- | --- | --- | --- |
| Safety | `webappx-browser-safety-bCJkZi` | **30**; forms/history decisions, CMS recovery, checkpoints and structured differences; 12 SHA-bound grayscale scenes | 70139 |
| Recovery drill | `webappx-browser-recovery-drill-vnuB92` | **8**; invalid files, unavailable storage, uncertain rollback, rescue download/recovery and damaged history; three bounded guidance scenes plus full contexts | 41631 |
| Foundation regressions | `webappx-browser-foundation-SPhWEu` | **10**; route recovery, retained navigation, in-page focus and directory save summaries | 79123 |
| State-contract regressions | `webappx-browser-state-contract-iXLphQ` | **13**; complete exports, selected replacement/remount exceptions, Reset/history isolation and memory-only storage | 79124 |
| Native visual quality | `webappx-browser-quality-aQTfwQ` | **6 groups**; 151 expected meanings, 157 observations in 35 families, 244 grayscale PNGs and seven contact sheets; nine accessible-name scenes with zero unresolved ambiguity | 16427 |
| Selected SDK visual quality | `webappx-browser-sdk-quality-UbyehP` | **5 groups**; all 44 meanings in 11 families, 88 grayscale captures; 44 uncovered text witnesses across 138 hit-test samples | 16106 |

Native quality manifest SHA-256:
`0fe4c7a72289b38dacb9ab3f9b2017d0e1b3f1bdc29d12b228903ac49e9426a2`.
SDK quality manifest SHA-256:
`55badd6795064af4661a7ef23561ff1efdc768c2903f163a71a9a183ea790f0b`.

Independent visual review inspected the native contact sheets and bounded
witnesses, **all 44 final SDK witnesses**, all 12 safety scenes and all three
recovery guidance scenes, with no remaining actionable issue. A read-only pixel
check found no non-gray pixels in all 244 native, 88 SDK and 12 safety images.
The two legacy-history decision-dialog images are byte-identical with matching
stable text and full capture dimensions; the same visible disclosure applies to
both decisions.

The native quality interactions use the actual accessibility preference and
normal controls. Rare-state snapshots pass the strict import validators and
render actual product components; they are explicitly labeled **render
fixtures**, not proof that a person performed those transitions. Actual exported
notice/budget/inspection components are used for bounded fixture variants.
Storage faults and delayed/refused SDK responses belong only to isolated
harness contexts. No model-injected application state substitutes for ordinary
form/recovery actions. The SDK ledger is separate from native saved workspaces;
its final report verifies absent native workspace slots and exact unrelated
storage preservation after normal accessibility initialization.

### Actual SDK receipt repair and failure evidence

A diagnostic SDK run exposed a real unsupported receipt GET returning HTTP 501.
The mock now provides the exact submitted-payroll receipt through the actual
published SDK client, with an independent complete fictional wire fixture and
strict method/query/stage checks. The selected receipt UI uses supported
translation overrides: it states no real wages, tax filing, transfer, licensed
processing or provider partnership. No real provider account or authority is
represented. The final SDK run opens the receipt and its tax/employee sections
and confirms viewing preserves the submitted local state.

Final refusal fixtures reconcile five exact expected HTTP 503 responses and
one explicitly registered StrictMode session cancellation. They do not exempt
later same-endpoint errors. The final SDK report has no unexpected problems.
These are local API platform fixtures, not observed provider refusals.

Failed diagnostic artifacts remain preserved, including safety runs
`WCRvR3`, `ETWZv9`, `8W9Abm` and `fJ4dVu`, and SDK receipt run `rNTq7f`.
Their selector/timing, reload/transport and unsupported-receipt failures remain
failed records; later passing identities above supply current evidence without
overwriting or relabeling them. Earlier preliminary/diagnostic reports are not
promoted to final acceptance evidence.

## Independent review findings and repairs

- CRM accepted baselines previously read old React render state. Synchronous
  current refs now cover decisions; accepting one form preserves other dirty
  groups, and a newly created company becomes a clean contact default without
  erasing entered name/email.
- Required import/Reset confirmation previously reloaded settings without
  binding the visible promise. Exact reviewed facts now prevent another page
  from disabling a required checkpoint behind an existing preview.
- Closing a recruiting job previously could silently rebind an unsaved
  candidate. A candidate-scoped decision protects that change.
- CMS Reload/feedback focus needed visible conditional fallbacks. Retained
  feedback remains locally editable/discardable after approval; hidden-owner
  activation returns to the correct supported route before consumer focus.
- Navigation review reproduced foreign/stale markers, legacy multi-step and
  delayed in-flight traversal races. The final disclosed current-slot fallback
  removes repair/replay movement instead of promising an exact stack repair.
- Old volatile-slot subscribers could repopulate exited sessions. Slot bindings
  now isolate the old session map. Dialog closure precedes destination focus;
  retained-owner query/hash stays tied to its supported route.
- Preview interruption during cleanup could be reported passed. Cleanup now
  finishes owned resources and propagates the original abort with process identity.
  Frozen verification disables source watching/HMR while retaining its own socket.
- Quality review rejected record titles as status badges, hidden UUIDs as
  accessible scopes, and incomplete status witnesses. Final ledgers, strict
  negative fixtures, text hit-test witnesses and visual review cover those cases.
- SDK receipt inspection exposed the HTTP 501 and real partnership wording.
  The exact fictional response and explicit mock copy are now independently
  checked through the selected genuine SDK components.

## Integrated publication gates

| Required gate | Current status |
| --- | --- |
| Implementation commit and full configured **61-stage** `npm run ci:all` | **Pending Agent 0's implementation-commit run.** A source-derived plan describes stages; it executes no gate. |
| `npm run deploy -- hosting --preflight` | **Pending Agent 0.** No production deployment was requested or performed by this receipt. |
| Final drift/template/identity/publication checks | **Pending Agent 0's integration record.** |

PENDING_CURRENT_SAFETY_GATES

## Evidence limits

All accepted criteria above are local source/fictional-workspace criteria.
The runner owns its preview children, allocated loopback listeners and fresh
browser contexts; it does not borrow user tabs, cookies or unrelated listeners.
Importer fixtures and fault injections are explicitly isolated. Browser storage
is readable by its user; preview roles and complete backups do not provide
trusted tenant or field authorization.

This receipt establishes no provider connection, credentials, payroll/funding,
tax/legal acceptance, live deployment, adopted-app operational acceptance,
native Windows runtime result, manual screen-reader acceptance or accessibility
conformance certification. WX-0656 remains outside automated acceptance.
Historical receipts retain their original dates, source bases and boundaries.
