# Session controls, portal contracts and evidence review — 2026-10-15

Examined working-tree implementation based on WebAppX main
`4ca558015a66c4f7b9f50eb085f98ab62c1c8335`. This is the recorded starting
source base, not an assertion that the new implementation exists in that
unchanged commit. The publication commit contains this receipt and its source.
Local execution host: macOS Apple Silicon, Node 25.8.1, npm 11.11.0.

## Original acceptance and implementation

| Proposal | Original acceptance scope | Examined implementation |
| --- | --- | --- |
| WX-0007 | Request a fixed loopback host/port; receive an actionable occupied-port error without silently changing origin. | Session argument/environment parsing fixes an explicitly selected origin. Port planning finishes before children or runtime writes, preserves the occupied listener, and uses strict Vite binding. |
| WX-0008 | Supervisor prints exact scheme, host and port owning mock saves, and links the portal directory. | Initial summary and usable-app notification print the explicit HTTP origin and `/portals`; local session metadata retains the same values. |
| WX-0009 | Inspect owned processes and proposed replacement listeners before restarting a supervised session. | Read-only restart preview inspects process birth/parent/command/CWD evidence and TCP listeners, classifies proposed listener availability, and refuses unknown ownership. It prints a bounded launch intent without signaling, binding or editing runtime files. |
| WX-0010 | Distinguish usable Vite from individual emulator readiness and component-specific failures. | Independent app/LAN/Auth/Firestore/Storage states report named endpoints, bounded probes, timeouts and child exits. Storage reports listener reachability explicitly; it does not claim an authenticated workflow test. |
| WX-0060 | Document which forms, timers and selections survive portal switching and which clear after selected restore. | [Portal state contract](PORTAL-STATE-CONTRACT.md) records actual HR subpage unmounting, CMS/CRM mounted UI, saved HR identity, selected root remounts, Undo, Reset and refresh. |
| WX-0501 | Map current synthetic HR/CMS/CRM roles to read/create/approve/publish/export without treating them as Firebase claims. | [Capability matrix](PORTAL-CAPABILITIES.md) maps all 15 roles, field/ownership/workflow limits and complete role-agnostic mock exports. It makes no production authorization claim. |
| WX-0601 | Inventory saved HR drafts, CRM contacts, CMS publications, restore snapshots and excluded transient inputs. | The state contract inventories the four readable browser slots, all retained categories, character limits, history retention, failed-save memory exports and separate SDK exclusion. |
| WX-0805 | Document supported Node/npm, locked clean-checkout installation and separate Gusto backend installation. | [Dependency guide](DEPENDENCY-INSTALLATION.md) checks app/starter Node 24.22.0 and npm 11.11.0 declarations, `npm ci` behavior, separate Functions Node 22 engine/lock and optional adapter commands. This is documentation acceptance; this wave did not reinstall dependencies or execute Node 24/22. |
| WX-0854 | Attach examined revision and scoped local/browser/provider/operator evidence without turning historical evidence into current completion. | [Review index](BACKLOG-EVIDENCE.md) and validator retain examined versus observation revisions, original dates, scope and limitations; prohibit completion/status fields; provide read-only queries and escaped Markdown output. Actual examples have two local and one browser reference, with zero invented provider/operator observations. |

The generated checklist remains a view of the canonical JSON catalog. The
execution plan covers every stable ID and now links the review index. Bounded
`backlog:ready` output omits the full waiting graph; full summary/graph modes
retain their diagnostic context. No command infers completion from an attachment.

Agent 0 accepted the nine local criteria above after focused execution and
source review, then regenerated the checklist, CSV and execution plan. The
catalog contains **1,000 entries: 33 done and 967 remaining**. Remaining
priorities are **137 P1, 673 P2 and 157 P3**; remaining gates are **799 local,
128 operator and 40 provider**. No original acceptance text or dependency was
changed in this wave. The complete catalog goal remains active.

## Local checks and corrections

The session tests use injected children, synthetic HTTP/TCP listeners and
temporary copied LAN fixtures. They do not start real Firebase emulators or
stop an existing developer listener. Review found and corrected Windows
relative-launch provenance, absolute HTTP probe deadlines, and process-query
errors being mistaken for exited processes. The supervised LAN child no longer
overwrites or clears the supervisor's origin/readiness record.

The adjacent stop control now uses the same fresh ownership evidence, signals
only a verified supervisor (or self-owned standalone LAN), and preserves state
on refusal or signal failure. Runtime cleanup rejects real-path/symlink escapes.
Combined Windows Stop refuses forced termination and cleanup, including when
recorded PIDs appear exited, because descendant termination is not established;
it gives owning-terminal Ctrl+C and inspection guidance. Windows standalone LAN
termination retains state until a later exit check. The final independent source
review had no unresolved finding.

`npm run systemx:session:test` passed **42 tests**: **22 supervisor** and
**20 preview/ownership/stop** cases, zero failed or skipped. A live temporary
fixture verifies that preview and refused Stop preserve the process, listener,
session record, token and runtime config bytes. After failed-query semantics
were corrected, its unrealistic out-of-range PID stand-ins were replaced with
confirmed absent valid PIDs. The fixture also copies the LAN server's new helper
dependency. No user session was signaled by these checks.

