# SFWA-WTL Webflow Research Master Plan

**Package:** `SFWA-WTL-WEBFLOW-RESEARCH-MASTER-PLAN-v1.0.0`  
**Research cut:** 2026-08-05  
**Target repository:** `WayneTechLab/SFWA-WTL-TEMPLATE`  
**Target subsystem:** `.SYSTEMX/LAN` / SYSTEMX Local Control Designer  
**Source catalog:** exactly **200** unique sources; **160 first-party Webflow**, **20 normative standards/security**, and **20 official comparator sources**.

## Purpose

This package is a clean-room product and architecture study of Webflow's current authoring platform, with an implementation master plan tailored to the existing SFWA-WTL template. It does **not** copy Webflow source code, private implementation details, trademarks, protected visual assets, or proprietary datasets. It studies published behaviors, documented interfaces, and open web standards, then translates them into SYSTEMX-native contracts.

The deliverable is intentionally more than a UI imitation. A serious visual builder needs:

1. a canonical document graph with stable IDs;
2. a command and transaction model that supports undo, redo, replay, review, and audit;
3. a standards-aligned style cascade and token engine;
4. reusable components with typed props, slots, variants, dependencies, and migrations;
5. CMS schemas, relationships, query/binding contracts, localization, and workflow states;
6. source adapters that can round-trip React/TypeScript/CSS without unsafe text replacement;
7. immutable preview/publish snapshots, build evidence, and rollback metadata;
8. capability-scoped extensions, MCP tools, provider adapters, and human approval gates.

## Highest-confidence conclusion

The current LAN is a strong **guarded local control-plane prototype**, not yet a full visual-editor kernel. Its best characteristics should remain non-negotiable: loopback-only networking, session ownership, host/origin checks, per-session mutation token, explicit confirmations, allowlisted writes, backups, secret-shape rejection, JSONL evidence, and production leakage checks. The next major move should be to replace fragile page fixtures and exact-text source writes with a typed editor domain and command journal.

## What is inside

- `.SYSTEMX/LAN/Research/Webflow/` — deep research and architecture documents.
- `sources/` — 200-source CSV/JSON catalogs and cross-reference matrices.
- `planning/` — feature matrix, backlog, roadmap, risks, dependencies, wiki repair matrix, route map, and acceptance criteria.
- `INJECT/` — repo-relative master plan, proposed JSON Schemas, status page, wiki page, and Codex/Agent 0 prompt.
- `tools/validate_package.py` — offline structural validator.
- `MANIFEST.json`, `SHA256SUMS.txt`, and `VALIDATION-REPORT.md` — integrity and package evidence.

## Recommended use

1. Read `00-EXECUTIVE-SUMMARY.md` and `10-LAN-CURRENT-STATE-CODE-AUDIT.md`.
2. Review P0 defects in `11-LAN-WIKI-DRIFT-AUDIT.md` and `planning/WIKI-REPAIR-MATRIX.csv`.
3. Review the architecture in files 13–19.
4. Copy only the reviewed contents under `INJECT/` into a working branch.
5. Implement Wave 0 and Wave 1 before adding more visual surface area.
6. Run the included validator and the repository's own quality/security checks after each wave.

## Scope limits

The package does not claim access to Webflow's private source code or undisclosed infrastructure. Descriptions of internals are architectural inferences from documented behavior and are marked as such. Current prices and plan quotas can change; this package models entitlements as capabilities rather than hard-coding commercial values.
