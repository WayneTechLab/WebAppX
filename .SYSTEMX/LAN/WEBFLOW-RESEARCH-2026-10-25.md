# Webflow research refresh for the SYSTEMX LAN builder

**Research/access date:** 2026-10-25, America/Los_Angeles
**Status:** sourced product research and proposed requirements; implementation acceptance is separate
**Audit baseline supplied by Agent 0:** WebAppX `e73aa4f`
**Scope:** improve the current LAN builder's functionality while preserving its familiar canvas, left structure panel, right inspector, top commands, and compact responsive controls.

The most useful immediate increment is better orientation in the existing live
preview: a discoverable current-DOM hierarchy, search, selected-element reveal,
and clickable ancestor breadcrumbs. It can improve everyday inspection without
pretending that a DOM projection is the canonical editor document. Structural
editing, cascade-aware styling, reusable component behavior, CMS bindings, and
agent mutations still depend on the kernel and command work in the existing
[master plan](WEBFLOW-DEEP-RESEARCH-MASTER-PLAN.md).

This is a dated refresh alongside the 2026-08-05 packages. It does not replace
their catalogs, manifests, checksums, historical evidence, or architecture.
Neither research package nor any managed release snapshot was edited. This
research did not start a background research workspace, scheduled task, runtime,
provider integration, publication, or production deployment.

## Evidence and confidence

- **Documented fact:** a capability or constraint stated in an official source
  in the source register. This records documentation, not an authenticated
  hands-on test of a Webflow account or every commercial plan.
- **Repository observation:** code or contracts inspected at the pre-increment
  baseline. Presence in source does not establish a fresh browser test.
- **Inference:** a conclusion drawn from those facts; it is identified as such.
- **Proposed requirement/advantage:** a LAN direction needing implementation and
  measured evidence. No broad claim that LAN is already better is established.

Official Help Center pages were opened directly where possible. Their displayed
update dates are retained below; developer pages without a visible date are
marked accordingly. Search snippets sometimes lagged direct pages: Navigator,
shortcuts, Intro, AI components, and MCP had newer direct-page text. Exact prices,
quotas, and unpublished vendor internals are outside this study. S25 was verified
through the official search result; direct retrieval redirected to an inaccessible
Zendesk access page, so its delivery details remain less directly verified.

## Repository baseline and boundaries

The [capability manifest](Builder/contracts/capability-manifest.json),
[LAN README](README.md), [UX contract](LAN-BUILDER-UX-RESEARCH.md), and
[dashboard source](Website/dashboard.js) were inspected. The existing research
package's [method](Research/Webflow/01-RESEARCH-METHOD.md) and
[package contract](Research/Webflow/RESEARCH-PACKAGE-README.md) remain historical
references with their original research cut.

| Pre-increment observation | Practical implication |
| --- | --- |
| The shell already centers a live Vite preview between structure and inspector surfaces; panel widths, open states, and responsive controls exist. | Preserve these positions. Improve tasks within the shell before adding another workspace or replacing its layout. |
| Live element selection, parent menu, source location/mapping, text preview/revert/save, and parent/child/sibling arrow selection already exist. | Extend selection consistency; do not present existing inspection or arrow navigation as new capabilities. |
| `renderPreviewLayerTree` renders the selected element's ancestor chain plus at most ten immediate children. Breadcrumbs name the page and current element. | The selected Navigator increment addresses discovery, context, and reveal. Its baseline limitation is narrower than a complete page hierarchy. |
| The manifest supports loopback control, session authority, read models, allowlisted inspection, guarded fixtures/source writes, port ownership, and production isolation. | Preserve host/origin/token checks, backups, secret rejection, atomic promotion, and owned-process boundaries. |
| Canonical document, transactional journal, AST structural editing, style engine, full component/CMS behavior, publish/restore, and extension clients remain planned in the manifest. | Schema files and panel labels alone do not prove those workflows. A read-only DOM tree does not complete the planned Designer kernel. |

The report uses that baseline deliberately. Agent 0 owns the separate Navigator
implementation, tests, capability decisions, and final integration. Changes from
this run must be reported against the verified final revision rather than
silently promoting the baseline observations into release claims.

