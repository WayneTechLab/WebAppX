# Roadmap and Wave Gates

The program is sequenced to stabilize the repository and editor kernel before introducing source round-trip, collaboration, plugins, AI, or production release workflows.

| wave | name | milestone | exit_gate |
| --- | --- | --- | --- |
| 0 | Truth, safety, and characterization | M0 | Current LAN behavior is tested; documented commands and paths exist; unsafe secret guidance is removed. |
| 1 | Modular server and typed contracts | M0 | Legacy UI works through modular services and all security characterization tests pass. |
| 2 | Canonical document and read-only import | M1 | Repeated imports are idempotent and stable without source mutation. |
| 3 | Command journal and local mutations | M1 | Journal replay produces the expected document hash and authorization/revision tests pass. |
| 4 | React Designer UI migration | M1 | All current LAN flows operate in the new UI with keyboard and visual-regression coverage. |
| 5 | Structural source editing | M2 | Supported structural edits rebuild, undo, re-import, and retain stable object identity. |
| 6 | Style, variables, and responsive engine | M2 | Effective styles match browser fixtures and source output is deterministic and reversible. |
| 7 | Components and libraries | M3 | Component changes produce impact reports; instances round-trip and upgrade safely. |
| 8 | CMS, bindings, forms, and assets | M3 | A CMS page and form work end-to-end through emulators with rules and accessibility tests. |
| 9 | Interactions and localization | M4 | A page/component supports reusable motion and two locales without duplicating the document. |
| 10 | Snapshots, publishing, backup, and restore | M4 | An approved snapshot publishes deterministically and a prior release restores with evidence. |
| 11 | Extensions, CLI, and MCP | M5 | A sandboxed extension and read-only MCP client work; approved mutation uses the journal. |
| 12 | Collaboration, insights, and domain packs | M5 | Page branch review/merge is conflict-aware and release evidence remains complete. |
