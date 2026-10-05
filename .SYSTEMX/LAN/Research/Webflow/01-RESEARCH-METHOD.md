# 01 — Research Method

## Research question

What public product, interaction, data-model, extensibility, governance, and publishing patterns make Webflow's current platform work, and how should those patterns be translated into the existing SFWA-WTL `.SYSTEMX/LAN` architecture without copying proprietary implementation?

## Evidence base

The catalog contains exactly 200 unique sources:

| Evidence class | Count | Use |
| --- | ---: | --- |
| First-party Webflow product/help/developer sources | 160 | Current behavior, interface, APIs, workflows, constraints, and terminology |
| Normative web/data/accessibility/security sources | 20 | Correct browser semantics, document/patch formats, accessibility, and security verification |
| Official comparator documentation | 20 | Alternative architecture patterns and usability benchmarks |

The first-party Webflow set is intentionally broad. It covers the Dashboard, Designer, CMS, components, variables, responsive behavior, interactions, localization, roles, collaboration, publication, hosting, domains, forms, Ecommerce, Analyze/Optimize, accessibility, AI, APIs, Code Components, Webflow Cloud, DevLink, Apps, CLI, and MCP.

## Repository review method

The audit reviewed the current `main` repository and specifically the LAN execution path:

- plans and research documents;
- loopback server and API routes;
- dashboard HTML/CSS/JavaScript;
- contracts and registries;
- current-repository and external-project importers;
- session and port ownership helpers;
- Vite development bridge;
- package scripts;
- production leakage assertion;
- every wiki page published in the sidebar plus linked hidden white-paper pages.

The package records findings against paths instead of embedding private source dumps.

## Analytical lenses

Each feature was analyzed through six questions:

1. **Object model** — What stable entities must exist?
2. **Interaction model** — How does selection, focus, insertion, editing, preview, and review work?
3. **Command model** — What mutations occur, and can they be validated, reversed, replayed, and audited?
4. **Persistence/source model** — Where is truth stored, and how does it round-trip?
5. **Authority model** — Who can read, edit, publish, connect providers, or execute automation?
6. **Release model** — How does a draft become a reproducible published artifact with rollback?

## Clean-room rule

This work uses only public documentation, the user's public repository, open standards, and official comparator documentation. It does not attempt to recover Webflow source code, network internals, private APIs, visual assets, or trade secrets. Similar concepts are described generically and implemented through independent SYSTEMX contracts.

## Confidence labels

- **Documented:** explicitly described by a cited source.
- **Observed in repository:** present in the audited public code or docs.
- **Architectural inference:** the minimum internal capability reasonably required to support documented behavior.
- **Recommendation:** a proposed SYSTEMX-specific design choice.

## Live source resolution

The 200-entry catalog was live-resolution reviewed on 2026-08-05. Redirected and versioned Webflow documentation paths were updated to current canonical destinations. A small number of very large or reorganized pages required search-result confirmation instead of direct full-page extraction. This is a dated research check, not a promise that third-party routes will remain unchanged.

## Known limitations

- Webflow product plans, quotas, and prices can change; use capability flags and remotely configurable quotas rather than hard-coded commercial assumptions.
- The package validator checks file structure, JSON parsing, catalog uniqueness, expected counts, and checksums. It is intentionally offline and does not repeat the live HTTP resolution pass.
- Webflow's private implementation may differ from the architecture inferred here. The target is behavioral capability, not internal equivalence.
