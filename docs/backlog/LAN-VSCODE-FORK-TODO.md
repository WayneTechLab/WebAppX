# LAN tailored Code-OSS fork — additive TODOs

Created **2026-10-31 (America/Los_Angeles)** from the owner's request to plan a
custom editor fork for the LAN builder. **32 proposed tasks; 0 accepted.**
All implementation, functional, installed, provider and publication evidence is
currently absent for this new fork program. The research/plan document is a
planning deliverable, not completion evidence for these future tasks.

Read the [fork plan and official source basis](../LAN-VSCODE-FORK-PLAN.md) before
selecting implementation work. The intended direction is an independently
branded maintained **Code-OSS source fork**, with an owned LAN extension/bridge
and separately qualified native/browser experiences. No fork, native install,
registry, account, signer or update service is created by this list.

`LAN-IDE-*` IDs are additive proposal references, not new entries or renumbered
items in the fixed [WebAppX 1,000-item catalog](WEBAPPX-1000-TODO.md) or
[LAN 10,000-requirement catalog](LAN-10000-TODO.md). Those authored definitions,
progress receipts and their acceptance rules remain unchanged. The
[active LAN iteration](../LAN-ACTIVE-ITERATION.md) retains its separate goal.
Blank reusable project/context/task/plan/memory seeds and managed release
snapshots remain untouched.

## Proposed work and acceptance

Every row is **planned and unaccepted**. The Evidence column names required
future artifacts; it does not assert that those artifacts exist. Dependency
numbers refer to the same `LAN-IDE-` prefix. An adopted implementation scope can
split a large task deliberately while preserving its original acceptance and
provenance; it must not mark a whole row done from one partial fixture or worker
exit.

