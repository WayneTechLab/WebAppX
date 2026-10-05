# Webflow-Class LAN Master Plan Status

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
- Wave 1+ code implementation: NOT STARTED — the typed Designer kernel and
  structural round-trip work remain future milestones.

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
