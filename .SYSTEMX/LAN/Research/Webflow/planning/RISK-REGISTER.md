# Risk Register

The program preserves LAN's current fail-closed posture and expands it to typed commands, source adapters, plugins, AI/MCP, collaboration, and release operations.

| risk_id | severity | risk | cause | mitigation |
| --- | --- | --- | --- | --- |
| R-001 | Critical | Source corruption from ambiguous transform | Exact text or weak AST mapping changes wrong code | AST ownership, base hashes, temp worktree, semantic diff, backup, verification |
| R-002 | Critical | LAN exposed publicly | Control-plane assets/routes/metadata enter dist or hosting | Loopback-only design and mandatory leakage scan |
| R-003 | Critical | Secret leakage | Secrets enter chat, browser, logs, source, backup, or artifact | Never-paste policy, secret stores, redaction, scans, rotation |
| R-004 | Critical | Wrong provider/environment target | Operation runs against production or wrong account | Target identity, emulator default, plan-bound approval, preflight |
| R-005 | High | Lost update/concurrent conflict | Stale editor overwrites newer document/source | Expected revisions, object conflicts, rebase report |
| R-006 | High | Nondeterministic replay | Journal cannot reproduce document/release | Pure handlers, versioned migrations, hashes, replay tests |
| R-007 | High | Plugin/code component compromise | Extension exfiltrates or takes editor authority | Sandbox, manifest, capabilities, integrity, dependency policy |
| R-008 | High | Prompt injection | Imported source/content instructs agent to exceed scope | Treat imported text as data; bounded MCP commands; human approval |
| R-009 | High | CSS cascade mismatch | Editor preview differs from browser/output | Standards-based resolver and browser conformance corpus |
| R-010 | High | Component migration breakage | Prop/slot/variant change orphans instances | Versioning, impact report, migration functions, rollback |
| R-011 | High | CMS destructive migration | Field/schema change loses data or breaks bindings | Impact/backfill/emulator/approval/integrity reports |
| R-012 | High | Authorization only in UI | Direct API call bypasses hidden control | Command capability enforcement and role matrix tests |
| R-013 | High | Path traversal or symlink escape | Source/import path escapes repo | Canonical realpath, symlink policy, hostile fixtures |
| R-014 | High | Parser/resource exhaustion | Malicious/huge project freezes LAN | Limits, workers, timeout, cancellation, inventory-only |
| R-015 | Medium | Monolith refactor regression | Current useful LAN flows break | Characterization tests, strangler adapters, feature flags |
| R-016 | Medium | Object ID instability | Comments/history/bindings/source maps drift | Stable fingerprints and golden import fixtures |
| R-017 | Medium | Editor performance degradation | Large document makes tree/inspector unusable | Normalized graph, indexes, virtualization, budgets |
| R-018 | Medium | Documentation drift | Operators run removed/unsafe commands | Generated command/path/version validation |
| R-019 | Medium | Overpromised universal round trip | Unsupported code patterns get damaged | Capability classification and read-only/needs-review states |
| R-020 | Medium | Audit log sensitive data | Logs retain source, PII, tokens, form values | Event allowlist, redaction, retention, integrity checks |
| R-021 | Medium | Approval staleness | Approved plan differs from applied plan | Approval bound to hash/revision/target/expiry |
| R-022 | Medium | Localization route collision | Locales generate duplicate or wrong routes | Locale route graph and publish validation |
| R-023 | Medium | Interaction accessibility | Animation hides content or ignores reduced motion | Reduced-motion/initial-state policy and tests |
| R-024 | Medium | Analytics privacy or editor-ID leak | Tracking ignores consent or exposes internal IDs | Runtime consent API and publish-safe identifier mapping |
| R-025 | Medium | Commerce replay/duplicate side effect | Webhook/command charges or orders twice | Idempotency, provider event ledger, test mode |
| R-026 | Low | Trade-dress/IP confusion | Product appears to copy Webflow branding/interface | Clean-room naming, original visual system, legal/trademark review |
| R-027 | Low | Plan/price assumptions go stale | Hard-coded Webflow-like quotas/prices become inaccurate | Capability/entitlement model and configurable quotas |
