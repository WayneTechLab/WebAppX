# Ten-minute backup, selective restore and Undo demonstration

Back up all three fictional portals, restore **CMS alone**, then reverse that
restore while HR and CRM retain their saved changes. The ten-minute schedule is
designed human pacing. Automated execution time does not establish how long a
person takes to follow the script. This scenario covers WX-0907.

Use a dedicated local development origin and a fresh owned browser context or
private window, following [Getting started](../GETTING-STARTED.md). Start from
`webappx-portal-smoke-v1`, the complete
[reviewed synthetic seed](../../tests/browser/fixtures/portal-smoke-v1.json) with
its [recorded digest](../../tests/browser/fixtures/portal-smoke-v1.sha256).
Keep any existing user profiles and saved workspaces intact. If your starting
records differ, close only your demonstration context and create a fresh one;
do not clear site data, Reset another person's work, or reuse their downloads.

Combined exports are readable JSON containing fictional records and saved
private drafts. They exclude restore points, unsaved fields, live timers and the
separate SDK session. Nothing is uploaded. Use only the demonstration downloads
created below and label them so that the baseline and changed backup stay clear.

After the one-time `npm ci` dependency installation, start your own account-free
server from the repository root:

```bash
npm run dev:mock
```

It isolates provider configuration and chooses a free loopback port. Open the
printed `/portals` URL in your new context and keep that exact address through
restore and Undo; browser saves and history belong to that origin.

1. **0:00–1:00 — Identify the baseline as the evaluator.** Open `/portals` and
   observe **Choose a portal.** Confirm the fresh seed through its portal
   dashboards: HR has **3** people, **1** time entry awaiting approval, **0**
   submitted payroll receipts, **1** goal and **2** open reviews; CMS has **1**
   draft, **0** awaiting review, **0** approved revisions and **1** published
   sample; CRM has **2** active leads, **$6,500.00** open pipeline, **$0.00** sample
   won value and **1** open follow-up. Back on **Portal directory**, **Restore
   points & Undo** says **No restore points yet.**

2. **1:00–1:45 — Download the complete baseline.** In **Combined workspace
   backup**, click **Export all workspaces**. Keep the actual
   `webappx-all-mock-workspaces-….json` download and label your copy
   **baseline-all**. Confirm its envelope contains `format:
   "webappx-mock-workspaces"`, `schemaVersion: 1`, `exportedAt`, and all three
   `workspaces.hr`, `workspaces.cms`, and `workspaces.crm` objects. Do not edit
   the file. This is the file to import in step 5.

3. **1:45–3:45 — Save one visible change in each portal.** As the native HR
   owner, choose **People & HR → Performance**, select **Avery Sample** in
   **Goal employee**, enter `Fictional browser smoke handoff` in **Goal title**,
   then click **Create sample goal**. The new title is visible, `goal-1` has
   receipt `MOCK-PERF-0001`, and the goal count becomes **2**. Expand the new
   goal's **Sample activity · 1 actions** disclosure to inspect that receipt.
   As **Alex · author**,
   choose **Content management**, replace only **Content title** with
   `Fictional browser smoke editorial update`, and click **Save draft revision**.
   The article is draft **revision 2** with `MOCK-CMS-0001`; its other text and
   existing published sample stay unchanged. As **Casey Example · Owner**, choose
   **Customer relationships → Leads** and create **Browser Smoke Fiction**,
   email `browser-smoke@fixture.invalid`, company **Fictional Browser Smoke
   Studio**, with **Create sample lead**. The new **new** lead is `lead-0001`
   with `MOCK-CRM-0001`; active leads become **3**, pipeline stays **$6,500.00**.

4. **3:45–4:30 — Back up the changed state.** Return to **Portal directory**
   and click **Export all workspaces** again. Keep this download as
   **changed-all**, separately from baseline-all. All three modules now differ
   from the baseline: HR has the added goal, CMS has the changed title/revision
   and saved activity, and CRM has the new lead/activity. **Restore points &
   Undo** still has no points; ordinary edits and exports do not create one.