| State / ID | Proposed task | Acceptance criterion | Required evidence / dependencies |
| --- | --- | --- | --- |
| [ ] LAN-IDE-001 | Define product charter and integration owner | Name intended users, owned product/repository, LAN scope, single canonical writer, initial runtime/platform targets, maintenance owner and measurable first slice. | Owner-reviewed charter and source/runtime/production boundaries. No dependencies. |
| [ ] LAN-IDE-002 | Record desktop/browser/extension architecture decision | Compare desktop fork, source-built browser workbench, extension prototype and Monaco-only scope; select the fork delivery path and explicit browser limitations. | Architecture decision with resource/UX tradeoffs and actual future proof criteria. Depends on 001. |
| [ ] LAN-IDE-003 | Review redistribution licenses and notices | At the selected source revision, inventory source/assets/native modules/extensions; preserve required notices and exclude components lacking a redistribution basis. | Versioned license/SBOM inputs and maintainer review; no Marketplace bypass. Depends on 005. |
| [ ] LAN-IDE-004 | Create independent product identity overlay | Specify owned name/icons, bundle/app IDs, protocols, data/extension folders, issue/support and service URLs without overwriting Microsoft-branded installations. | Reviewed product overlay and side-by-side identity fixture; branding clearance record. Depends on 001, 003. |
| [ ] LAN-IDE-005 | Pin upstream source provenance | Select exact Code-OSS upstream commit/tag, source hashes, license/version files and lockfiles; distinguish upstream and downstream revision identities. | Read-only provenance manifest and verification output. Depends on 001. |
| [ ] LAN-IDE-006 | Establish separate fork and upstream workflow | Use the explicitly selected fork repository and branch policy; record upstream remote, minimal patch series, update/revert procedure and inherited Actions review. | Verified repository/branch/root observations and reviewed upstream-sync rehearsal in a temporary copy. Depends on 003, 005. |
| [ ] LAN-IDE-007 | Add fork build prerequisite report | Derive tools/native dependencies from the pinned source rather than WebAppX assumptions; declare supported build paths, architecture and unavailable prerequisites. | Read-only preflight reports for macOS arm64, Windows x64 and ARM64; no automatic installs. Depends on 002, 005. |
| [ ] LAN-IDE-008 | Define stable extension/core patch boundary | Keep LAN behavior in owned extension modules where stable APIs suffice; enumerate necessary core changes and reject hidden proposed-API dependencies. | API/patch inventory, compatibility tests and upstream-update cost review. Depends on 002, 005. |
| [ ] LAN-IDE-009 | Build and launch clean desktop baseline | Reproduce the selected Code-OSS desktop source build using isolated profiles; launch without touching an existing editor, project source or provider account. | Build recipe/logs, artifact hashes, actual rendered launch and preservation readback. Depends on 003, 004, 006, 007. |
| [ ] LAN-IDE-010 | Prove browser-workbench capability boundary | Build the separately selected web target and show supported extensions, unavailable Node/process features and explicit companion requirements. | Browser trace and capability/refusal matrix, not desktop-derived compatibility claims. Depends on 002, 007, 008. |
| [ ] LAN-IDE-011 | Specify versioned LAN bridge protocol | Define bounded messages, allowed origins, request IDs, workspace/revision/generation binding and capability checks; refuse arbitrary shell/path payloads. | Protocol schema and known-bad, stale, cross-workspace and oversized-message tests. Depends on 008. |
| [ ] LAN-IDE-012 | Integrate canvas and preview webview safely | Display the LAN canvas beside source using restricted resource roots/CSP and validated messages; keep untrusted preview content outside execution authority. | Desktop/browser screenshots, message/refusal tests and zero unexpected network/write effects. Depends on 009, 011. |
| [ ] LAN-IDE-013 | Bind qualified document/node context | Consume reviewed identity/ownership APIs once available; reconcile selected route/node/source and show unresolved or stale references without guessing a writable target. | Cross-document/workspace collision, stale map, selection and provenance fixtures. Depends on 011 and accepted supporting LAN identity/ownership scope. |
| [ ] LAN-IDE-014 | Preserve guarded source editing and dirty drafts | Keep independent native/LAN drafts and original revisions; route mapped promotion through confirmation/backup/stale-save guards and reconcile external editor writes. | Real edit/conflict/recovery traces, exact predecessor backups and no-effect refusals. Depends on 011, 013. |
| [ ] LAN-IDE-015 | Surface source ownership and operation impact | Distinguish source/document/hybrid/unmapped selections, shared shell versus page impact, generated regions and unsupported structural operations. | Inspector readback and ambiguity/generated/opaque-source refusal evidence. Depends on 013, 014. |
| [ ] LAN-IDE-016 | Bind Git and canonical integration controls | Show exact repository/branch/head/dirty state and separate task worktrees; prevent a stale editor or worker UI from silently writing canonical main. | Multi-worktree/stale-handoff tests and owned Git action receipts. Depends on 011, 014. |
| [ ] LAN-IDE-017 | Add bounded Agent 0/X/Y/Z/Alpha workspace view | Use host swarm contracts for independent generations, review/lease/check state and evidence; webview messages cannot bypass provider or merge gates. | Positive/refusal integration tests plus explicit installed-provider versus fixture boundary. Depends on 016 and reviewed swarm protocol. |
| [ ] LAN-IDE-018 | Integrate owned terminal/emulator session controls | Display actual origin/ports/readiness and operate only proven owned processes; export/import owned emulator state before controlled restarts. | Native process/CWD/listener ownership, shutdown/readback and unrelated-listener preservation tests. Depends on 009, 011, 023. |
| [ ] LAN-IDE-019 | Select licensed extension distribution | Define owned/approved VSIX set and any alternative registry; record publisher/license/API/native/web/update requirements and unavailable features. | Extension compatibility/license inventory, reviewed registry terms and install/update refusal fixtures. Depends on 003, 009. |
| [ ] LAN-IDE-020 | Implement optional authentication/secret boundary | Keep base LAN account-free; configure only separately authorized service clients/scopes/callbacks and protected secret storage without copying product identities or app sessions. | No-account flows, callback/state/revoke tests and redacted storage/log/network inspection. Depends on 004, 011, 019. |
| [ ] LAN-IDE-021 | Define privacy and outbound traffic policy | Inventory product/extension telemetry, crash, update, experiment and auth traffic; make owned policy explicit and keep source/HR/private paths/tokens out of diagnostics. | Clean-profile egress capture, opt-in/off tests and bounded sanitized crash/export proof. Depends on 004, 019, 020. |
| [ ] LAN-IDE-022 | Isolate profiles, settings and extension data | Use separate owned user-data/extension folders and opt-in migration; refuse symlink/ambiguous targets and preserve installed VS Code/Codex settings. | Side-by-side profile, damaged-state, uninstall and migration preservation tests. Depends on 004, 009. |
| [ ] LAN-IDE-023 | Enforce restricted-workspace trust behavior | Permit safe inspection while disabling automatic task/provider/terminal/config execution until the appropriate workspace and action are authorized. | Untrusted/restricted/trusted transition tests, hostile workspace fixture and explicit disabled UI states. Depends on 008, 011. |
| [ ] LAN-IDE-024 | Qualify browser/native/remote boundary | Test URI/path/origin handling, CSP, workers, reconnect and local versus remote host resolution; do not treat remote localhost as the operator's machine. | Separate native, browser and supported remote capability/refusal traces. Depends on 010, 012, 023. |
| [ ] LAN-IDE-025 | Validate LAN layout and accessibility | Preserve structure/canvas/inspector orientation with keyboard traversal, focus restoration, readable diffs/ownership and supported narrow/high-contrast layouts. | Keyboard-only workflow traces, geometry/screenshots and accessibility findings resolved. Depends on 012, 014, 015. |
| [ ] LAN-IDE-026 | Exercise account-free portal workflows in the fork | Open HR/CMS/CRM and verify persistence/backup plus onboarding, payroll, benefits and time behavior without provider credentials or accidental real calls. | Actual fork/browser journey traces and saved-workspace/export preservation evidence. Depends on 012, 018, 021. |
| [ ] LAN-IDE-027 | Establish per-platform CI and native proof | Build/test/launch macOS Apple Silicon, Windows x64 and ARM64 separately; report unsupported native capabilities instead of inferring them from portable path tests. | Pinned CI logs, actual per-target launch/process/installer readback and explicit exclusions. Depends on 007, 009, 024, 025, 026. |
| [ ] LAN-IDE-028 | Add supply-chain and security maintenance gates | Track upstream/Electron/Node/native/extension advisories, locks/SBOM, artifact provenance and a scoped remediation procedure with private vulnerability intake. | Security ownership/SLA record, failing fixture and reviewed dependency/patch evidence. Depends on 003, 005, 019, 021. |
| [ ] LAN-IDE-029 | Produce owned installable packages | Package distinct product identities and notices; sign/notarize only through selected operator-controlled identities and prove installation/removal without affecting other editors. | Artifact hashes/signature verification and clean native installation/uninstall readback per target. Depends on 004, 027, 028. |
| [ ] LAN-IDE-030 | Design verified update channels and rollback | Use owned authenticated artifact channels with explicit versions/hashes and failure/rollback policy; do not retain Microsoft updater URLs or silently downgrade active work. | Tampered/stale/incomplete update refusals, signed update/rollback rehearsal and profile/source preservation. Depends on 021, 022, 028, 029. |
| [ ] LAN-IDE-031 | Add portable backup/migration/resume handoff | Back up owned settings and bounded workspace metadata; exclude credentials/runtime authority, validate imports and invalidate stale source/generation handoffs. | Cross-profile/machine import/refusal and rollback proof with exact artifact hashes. Depends on 014, 016, 022, 029. |
| [ ] LAN-IDE-032 | Accept a bounded release and support lifecycle | Review the original fork scope, all required platform/function/security evidence, extension limits, updater/support ownership and upstream refresh/end-of-support policy. | Agent 0/owner acceptance against exact revisions; separate package publication/readback and installed/operator acceptance records. Depends on 025–031 and unresolved required findings closed. |

## Acceptance and delta rules

For each selected task, retain its original criterion, dependencies, implementation
revision, independent review, exact terminal checks, relevant rendered/native
proof and known limits. Mark it complete only after Agent 0 or the owner accepts
that evidence. A source build, green CI, opened window, extension install or
GitHub push proves only its own boundary. Production/provider activation,
signing/publication and actual device state require their own authorization and
readback.

Current delta for all 32 proposals is **planned → implementation absent →
functional evidence absent → installed/provider/publication evidence absent →
unaccepted**. Research links support the decision to plan; they do not substitute
for any of those product checks. Existing LAN/F003/F004 work and ten-worker
execution keep their independent scope, budget, source revisions and acceptance.

When implementation is selected, start with 001/002/005, then licensing/product
identity and reproducible baseline. Keep extension/bridge, source adapters,
platform/package work and independent tests in bounded disjoint scopes. Agent 0
owns shared contracts and integration; do not duplicate mutable task state into
blank reusable seeds or edit either fixed catalog to inflate completion counts.
