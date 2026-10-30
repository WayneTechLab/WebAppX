# Customize the template through the LAN GUI

Use the local LAN builder to inspect the running WebAppX app, stage changes and
save a supported source edit with an exact revision and a predecessor backup.
The canvas, a literal source preview, a local page model and a production release
are separate surfaces. This walkthrough explains which one each action changes.

## Open the local project

Start the combined development session with `npm run dev:systemx`. Use the app
and `/__systemx/` URLs printed by that session; ports can change. The LAN bridge
is available only through the local Vite development server. It is excluded from
the production application build. Check `npm run systemx:session:status` when
resuming; recorded readiness needs a fresh endpoint and rendered-page check.

The left panel contains Pages and Navigator. The center is the running Vite app.
The right inspector groups Design, Data, Build and Ops. Keep the inspector open
when reviewing a save receipt. The app's portal directory is `/portals`; its HR,
CMS and CRM demos use fictional browser-local data without an account.

## Change a heading visually

1. Select Home from the current-page picker and enable Inspect.
2. Click a literal heading in the canvas. **Design → Settings** identifies the
   selected element, route, source file and loaded source revision.
3. Edit **Text field**, then choose **Preview text**. This changes only the
   current preview iframe. **Revert preview** returns to the selected original
   text. Neither action saves the repository file.
4. Review the text, source target and loaded revision. Enter `SAVE TEXT CHANGE`
   and choose **Save text to source**. A supported, unambiguous literal-text
   replacement uses the guarded source save and creates a predecessor backup.
5. Verify the receipt, source bytes and rendered app after Vite hot reload.
   Run the project's checks before committing or publishing.

An arbitrary React expression, repeated ambiguous text or structural JSX edit is
outside this literal-text operation. Use the controlled Code inspector for a
reviewed allowlisted source edit. A preview selection does not establish source
ownership or automatically authorize a replacement.

## Edit an allowlisted page in Code

1. Open **Build → Code**, choose the exact **File**, then **Load**. Selecting a
   different file does not silently replace a retained editor draft.
2. Edit the source. **Preview draft** captures literal text with its path,
   loaded raw-file revision and complete displayed-draft UTF-8 digest.
   **Check source** makes a fresh read and reports whether that captured base
   still matches the file. This snapshot does not compile or execute JSX.
3. Enter `SAVE LOCAL CHANGE` and choose **Save** only after reviewing the draft.
   The server checks the observed source revision and backs up the exact prior
   bytes before a successful change. The running canvas then follows Vite.
4. If the source changed meanwhile, retain the draft and use **Compare latest**.
   Review the loaded base revision, latest source and retained draft. Preparing a
   replacement is an explicit decision, followed by fresh save confirmation and
   another revision check. **Reload latest source** deliberately replaces an unsaved draft after
   confirmation; it does not merge changes.

An unavailable file is not recreated by a refused save. Inventories, previews and
readable hashes do not provide an exclusive lock. Each source hash covers one
allowlisted file's bytes, not the entire repository or a provider release.

## Fonts and independent editor baselines

The Style inspector's font controls use `src/index.css` and their own loaded
revision. **Refresh font source** explicitly reads that source. Previewing a
family affects the iframe; `SAVE FONT CHANGE` is needed to save a supported
stylesheet change. A successful font save does not rebase an open Code draft.
The older raw draft remains available and a stale save is refused. Real web-font
delivery has an independent network requirement; offline fixtures prove the
local controls without provider credentials.

## Keep one recovery draft across refresh

In **Build → Code → Local draft recovery**, enable **Allow one recovery draft for
this checkout in this browser**. Choose **Store recovery draft** deliberately;
typing never updates the saved slot. The record contains the source path, raw
baseline text and revision, displayed draft and digest. It is readable source
text in this browser profile, scoped by the local checkout identity. Each
baseline and draft is limited to 500,000 UTF-16 units, with a separate serialized
record limit. Unsupported paths, invalid records and screened private markers
are refused; storage failures preserve the editor and prior slot.

After refresh, choose **Review saved draft**. LAN reads the current source and
compares it with the saved baseline before offering **Restore saved draft**.
Restoration asks before replacing the open editor draft and keeps the saved
original baseline. It changes no repository file. If source has advanced, an
ordinary save still refuses the stale base; use the separate comparison and
reviewed-replacement workflow to make a deliberate decision.

**Discard saved draft** removes the slot while keeping the open editor. Turning
the preference off also removes its saved slot. If the browser refuses removal,
the UI reports that the slot may still exist. Recovery is a local draft aid;
use a deliberate export when you need a separate file you can keep.

## Download a comparison

Choose **Compare latest**, then **Review export scope**. The download includes
the proposed draft and latest source text, path, revisions and bounded line
comparison metadata. Read the inclusion scope, enter `EXPORT COMPARISON`, then
choose **Download comparison JSON**. **Cancel export** leaves the editor intact.
Editing the draft, switching targets or changing the comparison invalidates the
prior export review and confirmation.

Each source text is limited to 500,000 UTF-16 units, with a separate 2,500,000-unit
serialized export budget. The line comparison is positional after common
prefix/suffix trimming; it is not a minimal edit diff. Truncation indicators
remain in the export. The download grants no import, merge, replacement or save
authority and makes no repository change.

## Inspect source history

Choose **Refresh history** for the loaded source. The read-only view combines a
bounded local operation-log window with observations made in the current LAN
server process. Recorded saves include previous and resulting revisions where
available. Older records without complete revisions or checkout binding remain
qualified. An observed change identifies a hash seen outside the available
recorded evidence; it does not prove who edited the file.

History shows limits and omissions. Session observations expire with the server;
the log window is not a complete Git or filesystem audit trail. Refreshing
history does not restore a backup, recreate a missing file or save source.

## Check what an action actually delivered

| Boundary | Evidence to inspect |
| --- | --- |
| Plan | Original requirement, dependencies and checklist receipt binding. |
| Code | Reviewed source changes and exact functional candidate revision. |
| Function | Matching, stale, refused, recovery and race tests with terminal results. |
| Working local app | Rendered GUI action, save receipt, exact predecessor backup, source readback and the resulting app route. |
| GitHub delivery | Published source/wiki revision and remote readback. |
| Production | Separately authorized deployment and acceptance at the deployed route. A local save, build, Hosting preflight or Git push does not establish it. |

Read the [active iteration](LAN-ACTIVE-ITERATION.md) for current scope and
[program plan](LAN-10000-EXECUTION-PLAN.md) for accepted requirements. The
**Ops → Agent 0 → Work sources** view separately reports reusable work seeds,
the original WebAppX roadmap and explicitly selected adopted-project work.
Blank reusable task records are intentional and do not mean the LAN program is
complete. The app's CMS publication controls simulate fictional content releases;
they do not replace this repository's source or production release workflow.

The Pages controls maintain local builder models. Source and router changes still
use the controlled source workflow. LAN's Data workspace likewise maintains its
own local fixtures; the app's native HR/CMS/CRM records use the app portal
controls. Automatic structural editing, complete dynamic portal-route mapping
and bindings between these data surfaces remain later Designer work. Use the
app's Home portal link for the account-free workspaces covered by this walkthrough.
