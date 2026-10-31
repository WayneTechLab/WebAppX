# LAN tailored Code-OSS fork — proposed execution plan

Research reviewed **2026-10-31 (America/Los_Angeles)**. The owner requested a TODO
for a custom VS Code fork tailored to the LAN builder. This document records
that proposal and its evidence requirements. **No fork, build, installation,
account configuration or distribution has been performed by this planning work.**

The recommended product direction is an independently branded, maintained fork
of Microsoft's **Code-OSS source**, with LAN integration kept in a small owned
extension/bridge wherever the stable API permits. The fork is the intended
product; an extension prototype is a way to validate its boundary, not a claim
that the requested fork already exists. Product name, repository, upstream
commit and release channels remain to be selected for implementation.

The additive [32-item fork backlog](backlog/LAN-VSCODE-FORK-TODO.md) has **zero
accepted items**. Its `LAN-IDE-*` proposal IDs do not modify the fixed WebAppX
1,000-item catalog or the authored 10,000 LAN definitions/progress. The current
[active LAN iteration](LAN-ACTIVE-ITERATION.md) retains its own scope, acceptance
and delivery gates.

## Source, licensing and product boundary

The [Microsoft repository license](https://github.com/microsoft/vscode/blob/main/LICENSE.txt)
permits modification and distribution under MIT conditions, including retention
of its copyright and permission notice. That is the source starting point.
Microsoft's [repository/distribution explanation](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code)
distinguishes Code-OSS from its branded distribution, proprietary assets and
service integrations. A source fork does not acquire those separate assets or
service rights.

Use a new product identity, icon set, application identifiers, data directories,
protocols and support endpoints. Microsoft's [trademark guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks)
treat its names/icons/logos as protected brand assets. Preserve lawful
attribution without presenting the fork as Microsoft Visual Studio Code or a
Microsoft-endorsed build. Review each redistributed component and bundled
extension at the selected source revision; the repository's MIT license is not
a blanket license for every external download.

The current [Microsoft FAQ](https://code.visualstudio.com/docs/supporting/faq#_extensions)
explicitly excludes alternative forks from Visual Studio Marketplace access and
restricts Microsoft Marketplace extensions outside its product family. Do not
copy the official gallery endpoints or bypass checks/handshakes. Plan for an
owned, licensed extension set and reviewed VSIX installation; an alternative
registry needs its own terms, publisher, license and security review. Eclipse's
[Open VSX configuration guidance](https://github.com/eclipse-openvsx/openvsx/wiki/Using-Open-VSX-in-VS-Code)
is a candidate configuration reference, not permission to redistribute every
extension or override Microsoft's current service restrictions.

## LAN product shape and runtime choices

Preserve the familiar structure/canvas/inspector arrangement. The tailored
workbench should offer file editing and diffs beside the LAN canvas, page and
source selection, identity/ownership feedback, account-free portal previews,
local session controls and a revision-bound swarm/evidence view. Native IDE
features must not silently replace LAN's guarded write path or Agent 0's
canonical integration ownership.

| Option | Proposed role | Qualification boundary |
| --- | --- | --- |
| Maintained Code-OSS desktop fork | Preferred first product slice: own branding/configuration plus LAN extension, workspace integration and native development tools. | Build, launch and package from the selected source; independently qualify filesystem, process, credentials and installer behavior on each target OS. |
| Source-built browser workbench with owned companion | Separate LAN-hosted browser experience after its backend/message protocol is proven. Keep command execution in a constrained authenticated local companion. | Browser-only extensions cannot use Node APIs; filesystem/process support, origin/CSP/worker behavior and reconnect must be demonstrated rather than inferred from desktop. |
| LAN extension in a development Code-OSS build | Early integration harness shared with the eventual fork; minimize core patches and measure what stable APIs cannot express. | A successful extension prototype proves its stated APIs and UX, not branded fork packaging, updater or native acceptance. |
| Monaco-only browser editor | Possible focused code-editor control inside existing LAN. | This is a different reduced scope, not delivery of the requested full workbench fork or a general VS Code extension host. |

Microsoft documents the browser-host distinction and missing Node runtime in
its [web extension guide](https://github.com/microsoft/vscode-docs/blob/main/api/extension-guides/web-extensions.md).
The [Monaco project](https://github.com/microsoft/monaco-editor) supplies a browser
editor, not proof of complete workbench/extension compatibility. The option
ranking above is an engineering recommendation for LAN, not an upstream claim
that these integrations have been tested.

## Proposed component and repository boundaries

Keep the upstream fork in its own explicitly selected repository. Do not vendor
an entire editor source tree, Electron binary or mutable editor profile into the
WebAppX reusable template. Track the exact upstream commit/tag, source archive
hashes, downstream patch list, dependency lockfiles, licenses and release recipe.
Keep upstream and fork release identities distinct.

The following paths are **future layout proposals**, not existing implementation:

```text
<selected Code-OSS fork>/
  extensions/systemx-lan/       owned LAN extension and stable API contributions
  build/systemx/               reviewed branding, packaging and release overlays
  test/systemx/                fork/bridge/native workflow acceptance fixtures

<selected WebAppX checkout>/
  .SYSTEMX/LAN/Builder/ide-bridge/   versioned local protocol adapter if needed

<private execution state>/       profiles, build caches, credentials, signing state
```

Prefer owned extension modules and explicit build overlays over broad changes
to upstream workbench internals. Freeze an API compatibility layer where core
patches are unavoidable. Microsoft's [proposed API guidance](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)
marks proposed APIs unstable; do not quietly make a private proposal dependency
look like a supported stable contract.

The [current source-access policy](LAN-SOURCE-POLICY.md),
[identity/ownership work](LAN-IDENTITY-OWNERSHIP.md) and its
[execution plan](LAN-IDENTITY-OWNERSHIP-PLAN-2026-10-30.md) define the source-side
constraints. Their implementation and acceptance are independently gated; this
fork plan does not accept those requirements or assume every proposed mapping
is available. The fork must consume a versioned, reviewed read/command boundary,
not scrape labels or invent writable ownership from a preview element.

## Desktop/browser bridge and write policy

The extension should use ordinary workbench views for file/context selection
and a webview only where the interactive LAN canvas needs it. Microsoft's
[webview guide](https://github.com/microsoft/vscode-docs/blob/main/api/extension-guides/webview.md)
describes separate webview contexts and message passing. Define strict message
DTOs, bounded payloads, request IDs, allowed origins, CSP, local resource roots
and explicit capabilities. Do not give preview HTML or a webview raw shell,
arbitrary file or provider-token access.

Bind every writable action to the current workspace identity, qualified object,
source path, source byte revision, operation scope and user confirmation. Route
source promotion through the existing guarded backend, preserving stale-write
refusal, generated/read-only regions, backups and independent editor drafts.
File watching or editor autosave must not bypass those checks. If a native editor
uses a separate ordinary file-write path, make that authority explicit and treat
its changes as new external revisions requiring LAN reconciliation.

Keep single-root and multi-root selection explicit. Stale IDE/Codex handoffs,
workspace changes, extension-host restarts and remote/local authority changes
invalidate retained operation capability. Microsoft's [remote extension guide](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
explains UI/workspace host separation; test local loopback resolution and
forwarding deliberately instead of assuming that remote `localhost` is the
operator's machine.

The fork's [workspace-trust integration](https://code.visualstudio.com/api/extension-guides/workspace-trust)
should leave safe inspection available while disabling task/provider/process
execution in restricted workspaces. Trust is not a substitute for the selected
source/operation policy or explicit provider authority. Apply the
[swarm operating contract](SYSTEMX-SWARM.md),
[operational map](SYSTEMX-SWARM-MAP.md) and
[access matrix](SYSTEMX-SWARM-ACCESS-MATRIX.md): Agent 0 remains canonical writer;
UI controls do not inherit unconditional merge, process-stop or deployment power.

## Authentication, extension and privacy decisions

Account-free HR/CMS/CRM and source inspection must remain usable without a
Microsoft, GitHub, Gusto or AI-provider account. Any optional service gets its
own reviewed adapter, OAuth client/redirect policy, permissions and secret-store
handling. Do not copy Microsoft product client IDs, tunnel/server binaries,
Copilot entitlements, Marketplace extensions or authentication tokens into the
fork. Installed provider access is a separate user-selected capability; a fork
does not inherit the Codex app's conversation or account.

Create an extension compatibility inventory: source/license, publisher,
redistribution grant, engine/API version, desktop/web/native requirements,
network behavior, supported features and update source. Candidate registry
availability is not proof of extension compatibility, licensing or safety.
Restricted or unavailable extensions need an honest unsupported state.

Inventory and test outbound traffic with no account. Remove or replace product
telemetry, update, crash, experiment, survey and authentication endpoints as
appropriate to the owned product. Upstream [product configuration](https://github.com/microsoft/vscode/blob/main/product.json)
contains product/application/data/protocol settings; audit its selected revision
rather than assuming one name replacement covers distribution behavior.
Microsoft's [telemetry documentation](https://code.visualstudio.com/docs/configure/telemetry)
notes that extension telemetry can be separate from product telemetry controls.
Require explicit policy and evidence for the fork and its bundled extensions;
keep source, private paths, HR data, credentials and raw provider output out of
logs/crash exports by default.

## Build, platform and release sequence

1. **Record the fork charter and source baseline.** Select ownership, independent
   branding, repository, upstream commit, licenses, supported runtime and initial
   extension set. This plan creates no repository or provider action.
2. **Produce a reproducible unbranded baseline.** Follow the selected revision's
   [upstream contribution/build instructions](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
   and its own runtime/version files. Capture host tools and native dependencies;
   use a suitable build path. Do not substitute WebAppX's Node constraint for
   the fork's source requirements. Review inherited fork Actions before use.
3. **Prove the LAN extension/bridge.** Start with read-only context and preview,
   then qualified source operations, account-free portal flows and managed local
   sessions. Validate independent dirty drafts, denied operations and reconnect
   before exposing swarm controls.
4. **Qualify desktop and browser separately.** macOS Apple Silicon, Windows x64
   and Windows ARM64 are required product targets. Each needs actual build/launch,
   keyboard, filesystem and installer evidence. Portable path fixtures do not
   qualify native Windows Git/ACL/process behavior. Do not lift the host swarm's
   current native-process refusal merely because the editor launches.
5. **Package, update and support an owned product.** Preserve license notices and
   SBOM; sign/notarize through deliberately configured identities. Establish
   reviewed channels, authenticated artifacts, downgrade/rollback behavior,
   crash/support routing and a regular upstream security refresh. No signing
   identity, updater endpoint, installer or publication is activated by this plan.

Desktop/browser smoke tests should cover source conflict/recovery, damaged
profiles, origin/port changes, extension failures, account-free onboarding,
payroll/benefits/time and CMS/CRM persistence/backup. Measure startup, memory,
canvas latency, large-workspace and terminal behavior against an explicit
baseline. Keep these proposed product metrics separate from existing LAN test
results and avoid a blanket parity or superiority claim.

## Delta, acceptance and maintenance

| Boundary | Current state from this task | Evidence required later |
| --- | --- | --- |
| Research and planning | Official sources reviewed and 32 additive TODOs authored. | Recheck mutable docs and pin the actual source revision before implementation. |
| Source fork / integration | Not created or implemented by this task. | Fork provenance, reviewed patch set, tests and independently reviewed LAN bridge. |
| Working local product | Not built, installed or launched by this task. | Native desktop and separate browser traces, source preservation and failure/recovery proof. |
| Authentication / extensions | No account, registry or extension configured. | Per-service authority and extension license/runtime/security evidence. |
| Publication / device state | No package, update channel or device installation produced. | Signed artifact/readback, clean installation/upgrade/rollback and maintainer ownership. |
| Catalog acceptance | Zero fork TODOs accepted; existing catalogs untouched. | Each additive ID needs original criterion, exact revision, terminal evidence and Agent 0/owner acceptance. |

The first implementation handoff should name the selected fork repository,
upstream revision, product identity, extension policy, platform build owner and
bounded LAN bridge slice. Maintain one canonical integration writer and a small
reviewed downstream delta; record upstream merge conflicts and security fixes
without rewriting earlier proof. Microsoft's [security policy](https://github.com/microsoft/vscode/blob/main/SECURITY.md)
provides upstream reporting guidance; the fork also needs its own private
reporting, triage, patch and end-of-support process.

Managed SYSTEMX snapshots, research packages/checksums, reusable seeds,
React/Vite/Firebase app, kits and the existing LAN session remain preserved.
This planning task changes only this document and its additive TODO file.
