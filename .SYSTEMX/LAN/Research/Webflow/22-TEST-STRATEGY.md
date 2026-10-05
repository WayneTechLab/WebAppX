# 22 — Test Strategy and Validation Matrix

## Test pyramid

### Pure domain unit tests

- node tree invariants;
- route uniqueness;
- style cascade and variables;
- component props/slots/variants;
- CMS schema/binding validation;
- interaction target/timeline validation;
- locale inheritance;
- command inverses and impact analysis.

### Command transaction tests

- authorization and expected revision;
- multi-object atomicity;
- inverse/restore behavior;
- journal events and hashes;
- idempotency;
- external effect compensation;
- semantic diff.

### Adapter fixture tests

- router patterns;
- TSX literals/expressions/nested components/fragments/conditionals;
- CSS selectors/media/custom properties/Grid/Flex;
- Tailwind utilities/variants/arbitrary values;
- component source manifests;
- malformed/unsupported files;
- formatting/comments/import stability.

### Server/security integration tests

- loopback bind;
- IPv4/IPv6 host/origin;
- session token lifecycle;
- methods/content types/body limits;
- path traversal/symlink/race;
- backup/atomic write/restore;
- secret detection/redaction;
- request IDs/errors/rate limits;
- process ownership;
- production isolation.

### UI component tests

- rails/panels/dialogs/tree/inspector;
- selection synchronization;
- keyboard shortcuts and escape hierarchy;
- responsive panel behavior;
- command palette context;
- focus/component modes;
- conflict/error/approval flows.

### End-to-end workflows

1. start/stop managed session;
2. import current project;
3. select canvas node and reveal Navigator/source/style;
4. insert/move/style node, undo/redo;
5. create component/prop/variant/instance;
6. create collection/item/binding/form through emulator;
7. create locale/interaction;
8. create preview snapshot, review, preflight, release candidate;
9. restore prior snapshot;
10. plugin/MCP read and approved mutation.

### Visual regression

Test desktop/tablet/mobile and editor accessibility modes. Capture:

- canvas structure;
- Grid/Flex overlays;
- selection/focus states;
- style inspector provenance;
- component focus/variants;
- CMS list/template;
- comment/analyze overlays;
- dark/high-contrast editor themes.

### Accessibility

- axe/Playwright automated checks;
- keyboard-only critical paths;
- screen-reader smoke for shell, Navigator tree, inspector, dialogs, announcements;
- focus order/restoration;
- zoom and reflow;
- reduced motion;
- contrast and non-color status indicators.

### Performance

Synthetic fixtures:

- 10,000 nodes across 300 pages;
- 5,000 style rules;
- 2,000 variables and aliases;
- 500 component definitions / 20,000 instances;
- 100 collections / 50,000 fixture items indexed externally;
- deep and wide Navigator trees;
- large command journal and branch diff.

Measure import, selection, tree expansion, style trace, command commit, snapshot, build, and search.

## Golden fixtures

Create versioned fixtures for:

- the stock SFWA template;
- a hand-authored complex React app;
- a LAN-generated app;
- mixed Tailwind/CSS modules/global CSS;
- CMS/component/localization project;
- intentionally malicious/ambiguous project;
- prior schema versions for migration.

Expected outputs include document snapshots, IDs, source maps, semantic diffs, generated source, and gate reports.

## Fuzz/property tests

- random valid node commands preserve tree invariants;
- command + inverse returns equivalent document;
- no-op import/generate cycles stabilize;
- variable alias graphs never cycle;
- random schema migrations either validate or produce explicit blockers;
- random hostile paths never escape allowlists;
- parser limits terminate.

## Documentation validation

Scan Markdown for:

- `npm run` scripts absent from `package.json`;
- referenced repo paths absent from tree;
- wiki links without targets;
- version/Node/process contradictions;
- banned secret-handling guidance;
- feature claims unsupported by capability manifest/tests.

## Validation evidence

Each test run writes a compact JSON report with tool versions, commit, environment, suites, duration, failures, artifacts, and redaction status. Do not use terminal output as the only durable evidence for release-critical checks.
