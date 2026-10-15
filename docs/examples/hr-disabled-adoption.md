# Adopt CMS and CRM without HR

This walkthrough builds an owned temporary app with working CMS and CRM screens
and removes HR from its runtime dependency graph. The default WebAppX source
continues to contain all three portals. Run the example locally:

```bash
node scripts/rehearse-hr-disabled.mjs
node --test tests/adoption/hr-disabled.test.mjs
```

The rehearsal accepts no target or output paths. It creates and removes its own
temporary directory, Vite cache, browser profile, downloads and loopback preview.
It chooses a free port and requires that exact port; it never borrows the user's
development server. It has a 180 second deadline. SIGINT and SIGTERM cancel owned
command children, close the owned browser and unwind through cleanup. The script
waits for in-flight operations to stop before removing their fixture, with an
eight second forced-exit fallback. Signal handlers are removed on normal finish.
Its JSON result identifies the
captured Git revision, source manifest fingerprint, reviewed override hashes,
module count, backup contract and verified browser scenarios.

Install the repository's pinned dependencies and Chromium first using the normal
setup workflow. The fixture references that installed `node_modules` directory
through an explicit runtime link. No dependency download or provider setup occurs
during rehearsal. The fixture is typechecked and built using those installed
tools. The source comes from committed Git blobs in an explicit app allowlist;
untracked files, ignored files, local secrets, `.git` metadata, active SYSTEMX
records and private project data are never copied. The script does not clone or
transform an actual adopted app.

## Review the adoption boundary

The public [reviewed overrides](../../tests/adoption/hr-disabled-overrides/src/)
replace the temporary app's router, portal directory, portal registry, workspace
factory, workspace provider and combined backup codec. The adopted router offers
only `/portals`, `/cms/demo` and `/crm/demo`. Removed HR entry routes, including
the SDK route, produce an unavailable page. The root route shows the directory.
No HR card or navigation link remains. The provider creates only CMS and CRM;
the factory has no HR fixture, validator or model import. The directory imports
the original CMS and CRM components, whose own navigation uses the adopted
two-module registry.

This is a focused two-module app shell. The general WebAppX marketing, login,
administration and other template pages are outside this example's route set.
Review and integrate the same boundaries deliberately in a real app. Hiding a
card in the default three-module directory leaves the HR imports and workspace
evaluation active and does not implement this adoption.

CMS and CRM domain models, screens, persistence hooks and individual backup
codecs are copied unchanged from the captured public revision. The temporary
package manifest removes the Gusto dependency and template scripts. The installed
dependency directory may still contain that package, but the build audits every
emitted JavaScript module and fails if it includes `src/hr/`, `integrations/gusto/`
or `@gusto/`. It also requires the CMS screen, CRM screen and individual codec
to appear in the emitted graph. This is an actual build graph check, independent
of whether a card is visible.

## Deliberate backup compatibility decisions

| Contract | Decision in this adopted example |
| --- | --- |
| CMS individual export/import | Keep `webappx-mock-workspace`, version 1, `module: cms`, complete CMS graph |
| CRM individual export/import | Keep `webappx-mock-workspace`, version 1, `module: crm`, complete CRM graph |
| Adopted combined export/import | New `webappx-adopted-cms-crm-workspaces`, version 1, exactly `cms` and `crm` |
| Default combined export | Reject `webappx-mock-workspaces`, including valid default three-module backups; no implicit HR stripping |
| HR individual export/import | Reject in both remaining individual import controls |
| Adopted bundle containing an HR key | Reject even when both other workspaces are valid |
| Existing recovery points and undo | Not adopted; no recovery codec or recovery UI is imported, and old envelopes are rejected as bundles |
| Existing browser HR save and recovery history | Leave unread and unchanged; do not silently delete or migrate them |
| CMS and CRM browser save keys | Keep their existing version 1 keys and complete envelopes |

The new bundle's four fields are `format`, `schemaVersion`, `exportedAt` and
`workspaces`. The codec reuses the unchanged individual validators for complete
graphs, timestamps, reserved keys and exact browser-save size budgets. It rejects
incompatible input before any storage write. Accepted bundle restore writes both
CMS and CRM save slots before replacing live state. A failed write attempts to
roll back every attempted slot, including a write that changed storage before
throwing. An unsuccessful rollback explicitly tells the user to keep the tab
open and export live workspaces before refreshing. This example creates no
automatic recovery checkpoint. Export current records before replacing them.

Individual exports retain full native state. They are not the CMS public
published-content projection or the CRM view limited to a selected preview
identity. Use fictional data only; all backup files are readable JSON.

## What the rehearsal verifies

The owned Chromium context starts with the committed named CMS and CRM defaults
plus deliberate legacy HR and recovery storage fixtures. Real rendered controls
save a CMS draft and create a CRM lead. Refresh must retain those changes, and
full individual downloads must match independently stated complete records and
receipts. The rehearsal resets and restores each portal through its unchanged
individual import UI, then exports and restores the adopted two-module bundle
through the new UI and checks both complete saved envelopes after reload.

Negative UI cases reject a default combined backup, old recovery history, an
extra HR workspace and HR individual backups without changing any browser slot.
An instrumented storage reader verifies the app never reads the old HR or
recovery keys. Those values remain byte-for-byte unchanged throughout the run.
Removed HR routes have no HR navigation or screen. Browser exceptions and
outbound requests fail the rehearsal.

These checks establish the temporary adopted app's local build and browser
behavior. They do not change the default template's backup format, configure a
provider, deploy an app or establish native Windows x64/ARM64 acceptance. A real
adoption still needs its own reviewed migration decision, branding, permissions,
and environment-specific verification.

The focused POSIX interruption tests fork the real CLI. One sends SIGTERM while
its actual typecheck child is alive; the other sends SIGINT after Chromium and
the preview listener are running. They check child-process termination, fixture
removal and listener closure. These process checks use `ps` and are skipped on
native Windows; the local proof was collected on macOS.
