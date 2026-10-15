# Developer prerequisites and portal browser smoke — 2026-10-14

This wave starts from clean WebAppX `main` at
`4731702ec7bfdcaec60ac4d42e23b03f330f5d74`, verified against direct GitHub
`main`. Its local acceptance scope is **WX-0001**, the developer prerequisite
report, and **WX-0652**, the automated cross-portal browser smoke journey,
including its **WX-0651** named synthetic seed dependency.

## Developer prerequisite report

```bash
npm run doctor
npm run --silent doctor -- --json
# Available even before npm or app dependencies are installed:
node scripts/developer-prerequisites.mjs
```

The dependency-free Node report checks the running Node executable, npm, Git
and Python using bounded local argument arrays without a shell. The documented
requirements are Node **>=24.0.0** and Python **>=3.12.0**. npm and Git must
return parseable installed versions; no minimum is specified for them. Exit
codes are 0 for success, 1 for unmet checks and 2 for invalid CLI arguments.
Help does not probe tools. JSON mode excludes npm headers when invoked with
`--silent`; the direct Node entry point also emits clean JSON with `--json`.

Each probe has a five-second timeout and 64 KiB output cap. Reports omit raw
command failures, environment values and absolute executable paths. Windows npm
uses its standard CLI through Node. Windows Python fallback lists installed
runtimes with `py -0p` and directly probes an installed local interpreter;
launcher install flags are disabled/removed. It does not launch `py exec` or
installation commands. This follows the
[Python Windows launcher documentation](https://docs.python.org/3/using/windows.html).

The observed Mac report passed with Node **25.8.1**, npm **11.11.0**, Git
**2.54.0** and Python **3.14.5**. Version readiness does not establish app
dependency installation, Windows runtime acceptance, Firebase/Java/GitHub CLI
readiness or provider activation.

## Repeatable account-free browser smoke

```bash
npm ci
npm run browser:install
npm run browser:smoke
# Optional visible browser / chosen artifact parent:
npm run browser:smoke -- --headed
npm run browser:smoke -- --output /path/to/local/artifacts
```

The root package and lockfile pin **@playwright/test 1.64.1**. Browser installation
is an explicit setup step; the smoke runner never downloads software. Playwright
requires browser binaries matching its installed version; see the
[official browser setup guide](https://playwright.dev/docs/browsers).

The runner allocates an available loopback port with an OS-assigned temporary
listener, closes that allocator and starts its own Vite server with the selected
positive port and strict binding. A raced port occupant causes failure; the
runner never reuses or stops another listener. Vite 8 treats configured port
zero as the default port, so the positive-port handoff is intentional.

Vite keeps its dependency cache inside the run's temporary artifact directory,
separate from an existing development server's cache. It ignores environment
files, inherited client configuration is blanked, and
Firebase emulators/local sessions remain disabled. A fresh Chromium context
blocks service workers, external/provider/backend requests and WebSockets other
than its own dedicated HMR path. The runner uses no existing browser profile,
account, local saved workspace, production endpoint or SDK session.

The reviewed seed is
[`webappx-portal-smoke-v1`](../tests/browser/fixtures/portal-smoke-v1.json), with
recorded SHA-256:

```text
ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02
```

Its exact bytes, complete domain validators, current canonical defaults and
recorded dashboard totals are checked before browser startup. The scoped Git
attributes retain LF bytes on Windows checkouts. Ordinary smoke runs cannot
regenerate the fixture or digest; the explicit maintainer generator requires
`--write` and review of both files.

| Portal | Reviewed starting totals | Real UI change |
| --- | --- | --- |
| HR | 3 people, 1 time entry awaiting approval, 0 confirmed benefits, 0 submitted payroll receipts, 1 goal, 2 open reviews | Create a fictional performance goal for Avery |
| CMS | 1 draft, 0 awaiting review, 0 approved revisions, 1 published sample | Save the sample article with a new title as revision 2 |
| CRM | 2 active leads, $6,500 open pipeline, $0 won, 1 open follow-up | Create a fictional lead with an `.invalid` email |

The automated journey compares the fresh complete export to the named seed,
then changes one real domain record per portal through visible controls. After
each reload it compares the complete downloaded bundle to independently written
expected records, including exact receipts and unchanged portals. It checks
dashboard counters and final saved envelopes, preserves the app's original
accessibility preference, and requires no account cookies. A second clean
context must export the untouched seed with no inherited domain saves. Browser
errors, failed HTTP requests and unexpected backend/provider traffic fail the run.

Reports, downloaded synthetic snapshots, screenshots and a trace are written to
a fresh temporary directory by default. The report includes origin and cleanup
results; local absolute artifact paths remain outside tracked release files.
Success, assertion failures, startup failures and interruption all close owned
resources. The existing user preview at its separate origin is preserved.

## Verification results

- **18 prerequisite tests passed**, covering version boundaries, missing tools,
  malformed output, process errors/timeouts/signals/output caps, text/JSON/help
  exit behavior, shell-free argument arrays, Windows npm invocation and Python
  alias/listing fallback with installation flags removed.
- **16 seed/runner guard tests passed**, covering exact-byte hash drift, rejected
  seed identity, dashboard-total drift, invalid cross-links, changed defaults,
  independent expected deltas, network and environment isolation, argument
  rejection, real OS allocation/release, preservation of a listener on the
  default development port, and cleanup on success/failure/interruption.
- **Seven browser gates passed** on an allocated test origin. The final focused
  run recorded both `browserClosed: true` and `serverClosed: true`. It observed
  only the expected unset Firebase configuration warning, with no browser
  errors, failed HTTP requests or external/provider/backend traffic.
- HR goals increased from **1 to 2** with `MOCK-PERF-0001`. The CMS article
  persisted its new title at **revision 2** with `MOCK-CMS-0001`. CRM active leads
  increased from **2 to 3** with `MOCK-CRM-0001`; open pipeline stayed **$6,500**.
  Complete exports after each reload exactly matched independent expected
  records, including every unselected portal. The second context returned the
  unchanged baseline and no domain saves.
- Independent source review found no material unresolved findings. It inspected
  assertion quality, fixture integrity, subprocess/read-only behavior, network
  boundaries, strict port allocation and owned-resource cleanup; it did not
  claim Windows or provider runtime acceptance.
- A real negative invocation with an empty browser-cache override returned exit
  1 with `npm run browser:install` guidance. It did not download anything; its
  report confirmed the owned Vite server closed, and a socket check confirmed
  that allocated test port no longer listened.
- The catalog regression fixtures now explicitly prepare TODO/DONE rows instead
  of assuming the first live item is still TODO. This fixes the full CI issue
  exposed when WX-0001 became complete while preserving all 13 negative and
  round-trip catalog checks.

Agent 0 accepted **WX-0001, WX-0651 and WX-0652** for this scope. Together with
the earlier two completions, the unchanged 1,000-record catalog now has **5 done
and 995 TODOs**, including **162 P1, 675 P2 and 158 P3 TODOs**. Each new completion
links this receipt and its original reviewed source base.

## Final publication gates

- **`npm run ci:all` passed**, including the real prerequisite report, 18 doctor
  tests, 16 seed/runner tests, 13 catalog tests, 235 shared SYSTEMX cases (five
  filesystem-specific skips), 36 host integration cases, eight security
  operations cases, 11 app/LAN cases, 116 HR cases and 114 portal cases.
- The integrated browser gate passed all **seven checks** on its allocated
  loopback origin with a fresh optimizer cache. Its report recorded successful
  browser/server cleanup, exact seed hash and complete persisted payloads.
- Template seeds, immutable releases and research fingerprints, SYSTEMX
  validation/drift, lint, TypeScript, Markdown links, security/auth/AI checks,
  root and optional backend dependency audits, production build and LAN
  isolation passed. Dependency audits reported zero vulnerabilities.
- **`npm run deploy -- hosting --preflight` passed** and skipped version/changelog
  mutation, commit, push and deployment. Version remained 3.4.0/deploy count zero.
- The standalone **`sync:system:check` reported no drift**. The live upstream
  preview verified public main `3fb59429c878268f1081ca255a1f32fafc5dcfba`, alpha.6,
  identical complete source trees, no additions or bootstrap replacements and
  no applied import.
- The wiki preview rendered **58 pages** and the five expected page updates.
  Source/wiki publication references and final remote parity are reported in
  the delivery handoff.

These checks cover the native account-free smoke journey, not complete HR, CMS
or CRM workflow, accessibility, cross-browser or provider acceptance. Earlier
manual QA receipts retain their historical scope.

Managed SYSTEMX remains manually pinned to **1.9.0-alpha.6**. Immutable releases,
research checksums, original import provenance and blank reusable execution
records are preserved. App version remains **3.4.0**, deployment count **0**.
