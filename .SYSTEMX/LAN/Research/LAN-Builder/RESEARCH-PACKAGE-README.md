# SFWA-WTL LAN Builder Designer Research Package

**Package:** `SFWA-WTL-LAN-BUILDER-DESIGNER-RESEARCH-PACKAGE-v1.0.0`  
**Research cut:** 2026-08-05  
**Target repository:** `WayneTechLab/webapp-stack-g1`  
**Target subsystem:** `.SYSTEMX/LAN` / SYSTEMX Local Control Designer  
**Source catalog:** exactly **200** de-identified research records; **160 primary capability records**, **20 normative standards/security records**, and **20 comparator records**.

## Purpose

This package is an original, clean-room research synthesis and implementation plan for the LAN Builder Designer program. It studies public builder behaviors, documented interface patterns, open standards, and the current SFWA-WTL repository, then translates those findings into SYSTEMX-native contracts. It is not a product clone, vendor SDK, or claim of visual or architectural equivalence.

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

- `.SYSTEMX/LAN/Research/LAN-Builder/` — deep research and architecture documents.
- `sources/` — 200-record CSV/JSON catalogs and cross-reference matrices. External product names and URLs are intentionally omitted from this tracked package; stable local keys preserve research traceability without creating a vendor dependency.
- `planning/` — feature matrix, backlog, roadmap, risks, dependencies, wiki repair matrix, route map, and acceptance criteria.
- `INJECT/` — repo-relative master plan, proposed JSON Schemas, status page, wiki page, and Codex/Agent 0 prompt.
- `tools/validate_package.py` — offline structural and identity validator.
- `RESEARCH-PACKAGE-MANIFEST.json`, `RESEARCH-PACKAGE-SHA256SUMS.txt`, and `RESEARCH-PACKAGE-VALIDATION.md` — integrity and package evidence.

## Recommended use

1. Read `00-EXECUTIVE-SUMMARY.md` and `10-LAN-CURRENT-STATE-CODE-AUDIT.md`.
2. Review P0 defects in `11-LAN-WIKI-DRIFT-AUDIT.md` and `planning/WIKI-REPAIR-MATRIX.csv`.
3. Review the architecture in files 13–19.
4. Copy only the reviewed contents under `INJECT/` into a working branch.
5. Implement Wave 0 and Wave 1 before adding more visual surface area.
6. Run the included validator and the repository's own quality/security checks after each wave.

## Scope limits

The package does not claim access to any third-party private source code or undisclosed infrastructure. Descriptions of internal requirements are architectural inferences from public behavior and are marked as such. The current G1 vertical slice remains the supported implementation; the kernel, structural source round-trip, and later Designer waves are planned until their acceptance gates pass.
