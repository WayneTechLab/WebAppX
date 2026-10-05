# 24 — Architecture Decision Log

## ADR-001 — Preserve loopback sidecar architecture

**Decision:** Keep `.SYSTEMX/LAN` as a local-only sidecar and Vite development bridge; do not add it to Firebase Hosting routes.

**Reason:** This is the strongest security and product boundary in the current design.

## ADR-002 — Use a canonical normalized document graph

**Decision:** Introduce `DesignerDocument` with stable IDs, revisions, indexes, and migrations.

**Rejected:** Continue using DOM discovery plus generic local fixture arrays.

## ADR-003 — Use commands as the only mutation interface

**Decision:** UI, CLI, MCP, plugins, and legacy routes invoke typed commands.

**Rejected:** Direct store/file mutation from panels or transport handlers.

## ADR-004 — Hybrid controlled source ownership

**Decision:** Support source-owned, generated-owned, and explicit hybrid objects.

**Rejected:** Claim universal two-way editing or replace all existing source with a proprietary document format immediately.

## ADR-005 — AST/CSS adapters, no general string replacement

**Decision:** Keep exact-text replacement only as a constrained legacy adapter; structural and style writes require parsers and source maps.

## ADR-006 — Browser standards define style semantics

**Decision:** Implement cascade, selectors, media queries, values, variables, Grid, Flex, HTML, and DOM behavior from standards.

**Rejected:** Invent a separate layout language that only approximates browser behavior.

## ADR-007 — Separate UI state from document state

**Decision:** panels, selection, hover, zoom, scroll, mode, and open drawers are editor UI state.

## ADR-008 — Immutable preview/release snapshots

**Decision:** publication consumes frozen snapshots and manifests, never the mutable current canvas.

## ADR-009 — Provider-neutral domain, adapter-specific capability

**Decision:** CMS/forms/assets/commerce model common domain concepts; Firestore, SQL Connect, Storage, Drive, Stripe, and others are adapters.

## ADR-010 — Plugin/MCP capability sandbox

**Decision:** extensions are untrusted clients with manifests, explicit capabilities, rate limits, and no generic shell/fs/env access.

## ADR-011 — Collaboration follows stable IDs and journal

**Decision:** comments, presence, branches, and merge are added after object identity and commands are proven.

## ADR-012 — React/Vite UI migration by strangler pattern

**Decision:** preserve compatibility launchers/routes while modular server and React UI replace monolithic internals.

## ADR-013 — Documentation is generated/validated evidence

**Decision:** commands, paths, versions, platform support, and feature status must be checked against canonical manifests and tests.

## ADR-014 — AI proposes commands

**Decision:** agents can query and propose structured mutations; human/policy acceptance commits them.

## ADR-015 — Clean-room capability implementation

**Decision:** use public documentation and standards to design original SYSTEMX contracts; do not copy Webflow code, assets, or trade dress.
