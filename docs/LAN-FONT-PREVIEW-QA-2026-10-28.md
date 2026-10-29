# LAN font revisions and draft preview QA — 2026-10-28

Status: **locally accepted ten-requirement batch covering two F001 capabilities**.
Agent 0 accepted LAN-00051–LAN-00060 at tested candidate `781b624bc322c4d851fa3dfc91a165a087dea5d7`.
The program now has **85/10,000 requirements and 17/2,000 capabilities accepted**,
a delta of ten requirements and two capabilities; **9,915 requirements remain TODO**.
Baseline: `42886165e315f8d7b6c89c754d2b81221a9c7972`.
App 3.4.0, managed SYSTEMX 1.9.0-alpha.6 and deployment count 0 remain unchanged.

See the [active iteration](LAN-ACTIVE-ITERATION.md),
[generated program plan](LAN-10000-EXECUTION-PLAN.md) and
[F001 checklist](backlog/lan-10000/F001.md).

## Accepted behavior

Font reads expose the raw-byte revision of the fixed `src/index.css` target,
using the same snapshot as its metadata. A SAVE FONT CHANGE write requires that
observed baseline before metadata effects and checks it again after any awaited
catalog read. Saved and unchanged responses expose previousRevision, revision
and currentRevision. Stale requests, including no-ops, are refused before source,
backup, temporary or operation effects. A real missing source returns fixed
SOURCE_UNAVAILABLE guidance without recreation. Successful writes back up exact
predecessor bytes and preserve supported UTF-8/BOM and uniform LF/CRLF content.
The supported font layout is conservative; unsupported selectors, import blocks,
declarations, encoding or endings refuse before mutation.

The Font browser shows its independent baseline and explicit Refresh font source.
It retains an open raw CSS draft and that editor's older baseline. A later raw
save receives 409 when the font write advanced the source. Pending font saves
retain their captured family; newer selection and approval input survive the
receipt. Superseded reads, errors and raw/leaf/font receipts do not overwrite a
newer known source observation. Failed or unverifiable font operations require
an explicit successful refresh before another save.

Build → Code → Preview draft captures a literal source snapshot, its path,
loaded raw-file baseline and displayed-draft UTF-8 digest. Check source is GET
only and reports current, changed, unavailable or unknown state. Input, target,
load and close actions invalidate pending reads/digest work. A captured preview
keeps its own text and baseline even when the editor changes or explicitly reloads.
Close preview keeps the editor. Preview creates no source/backup/log/temp effect,
replacement authority or persistent browser record, and executes no markup or JSX.

## Bounds and visible feedback

Capture is inclusive at 500,000 UTF-16 units; display is capped at 20,000 with
explicit omission counts and surrogate-safe clipping. The complete displayed
editor text is hashed as UTF-8. That digest is deliberately distinct from the
raw file-byte baseline, including textarea newline normalization.

Four browser checkpoints cover font current/unavailable and literal-preview
current/unavailable states at the normal **336 px dock**. They check child boxes,
metadata scroll bounds and individual complete hash text lines. The largest
checked child is 317 px. Revision hashes and receipts wrap visibly; literal code
retains its intentional inner horizontal scrolling. These are four states at
one dock width, not four separate responsive-width qualifications. Actual in-app
browser readback separately confirmed the contained font/source controls.

## Terminal validation

| Check | Observed result |
| --- | --- |
| Full CI at the tested candidate | All 68 ordered stages, exit 0; finished 2026-10-29T02:32:36.792964+00:00 |
| npm tests within full CI | 49 passed; source-revision 18 and characterization 11 are included |
| Isolated source/font/preview browser | 37 groups, four geometry checkpoints, exit 0 |
| Actual-stack Navigator regression | 16 groups, 746 browser GETs, no errors or refused requests; 687 protected fingerprints unchanged |
| Separate Hosting preflight | Exit 0; finished 2026-10-29T02:20:11.869032+00:00; commit, push and production deploy skipped |
| Integrity | Template seeds, selected immutable release, both checksummed research packages and host sync validated |

The final isolated browser run records 21 source POSTs, seven font POSTs, 49
source GETs and seven Google CSS requests fulfilled with synthetic local replies.
All writes and simulated external edits target disposable owned copies. It
retains 29 exact input fingerprints, five matching served JS/CSS response hashes,
complete artifact manifests and terminal cleanup of its own LAN/Chromium. Real
app source and reusable seeds are unchanged. The actual Navigator run uses a
fresh separate browser context and refuses writes and external requests.

## Findings, failed attempts and repairs

- The first extended browser attempt passed all original 21 groups, then failed
  because `src/index.css` was absent from the Code inventory. The importer now
  lists that fixed target only through the existing confined regular-file rule.
  Characterization checks cover missing/regular/directory fixtures and API inventory.