## Comparison that informs the work

| Area | Documented Webflow behavior | LAN direction and present boundary |
| --- | --- | --- |
| Workspace and orientation | Canvas-centered interface, left structure/navigation tools, right styles/settings/interactions, clickable hierarchy breadcrumbs, hierarchy selection/reveal, and keyboard navigation. S01–S03. | Retain the existing shell. Complete the read-only orientation increment first. Search is a proposed LAN requirement: this review did not establish text search inside Webflow's Navigator. |
| Styling and responsive design | Reusable selectors, states, inheritance indicators, affected-element counts, reset, directional breakpoint inheritance, and expanded side-by-side breakpoint editing. S04–S05. | Viewport presets and font browsing do not constitute a cascade engine. Show provenance and write scope before enabling broader style persistence. |
| Design systems | Typed variables, collections, aliases, manual/responsive modes; component definitions, instance properties, slots, variants, and a focused component canvas. S06–S10. | Staged module metadata is a useful starting point. Versioned definitions, true instances, typed props/slots, dependencies, migrations, and source ownership remain separate work. |
| CMS | Typed collection schemas and references, staged/live content, explicit item publication/unpublication, and schema publication requirements. S11–S12. | Local CMS/CRM fixtures are not production content binding. Add schema-checked local binding and lifecycle evidence before provider writes. |
| Developer surfaces | Data, Designer, and Browser APIs have different purposes; DevLink supports component-level React export and externally owned React imports. S10, S13–S14. | Model current-checkout commands, provider APIs, browser preview, and publication separately. Do not claim universal bidirectional React editing. |
| Cloud and local development | Cloud supports Vite, Next.js, Astro, local development, server routes, storage bindings, and Git/CLI deployment. Its Workers runtime has partial Node compatibility. S15–S18. | React/Vite/local testing alone is not a distinguishing advantage. A useful proposed distinction is explicit evidence for local OS/process tools and this repository's Firebase emulator contract. |
| AI and agents | AI site generation, editable React AI components, MCP, role-based access, snapshots, agent presence, and Enterprise review surfaces exist, with documented constraints. S19–S23. | Treat AI as a client of bounded commands. Dry runs, revision checks, source diffs, rollback, and acceptance must work before broad mutations are exposed. |
| Portability | Static code export exists but omits important hosted capabilities. DevLink and Enterprise custom hosting are separate routes with different boundaries. S10, S14, S24–S25. | Publish a tested target-by-target portability manifest rather than promising that an HTML ZIP, React export, and a hosted app preserve the same behavior. |

**Inference:** editor quality depends on consistent identity, selection,
provenance, and change scope across panels. A familiar layout becomes more useful
when every visible action has a truthful contract. Recreating more panel labels
before those contracts exist would not establish functional parity.

## Sequenced requirements and acceptance evidence

These requirements refine the existing wave order; they do not replace it.
The read-only orientation slice can proceed independently because it grants no
new source mutation. Kernel and transaction foundations still gate structural,
style, component, CMS, and agent writes.

