# LAN recovery, comparison export, source history and template GUI QA — 2026-10-29

Status: **locally accepted fifteen-requirement batch completing F001**.
Milestone started 2026-10-29; local acceptance recorded 2026-10-30.
Agent 0 accepted LAN-00076–LAN-00090 on 2026-10-30 at tested candidate `04813b380cda7656650db752049a8e0661c55bc5`.
Published baseline: `ba8b0bbda8b7ef0c044dfe243448e646b793a66f`.
The accepted program is now **100/10,000 requirements and 20/2,000 capabilities**,
a delta of fifteen requirements and three capabilities. **F001's 100 requirements
are complete; 9,900 requirements remain in the wider program.** Font revisions
and source-bound previews retain their earlier acceptance and were regression
tested without counting them twice. App 3.4.0, managed SYSTEMX 1.9.0-alpha.6 and
deployment count 0 remain unchanged.

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
and native control of the Codex app was denied. The user clicked **OK**. Subsequent
GUI readback confirmed the exact recovered draft and original baseline, with no
source save. The initial automation timeout remains qualified; the restoration
used that explicit manual confirmation.

Agent 0 then used **Compare latest → Review export scope → EXPORT COMPARISON →
Download comparison JSON**. The downloaded file was exactly **9,039 bytes** and
matched the scope's SHA-256
`3e001ccfa6aec2034049fda04fe0a060d56e8335d00561b1caf0253d19c605c9`.
Its path, loaded/current revisions, complete current Home source and proposed
unsaved text matched independently. Its draft digest was
`f91c97f01866eff4a04d2d16a19722b67f80b5707120137f79bc63fc897a8f6d`.
The comparison was complete and untruncated. All eight source/backup/operation-log
fingerprints remained identical across recovery, restore, export and history.
The rehearsal record was removed by opting out; comparison/export were canceled
and the editor returned to its clean loaded source. The intended Home edits remain.

## Accepted capability behavior

| Requirements | Capability | Accepted local behavior |
| --- | --- | --- |
| LAN-00076–LAN-00080 | Revision-bound draft recovery | Explicit opt-in and Store preserve one checkout-scoped path, raw baseline and revision, displayed draft and digest. Review reads current source before explicit Restore; stale restoration retains the old base and ordinary stale saves still refuse. |
| LAN-00081–LAN-00085 | Comparison export | The exact inclusion scope precedes EXPORT COMPARISON and a bounded JSON download. Content, revisions, digest and truncation metadata agree; edits or new observations invalidate consent. Download grants no source replacement authority. |
| LAN-00086–LAN-00090 | Source revision history | A read-only bounded view separates recorded workspace-bound saves, qualified legacy operations and unattributed session observations. Missing hashes remain unavailable; no rollback or raw log export is provided. |

Each capability's behavior, boundaries/refusal, recovery, feedback and evidence
lanes bind to the exact tuples below. The original 85 completion objects and
their ordering are preserved. The original WebAppX catalog remains 179 done /
821 remaining, and its historical foundation bundle remains unapplied.

## Terminal validation

| Check | Result at `04813b380cda7656650db752049a8e0661c55bc5` |
| --- | --- |
| Full CI | All 68 ordered stages, exit 0. |
| Core npm unit/API tests | 72 passed, zero skips; includes 16 draft-record and seven history tests. |
| Source/font/preview/recovery/export/history browser | 55 groups and seven normal 336 px inspector geometry checkpoints, exit 0. The inspector is explicitly kept open through the supported GUI control. |
| Actual-stack Navigator | 16 groups, no page errors or refused requests; all 689 protected fingerprints unchanged. Includes actual app and deliberate DOM fixtures. |
| Separate Hosting preflight | Exit 0; commit, push and production deployment skipped. |
| Template, host and distribution integrity | Required CI gates passed; immutable managed releases, blank seeds and both research packages preserved. |

The isolated source suite exercises the real LAN server and controls with writes
confined to owned temporary copies and a synthetic app document. The actual Home
GUI proof above and live Navigator cover the running Vite app separately. The
font provider responses in the isolated suite are synthetic. These results do
not qualify a real Google Fonts delivery, Gusto account, provider activation,
native Windows installation or production deployment. Local runtime facts and
browser assets were rechecked against the frozen implementation.

## Findings and retained attempts

- Source review repaired responding-checkout identity binding across raw, leaf,
  font, preview and recovery reads. A delayed or foreign response cannot label
  another checkout's bytes as the active project. Drafts retain their own bases.
- Complete legacy history tuples without checkout binding now have row-specific
  unverified labels. Valid historical hashes are retained; missing values are
  never fabricated.
- The first aggregate CI stopped because its supervisor fixture copied the new
  server without the history helper. The explicit fixture inventory was repaired;
  its 55 session tests and the terminal full CI pass. The original failure remains.
- The first expanded browser attempt passed 38 groups, then a startup font read
  invalidated a recovery offer for that same source. The stable case now waits
  for startup readiness; deliberate newer-observation races remain tested.
- A later attempt passed 46 groups before an overstrict Store assertion. The
  corrected oracle explicitly stores the exact retained original-checkout
  snapshot and checks every binding/digest, the absent other-checkout slot and
  unchanged repository effects. Stale snapshots remain a supported recovery aid.
- A development attempt passed 48 groups before its export CSS fixture lacked a
  supported font body. The fixture was repaired while preserving BOM/CRLF and
  exact changed-line coordinates. Complete and truncated exports remain checked.
- A committed attempt stopped after three legacy checks when the Auto inspector
  collapsed and intercepted a click. The final harness uses the normal visible
  Keep open control and verifies the expanded 336 px inspector. It uses no forced
  clicks or injected pin state. The failed attempt remains separate.