- The next 37-group behavior pass exposed clipped metadata on visual readback.
  Three CSS declarations constrain the inspector/font grid tracks and wrap the
  font receipt. The complete suite subsequently passes four explicit geometry
  checkpoints; earlier screenshots retain their original visual limitation.
- The broader Navigator regression exposed an inherited full-reload selection
  race. The first cleanup also clobbered explicit page-picker context labels.
  Final cleanup clears retained selection/anchor/leaf authority on full load;
  a page pick that already cleared selection keeps its new page label. Both
  unchanged browser suites pass on the final candidate.
- Three CI attempts were deliberately interrupted before acceptance while those
  functional repairs were pending. Their partial logs remain incomplete evidence;
  only the final terminal 68-stage run is counted here.
- The first completed aggregate run passed behavior/browser stages but failed
  strict audit after a newly published high-severity re2js advisory. Root and
  starter now pin patched re2js 2.8.7; it is the only changed dependency package
  in each lock. Root audit retains two low Gusto/deepmerge findings with zero
  high/critical; starter audit is clean. The SDK was not downgraded and the audit
  threshold was not relaxed. See [the upstream advisory](https://github.com/advisories/GHSA-gg6h-894w-4m9c).
- Independent review also repaired font import placement, supported selector and
  exact declaration identity/boundaries, no-import insertion, encoding/refusal and
  metadata-await cases. The offline race test uses a portable file-URL preload.

All prior failed or qualified attempts retain their original dates, results and
artifacts. The source-only documentation reviews preserve historical guide and
receipt bytes and all prior decision records; they do not establish new runtime
or provider acceptance.

## Evidence fingerprints

| Artifact | SHA-256 |
| --- | --- |
| Final source browser result | `171cb0821259e427b22db77d9ce8aa3016137cab06e6d267cfa0fedb06a8608f` |
| Final source browser manifest | `08abd25401673676151db7fc2c03478b766b2caca7f8a40e9a573ae92a74c4a0` |
| Final source browser trace | `72b42483486d199b66d24203d894c8f196f110884577423f6a989190b3a1cf06` |
| Actual Navigator result | `124a1ea8265b9e8b8e0d1b571695b20914ecf032bc43b90e79b877ba495e8e50` |

Private traces, runtime URLs/PIDs, tokens, emulator exports and local paths stay
outside Git. Owned emulators were exported before controlled restart and the
exact snapshot was supplied for import. Startup/health observations are separate
from record-by-record dataset or production acceptance. No real Google Fonts
metadata provider or account was needed for the isolated proof. A real web-font
preview still needs its independent CSS/font network delivery.

## Remaining work and acceptance boundary

The next ready capabilities are revision-bound draft recovery (LAN-00076),
conflict comparison export (LAN-00081) and source history (LAN-00086). Those and
all remaining requirements stay TODO. The original WebAppX catalog remains
179 done / 821 remaining; its saved foundation bundle remains unapplied.

Local byte revisions are optimistic single-file checks, not exclusive OS locks,
auto-merge or multi-file transactions. Literal snapshots do not establish compiled
canvas equivalence. These macOS checks do not establish native Windows runtime,
provider activation or production deployment. Publication is verified separately
in the final handoff; production deployment was not authorized or executed.

## Exact accepted definitions

```lan-completion-evidence
{
  "schemaVersion": 1,
  "requirements": [
    {
      "id": "LAN-00051",
      "definitionSha256": "9cadba93cfde690143ae93d7af8e58a335f2bbf02c9f16dce3f84dec3f54b762",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00052",
      "definitionSha256": "d149efc02ed07c25ade581970f402cf7a917b79d075489f19d1496197182d4e6",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00053",
      "definitionSha256": "9d630a7ec8b6c44210d9a5e9de97d4262aeb0ee26e18c3ef9e2b907f6a12bf11",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00054",
      "definitionSha256": "acfa273506151e3b6e6ed0bfc7fe6deaa916238ca453c22dc72d68c4c58e9a39",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00055",
      "definitionSha256": "49f463d92882f4dd458a0bbc89c4b226826db4cb929b1c9d8cdd7699b9c7cea5",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00056",
      "definitionSha256": "e59f1a9ba8791addbdcd05b853ebccb707531a85d95d39df66128c49135b85a2",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00057",
      "definitionSha256": "5be84dd5938385271861f8c0c451e906502bfa5edfce435aa8f47b497ee91b56",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00058",
      "definitionSha256": "fbca67949e096ef93f93918b07f233e19de8713f705a2c8d58e16deda03517e6",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00059",
      "definitionSha256": "773a9e1a776fada91973b8a8577dea81f9f33883912b9066018126a870e565f2",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    },
    {
      "id": "LAN-00060",
      "definitionSha256": "988657013fca478b183dc938dcb752b22e8f64351eb54486096aa8d98ba7cc78",
      "sourceRevision": "781b624bc322c4d851fa3dfc91a165a087dea5d7"
    }
  ]
}
```