| Order | Proposed requirement | Evidence required before accepting it |
| --- | --- | --- |
| R01 — selected increment | Extend the current Navigator to discover the live page hierarchy, filter by useful labels, reveal the selection, and select ancestors through breadcrumbs. Preserve the three-panel shell and current inspection actions. | Deep and wide synthetic DOM cases; selection from canvas, tree, search, breadcrumbs, and keyboard agrees; no source/provider write is possible through navigation; focus, typing, reload, and route changes are tested. |
| R02 — orientation quality | Show clear scope: current rendered page, selected node, source location or unmapped state, hidden status where discoverable, and any tree budget/truncation. Keep DOM identity separate from durable source identity. | Duplicate labels, more than ten children, hidden/off-screen nodes, detached nodes, empty results, and bounded large trees remain understandable. Search does not silently omit results or reinterpret a node as another after rerender. |
| R03 — foundation | Modularize the existing server behind versioned contracts, then introduce stable `DesignerDocument` identities and explicit `source-owned`, `document-owned`, or `hybrid-controlled` ownership. | Repeated import is idempotent; unsupported source remains read-only; source ambiguity is visible; accepted imports preserve unrelated source and immutable packages. This follows existing Waves 1–2. |
| R04 — reversible writes | Add revision-bound commands, atomic transactions, command journal, semantic diff, undo/redo, replay, and conflict rejection before structural source editing. | One operation changes only its declared scope; stale revisions fail closed; undo/redo/replay produces expected document and source digests; backup/rollback and existing write guards pass. Existing Waves 3 and 5 apply. |
| R05 — style truth | Build selector/state/breakpoint/token semantics with an explanation of each computed value and its edit target. Start with read-only provenance where source adapters cannot safely persist changes. | Explain a value inherited from a parent, class, token, state, or media rule; show affected elements before shared edits; reset reveals the expected inherited value. Test all supported widths, not only preset screenshots. |
| R06 — reusable components | Distinguish component definition from instance, declared props/slots from arbitrary children, and authored code from generated artifacts. Add version/dependency/migration rules before a library action changes all instances. | Two instances with different props/slots stay distinct; definition changes propagate only as declared; migration has preview, rollback, and unsupported-content refusal. Component previews include variants and responsive cases. |
| R07 — local data before cloud writes | Introduce schema-checked fixture bindings, references, missing-data handling, and explicit draft/review/published states; label mock, emulator, provider, and production data separately. | A synthetic collection renders in preview; invalid references and required fields are actionable; a draft never becomes production content through a local save; every provider action proves target and scope. |
| R08 — release and portability | Produce addressable preview/release manifests tied to source, build configuration, artifact digest, data schema, target, and restore scope. List features that remain provider-bound. | Restore drill verifies the claimed scope; exported components/forms/assets/data behave according to the target matrix; unsupported features are reported before export or publish. A command exit is not live acceptance. |
| R09 — agents and extensions | Expose the same query/command registry to CLI/MCP/plugin clients with per-capability authority, dry-run proposals, revision checks, and sanitized evidence. | An agent can inspect, propose, and validate a change without implicitly publishing; stale/concurrent operations reject; required review and source ownership survive every client. Preserve Agent 0 integration authority. |

For R01–R02, preserve usable canvas width, independently scrollable panels,
persisted non-secret panel preferences, explicit focus indication, and narrow
screen focus behavior from the existing UX contract. Scope shortcuts so typing
in inputs, editing source/text, and interacting with the product preview do not
accidentally navigate or mutate the builder. A rendered-DOM tree may not expose
unmounted routes, virtualized content, closed shadow roots, or cross-origin
frames; disclose the actual inspection scope instead of claiming source-wide
completeness.

**Proposed advantage hypotheses:** quicker target discovery, clearer edit
ownership, fewer unintended shared-style changes, and more reproducible review
for a repository already under local development. Validate them with the same
synthetic tasks before and after each increment: find a deeply nested CTA,
inspect an off-screen element, trace an inherited style, change one component
instance, preview a draft record, and restore a reviewed change. Record task
success, time, wrong-target selections, unrelated diffs, and recovery success.
No comparative performance or usability claim is accepted until measured.

## Current official source register

All sources below were accessed on **2026-10-25**. Dates are the page's displayed
update dates, without an assumed timezone; “not exposed” means none was visible
in the retrieved developer page. Statements are paraphrases. Source titles and
links provide attribution; no vendor source code or protected visual assets are
included.

