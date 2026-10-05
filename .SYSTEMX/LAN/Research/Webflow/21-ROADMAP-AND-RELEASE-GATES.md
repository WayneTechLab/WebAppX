# 21 — Roadmap, Milestones, Release Gates, and Success Metrics

## Roadmap horizon

The roadmap is capability-gated rather than date-promised. Each wave can ship as a versioned, usable increment when its exit conditions pass.

| Milestone | Waves | Product result |
| --- | --- | --- |
| M0 — Trustworthy prototype | 0–1 | Current LAN behavior is tested, documented, modular, and contract-validated |
| M1 — Editor kernel | 2–4 | Stable document IDs, read models, command history, undo/redo, typed React UI |
| M2 — Visual source editor | 5–6 | Structural React/Vite edits and responsive styling round-trip safely |
| M3 — Data-driven design system | 7–8 | Components, CMS, bindings, forms, assets, emulator workflows |
| M4 — Experience and release | 9–10 | Interactions, localization, immutable previews, publish/restore evidence |
| M5 — Platform ecosystem | 11–12 | Plugins, CLI, MCP, review/branching, insights, optional commerce |

## Cross-wave release gates

### Correctness

- schemas parse and generated types are current;
- command replay produces expected document hash;
- undo/redo invariants pass;
- source parse-print/idempotency passes for supported fixtures;
- no unexpected diff outside approved files;
- browser rendering matches expected fixtures.

### Security

- host/origin/session/path/body/secret tests pass;
- command capability tests pass for all roles;
- no generic shell or unrestricted filesystem/provider endpoint;
- plugin/code-component policy passes;
- no LAN/private/secret markers in `dist`;
- accepted high-risk findings are current and approved.

### Quality

- typecheck and lint clean;
- unit/integration/e2e/visual/a11y suites pass;
- large-document performance budgets pass;
- documentation command/path/link validation passes;
- migration/rollback tested.

### Release

- source/document/adapter versions recorded;
- preview snapshot immutable;
- semantic diff reviewed;
- target identity and environment verified;
- required approvals collected;
- rollback information present;
- smoke test and monitoring evidence recorded.

## Core success metrics

| Metric | Target direction |
| --- | --- |
| Unsupported import rate on the stock template | toward 0 for intended supported patterns |
| Stable object ID retention after no-op import/format | 100% |
| Command replay determinism | 100% for committed journal fixtures |
| Undo/redo invariant success | 100% for supported reversible commands |
| Unintended file diff | 0 |
| Public build LAN leakage | 0 |
| Source apply rollback drill | 100% successful in test fixtures |
| Keyboard-accessible editor critical paths | 100% |
| WCAG 2.2 AA violations in editor shell | 0 critical/serious |
| P95 selection/inspector response, 10k-node fixture | under defined budget (initially 100 ms local) |
| P95 command commit without build, local | under defined budget (initially 250 ms for simple commands) |
| Full incremental verification after source write | measured and reduced without skipping required gates |
| Documentation broken command/path count | 0 |

## Feature maturity labels

Every UI capability must display one of:

- planned;
- experimental read-only;
- experimental write;
- supported constrained;
- supported production;
- deprecated.

A readiness card cannot imply a live integration. The capability manifest is generated from implementation and tests.

## Stop conditions

Pause feature expansion when:

- a safety regression appears;
- document/import identity is unstable;
- source writer creates nondeterministic or unrelated diffs;
- command replay diverges;
- docs and code disagree on authority or targets;
- provider writes cannot be safely identified/rolled back;
- performance makes the canvas or Navigator unusable;
- unresolved component/CMS migration rules risk data/source loss.
