# LAN source revision and delivery catalog QA — 2026-10-26

Status: implemented candidate; focused tests and rendered browser checks passed.
Aggregate CI, Hosting preflight and exact requirement acceptance are pending.
This receipt does not authorize production deployment.

## Delivery scope

The [execution plan](LAN-10000-EXECUTION-PLAN.md) and [checklist index](backlog/LAN-10000-TODO.md)
contain 100 authored families, 2,000 functional capabilities and 10,000 delivery
requirements. Each capability has five acceptance lanes: behavior, boundaries,
recovery, feedback and evidence. This is a requirements inventory, not a claim
that 10,000 independent features are implemented. Completion requires exact
requirement-definition and source-revision tuples in the public receipt and
validated progress ledger. Readiness queries never execute or authorize tasks.

The first source-editing batch targets 12 F001 capabilities: source revisions,
editor baselines, guarded preconditions, stale refusal, conflict draft retention,
changed content at the same path, leaf-save revision tracking, explicit reload,
format preservation, file switching, one-file scope feedback and transport
failure feedback. The other eight F001 capabilities remain proposed, as do the
remaining families. The original WebAppX catalog remains 179 done / 821 remaining;
the saved unfinished foundation bundle remains unapplied.

## Implemented contract

Allowlisted source GET responses include the SHA-256 of exact file bytes.
Confirmed source POST requests require `baseRevision`: missing revisions return
428, malformed revisions return 400, and stale revisions return 409 with
`currentRevision` and fixed reload guidance. A stale request is refused before
backup, temporary-file promotion, operation logging or the unchanged shortcut.
Success and unchanged responses include their source revision. Existing path,
Host, Origin, session token, explicit confirmation, size and secret checks remain.

The raw editor binds path, content and revision only after a successful GET.
Refused or uncertain saves retain the draft, loaded baseline and confirmation.
Reload is explicit; Cancel and failed reads preserve the old binding. File
switches cannot send an old draft against a new target. Raw and selected-text
editors retain independent baselines, so a leaf save cannot silently rebase a
dirty raw draft. Text typed while a save is pending remains dirty afterward.

Unchanged valid UTF-8 content preserves BOM, Unicode and exact CRLF, mixed
line endings and lone CR bytes by sending the original loaded representation.
Edited uniform CRLF files are re-encoded with CRLF. Edited mixed-line-ending or
invalid-UTF-8 byte preservation is not accepted by this receipt. A line-ending-only
external change still conflicts because revisions use file bytes.

The precondition covers one allowed file's content. It is optimistic checking,
not an operating-system exclusive lock, multi-file transaction, Git-cleanliness
check, structural Designer kernel, merge editor or provider publication.

## Observed validation

| Check | Result and boundary |
| --- | --- |
| `npm test` | 24 passed: existing characterization, security and Navigator model coverage plus new raw-byte revision, stale-save and exact-backup cases. Temporary server copies preserve the actual app. |
| `npm run backlog:test` | 29 passed across the original catalog and new compiler, including definition/evidence binding, prerequisite closure, public receipt containment, fixed outputs and formula-safe CSV. |
| `npm run backlog:check` | Both generated catalogs match their definitions and progress; the new catalog remains unchecked until aggregate acceptance. |
| `npm run systemx:session:test` | 55 passed: existing supervision/restart checks plus explicit import validation and complete piped status/preview JSON. Temporary copies only. |
| Source editor browser suite | 11 groups passed with no page errors or unexpected requests. Stale retry, Cancel/failed reload, fresh save, exact backups, byte formatting, pending-save drafts, transport/503, file switching and independent leaf/raw baselines were exercised in an isolated copy. Actual app source and reusable seeds were preserved. |
| Actual-stack Navigator regression | 16 groups passed on the updated runtime: 744 browser GET requests plus four GET preflights, no page errors or refused requests; all 686 protected fingerprints unchanged. Actual Home/About journeys and labeled DOM fixtures remain distinct. |
| Clean Home capture | A separate fresh browser selected the actual Home heading and waited for its 64-character leaf-source revision: 163 GET requests, no page errors or refused requests. No source save. |

