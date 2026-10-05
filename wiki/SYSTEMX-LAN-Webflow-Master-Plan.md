# SYSTEMX LAN Webflow-Class Designer Master Plan

The LAN Builder is being designed as a repository-native visual development control plane. The target is not a visual copy of Webflow. It is a Webflow-class set of authoring capabilities combined with SYSTEMX local-first safety, source ownership, evidence, and controlled provider operations.

## Target capabilities

- stable page/node/style/component/CMS objects;
- Navigator/canvas/inspector selection synchronization;
- structural React/Vite editing through AST adapters;
- CSS cascade, breakpoints, states, variables, and modes;
- components with props, slots, variants, versions, and migrations;
- typed CMS schemas, references, queries, bindings, forms, and assets;
- interactions and localization;
- immutable previews, semantic reviews, publish manifests, and restore;
- comments, page branches, activity history, plugins, CLI, and MCP clients.

## Safety boundary

LAN remains local-only. It must not be published as part of the customer application. Browser controls never receive generic shell, filesystem, cloud, or secret authority. High-risk source/provider/release actions require a reviewed plan, explicit approval, verification, and evidence.

## Current implementation status

The existing LAN already includes a useful local shell, managed sessions/ports, guarded source writes, backups, evidence logs, current-project inspection, local fixtures, component staging, and a production leakage assertion. The full editor kernel, source adapters, cascade, components/CMS model, publication snapshots, and collaboration layers are planned work.

Research Wave 0 is now complete for the truth-and-safety slice: the package is
validated, Wiki and setup drift is repaired, current behavior is characterized,
draft-schema decisions are recorded, and the supported/guarded/planned
capability manifest is checked in. Wave 1 modular server/contracts work is not
started and must not be represented as current functionality.

## Roadmap

1. repair documentation and freeze current safety behavior;
2. modularize the server and version contracts;
3. introduce the canonical document and read-only import;
4. add commands, transactions, history, undo/redo, and semantic diff;
5. migrate the editor UI to typed React modules;
6. add structural source editing and responsive style engine;
7. add components, CMS, bindings, forms, assets, interactions, and locales;
8. add snapshot/release/restore and safe extension clients;
9. add collaboration, insights, and optional domain packs.

See the research package for the 200-source catalog, detailed architecture, backlog, risk register, acceptance criteria, and proposed schemas.