- The later Work sources browser check exposed the same Auto-resize screenshot
  precondition. It now uses the normal Keep open control and records the expanded
  inspector, retaining all six source-status assertions and original seed checks.
- An incomplete aggregate was deliberately interrupted after its superseding
  test setup was ready; its exit 130 receipt remains incomplete evidence.
- Held-read checks retain the original non-edit binding and the post-action
  binding, await the exact captured request's terminal event, then assert before
  cleanup. These strengthen the evidence without changing the runtime behavior.

All failed, development and earlier successful attempts retain their original
artifacts and scope. Only the exact committed terminal run is counted above.
The native in-app confirmation interruption and user's explicit OK are recorded
in the real GUI proof rather than relabeled as a fully automated restoration.

## Plan, code, function, local working and production delta

| Boundary | Verified state | Remaining boundary |
| --- | --- | --- |
| Plan | Exactly fifteen new requirements accepted; program 100/10,000 and 20/2,000, F001 complete. | Remaining 9,900 requirements and future families stay TODO. |
| Code | Reviewed frozen implementation and independent approval match the tested candidate. | Full structural Designer kernel, automatic portal-route mapping and data bindings remain later work. |
| Function | 72 unit/API tests, 55 source-flow browser groups and 16 Navigator groups pass. | Future provider and native-platform qualifications remain separate. |
| Working local project | Three Home GUI saves have exact predecessor backups; recovery, confirmed comparison download, history and portal entry readbacks passed. | Local health is volatile; recheck the owned session on resume. |
| GitHub delivery | Source/wiki publication is recorded by the final handoff after remote readback. | A commit or push does not deploy the app. |
| Production | Hosting preflight passed; no production deployment or provider activation occurred. | Deployment and deployed-route acceptance require their own operator authorization and evidence. |

The Work sources board still separates blank reusable seeds, the original
WebAppX catalog and explicitly selected adopted work. LAN's generated plan and
progress ledger own this separate program. Local page models, source text edits,
native portal data and provider/production operations retain their distinct
authority and persistence rules. Read the [GUI walkthrough](LAN-TEMPLATE-GUI-WORKFLOW.md).

## Evidence fingerprints

| Artifact | SHA-256 |
| --- | --- |
| Final source browser result | `bc33412bae9d3e435a7d6b344e3931e9a099cf07ab802e9fc931ef7a834cc7b4` |
| Final source browser manifest | `7bc0e111ea4ff23631f20aa5232a57b8643214d7dec1297e5bb11fee381ce72d` |
| Final source browser trace | `8f94d735a07aa3c4b3e9be35789229bf32cfea420cabbe97ddd2f9b3f6451c69` |
| Final Navigator result | `e4d381d93eb9116c1e2076771163a89c7c40ae0568d3919fb896da580c35ccca` |
| Real comparison download | `3e001ccfa6aec2034049fda04fe0a060d56e8335d00561b1caf0253d19c605c9` |

Private paths, tokens, browser state, traces and emulator snapshots stay outside
Git. Owned emulator state was exported before restart and the same snapshot was
supplied for import. Startup and health are not record-by-record dataset or
production acceptance. The [active iteration](LAN-ACTIVE-ITERATION.md) and
[generated plan](LAN-10000-EXECUTION-PLAN.md) identify the next unaccepted work.

## Exact completion bindings

```lan-completion-evidence
{
  "schemaVersion": 1,
  "requirements": [
    {
      "id": "LAN-00076",
      "definitionSha256": "e8ef66d5a23d693a7cfee2fa5bc08af64a69d3f64e75f461ab5a49eb8811cebb",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00077",
      "definitionSha256": "5489c79fffca757c89d6d75da5dc9d94b4dea2e67f2e48afb7ad2a9c090432f2",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00078",
      "definitionSha256": "98768104e29825bd79f171710fcc02f96c9d18a0b0651d81477314ecfe463d0c",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00079",
      "definitionSha256": "e865dbf72ed612ac4e1d6eed2680494ac376add46a824cb39480e61967e9a5e4",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00080",
      "definitionSha256": "511667a2f46c71dd9e48e3e178bf2b8f4149ffad18f5f2827e2901d4a2cd494e",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00081",
      "definitionSha256": "1841658d16295949d2ba28b7e96c63283b0581e7ed655bc31be55d0db39a5a1b",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00082",
      "definitionSha256": "2469de3275c3402691e852f31fb803cde1129a170295fb09e73f8ac1bebfcc85",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00083",
      "definitionSha256": "0e5fa734b15fb1a8e918afcb4c0a8a0d60e8dc05d81ebe7db63e0e62a08001f4",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00084",
      "definitionSha256": "8fe4dab965abdaef666e741886b171b14c7812298c2013c234b2d2a6d181a2db",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00085",
      "definitionSha256": "c4f6a7284a6ee212b00509f5cba158deef5341a69357a4620b4d2b4a2c4d062d",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00086",
      "definitionSha256": "e00841f7f7f5beff1fe717163bd85063be90287f3ded92af797b2605805c8830",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00087",
      "definitionSha256": "29b69e6b8d2687abe9caf8f31d8d4eec7fec1b93c9ca2b585ee0effc630bf2e7",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00088",
      "definitionSha256": "8d957ed0f48a36d058db4c8ea333bee8ec266979a9e44a5a9aa84e4dcc5c335f",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00089",
      "definitionSha256": "29b92f7588f121940fd47792b2e4e02df4dab094e1226954846b1d8b0642001b",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    },
    {
      "id": "LAN-00090",
      "definitionSha256": "cb150ad7705c43d225f1cedde798806a8e633ff6ee9e103429534c99c3bf52e1",
      "sourceRevision": "04813b380cda7656650db752049a8e0661c55bc5"
    }
  ]
}
```
