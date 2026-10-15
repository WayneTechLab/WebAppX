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

## P1 portal follow-up — 2026-10-14

The existing **WX-0051** and **WX-0451** catalog entries are completed for the
shared typed portal registry and restore storage-budget preview. Their completion records
link the [P1 QA receipt](../docs/PORTAL-REGISTRY-BUDGET-QA-2026-10-14.md); consult
the canonical JSON and [roadmap](../docs/WEBAPPX-ROADMAP.md) for verified status
and counts: exactly **1,000 records**, **998 remaining, including 164 P1**.
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