5. **4:30–6:00 — Preview and restore only CMS.** Click **Import combined
   backup** and use the native file chooser to select the actual baseline-all
   download. **Choose workspaces to restore** appears with **Restore HR**,
   **Restore CMS** and **Restore CRM** all unchecked. **Restore selected
   workspaces** is disabled until a module is selected. Check **Restore CMS**
   only; leave HR and CRM unchecked. The preview says **CMS will be replaced
   and saved** and explains that unchecked portals retain their current records.
   Click **Restore selected workspaces**. The preview closes and an automatic
   **Before selective restore · CMS** point appears. Its scope is CMS alone.

6. **6:00–7:30 — Verify restoration and untouched work.** Open **Content
   management** and confirm **A fictional team update** and **current draft
   revision 1** are back; the step-3 title/revision-2 activity is absent. Open **People &
   HR → Performance** and confirm **Fictional browser smoke handoff** is still
   visible. Open **Customer relationships → Leads** and confirm **Browser Smoke
   Fiction** and `lead-0001` are still present. Export all workspaces as
   **cms-restored**. Compare complete payloads: `hr` and `crm` equal changed-all,
   while `cms` equals baseline-all. The restore replaces the complete selected
   workspace rather than merging just a title. Merely loading or selecting the
   import preview changed no saved workspace data.

7. **7:30–8:45 — Reverse the one-module restore.** Back on **Portal directory**,
   find **Before selective restore · CMS** in **Restore points & Undo** and click
   its **Undo…** button. The **Undo CMS** preview states that it replaces the
   entire CMS workspace and leaves other portals unchanged. Click **Confirm
   undo**. A new **Before Undo · CMS** point appears, while the original point
   remains. There are now **2 / 5 points**, both scoped only to CMS. The new point
   captures the baseline CMS that existed immediately before Undo, so Undo can
   itself be reversed.

8. **8:45–10:00 — Recheck all records and persistence.** Export all workspaces
   as **after-undo**. Its three complete workspace objects equal changed-all:
   CMS again has `Fictional browser smoke editorial update`, draft revision **2**
   and `MOCK-CMS-0001`; HR and CRM retain the goal and lead. Reload, verify both
   CMS-only history points remain, and export **after-reload**; its complete
   workspace payload still equals changed-all. Export timestamps and filenames
   naturally differ. Close only your owned demonstration context/server.

The exact acceptance comparison is:

| Checkpoint | HR | CMS | CRM | Automatic history |
| --- | --- | --- | --- | --- |
| baseline-all | Named seed | Named seed | Named seed | No points |
| changed-all | Added goal | Changed title, revision 2 | Added lead | No points |
| cms-restored | Exact changed HR | Exact baseline CMS | Exact changed CRM | One CMS-only restore point containing changed CMS |
| after-undo / after-reload | Exact changed HR | Exact changed CMS | Exact changed CRM | Original CMS point plus a CMS-only Undo point containing baseline CMS |

Run the matching automated browser proof with installed Playwright Chromium:

```bash
node scripts/browser-evaluators.mjs
# Optional visible automated run:
node scripts/browser-evaluators.mjs --headed
```

The command owns its loopback Vite server and fresh browser contexts and closes
them afterward. Recovery input is its actual baseline UI download; mutations,
file selection, checkbox selection, restore and Undo use rendered controls.
Complete exported records are compared with independently written expectations.
The test additionally compares untouched HR/CRM raw save strings byte for byte
after restoring CMS; after Undo, all three raw saves equal their pre-restore
strings. Reload preserves those strings and both complete history records.
These byte comparisons provide a deeper check than visible titles alone.

Printed artifacts include `evaluator-recovery-evidence.json`, five actual
combined JSON downloads, `evaluator-recovery-cms-only-preview.png`,
`evaluator-recovery-undo-history.png`, `evaluator-recovery-trace.zip` and the
suite's `report.json`. This exercise covers browser-local fictional data;
provider recovery, deployed backups and production recovery remain separate.

Related demonstrations: [HR](HR-FIVE-MINUTE.md), [CMS](CMS-FIVE-MINUTE.md),
and [CRM](CRM-FIVE-MINUTE.md).
