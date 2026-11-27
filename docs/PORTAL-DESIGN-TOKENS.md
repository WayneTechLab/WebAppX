# Native portal design tokens

This source contract documents the bounded shared vocabulary for original WX-0701, with semantic focus anchors supporting WX-0061 and WX-0715. Implementation starts from tested/published source `db6f078ed5b705b8787ab5f704f6f701d9d5923d`. The changes described here require their own focused and integrated verification; this guide is not a CI, browser, publication or accessibility acceptance receipt. Existing dated receipts retain their original source and observation scope.

## One finite vocabulary

The application stylesheet imports twelve shared properties from [the portal stylesheet](../src/portals/foundation.css). They apply through explicit portal classes; domain status colors, brand accents, existing grids, saved records and role behavior remain with their current owners. There is no theme selector or new persistence key. Spacing uses rem units so the existing large/x-large text preference scales it.

| Token | Value | Meaning and consuming class |
| --- | --- | --- |
| `--portal-surface-base` | `#fafafa` | Workspace canvas; `portal-surface-base`. |
| `--portal-surface-raised` | `#ffffff` | Record/form panel; `portal-surface-raised`. Borders retain the existing panel separation. |
| `--portal-surface-muted` | `#f5f5f5` | Supporting context or empty state; `portal-surface-muted`. A muted surface does not mean disabled or hidden. |
| `--portal-space-control` | `0.75rem` | Gap between related controls; `portal-space-control` on a flex/grid group. |
| `--portal-space-panel` | `1.25rem`; `1.5rem` from a `40rem` viewport | Panel interior padding; `portal-space-panel`. |
| `--portal-space-section` | `1.5rem` | Gap between grid/flex sections; `portal-space-section`. `portal-section-stack` applies this value between visible block siblings. |
| `--portal-emphasis-primary` | `#171717` | Main heading/field text; `portal-emphasis-primary`. |
| `--portal-emphasis-secondary` | `#525252` | Supporting explanation; `portal-emphasis-secondary`. |
| `--portal-emphasis-quiet` | `#666666` | Additional metadata with readable labels; `portal-emphasis-quiet`. This is text priority, not permission to omit important information. |
| `--portal-focus-ring-color` | `#171717` in the sample; HR `#047857`, CMS `#4338ca`, CRM `#0369a1` | Existing native accent family, set by the corresponding `portal-workspace-*` shell. |
| `--portal-focus-ring-width` | `2px` | Visible keyboard outline width. |
| `--portal-focus-ring-offset` | `3px` | Outline clearance from the focused target. |

`portal-focus:focus-visible` consumes all three focus properties. It does not remove the browser outline from unrelated controls. The existing high-contrast preference retains its stronger `3px` current-color outline and offset through its existing priority. Reduced motion and typography preferences retain their existing behavior.

Text emphasis is independent from action priority and domain state. Primary buttons retain their existing dark/sky styling; approval/refusal/ready statuses keep explicit labels and existing colors. The tokens do not make an inaccessible label readable by color alone.

## Actual bounded consumers

| Native surface | Surface, spacing and emphasis consumers | Visible focus and semantic scope |
| --- | --- | --- |
| [HR workspace](../src/hr/components/HrWorkspace.tsx) | Base shell; raised shared `Panel` and fields; muted synthetic-identity context; control gap in onboarding review actions; panel padding; main section grid; panel headings/notes and employee-count metadata. | Shared fields/buttons, workspace/list headings and employee-record links. HR retains supported subsection mounting, role/person restrictions and its separate interviewer early-return surface. |
| [CMS workspace](../src/cms/CmsDemo.tsx) | Base shell; raised panels/fields; muted activity context/empty published state; related portal controls; panel padding; section stack/content grid; workspace/list headings, explanation and identity metadata. | Shared controls/headings; actual entry ID in each editor title/slug/body target, selected heading and entry-selector target. Existing DOM IDs remain for labels/local validation; they alone are not history identity. |
| [CRM workspace](../src/crm/CrmDemo.tsx) | Base shell; raised shared `Panel` and fields; muted action-inbox context/empty state; portal control gap; panel padding; inbox section spacing; panel headings/notes and dashboard metadata. | Shared fields/buttons and active subsection headings; lead action and company-heading keys include actual record IDs. Existing merge controller, authorization, latest-state confirmation and privacy projections are unchanged. |

