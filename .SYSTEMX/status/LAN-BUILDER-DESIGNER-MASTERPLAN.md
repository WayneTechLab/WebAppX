# LAN Builder Designer Master Plan Status

## Global goal

Build a repository-native visual Designer for the SFWA-WTL template using a canonical document/command architecture while preserving all current SYSTEMX local safety controls.

## Current state

- Research: COMPLETE — 200-source catalog assembled.
- Repository LAN audit: COMPLETE — plans, server, UI, contracts, importers, runtime/session, Vite bridge, package scripts, and isolation check reviewed.
- Wiki audit: COMPLETE — full sidebar plus hidden linked pages reviewed.
- Architecture/master plan: COMPLETE — proposed future program, with current
  capability and schema decisions now recorded in the repository.
- Wave 0 implementation: COMPLETE — documentation, safety, characterization,
  link validation, capability manifest, and evidence packet pass.
- Wave 1 preparation: source-revision contract and stale-edit client workflow are implemented for local verification. Full transport/domain modularization, the typed Designer kernel and structural round-trip work remain future milestones.

## Bounded LAN orientation delta — 2026-10-25

The owner resumed the current LAN builder, with a
[25-source official Webflow research refresh](../LAN/WEBFLOW-RESEARCH-2026-10-25.md)
alongside the original immutable research packages. The familiar structure,
canvas and inspector layout remains the basis.

The live Navigator now discovers a bounded current-DOM hierarchy, searches
structural metadata, expands/collapses branches, selects through ancestor
breadcrumbs, reveals available rendered targets and supports ARIA tree keyboard
navigation. Hidden/inert, stale-document and truncated-result behavior are
explicit. Ordinary Interact-mode links work while the inspector remains open.
The [dated QA receipt](../../docs/LAN-NAVIGATOR-QA-2026-10-25.md) binds the actual
16-group browser pass to exact runtime fingerprints.

This is an orientation increment on the existing vertical slice. It does not
accept a typed Designer kernel, durable source identity, structural editing,
command journal, style authoring, provider publication or later wave completion.
The original 200-source package and all package checksums remain preserved.
The original application backlog remains 179 done / 821 remaining; the saved
unfinished foundation bundle remains unapplied.

Final local acceptance on `dcca2b7300464a4df9a41460959ab907b9c58968` passed 16 Navigator groups,
all 68 CI stages and separate Hosting preflight. Compatible root/starter/backend
dependency audit repairs passed with zero reported vulnerabilities. App 3.4.0
retains deployment count 0. Later kernel waves remain planned.

## LAN execution program — 2026-10-26

The [active iteration](../../docs/LAN-ACTIVE-ITERATION.md) continues with source comparison, missing-file
draft protection and explicitly reviewed replacement. Its 15 requirements stay
pending until the new browser and release checks are accepted.

**Accepted first batch: 60 requirements / 12 capabilities; 9,940 requirements
remain TODO.** Tested source `136a4cf` passed all 68 CI stages, 11 source-editing
browser groups, 16 Navigator regression groups and separate Hosting preflight.
Production deployment was skipped.

The [LAN execution plan](../../docs/LAN-10000-EXECUTION-PLAN.md) and
[family checklist index](../../docs/backlog/LAN-10000-TODO.md) define 100 families,
2,000 proposed capabilities and 10,000 delivery requirements. Cross-family
prerequisites preserve document/ownership/commands before structural authoring,
and schemas/review/build evidence before later integration/publication work.

The first source-editing batch covers byte revisions, stale-save refusal,
retained raw/leaf drafts, explicit reload, target binding, no-op/CRLF handling,
transport feedback and revision scope. Only receipt-bound accepted requirements
count toward progress; the list and readiness queue do not execute or grant
provider authority. Read the [dated QA receipt](../../docs/LAN-SOURCE-REVISION-QA-2026-10-26.md).

This program leaves the original 1,000-item catalog and unfinished foundation
bundle separate. Managed releases, blank seeds and research fingerprints remain
unchanged. The full Designer kernel and remaining waves are not completed by
this increment.

## Wave 0 findings resolved

1. Wiki secret-handling wording was replaced with a never-paste policy.
2. Removed installer, launcher, path, and npm-command claims were repaired or
   marked planned.
3. The current LAN limitations are recorded as future Designer work rather than
   being advertised as shipped.

## Next planned milestone

**Wave 1 — Modular server and typed contracts**

Required outputs: transport/domain/policy separation, schema validation, a
versioned API boundary, and compatibility tests with no UX regression.

## Wave 0 exit evidence

- `npm test` passes all 8 LAN characterization tests;
- `npm run docs:links` passes 269 Markdown files;
- `node .SYSTEMX/scripts/verify-template-structure.mjs` passes;
- `npm run build` and the public LAN-isolation guard pass;
- `npm run sync:system:check` reports no drift;
- `WAVE-0-EVIDENCE.md` and `SCHEMA-DECISIONS.md` are checked in.

## Operator note

Do not copy the `INJECT/` files blindly over newer repository work. Merge on a working branch, review schema/architecture decisions, and preserve current LAN source until characterization tests exist.
