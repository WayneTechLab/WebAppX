# WebAppX template planning pointer

This host-owned page links the public template's improvement catalog. It is not
a selected upstream default, project memory seed or active task ledger.

- [Roadmap and sequencing](../docs/WEBAPPX-ROADMAP.md)
- [Exactly 1,000 improvement items](../docs/backlog/WEBAPPX-1000-TODO.md)
- [Canonical JSON](../docs/backlog/webappx-1000-todo.json)
- [Refresh and backlog verification](../docs/SYSTEMX-ROADMAP-QA-2026-10-14.md)

Use `npm run backlog:summary`, then query a bounded area or ID with
`npm run backlog -- --area mock-recovery --priority P1 --limit 10`.
Do not load the full catalog into every resume packet. Inspect the current
implementation and accept only the next bounded assignment before creating
canonical tasks in an adopted app. Provider/operator gates remain separate.

`WORK/TASKS.json`, context, plan, project memory and agent memory remain blank
reusable seeds. No active tasks or roles are created by publishing the catalog.

## Developer readiness and automated browser smoke — 2026-10-14

**WX-0001**, **WX-0651** and **WX-0652** are completed for the read-only developer
version report, deterministic named portal seed baseline and automated HR/CMS/CRM
Chromium smoke. Consult their catalog records and the
[developer/browser QA receipt](../docs/DEVELOPER-BROWSER-QA-2026-10-14.md) for
verified status and evidence. Together with completed **WX-0051/WX-0451**, the
catalog retains exactly **1,000 records**: **five completed, 995 remaining —
162 P1, 675 P2 and 158 P3**.

`npm run doctor` checks installed Node.js >=24.0.0, Python >=3.12.0 and parseable
npm/Git versions. `npm run --silent doctor -- --json` reports the same checks as JSON.
The report installs nothing and does not prove runtime acceptance.

After `npm ci`, `npm run browser:install` explicitly downloads Chromium for
exact pinned Playwright 1.64.1. `npm run browser:smoke` checks seed identity/hash,
expected dashboard totals, HR/CMS/CRM UI changes, refresh persistence and complete
export comparisons in its own loopback Vite server and fresh browser context.
It never downloads a browser automatically or uses provider accounts/emulators.
Temporary artifact paths are printed; cleanup closes only owned resources.

Full `ci:all` includes doctor regressions, seed checks and browser smoke. Keep
these host-owned checks separate from immutable upstream tools, blank adoption
records, live provider adoption and platform acceptance. Earlier completion
checkpoints below retain their date and scope.

Local focused verification passed the real Mac version report, 18 doctor cases,
16 seed/runner cases and seven authored browser gates. UI changes in HR/CMS/CRM
survived reload with complete expected exports and unselected portals preserved;
a second context retained the clean seed. Request/error guards and both owned
cleanup checks passed; only expected missing Firebase configuration warned.
Independent source review had no unresolved findings. Consult the receipt for
final full CI/preflight/drift results.

## P1 portal follow-up — 2026-10-14

The existing **WX-0051** and **WX-0451** catalog entries are completed for the
shared typed portal registry and restore storage-budget preview. Their completion records
link the [P1 QA receipt](../docs/PORTAL-REGISTRY-BUDGET-QA-2026-10-14.md); consult
the canonical JSON and [roadmap](../docs/WEBAPPX-ROADMAP.md) for verified status
and counts. At this first P1 checkpoint: exactly **1,000 records**, **998
remaining, including 164 P1**.
Preserve stable IDs rather than adding replacement entries or populating the
reusable task ledger.

- [Registry](../src/portals/registry.ts): common HR/CMS/CRM identities, labels,
  descriptions and demo routes for shared navigation, cards, cross-links and
  backup/restore module validation.
- [Restore-budget guide](../docs/TEMPLATE-PORTALS.md#restore-storage-budget-preview):
  selected workspace sizes and projected recovery history before selective
  restore or Undo confirmation. Estimates use serialized characters and app
  limits; they do not measure/reserve browser quota or guarantee successful writes.

Actual confirmation still revalidates current records/history, saves a recovery
point first and attempts rollback on failures. These local mock features create
no provider account, trusted role membership or production deployment. App
version remains **3.4.0**, deployment count **0**, and the managed release stays
**1.9.0-alpha.6**. Blank adoption seeds and immutable snapshots remain preserved.

Observed local browser checks passed registry navigation, scope boundaries,
preview/cancel preservation, HR-only/CMS+CRM/all-three restore, refresh and Undo.
Confirmed history matched its projections, including five-point retention and
pruning. A valid near-limit CMS state correctly refused a small incoming restore
whose new recovery point exceeded the history limit. Complete exported payloads
confirmed cancellation and unselected-portal preservation. The receipt separates
these observations and focused automated checks from final publication gates.

## Reviewed upstream state — 2026-10-14

The selected release remains **1.9.0-alpha.6**, manually pinned. Reviewed public
main is `3fb59429c878268f1081ca255a1f32fafc5dcfba`; the original import receipt
remains bound to `7f0d82b7ba8531ac04d897209d8c1ed263ee29cb`. Both commits have
the same complete `.SYSTEMX` tree, `30baa1a6f6140776751b1cbb036ac323c4dd301c`.
The import preview reports no additions or bootstrap replacements. An already
current distribution does not need reinstalling or a new version number.
