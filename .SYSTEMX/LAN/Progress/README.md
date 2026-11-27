# LAN progress workbook

Open [LAN-10000-Progress.xlsx](LAN-10000-Progress.xlsx) in Excel. **Progress** shows accepted requirements, remaining requirements, completed capabilities, and the breakdown for all 100 families. Each capability has five original requirements.

On **Requirements**, filter **Status** to find accepted work, ready work, or work waiting on prerequisites. **Gate** identifies local, operator, and provider work. Each accepted row has its verification date, repository-relative evidence file, source revision, and reviewer. Look up the same requirement ID on **Criteria** for its full acceptance text and prerequisites.

**Owner** and **Next action** accept planning text. Refresh keeps these fields attached to the requirement ID even after Excel sorting and rebuilds the status columns from the reviewed ledger. Save team or personal planning details in a separate local workbook if they should stay private.

## Refresh or check the workbook

From the repository root, use a Node runtime with `@oai/artifact-tool` available. In Codex Desktop the workspace dependency loader provides the bundled Node executable and its `node_modules` directory. When the package lives outside the project, set `NODE_PATH` to that directory for these commands.

```sh
node .SYSTEMX/LAN/Progress/refresh.mjs
node .SYSTEMX/LAN/Progress/refresh.mjs --check
```

Refresh first validates the [LAN catalog](../../../docs/backlog/lan-10000.json), [acceptance ledger](../../../docs/backlog/lan-10000-progress.json), and referenced evidence using the repository's backlog checker. The workbook records hashes of the two source files. The check compares the saved workbook with the current sources, including its original criteria, evidence fields, and family totals. Acceptance changes go through the [LAN execution plan](../../../docs/LAN-ACTIVE-ITERATION.md).

The standard backlog check also reads the saved Excel file with Python, verifies both source hashes, and checks the status of all 10,000 requirement IDs. This runs in regular CI without the spreadsheet authoring library.
