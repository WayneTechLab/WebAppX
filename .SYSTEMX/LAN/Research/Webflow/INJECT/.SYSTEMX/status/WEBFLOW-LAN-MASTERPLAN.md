# Webflow-Class LAN Master Plan Status

## Global goal

Build a repository-native visual Designer for the SFWA-WTL template using a canonical document/command architecture while preserving all current SYSTEMX local safety controls.

## Current state

- Research: COMPLETE — 200-source catalog assembled.
- Repository LAN audit: COMPLETE — plans, server, UI, contracts, importers, runtime/session, Vite bridge, package scripts, and isolation check reviewed.
- Wiki audit: COMPLETE — full sidebar plus hidden linked pages reviewed.
- Architecture/master plan: COMPLETE — proposed only; not yet merged into repository implementation.
- Code implementation: NOT STARTED by this package.

## Blocking P0 findings

1. Wiki contains unsafe AI secret-handling wording.
2. Multiple wiki pages reference removed installers, launchers, paths, and absent npm commands.
3. Current LAN lacks a canonical document graph and stable object identities.
4. Current mutations lack a shared command journal/transaction/replay model.
5. Exact-text source save is too brittle for structural visual editing.
6. Server and editor UI are monolithic and difficult to test/extend safely.

## Next active milestone

**Wave 0 — Truth, safety, and characterization**

Required outputs:

- canonical command/platform/version/process manifests;
- wiki repair changes;
- docs validator;
- current API/security characterization suite;
- feature/capability manifest generated from tests;
- architecture decision records.

## Definition of Wave 0 done

- every documented command/path exists;
- Node/version/process guidance agrees;
- no secret-paste guidance remains;
- all current LAN safety/write behavior has automated tests;
- public build isolation still passes;
- current feature claims are test-backed.

## Operator note

Do not copy the `INJECT/` files blindly over newer repository work. Merge on a working branch, review schema/architecture decisions, and preserve current LAN source until characterization tests exist.