| ID | Official source | Documented capability or boundary used here | Displayed update |
| --- | --- | --- | --- |
| S01 | [Intro to Webflow](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow) | Canvas is the primary workspace. Surrounding toolbars separate navigation and properties; the canvas bar includes breadcrumbs, undo/redo, and breakpoint controls. Breadcrumb parents are selectable. General Quick find spans several resource types. | 2026-10-14 22:20 |
| S02 | [Navigator](https://help.webflow.com/hc/en-us/articles/33961320786451-Navigator) | Page hierarchy supports expand/collapse, selection, reorder, hover synchronization, off-screen reveal, and hard-to-select/hidden elements. Pinning and resizing are documented for wider browsers. | 2026-10-14 19:35 |
| S03 | [Keyboard shortcuts](https://help.webflow.com/hc/en-us/articles/33961359609875-Keyboard-shortcuts-in-Webflow) | Parent/child/sibling selection and panel shortcuts are documented, with Windows modifier equivalents. Shortcut discovery is available in the interface. | 2026-10-14 19:02 |
| S04 | [Style panel overview](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview) | Selectors, classes, states, inheritance, affected-element counts, property sections, focus mode, and applied-style indicators make style scope discoverable. | 2025-07-22 14:49 |
| S05 | [Breakpoints overview](https://help.webflow.com/hc/en-us/articles/33961300305811-Breakpoints-overview) | Desktop styles flow toward smaller and larger breakpoints; overrides have directional scope. Expanded canvas shows breakpoints together. Structure/order/content changes apply across breakpoint views. Added large breakpoints cannot currently be removed. | 2026-09-02 17:40 |
| S06 | [Variables](https://help.webflow.com/hc/en-us/articles/33961268146323-Variables) | Color, size, percentage, number, and font variables support functions, collections, aliases, and manual/responsive modes. Cross-collection aliases target the referenced collection's base mode. | 2026-09-21 22:04 |
| S07 | [Component canvas](https://help.webflow.com/hc/en-us/articles/49505240420755-Component-canvas) | Variants can be inspected together; definition changes affect instances. Props/slots customize instances while definition structure/styles remain shared. Availability differs by editing context. | 2026-07-31 10:15 |
| S08 | [Component properties](https://help.webflow.com/hc/en-us/articles/33961219350547-Component-properties) | Content, switch, and collection-list properties allow controlled instance differences; supported content types include text, rich text, image, link, video, number, and switch. | 2026-09-02 17:40 |
| S09 | [Slots](https://help.webflow.com/hc/en-us/articles/33961195339923-Slots) | Slots make component instances composable through placeholders for other components, with documented nesting and placement constraints. | 2026-08-28 16:13 |
| S10 | [Component type overview](https://help.webflow.com/hc/en-us/articles/44650915153811-Webflow-component-type-overview) | Native visual components and AI components are Webflow-owned. Imported DevLink React components are externally code-owned. Native export, code import, and AI component portability differ. | 2026-04-29 09:45 |
| S11 | [Manage CMS Collections](https://help.webflow.com/hc/en-us/articles/33961244391059-Manage-CMS-Collections) | Collections define a schema and template; fields include references and multi-references. Schema changes need full-site publication; fields in use cannot simply be deleted. | 2026-08-18 20:01 |
| S12 | [Publishing with the CMS API](https://developers.webflow.com/data/docs/working-with-the-cms/publishing) | Data API v2 separates staged and live content. A live item can retain draft changes; setting `isDraft` does not by itself unpublish it. Explicit unpublish and direct-live update operations exist. | Not exposed; v2 |
| S13 | [API, CLI, and SDK reference](https://developers.webflow.com/reference) | Data API manages site resources; Designer API extends visual authoring; Browser API executes on published sites. These are different execution and authority surfaces. | Not exposed |
| S14 | [DevLink Export quickstart](https://developers.webflow.com/devlink/docs/quick-start/quick-start-component-export) | Native components export as React for React frameworks. Export is component-based, refreshes generated files, and leaves separate application code outside its generated directory. Supported-element/runtime requirements apply. | Not exposed |
| S15 | [Optimizing an app for Webflow Cloud](https://developers.webflow.com/webflow-cloud/environment/framework-customization) | Cloud supports Next.js, Astro, and Vite, including multiple Vite UI frameworks. Vite local development and optional Workers/binding emulation exist. Server routes are supported. Client-prefixed variables remain browser-visible. | Not exposed |
| S16 | [Node.js compatibility](https://developers.webflow.com/webflow-cloud/environment/nodejs-compatibility) | Workers has partial Node compatibility and polyfills; some package methods can still fail at runtime. Full Node host/process/filesystem behavior cannot be inferred. | Not exposed |
| S17 | [Cloud storage overview](https://developers.webflow.com/webflow-cloud/storing-data/overview) | Persistent storage includes SQLite, key-value, and object storage. Declared bindings connect application code to provisioned resources. | Not exposed |
| S18 | [Cloud deployments](https://developers.webflow.com/webflow-cloud/deployments) | Git/CLI app deployments are separate from site publication. Failed builds retain the preceding successful deployment. Rollback rebuilds a prior code version; it does not restore every former deployment state. | Not exposed |
| S19 | [Data API scopes](https://developers.webflow.com/data/reference/scopes) | Permissions differ by resource, token type, and read/write scope. Custom-code endpoint access is limited to Data Client apps. A connection is not universal mutation authority. | Not exposed; v2 |
| S20 | [MCP server overview](https://help.webflow.com/hc/en-us/articles/52536562285203-Webflow-MCP-server-overview) | Role-scoped MCP supports design/content, native interactions, snapshots without an open session, agent presence, and Cloud operations. Selection-dependent canvas actions need the Bridge App. Some locale creation, binding, and element settings remain unsupported. | 2026-10-22 17:48 |
| S21 | [CLI command reference](https://developers.webflow.com/cli/command-reference) | The canonical `apps` namespace is documented as pre-release `@next` only; stable `cloud` commands differ. Version/channel, session, target, and destructive flags need explicit verification. | Not exposed |
| S22 | [Build AI code components](https://help.webflow.com/hc/en-us/articles/51168990228499-Build-AI-code-components) | React components can be generated, visually edited, and edited as code. Current constraints include single-file components, limited internal canvas interactions, no DevLink export, stripped code exports, and unsupported database/auth/secret management requests. | 2026-10-01 20:04 |
| S23 | [AI site builder](https://help.webflow.com/hc/en-us/articles/38840145286035-Build-a-site-with-Webflow-s-AI-site-builder) | Site generation proposes pages, sections, content, and themes. It applies to new or already AI-generated sites, rather than arbitrary existing sites. Regeneration replaces the proposed structure and its edits. | 2026-09-11 22:33 |
| S24 | [Code export](https://help.webflow.com/hc/en-us/articles/33961386739347-How-do-I-export-my-Webflow-site-code) | Eligible Workspace plans export HTML/CSS/JS/assets. The ZIP omits hosted CMS/commerce functionality, code components, most localized content, password protection, search, and form processing; collection data has separate CSV export. | 2025-10-31 14:05 |
| S25 | [Custom hosting overview](https://help.webflow.com/hc/en-us/articles/46223183211155-Webflow-custom-hosting-overview) | Enterprise custom hosting is a separate deployment/integration offering, including CMS and form workflows. Static ZIP limitations must not be generalized to all Webflow deployment paths. Official search-result confirmation only. | 2026-07-02 14:27 |

## Unverified gaps and follow-up boundaries

1. This review did not test an authenticated Webflow workspace, commercial
   entitlements, product performance, accessibility conformance, or every edge
   case. Documentation coverage does not prove an equivalent LAN feature.
2. Complete source round-tripping, generated-code quality, import fidelity,
   component migration, CMS binding correctness, and restore behavior need
   repository fixtures and deterministic tests. Neither screenshots nor a source
   schema settle them.
3. The Cloud guide and current CLI reference differ in command/channel examples.
   Any later integration must pin and inspect its chosen CLI version and
   credential destination before adopting commands. No integration was made here.
4. Current Webflow snapshots, agent presence, activity logs, branches, and
   deployment history prevent claims that these concepts are absent there.
   Stronger LAN review or reproducibility is a hypothesis for this repository's
   workflow and needs demonstrated evidence.
5. The original kernel wave plan remains open. Navigator acceptance must not
   close unrelated foundation items, establish production readiness, imply that
   the saved unfinished HR foundation bundle was applied, or authorize publication.

Agent 0 should attach the implemented R01 evidence to the normal repository
handoff and keep the rest as sequenced requirements. Publication, if later
authorized, still requires the repository's `ci:all`, Hosting preflight, drift
check, and explicit production authorization rules. Template copying additionally
requires `template:check`.
