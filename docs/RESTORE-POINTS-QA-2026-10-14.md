# Automatic restore points and Undo — 2026-10-14

This WebAppX 3.4.0 follow-up starts from
`38d31a3e312f11050f5b6175aec3145afeb3c5a8`. It adds persistent automatic
restore points and explicit Undo for combined selective restores across HR, CMS
and CRM. The [combined-backup receipt](COMBINED-BACKUP-QA-2026-10-14.md) describes
the preceding revision and retains its original scope. Browser work ran on
October 14 in America/Los_Angeles, October 15 in UTC.

## Recovery contract

Before replacing selected workspaces, the coordinator saves a validated,
detached copy of those portals' current domain state at
`webappx.demo.restore-points`. It reads the existing history and all selected
browser-save bytes before writing anything. History is written first, followed
by selected saves; the provider adopts those states only after all writes succeed.
Unselected portal saves and temporary forms are preserved.

Each point records its ID, canonical UTC creation time, operation, exact portal
scope and complete selected snapshots. Undo previews current/recovery summaries
and explicitly warns that later saved edits will be replaced. Confirming Undo
creates another point before applying the original point's scope, allowing the
Undo itself to be reversed. No record merge is performed.

The origin-local history survives refresh and retains the newest five points
within 2,000,000 serialized characters, pruning the oldest as needed. A new point
that cannot fit or be saved blocks the restore before workspace writes. Corrupt
or unsupported history also blocks restore/Undo until explicitly cleared.
**Clear restore points** requires a second confirmation and removes history only.

History and selected save writes use synchronous rollback attempts. localStorage
has no multi-key transaction or cross-tab locking. If rollback itself fails, the
helper identifies uncertain browser slots, keeps the current in-memory states,
and instructs the user to export before refreshing. These checks do not establish
power-loss atomicity or concurrent-tab merge behavior.

Points contain readable fictional domain data, including private mock drafts and
receipts. They exclude unsaved form fields, running timers and the separate SDK
session; portable JSON exports exclude history. Individual imports, Reset and
ordinary edits do not create points. A point captures current domain memory,
which may include actions whose previous normal save failed. Recovering an
original fixture creates a valid browser save rather than recreating a missing
storage key. Use fictional information only.

## Browser observations

The in-app browser tested the local Vite app using an isolated localhost storage
origin. Numeric-loopback saved workspaces were preserved separately. No Firebase
configuration, Gusto credentials or account was used. The original exported
dataset A included one HR payroll receipt, two CMS actions, and three CRM
companies/leads/opportunities. Dataset B used the original fixtures: no submitted
payroll receipts, no CMS actions, and two CRM companies/leads/opportunities.

| Check | Observed result |
| --- | --- |
| First automatic point | Restoring HR from A into B created one HR-only point containing B's HR state. Exported HR matched A exactly; CMS and CRM matched B exactly. |
| Undo preview | Displayed the timestamp, HR scope, current one-receipt summary and recovery zero-receipt summary, with explicit whole-workspace/later-edit warning. |
| Cancel Undo | All three exported workspace graphs matched the pre-cancel snapshot; history stayed at one point. |
| HR Undo | HR returned to B; complete CMS and CRM payloads remained B. A new Before Undo point appeared. |
| Unselected temporary form | An unsaved CMS title survived HR Undo without becoming a saved CMS record. |
| Refresh recovery | Reload retained both points and their scope; the latest point remained usable. |
| Undo of HR Undo | Recovered the prior HR restore exactly, with CMS and CRM still equal to B. |
| CMS and CRM restore | Restored both selected portals from A; HR retained its complete prior state. The new point listed only CMS and CRM and contained their B records. |
| Later saved edit | Saved a new CMS draft revision after that restore. Undo recovered B's CMS/CRM; undoing the new Before Undo point recovered the later CMS edit and the A CRM graph exactly. |
| All three portals | Restored B across HR/CMS/CRM, refreshed, then recovered the entire prior three-portal state using the persisted point. Every exported value matched its expected snapshot. |
| History retention | Additional operations held the list at five points; older HR points disappeared while newer scoped points remained. |
| Cancel clearing | Keep restore points dismissed the confirmation and retained the five points. |
| Clear and refresh | Confirm clear restore points produced empty history after refresh. All three exported workspace payloads exactly matched the state before clearing. |
| New history after clearing | A subsequent all-portal restore and Undo created two usable points again. Refresh restore points reloaded them. |
| JSON compatibility | Real combined downloads retained the same format/version and contained exactly the three workspace graphs, without restore history. |
| Console | No application errors appeared; the expected warning stated Firebase remained disabled without configuration. |

Comparisons parsed actual browser-downloaded JSON and compared every value in
`workspaces`, excluding only the envelope's changing export timestamp. File
selection, checkboxes, edits, confirmations, cancellation, exports and refreshes
used the browser UI. This is local evidence from one browser environment, not a
cross-browser/device certification or provider acceptance result.

## Automated verification

- `npm run portals:test`: **96 passed**, including **17 new restore-point cases**
  and the existing 13 low-level selective-restore cases.
- New coverage includes detached selected snapshots, refresh loading, exact Undo
  scope, Undo of Undo, count/size pruning, newest-point refusal, corrupt history,
  explicit clearing, denied reads, history-write failure before portal writes,
  partial portal-write rollback, uncertain rollback slots, input validation and
  serialization failures. Individually valid portal saves whose combined point
  exceeds the history budget are also refused without writes.
- Storage quota, corruption and rollback faults use controlled storage doubles;
  browser permissions or real profile storage were not changed to inject faults.
- TypeScript and scoped ESLint passed. An independent bounded source review
  found no actionable correctness or data-loss defects.

## Repository publication gates

- `npm run ci:all` passed: **116 HR + 96 portal/storage/backup tests**
  (**212 total**), 235 shared SYSTEMX cases (five filesystem-specific skips),
  30 host integration cases, eight security operations cases and 11 app/LAN cases.
- Lint, TypeScript, reusable-template/import/research checks, immutable managed
  integrity, SYSTEMX drift, security/auth/AI checks, documentation links, production
  build and LAN isolation passed. Root and optional HR backend audits reported
  zero vulnerabilities.
- `npm run deploy -- hosting --preflight` passed and skipped version/changelog/Git
  mutation, push and deployment. Version remains 3.4.0 with deployment count zero.
- Wiki preview rendered 57 pages with the five intended page updates while
  preserving other pages and wiki history.

Immutable managed releases, research fingerprints and reusable blank seeds are
preserved. These are local mock verification and source-publication checks;
live provider and production deployment acceptance are separate.
