# 20-Phase Master Plan

This folder defines the canonical WSG setup model.

The current 10-phase Unified Setup flow remains as a compatibility map for
existing docs and scripts, but the 20-phase master plan is now the primary
scratch-to-production operating model.

Use this layer for:

- project goal and operating instructions,
- business and delivery planning,
- frontend, backend, data, security, and operations planning,
- launch readiness and post-launch ownership,
- packet generation for durable user/LLM setup handoff.

## SYSTEMX LAN builder track

The master plan now includes a builder track for editing the current template
from the local `.SYSTEMX/LAN` control surface. This is an overlay across the
20 phases, not a replacement for the setup process or a second public app.

Read [`../../LAN/BUILDER-SYSTEM-PLAN.md`](../../LAN/BUILDER-SYSTEM-PLAN.md) for
the architecture, provider matrix, current-repository edit mode, local
emulator path, sync bridge, implementation waves, and acceptance gates.

The builder must remain:

- loopback-only and outside the public Vite/Firebase build;
- preview-first, with Firebase Emulator Suite as the default local cloud path;
- explicit about Firestore/Realtime Database versus Firebase SQL Connect and
  Cloud SQL PostgreSQL;
- capability-based for Firebase, Cloud Storage, Google Drive, GCS, and future
  providers;
- subordinate to the existing `.SYSTEMX` CLI for security, quality, and
  deployment decisions.

The current implementation checkpoint is Wave 0 complete, Wave 1 complete, and
the Wave 2 guarded local-edit vertical slice active: the local dashboard now
imports the current repository's pages, routes, components, token sources, KIT
files, and provider capability registry. It manages local page/node models,
CMS/CRM records, user fixtures, and allowlisted source files with backups,
confirmation, secret scans, and JSONL evidence. The combined session checks
IPv4 and IPv6 loopback ports, records ownership, and stops only verified
project processes. The workspace shell now uses resizable persisted side
panels, grouped right-inspector tabs, automatic canvas-width protection,
phone-width focus mode, and a non-overlapping bottom evidence row. Its layout
contract is supported by a 54-source official builder UX review.
Emulator-backed provider adapters and source-to-node round-trip generation
remain separate gated waves.

## LAN Builder Designer research overlay

The template now carries a research-backed Designer program under
`.SYSTEMX/LAN/Research/LAN-Builder/`. The package contains 200 source records, a
13-wave roadmap, a risk register, acceptance criteria, Wiki repairs, and draft
contracts for the canonical document, commands, styles, components, CMS,
evidence, publishing, plugins, and presence.

The existing G1 vertical slice is not being relabeled as a complete visual
editor. The overlay starts at **Wave 0 — truth, safety, and
characterization**. The injected plan, status board, and Wiki page are the
canonical operator references. Each later wave must be implemented and tested
before its capability is advertised.

- Master overlay: [`../../LAN/LAN-BUILDER-DESIGNER-MASTER-PLAN.md`](../../LAN/LAN-BUILDER-DESIGNER-MASTER-PLAN.md)
- Research corpus: [`../../LAN/Research/LAN-Builder/`](../../LAN/Research/LAN-Builder/)
- Status: [`../../status/LAN-BUILDER-DESIGNER-MASTERPLAN.md`](../../status/LAN-BUILDER-DESIGNER-MASTERPLAN.md)
