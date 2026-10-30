# LAN recovery, comparison export, source history and template GUI QA — 2026-10-29

Status: **implementation and verification in progress; no new requirements accepted**.
Published baseline: `ba8b0bbda8b7ef0c044dfe243448e646b793a66f`.
The accepted baseline is 85/10,000 requirements and 17/2,000 capabilities.
LAN-00076–LAN-00090 remain TODO until a frozen candidate, terminal browser
results, independent review and all required publication gates support acceptance.
The earlier font and preview capabilities are regression prerequisites; this
batch does not count them twice.

Read the [active iteration](LAN-ACTIVE-ITERATION.md),
[GUI walkthrough](LAN-TEMPLATE-GUI-WORKFLOW.md) and
[generated program plan](LAN-10000-EXECUTION-PLAN.md).

## Actual WebAppX Home GUI changes

Agent 0 used the existing local LAN bridge, its running Vite canvas and the real
`src/pages/HomePage.tsx`. The edits were submitted through GUI controls, without
writing the Home file through a terminal or file editor.

| Action | Observed result |
| --- | --- |
| Build → Code → File → Load | Loaded the Home source and its exact raw-byte revision. |
| Edit intro and add portal CTA → Preview draft | Captured a literal snapshot with a distinct draft digest and the still-current source baseline. The app source remained unchanged until Save. |
| `SAVE LOCAL CHANGE` → Save | Saved the new intro and **Explore demo portals** link with an exact predecessor backup. Vite rendered the new copy and link. |
| Select Included heading in canvas → Settings → Text field → Preview text | Changed the iframe heading while a direct source hash still equaled the prior save. The UI explicitly reported that source was unchanged. |
| `SAVE TEXT CHANGE` → Save text to source | Saved **Build pages. Test portals. Make it yours.** and verified a second exact predecessor backup. |
| New runtime: select Start heading → `SAVE TEXT CHANGE` → Save text to source | Saved **Customize your app with a consistent operating standard.** and verified a third exact predecessor backup. |
| Build → Code → Refresh history | Showed the new operation as **Recorded builder save · leaf-text**, with the exact prior/result hashes. The two earlier saves remained visibly legacy/unverified. |
| Follow the new Home CTA | Opened **Choose a portal.**, then rendered **People workspace**, **Content publishing workspace** and **CRM portal** without an account. |

The Home retains the existing template layout, brand, account link and footer.
The new copy describes account-free workspaces and local review before release.
The new CTA uses the established `AppLink` route mechanism. Independent source
review approved the narrow Home/parity change; typechecking passed. These local
observations do not establish deployed behavior or provider authorization.

| Home source stage | SHA-256 |
| --- | --- |
| Exact predecessor before GUI edits | `f41310f9b37cb9ccef4af1d09ffa3f78ee1c429a6a1cc051b23c792890d7c5ee` |
| After controlled Code save | `7d889cd267e4644d6a0ae9ebd691fb3019be2d0c694db722cbd94ffd942f85f1` |
| After visual heading save | `19536e38169cecc97e5e8b552d2344c7d72ed26bbefdd893670b0d930a15b518` |
| After new-runtime Start heading save | `cf753da247db7e2a66b667510ed211d879a39b77a6c122d672a97ee609a25aa6` |

All three backups were read and matched the preceding stage byte for byte. The
intentional root/starter Home parity entry was refreshed only for the root Home;
the standalone starter page remained unchanged. Screenshots, raw readbacks,
runtime identities and backup paths remain private local evidence.

The two initial GUI saves occurred before the new history API was loaded. Their
older operation rows must remain qualified as legacy records if they lack hash
pairs; this receipt supplies the independent exact-byte backup proof. No new
history implementation may invent missing historical revision fields.

The new runtime was started only after its owned Auth/Firestore/Storage emulator
snapshot was exported, then supplied for import. The actual recovery GUI stored
an explicit unsaved Home draft, survived a browser refresh and reported that its
saved baseline matched the current source. Its native Restore confirmation then
blocked the in-app browser automation: the documented dialog/tab APIs timed out,
and native control of the Codex app was denied. Agent 0 requested a manual
dismissal and continued independent tests. This attempt is not a completed
automated restoration result. No source save was requested by that action.

## Plan, code, function, local working and production delta

| Boundary | Current observation | Remaining evidence |
| --- | --- | --- |
| Plan | Five selected capabilities; fonts/previews previously accepted. | Accept exactly the fifteen new requirements only after their full gates pass. |
| Code | Recovery, export and history implementation is in progress. | Frozen patch and independent final review. |
| Function | Real Home Code and visual saves, revision readbacks and exact predecessor backups passed. | New capability model/API/browser tests and existing source/font/preview regressions. |
| Working local project | The changed Home and all three account-free portal entry pages rendered. | Final candidate runtime readback, Navigator and full CI. |
| GitHub delivery | Baseline main is published. | Publish the verified candidate and wiki, then read remote revisions back. |
| Production | No deployment or provider activation performed. | Separately authorized deployment and deployed-route acceptance. |

The Work sources board still separates blank reusable seeds, the original
WebAppX catalog at 179 recorded completions / 821 proposed TODO and explicitly
selected adopted work. The LAN plan and completion ledger own this separate
10,000-requirement program. Neither the empty reusable task ledger nor a local
GUI save completes the program or accepts the historical foundation bundle.