The evidence index passed **15 tests**, including malformed revisions/dates,
unknown proposals, forbidden status fields, portable path rejection, symlink
escape rejection, special Markdown filenames and byte-preserving CLI queries.
Independent review prompted full destination encoding for special filenames and
a Windows symlink-permission fixture adjustment. Its final narrow review had no
remaining finding. The actual WX-0717 example retains the earlier browser source
base and pending WX-0708 prerequisite; neither status is changed by this index.

The execution planner passed **8 tests**, including the bounded ready output
and unchanged catalog/blank-seed bytes. The CI planner passed **13 tests** and
describes **38 actual stages**, with zero unknown command classifications.
The existing HR and portal model suites passed **116** and **121** cases during
the capability review. Runtime declarations, template preservation and host
drift checks also passed during focused integration.

## Native portal browser evidence

`npm run browser:state-contract` adds eleven authored Chromium checks:

1. Fresh complete seed exports without creating workspace/history saves.
2. Saved HR draft time and employee identity, canceled live timer and cleared
   route-local time inputs on portal switching.
3. CMS/CRM mounted unsaved fields, filters, identity and tab retention, with
   unsaved inputs excluded from persisted envelopes.
4. Actual combined download containing saved draft time, CMS draft/publication
   and CRM contact records, excluding temporary UI and recovery history.
5. CMS-only restore clearing selected UI and preserving exact HR/CRM saves and
   unchecked CRM fields; the recovery point contains only the prior CMS records.
6. CRM-only restore clearing its UI and retaining an unchecked CMS form.
7. Undo restoring captured CMS records and creating its own recovery point.
8. Refresh preserving exact saved workspace/history bytes and clearing UI state.
9. HR-only restore capturing its full prior records and restoring saved identity.
10. Reset preserving history/downloads, followed by clearing only history.
11. Denied-storage fixture retaining accepted changes in memory across portal
    switches/export, then opening fictional seeds after refresh.

An independent integration run failed after eight checks because the restore
helper interacted after preview visibility but before the passive heading-focus
effect finished. The preserved screenshot showed a closed preview; that run
had no trace, so it does not establish the exact misdirected pointer event.
The suite now awaits the actual focused preview heading, matching the existing
keyboard suite's readiness boundary. It uses no sleeps, forced clicks or retries.
The corrected wired command and a separate root integration run each passed
**11 checks**, with both owned resources closed. Native and denied-storage
contexts now retain traces for future review.
No application defect was established by that timing failure.

Ordinary record changes use rendered controls and real downloads. Storage and
exported JSON are read as evidence; no normal state is injected. The separate
denied-storage context deliberately changes the platform storage getter only.
No provider/backend/external request, console error or uncaught exception was
observed. The expected missing-Firebase warning remains visible.

Reports, screenshots, traces and downloaded samples remain in local temporary
artifact directories. They are not copied into reusable project records.

## Integrated release gates

The final implementation passed **`npm run ci:all`**, exit 0, through all
**38 required stages**. This included the 42 session cases, 15 evidence-index
cases, eight planner cases, 13 CI-plan cases, 116 HR cases and 121 portal cases.
The unchanged managed suite ran 235 tests with its five existing filesystem
skips; the host integration suite passed 36 tests and security controls passed
eight. Registry audits reported zero vulnerabilities.

All four authored browser suites passed in the integrated run:

| Suite | Checks | Owned browser/server cleanup |
| --- | ---: | --- |
| Native portal smoke | 7 | Both closed |
| Keyboard onboarding/recovery | 9 | Both closed |
| Portal foundations | 9 | Both closed |
| Saved/transient state contract | 11 | Both closed |

**`npm run deploy -- hosting --preflight` passed**, exit 0. Its log explicitly
skipped changelog/commit, push and deployment, and retained app 3.4.0 / deploy
count 0. Final `sync:system:check`, `template:check`, `backlog:check`,
`backlog:plan:check`, whitespace and documentation checks passed. The maintained
link checker covered 733 README/SYSTEMX/wiki files; a separate host-doc scan
checked 42 Markdown files and 1,331 local file links with zero missing targets.
These link results check file targets, without claiming anchor validation.

The native wiki preview rendered 58 pages and proposed five updated pages.
Agent 0 publishes source and wiki after these gates, without force-pushing or
deploying Hosting. Exact publication revisions are reported after direct remote
verification; this receipt does not substitute a local check for publication.

## Acceptance boundaries

This wave supplies local source/documentation, synthetic session and isolated
Chromium evidence. Windows command/schema fixtures are injected on macOS;
Windows x64/ARM64 runtime execution remains separate. It establishes no real
emulator workflow, Node 24/22 execution, provider access, production deployment,
screen-reader or whole-site accessibility acceptance.

The selected managed release remains 1.9.0-alpha.6. Immutable snapshots,
research inventories and blank reusable SYSTEMX context/plan/task/memory records
remain intact. Host-owned tools and documentation are the changed SYSTEMX scope.
WebAppX remains 3.4.0 with deploy count 0; source/wiki publication is separate
from Hosting deployment. The full 1,000-item goal remains active.
