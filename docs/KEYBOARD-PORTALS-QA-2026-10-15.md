# Keyboard onboarding and selective recovery — 2026-10-15

This wave starts from clean WebAppX `main` at
`cae18da251b0a9c4418a4fbebf2bd514ccd2dcdd`, verified against direct GitHub
`main`. Agent 0 accepts **WX-0653** and **WX-0654** for the local synthetic
keyboard journeys below. Their existing named seed dependency **WX-0651**
remains complete. This receipt records the selected checklist scope.

## Run the authored browser journeys

```bash
npm ci
npm run browser:install
npm run browser:keyboard:test
npm run browser:keyboard
# Optional visible Chromium / local artifact parent:
npm run browser:keyboard -- --headed
npm run browser:keyboard -- --output /path/to/local/artifacts
```

The command reuses the smoke runner's owned positive loopback port, strict Vite
binding, separate temporary optimizer cache, blank client environment and fresh
Chromium contexts. It never uses an existing preview, browser profile, account,
Firebase emulator or Gusto SDK session. Unexpected backend/provider requests,
external WebSockets, browser errors and failed requests fail the run. Browser
installation remains an explicit setup step. Each journey receives a separate
fresh context and the reviewed `webappx-portal-smoke-v1` baseline, whose hash is:

```text
ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02
```

All application interaction uses real Tab/Shift+Tab, Enter/Space and keyboard
text entry. The shared driver reaches targets by Tab rather than forcing DOM
focus. It observes the actual focused element, `:focus-visible`, enabled and
visible state, viewport intersection and its computed outline/ring. Named
application-managed transitions must focus the exact expected target. Native
browser chrome can occur at the tab-order wrap boundary; every actual DOM target
encountered is checked. The driver does not assess visual contrast or occlusion.

Initial navigation and reload are test lifecycle operations. The native file
chooser is opened by Enter on Import; Playwright then supplies a reviewed
synthetic JSON file through the chooser API. OS-dialog keyboard operation is
outside these browser tests. No locator click/fill/check/direct-focus helpers,
DOM mutation, local-storage injection or reducer injection are used for the
journeys. DOM and saved-state reads are assertions only.

## Accepted browser results

The focused Chromium run passed **nine checks**, recording **110 onboarding
focus observations** and **266 selective restore/Undo focus observations**.
Both contexts used no account cookies. Only the expected missing Firebase
configuration warning appeared; no browser/request/backend/provider error was
observed. The report records `browserClosed: true` and `serverClosed: true`.

| Journey | Observed result |
| --- | --- |
| Required profile fields | Tab navigation opens Avery's employee profile. Empty required email is rejected by native validation and creates no domain save. Keyboard entry saves `avery.keyboard@fixture.invalid`. |
| Onboarding review and confirmation | Profile review, job review, required policy task, summary review and confirmation run with Enter/Space. Focus advances to the next required control as previous controls become disabled, then to the named completion status. Receipt is exactly `MOCK-ONBOARDING-0001`. |
| Onboarding persistence | Refresh restores the completed state. The entire HR saved envelope and an actual keyboard-triggered combined download match independently handwritten expected records. CMS, CRM and the original accessibility preference are unchanged. |
| Selective restore cancellation | Keyboard import, Space selection and forward/reverse Tab reach HR/CMS/CRM checkboxes. Cancel returns focus to Import and preserves every raw workspace/history byte and the complete exported baseline. |
| Selected-only restoration | A valid import deliberately changes all three portals. Selecting HR and CMS restores exactly those records and saves only their pre-restore states. Unchecked CRM remains the original complete state. |
| Undo cancellation | Opening Undo focuses its preview heading. Cancel returns to the exact originating Undo button and preserves raw saves, history and exported records. |
| Confirm Undo | Confirm restores the complete expected HR/CMS records, preserves CRM, saves a reversible selected-only point and returns focus to the exact originating Undo button. |
| Removed-opener fallback | Three additional keyboard HR restores fill history to five points. Undoing its oldest HR/CMS point removes that opener through normal retention; focus lands on the visible `Restore points & Undo` heading. All unselected records stay unchanged. |
| Recovery persistence | Reload preserves exact saved workspace/history bytes, the same five retained points and the complete expected combined export. |

