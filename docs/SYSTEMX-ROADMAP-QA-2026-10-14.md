# SYSTEMX refresh and 1,000-item roadmap verification — 2026-10-14

This update starts from WebAppX
`8359285c99069349d6218fe871868baab76868e5`. The checkout was clean on `main`
and matched direct GitHub `main` before work. It refreshes the host's upstream
check behavior and planning documentation, and publishes a proposed 1,000-item
improvement catalog. It does not implement or activate those 1,000 proposals.

## Upstream verification

| Observed source | Value |
| --- | --- |
| Reviewed public dotSYSTEMX main | `3fb59429c878268f1081ca255a1f32fafc5dcfba` |
| Original alpha.6 import commit | `7f0d82b7ba8531ac04d897209d8c1ed263ee29cb` |
| Complete `.SYSTEMX` tree at both commits | `30baa1a6f6140776751b1cbb036ac323c4dd301c` |
| Selected and pinned release | `1.9.0-alpha.6`, manual updates |
| Manifest SHA-256 | `009e6b6c2f1359fa4c88e3961164d28cc89f65cea2a6682200fb2953caf326e3` |

The newer public commit changes only README/wiki content outside `.SYSTEMX`.
The original importer refused the changed commit even though the release source
was identical. The reviewed host fix accepts this case only after matching
receipt repository, version, manifest and complete commit identity, and comparing
the available historical commit's complete `.SYSTEMX` Git tree with the newly
reviewed public main. A matching manifest alone is insufficient. Changed trees,
unlisted files, invalid identity or missing historical objects remain rejected.

The live read-only preview reports `receiptCommit` for the original receipt and
`identicalSourceTree: true`, with empty additions and bootstrap add/replace lists.
No import application is necessary. Installation metadata, receipt bytes and
timestamps, the selected manual pin, immutable release snapshots, research
fingerprints and reusable blank seeds are preserved.

Six added regression cases cover documentation-only source advancement with
first-import provenance preserved, changed same-version source/manifest,
unlisted `.SYSTEMX` changes, malformed or wrong receipt identity, unavailable
historical commit and reviewed expected-commit drift. The complete host SYSTEMX
integration suite passes **36 tests**, including **19 importer tests**.

## Catalog verification

The [canonical JSON](backlog/webappx-1000-todo.json) contains exactly 1,000
`todo` proposals, ordered WX-0001 through WX-1000, with 20 defined areas and
50 proposals per area. Each includes a priority, phase, concrete title, specific
observable acceptance, existing repository source, acceptance gate and earlier-ID
dependencies. Titles and acceptance checks are individually unique.

Priorities are **166 P1, 676 P2 and 158 P3**. Acceptance gates are **832 local,
40 provider and 128 operator**. All 1,000 remain unstarted `todo` proposals.

The Markdown and CSV views are generated from JSON, and `backlog:check` checks
exact byte parity. A separate CSV parser round trip matches all 1,000 JSON
records, and all 1,000 Markdown IDs appear once in order. Source pointers resolve
inside the repository. The source baseline is preserved in catalog metadata.

The validator rejects wrong counts, reordered IDs, wrong area allocation,
duplicate titles or acceptance, forward dependencies, missing or escaped sources,
invalid metadata types and impossible calendar dates. CLI queries support an
exact ID or area/priority/limit filters. Unknown or ambiguous options fail before
rendering. Six regression tests cover those boundaries and representative queries.

Source review distinguishes implemented portal capabilities from proposed deltas,
removes repeated or already delivered proposals, and keeps optional provider or
operator adoption gated. The catalog is planning data, not a canonical execution
ledger, defect inventory, compliance assessment or production authorization.
The template's task/context/plan/memory seeds remain blank.

## Documentation refresh

- README, the host `.SYSTEMX` entry/pointer, maintenance and integration guides
  link the catalog and describe the unchanged alpha.6 provenance.
- The wiki gains a roadmap page and navigation links; its managed integration
  page now reflects 3.4.0/alpha.6 and preserves the Agent Y adoption guide.
- Getting Started now describes browser persistence and restore/Undo accurately.
- Historical QA receipts retain their original scope; no new browser results
  are claimed for this planning/tooling update. Prior browser evidence remains
  in the [restore-point receipt](RESTORE-POINTS-QA-2026-10-14.md).

## Final publication gates

- `npm run ci:all` passed: six catalog regressions; 235 shared SYSTEMX cases
  (five filesystem-specific skips); 36 host integration cases; eight security
  operations cases; 11 app/LAN cases; 116 HR and 96 portal cases.
- Template seed/integrity checks, research fingerprints, lint, TypeScript,
  documentation links, security/auth/AI checks, root/backend dependency audits,
  production build and LAN isolation passed. Dependency audits reported zero
  vulnerabilities.
- `npm run deploy -- hosting --preflight` passed and skipped version/changelog/Git
  mutation, push and deployment. Version remains 3.4.0/deployment count zero.
- The final standalone preview verified reviewed public main, identical source
  trees and no additions/replacements. Final `sync:system:check` reported no drift.
- The wiki preview rendered 58 pages, including the new roadmap page; existing
  wiki-only pages and history remain preserved by the sync workflow.

These are local tooling, planning and source-publication results. No production
deployment, provider activation or execution of the 1,000 proposals occurred.