Browser test sources are [source-revision-browser.mjs](../.SYSTEMX/LAN/tests/source-revision-browser.mjs)
and [navigator-browser.mjs](../.SYSTEMX/LAN/tests/navigator-browser.mjs).
The source-editor artifacts have basename `finalCrlfAndSourceFlow`; Navigator
proof has basename `navigator-regression`. Results, traces, screenshots and
fingerprint manifests are retained outside the repository. Machine paths,
authentication values, emulator datasets and runtime state are excluded here.
Earlier failed attempts remain retained separately; they are not passing evidence.
The final source suite followed a real pending-Save Reload repair and two test
readiness/visibility corrections. The Navigator suite ran against the restarted
owned app and LAN, without source POSTs.

## Local session preservation

An explicit `--emulator-import` option validates a selected existing Firebase
export before allocating ports, spawning children or writing session state.
Metadata and supported service trees must be contained, regular, bounded and
free of links, traversal and unsupported node types. The default startup is
unchanged; the option adds the canonical directory through an argument array.
Keep the selected export unchanged during startup: preflight is not a filesystem
lock or a semantic validation of all exported provider data.

The owned Auth/Firestore/Storage session was exported to private storage before
its restart. The private dataset and ownership receipts remain outside Git.
Current readiness reports the app and LAN plus three emulator components;
listener health alone does not prove HR/CMS/CRM workflow or restored record
correctness. A separate status CLI fix waits for JSON output to drain before
exit; pressured-pipe tests prevent the previously observed truncated JSON.
These operational changes do not accept later catalog families whose prerequisites
remain unimplemented.

## Tested implementation fingerprints

These hashes identify the tested working-tree implementation over baseline
`053382b383d0fbffbe5161e9fb4d5f07a3c1fed8`. A later tested commit must contain the
same bytes before any requirement is accepted.

| Repository-relative file | SHA-256 |
| --- | --- |
| `.SYSTEMX/LAN/Builder/source-revision.mjs` | `5b77b4155a4b6227c80826864633b8acef624cbfce8e92c1fe7027b32854eb04` |
| `.SYSTEMX/LAN/server.mjs` | `94c4f66b0134703dcf4a47fa6adcc5d32c222f6fd0929488bf30a56c0636556d` |
| `.SYSTEMX/LAN/Website/dashboard.js` | `f244e956dd81b0009a6eb404bf99026ba2514a579cf60862ec4c968cda776166` |
| `.SYSTEMX/LAN/Website_Dashboard.html` | `c1f276285e280d866b5ced985be22ce580c08c22575a45f68ae7419b01ecb754` |
| `.SYSTEMX/LAN/Website/dashboard.css` | `1704daea79287e7c6ecba0e06daf4f99f6149c152a081644b4f084336e6a62ba` |
| `.SYSTEMX/LAN/tests/source-revision.test.mjs` | `a17f7721ec1dcb76a6ed8077b608fa9af3a7648611c75e4e42e3d1f7a2381efd` |
| `.SYSTEMX/LAN/tests/source-revision-browser.mjs` | `cea05eda5b338af5f76d24813d0a27857c2211685baafea5f9953cb5efae3e3b` |
| `.SYSTEMX/LAN/dev-session.mjs` | `ae2f27db0687460cb9ec403d731892bf392239f015e505ed1d3b031adb5badb3` |
| `.SYSTEMX/LAN/session-supervisor.mjs` | `039eb022db4da851d9f929878f7f0a9e8e48770abe8f8a197b5074d8b469529f` |
| `.SYSTEMX/LAN/session-control.mjs` | `a7a7ef540c48824005e9666d7030c3bd65a020553250e82f3a65d8da3300ba09` |

## Retained browser artifact digests

| Artifact | SHA-256 |
| --- | --- |
| source editor result | `71e8b8ab393107bbe04b92843b991e237838237327f749824e68bed30d8d70a1` |
| source editor preservation manifest | `0f36d6b1b49117b81386d296c1ff91cb0e14db1db09b534a7ad418c362d9d5bf` |
| Navigator result | `ac7c15fe7fddc0398e2b725ad90218affdd6ba8847ba920910c015a986c879ba` |
| Navigator preservation manifest | `4f51eba151bf1b97af8e2efead4d3d5023223d27c7ce9282f6834e67e224e377` |

The manifests bind the frozen implementation bytes and preserved artifacts.
The source-editor result alone is not a commit fingerprint.