This is a bounded conversion of shell/shared panel/control styling, not a replacement of every domain component. Record tables still scroll in their existing containers; no token imposes a fixed content height, clips full captures or hides status text.

## One rendered sample

[`PortalDesignTokens`](../src/portals/PortalDesignTokens.tsx) exports one provider-independent sample component for the portal directory. It imports no router, workspace model or persistence provider. Root integration mounts it once on the existing directory; there is no new route.

The visible **Portal design tokens** sample names and demonstrates every property:

- Three labeled base/raised/muted surface panels.
- Control gap, panel padding and section/column gap examples with rem values.
- Three labeled primary/secondary/quiet text examples.
- A read-only fictional **Focus sample field**. Tab to it to inspect the actual outline; the nearby labels name color, width and offset. Reading/focusing the sample creates no workspace action or save.

The sample uses wrapping labels, `min-w-0`, responsive columns and a full-width field. It must be reviewed at the normal desktop viewport and at `390px` with x-large text after integration. A source token declaration or text-content assertion alone does not prove visible, unclipped rendering or readable focus.

## Walkthrough copy compatibility

The three surface banners use the workspace handle's optional `mode`, defaulting to `browser` for custom-provider compatibility. Their browser-mode persistence sentences remain verbatim. Walkthrough mode instead says changes stay in memory and uses the shared canonical refresh message. Known individual-import result notices use `storagePresentationMessage`; arbitrary domain results, labels, reasons and filenames are not rewritten. This is presentation only: no model, save adapter, mode-selection architecture or navigation behavior changes here.

The earlier 69-case preservation checkpoint preceded this narrow copy amendment. It must not be relabeled as execution against later bytes; subsequent source checks and root's integrated browser/CI gates provide their own boundaries.

## Semantic navigation anchors

The focus coordinator owns capture, accepted navigation and latest local-focus arbitration. These three surfaces provide its live DOM contract:

| Attribute | Contract |
| --- | --- |
| `data-nav-workspace` | Exact `hr`, `cms` or `crm`. |
| `data-nav-scope` | Opaque tuple including an unconditional React `useId` component-lifetime identity, explicit browser/walkthrough mode, current actor and replacement epoch. CMS binds actor; CRM also binds active local tab; HR binds portal, role and mapped person/contractor. A new session/remount cannot inherit exact-target authority merely because actor/epoch values repeat. |
| `data-nav-active` | Actual current supported module path, not just a retained HR return path. Hidden/detached ancestors must still fail the coordinator's live validity checks. |
| `data-nav-focus` | Semantic key for a workspace/list/control/record target. Record keys contain the actual record ID. Reused `edit-title` is not a sufficient identity. |
| `data-nav-heading` | `workspace` or `list` only on its actual heading. Such headings have `tabIndex=-1` for deliberate programmatic focus; this does not insert them into the normal Tab sequence. |
| `data-nav-fallback` | Ordered space-separated semantic keys. A fallback does not select an actor/record, reveal a tab or authorize hidden content. |

Stable fallback headings are `hr:workspace` and `hr:<portal>:employees`; `cms:entries` then `cms:workspace`; and active `crm:<tab>` then `crm:workspace`. CRM tabs remain presentation at `/crm/demo`; anchors do not invent tab routes or emit navigation events. List headings in hidden retained tabs are invalid focus destinations. The coordinator may then use the outer active page/main heading when no valid module target remains.

Existing local validation, Keep editing, cancel and recovery/Undo focus has priority over a deferred navigation focus request. These markup additions do not replace those callbacks. Browser Back to a removed CMS entry must not focus another entry through the same input DOM ID; a removed, out-of-scope or changed-session record instead falls back to a valid active list/workspace heading. The actual keyboard/Back/removal evidence belongs to the integrated navigation proof, not this guide.

## Verification and acceptance boundary

Use scoped ESLint and TypeScript plus the existing focused portal/dirty-form checks to detect integration regressions. The coordinator's independent pure tests cover validity/arbitration. Integrated browser proof must use actual keyboard navigation, Back/Forward, hidden/removed record cases, local-focus priority and normal/390px/x-large sample rendering. Inspect actual outline and label screenshots, not only extracted text.

No provider, deployment, native Windows execution, manual screen-reader session or production security follows from these source changes. WX-0656's separate manual announcement evidence remains outside this scope. Root records actual gates and canonical acceptance after integration; this source guide does not mark any criterion complete.
