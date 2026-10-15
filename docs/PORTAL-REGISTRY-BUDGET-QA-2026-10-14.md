# Portal registry and restore storage-budget verification — 2026-10-14

This update starts from clean WebAppX `main` at
`a9e78672d707e198dc10193972b17a76958abeb5`, verified against direct GitHub
`main`. Agent 0 reviewed and accepted the local implementation of **WX-0051**
and **WX-0451**. The catalog keeps its original 1,000 IDs and source baseline;
two items are complete and 998 remain, including 164 P1 items. Completion
metadata points here and records the reviewed source base and date.

## Delivered behavior

- The pure TypeScript [portal registry](../src/portals/registry.ts) defines
  HR/CMS/CRM IDs, navigation labels, paths, directory descriptions, workflows,
  roles and display metadata. Directory cards, shared navigation, portal
  crosslinks, backup labels, allowed module lists and root portal routing use
  it. HR matches only its root or slash-delimited descendants; CMS/CRM use their
  existing exact routes. HR continues to dispatch the isolated SDK demo before
  native workflows; SDK state is excluded from native workspace backups.
- Combined selective restore and Undo now show each selected incoming browser
  save, its configured limit, selected total, new automatic restore-point size,
  current compact history, projected history after retention, retained point
  count and older points removed. **Refresh storage preview** rereads history.
- Preview and confirmation share serialization and retention preparation.
  Preview performs no browser writes or quota probes and reserves no space.
  Confirmation rereads persisted history and selected raw slots, checks again,
  and requires successful saves before replacing in-memory state. Existing
  reverse rollback and explicit uncertain-recovery reporting remain in place.
- Sizes are JavaScript serialized character counts, including save envelopes.
  Each portal save and recovery history have a 2,000,000-character cap; history
  also retains at most five points. Current history is normalized compact JSON,
  including its 31-character empty envelope. Actual browser quota, storage
  encoding, other origin data and cross-tab changes are not measured.

## Browser evidence

Testing used the in-app browser against an isolated loopback Vite origin with
Firebase, provider access and local session integrations disabled. All records
were fictional. Browser tests ran on October 14 Pacific time (October 15 UTC).
The existing user preview and its saved workspaces were preserved.

| Check | Observed result |
| --- | --- |
| Registry navigation | Directory cards and HR/CMS/CRM shared navigation and crosslinks opened their named workspaces; nested HR payroll remained available. `/hr/demo-other` returned the normal 404. |
| Empty and changed selection | Nothing was selected automatically; Restore stayed disabled until selection. Per-portal rows and totals changed with HR-only, CMS+CRM and all-three selections. |
| Preview and Cancel | Complete JSON exports before and after preview/cancellation had identical `workspaces` payloads; no recovery point was created. |
| HR-only restore | Exported HR exactly matched the incoming seed while CMS and CRM exactly matched their previous destination payloads. |
| HR Undo and refresh | Undo recovered the complete original destination payload, created a pre-Undo point, and both history points survived browser refresh. |
| CMS+CRM restore and Undo | Both selected portals restored together while HR remained equal to its previous payload; paired Undo succeeded. |
| All-three restore | Restored all three portals with a selected total of 7,073 serialized characters and retained five points. A separate clean test origin restored the distinct destination backup, survived refresh, and exported complete payloads exactly equal to the imported backup. |
| Confirmed history parity | The next preview's current history matched the preceding projected size: 4,748 → 9,525 → 12,486 → 15,048 → 22,602 → 24,994 characters. |
| Five-point retention | The sixth restore preview reported five retained points and one removed; confirmation retained exactly five. Refreshing the preview preserved the projection. |
| Oversized automatic point | A valid CMS save of 1,994,127 characters imported successfully. An attempted subsequent all-three restore of a small 7,073-character incoming payload projected a 2,000,440-character automatic point and 2,000,471-character history, exceeding the history cap even after pruning. The reason appeared and Restore was disabled. |
| Blocked restore preservation | Complete exports before and after the oversized preview/cancellation had identical `workspaces` payloads. Existing history remained at five points. |
| Console | No application errors were observed; the expected unset Firebase configuration warning explained that production services were disabled. |

The over-budget fixture was derived from a real exported seed and imported
through the ordinary file chooser. No browser storage injection, quota override
or runtime-state mutation was used. Export comparisons ignored only the outer
export timestamp and compared each complete native workspace payload.

## Automated and source review evidence

- **114 portal tests** pass, including six registry tests and 12 new budget
  tests. Budget cases cover exact preview/write parity, one/several/all portal
  scopes, no writes/probes/mutation, count and character retention, oversized
  plans, invalid graphs/selection/history, fixed-length runtime ID parity,
  Undo scope resolution, and actual write failure with rollback.
- **13 catalog tests** cover stable IDs, generated Markdown/CSV parity and
  completion metadata validation. `done` requires a real date, a full reviewed
  source base, an existing repository evidence file and an allowed reviewer;
  `todo` items cannot carry completion metadata.
- Independent source review found no actionable correctness, regression or
  data-loss findings in the assigned registry, preview and restore code. This
  review did not claim browser, device, provider or deployment acceptance.

## Publication checks

- `npm run ci:all` passed: 13 catalog cases; 235 shared SYSTEMX cases (five
  filesystem-specific skips); 36 host integration cases; eight security
  operations cases; 11 app/LAN cases; 116 HR cases; and 114 portal cases.
- Template seed/integrity checks, immutable release and research fingerprints,
  SYSTEMX validation, lint, TypeScript, Markdown links, security/auth/AI checks,
  root and optional backend dependency audits, production build and LAN
  isolation passed. Both dependency audits reported zero vulnerabilities.
- `npm run deploy -- hosting --preflight` passed. It skipped changelog/version
  mutation, commit, push and deployment. Version is 3.4.0/deployment count zero.
- `npm run sync:system:check` passed with no drift. The standalone live
  `systemx:upstream:check` preview verified public main
  `3fb59429c878268f1081ca255a1f32fafc5dcfba`, alpha.6, identical complete source
  trees and no additions or bootstrap replacements; no import was applied.
- Wiki preview rendered 58 pages and the five expected page updates, preserving
  existing wiki-only pages/history. Source and wiki publication references and
  final remote parity are reported in the delivery handoff.

These results establish local source and mock behavior. They do not establish
provider activation, available browser quota on other profiles/devices,
production deployment or operational payroll/CRM/CMS acceptance.

The selected manual SYSTEMX pin remains `1.9.0-alpha.6`; immutable releases,
import provenance, both research packages and blank reusable execution seeds
are preserved. The app version remains 3.4.0 with deployment count zero.