Local evidence includes `report.json`, per-journey `focus-observations.json`,
traces, actual downloaded snapshots and screenshots. Onboarding screenshots show
the policy task, confirmation button and completion status with visible focus;
restore screenshots show the retained-history fallback heading. Agent 0 visually
inspected the confirmation and fallback screenshots. Runtime paths and trace
artifacts stay outside tracked template/release files.

## Implementation and review

Onboarding now advances focus only after successful local actions, using the
next required profile/job/checklist/summary/confirmation control and finally the
completion status. It does not move focus on mount or a rejected action.
Combined restore focuses its validated preview heading and returns to Import
when canceled or completed. Undo returns to its exact opener, falling back to
the history heading if retention removes or disables it. Clear-history
confirmation uses the same heading/opener pattern, although clearing history is
not part of these accepted browser journeys. Preview regions use normal Tab
navigation and do not claim modal-dialog keyboard behavior.

The first development run exposed a missing initial navigation in the restore
harness; a subsequent integration edit exposed a regex escaping error. Both
harness issues were corrected before acceptance. The final focused run exercised
all nine checks successfully. Independent source review found coherent focus
handoffs and full-record assertions, and prompted preservation of the original
assertion/evidence if artifact or tracing cleanup also fails.

The focused guard suite passed **11 tests**: visible outline/ring acceptance,
lost/hidden/disabled/offscreen/zero-size focus, missing or transparent indicators,
independent expected onboarding records and prohibited input/state-injection
helpers. The existing **16 seed/runner guard tests** also passed. These tests
supplement the actual browser journeys; they do not replace them.

## Checklist and publication gates

The catalog still contains exactly **1,000 records**. With **WX-0653/WX-0654**
accepted, it has **7 done and 993 TODOs**, including **160 P1, 675 P2 and 158 P3
TODOs**. Each new completion links this receipt and the reviewed source base.
JSON remains canonical; Markdown checkboxes and CSV are regenerated together.
All other proposal statuses retain their own acceptance requirements.

Final local publishing gates passed:

- **`npm run ci:all`** exited 0: real prerequisite report; 18 doctor, 16
  seed/runner, 11 keyboard guard, 13 catalog, 235 shared SYSTEMX (five
  filesystem-specific skips), 36 host integration, eight security operations,
  11 app/LAN, 116 HR and 114 portal cases. The integrated browser suites passed
  all seven smoke and nine keyboard checks. Both reports confirmed owned browser
  and server cleanup, and the keyboard run repeated 110/266 focus observations.
- Lint, typecheck, template/managed integrity, research inventories, local
  Markdown links, security/account/MFA/AI checks and production build/LAN
  isolation passed. Root and Gusto Functions dependency audits reported zero
  vulnerabilities at this check.
- **`npm run deploy -- hosting --preflight`** exited 0. It ran local gates/build,
  skipped version/changelog/Git/push/deployment actions and finished at version
  3.4.0, deployment count 0.
- **`npm run sync:system:check`** passed inside full CI and again after the final
  documentation edits; backlog validation, whitespace and all 733 Markdown-file
  link checks also passed. Native wiki publication is verified in
  the final Git handoff, using the repository's preserved-history sync command.

App version stays **3.4.0**, deployment count **0**, and the
selected immutable SYSTEMX release remains **1.9.0-alpha.6**. The current reviewed
public dotSYSTEMX main is `3fb59429c878268f1081ca255a1f32fafc5dcfba`; read-only
upstream preview found no additions or bootstrap replacements and retained the
original import receipt. Host documentation is updated; reusable context, plan,
task and memory seeds remain blank.

This is macOS Apple Silicon / Chromium local evidence for these two workflows.
It does not establish Windows/device, screen-reader, whole-site accessibility,
production deployment or Gusto/provider acceptance.
