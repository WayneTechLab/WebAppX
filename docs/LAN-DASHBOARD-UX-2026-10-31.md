# LAN dashboard layout and interaction review — 2026-10-31

The user reported clipped menus/components, excessive submenu descriptions, a
misplaced header menu and preview viewport shifts during selection/navigation.
This host UI work is part of the active F003/F004 candidate; final browser qualification has passed; publication is qualified separately
by remote readback. The separate Code-OSS fork is
[planned work](LAN-VSCODE-FORK-PLAN.md), not a delivered editor.

## Research and design decisions

[Webflow's interface guide](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow)
describes a central canvas with top-level workspace/page/actions, left structure
panels and right element tools. LAN retains that organization. Our engineering
inference is to make frequent page/action controls concise and keep optional
route, target and provenance details in an explicit disclosure. Webflow's save
behavior does not grant LAN automatic source-write authority.

[W3C disclosure navigation guidance](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
uses ordinary navigation links and expanded-state buttons, with Escape closure
and focus handling; a navigation dropdown need not claim a complex ARIA menu
role. LAN retains native links/buttons/details and verifies keyboard behavior.
The [W3C toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
requires keyboard focus management if a toolbar widget is declared. LAN's
ordinary grouped controls keep native Tab order; visual toolbar styling alone
is not a claim of a fully implemented ARIA toolbar widget.

## Observed causes and implementation

- An implicit sidebar grid column expanded beyond its selected width. At the
  live Components view, a 219-pixel client contained 617 pixels of scroll width;
  card and form tracks were roughly 599 pixels. Explicit shrinkable tracks,
  bounded native fields and wrapped metadata address the actual content size.
- Older five-column responsive selectors overrode the newer seven-track shell.
  Correct cascade priority preserves chosen resize widths and usable compact panes.
- Hidden search left header actions in an intermediate grid column. Header flex
  alignment and a dropdown anchored to the same header keep the trigger/menu at
  the right edge. Long menus scroll within available height.
- Repeated explanations crowded working controls. Longer instructional copy is
  available through Help/More info, with concise action constraints/status visible.
- Growing breadcrumb text consumed canvas height. Optional workspace details
  use a bounded popover so selection metadata cannot grow the primary header.

Symbols are decorative and retain text/accessible names. Narrow navigation,
component forms, hierarchy, inspectors and footer controls must stay reachable
with mouse and keyboard. Compact focus preserves each sidebar's pin preference;
hidden panes leave the focus order. Quick find is visible when invoked even if
its normal header field is collapsed.

The preview follow-up also removes automatic inspector opening on single-click
selection/restoration, preserves a same-workspace/origin iframe on status
refresh, and compares its actual SPA URL for explicit page navigation. Interact
passes normal app clicks; Inspect selects, and double-click explicitly edits.
Fixed device width now describes iframe content width with borders outside it;
removing the width animation avoids intermediate responsive sizes.

## Final candidate qualification

The exact final candidate responsive run passed **25/25 groups** across 1440, 1163,
900, 768 and 390-pixel viewports, with preserved source/fixtures/inputs. Stable
393-pixel iframe content was measured inside a 395-pixel bordered viewport.
The existing source-editor and Navigator regressions passed after retaining
and repairing earlier failures. Candidate `aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0`
passed all 73 CI stages and separate Hosting preflight with 2,111 tracked inputs
unchanged. In the real 1,164px browser, Fit readouts matched actual frame widths
after panel resizing (777/777 then 765/765) and fixed393 → Fit (393/393 → 765/765).
Read the [candidate-bound QA receipt](LAN-IDENTITY-OWNERSHIP-QA-2026-10-31.md).

## Acceptance and remaining delta

The responsive browser harness exercises desktop and compact viewports against
real copied assets with synthetic fixtures, retaining failures and exact hashes.
The actual WebAppX browser view was reloaded and read back separately, preserving
source drafts and the same mock-workspace origin; owned emulator data was exported
and reimported before restart. F003/F004 acceptance is 400 requirements / 80
capabilities. GitHub source/wiki and Page delivery use separate final readbacks.
No production deployment or custom native editor build is established here.
