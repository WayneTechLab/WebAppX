# 19 — Threat Model and Security Architecture

## Assets

- repository source and history;
- local filesystem outside the repo;
- secrets/credentials and provider identities;
- Firebase/GCP/Stripe/Drive/other provider resources;
- CMS/CRM/form/customer data;
- document/journal/backups/release evidence;
- code components/plugins/dependencies;
- published site and domains;
- operator identity and approval authority.

## Adversaries and failure sources

- malicious site visited in the same browser attempting localhost requests;
- compromised browser extension;
- malicious or vulnerable LAN plugin/code component;
- prompt injection through imported content, source comments, CMS data, or web research;
- over-privileged AI/MCP client;
- dependency/supply-chain compromise;
- accidental operator target selection;
- path traversal, symlink escape, zip bombs, parser bombs;
- stale revision/lost update;
- malicious project imported for inventory;
- leaked secret in source/log/evidence/build;
- XSS/code embed/CSS injection in preview or published output;
- provider replay/duplicate webhook/action;
- unauthorized publish or role escalation;
- corrupt/missing backup or nondeterministic release.

## Trust boundaries and controls

### Browser -> loopback server

Threats: CSRF, DNS rebinding/host confusion, stolen session token, oversized body, malicious origin.

Controls:

- bind only approved loopback addresses;
- validate `Host` and `Origin`;
- random per-session token held in memory;
- `SameSite`/custom header strategy and no permissive CORS;
- allowed methods/content types/body limits;
- schema validation;
- rate limits and request IDs;
- CSP/frame policy for dashboard;
- token invalidation on session stop.

### Server -> repository

Threats: traversal, symlink escape, arbitrary file read/write, race, stale diff, partial write.

Controls:

- canonical realpath under allowlisted roots;
- reject symlinks or verify resolved target;
- extension/object capability allowlists;
- base hash/revision precondition;
- temp-file + fsync + atomic rename;
- restrictive permissions;
- backups and restore verification;
- parse/format/type/lint/build before promotion;
- no shell interpolation.

### Importer -> parsed project

Threats: malicious syntax/resource exhaustion, prompt injection, secrets/private files, huge repos.

Controls:

- inventory-only by default;
- file/size/count/depth/time limits;
- ignore secrets/build/vendor directories;
- parser workers with timeout/cancellation;
- treat text as untrusted data, never instructions;
- no execution of project code during inventory;
- explicit adapter install/bridge after review.

### Plugins/code components

Threats: exfiltration, editor DOM takeover, dependency compromise, infinite loops, secret access.

Controls:

- signed/hash-pinned manifest;
- sandboxed origin/runtime;
- capability allowlist;
- network/storage deny-by-default;
- dependency policy/SBOM/license scan;
- timeout/memory/message limits;
- no Node/fs/env in browser preview;
- owner-approved install/update;
- kill switch and quarantine.

### Provider adapters

Threats: wrong account/project/environment, excessive scopes, replay, destructive write, secret leakage.

Controls:

- target identity query before write;
- emulator/test default;
- least privilege and short-lived auth;
- idempotency keys;
- dry-run/preflight;
- explicit live approval bound to target/diff;
- sanitized evidence;
- rollback/compensation;
- quotas and cost guardrails.

### Publish

Threats: stale/dirty source, failed gates bypassed, LAN leakage, domain takeover/misroute, irreversible schema change.

Controls:

- immutable snapshot;
- commit/tree hash;
- required gate policy;
- public artifact scan;
- domain/project verification;
- approvals and release manifest;
- smoke/monitoring;
- rollback and data migration plan.

## Security test matrix

- hostile Origin/Host requests;
- missing/replayed/expired token;
- method/content-type/body limit bypass;
- traversal and encoded traversal;
- symlink race;
- secret-shaped source and binary upload;
- malformed JSON/schema and prototype pollution;
- XSS in names/content/comments/CMS/asset metadata;
- CSS/URL/embed sanitization;
- parser timeout/zip bomb/large tree;
- unauthorized command for every role;
- stale revision conflict;
- plugin capability and origin escape;
- provider target mismatch;
- duplicate external command/idempotency;
- build leakage markers;
- audit redaction and integrity;
- backup restore drill.

## Residual risk policy

Every accepted risk records severity, affected capability, owner, rationale, compensating controls, evidence, expiry, and release applicability. Expired risk blocks publication until reviewed.
