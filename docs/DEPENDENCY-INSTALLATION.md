# Install dependencies from a clean checkout

## App and reusable starter

The root app and `.SYSTEMX/Template/starter` select **Node 24.22.0** in
`.nvmrc` and `.node-version`, declare **Node >=24.0.0**, and record
**npm 11.11.0** in `packageManager`. Use these checked-in versions when
preparing a clean checkout. The minimum engine range is a compatibility
declaration; it does not certify every later Node release. The
[runtime contract](DEVELOPMENT-CONTRACTS.md) explains how the declarations
are checked. The optional Gusto Functions package has a separate runtime below.

With `nvm-sh` already installed on macOS, select the app runtime from the
repository root:

```bash
nvm install
nvm use
node --version
npm --version
```

On Windows x64 or ARM64, read `Get-Content .node-version` in PowerShell and
select that exact version using your installed Node version manager. A runtime
selection on one architecture does not establish acceptance on another.
Ensure the selected npm version matches `packageManager` before installing;
Node's bundled npm version can differ. For a one-command invocation of the
recorded npm version without replacing your global CLI, use:

```bash
npm exec --yes --package=npm@11.11.0 -- npm ci
```

This explicit command may download the selected npm package into npm's cache.
If the selected shell already has npm 11.11.0, plain `npm ci` is sufficient.
The `packageManager` field records policy; it does not itself switch npm.
See the official [npm exec command](https://docs.npmjs.com/cli/v11/commands/npm-exec/).

## Locked installation and verification

```bash
npm ci
npm run development:check
npm run doctor
npm run browser:install
npm run dev:mock -- --port 5185
```

Run this sequence from the repository root after selecting Node and npm.
The explicit browser command downloads the Chromium version required by the
locked Playwright dependency. The final command prints the native account-free
portal directory on the selected loopback origin. Reuse that origin to access
the same browser saves. The mock workspace needs no Firebase or Gusto account.

`npm ci` requires the committed lockfile, rejects a package/lock mismatch,
removes an existing `node_modules`, and leaves package manifests and lockfiles
unchanged. It can contact the registry, use local caches and run dependency
lifecycle scripts. These are installation side effects, not read-only checks.
Do not silently substitute `npm install` when `ci` rejects a mismatch: review
the intended dependency change and regenerate its lockfile deliberately.
If a lockfile was created with dependency-shaping flags, the same settings
must be supplied for installation; review such project configuration with the
lockfile. See the official [npm ci contract](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

The root and starter have distinct lockfiles. When adopting the starter as its
own app, run `npm ci` inside that app's checkout; the root install does not
install a second copy of the starter dependencies. `development:check` compares
both declarations and lockfile root metadata without installing either one.
Full release validation uses `npm run ci:all`; inspect `npm run ci:plan` for
its actual stages and side effects. A successful install alone is not a test result.

## Optional Gusto Functions adapter

[`integrations/gusto/functions/package.json`](../integrations/gusto/functions/package.json)
declares **Node 22**, with its own
[`package-lock.json`](../integrations/gusto/functions/package-lock.json).
The app's root installation does not install this nested package. Native
HR/CMS/CRM mocks, including payroll and portable backups, run without it.

For adapter development, select an installed Node 22 release in a separate
shell using your version manager, verify `node --version` and `npm --version`,
then run these commands from the repository root:

```bash
npm --prefix integrations/gusto/functions ci
npm --prefix integrations/gusto/functions run check
npm --prefix integrations/gusto/functions test
npm --prefix integrations/gusto/functions audit --audit-level=high
```

The adapter declares only the Node major; no exact Node 22 patch or separate
package-manager pin is currently published for it. Record the selected patch
and npm version in any adapter execution receipt. The root app's Node pin is
not evidence that the Functions runtime was exercised. Return to the app's
selected runtime before running root commands.

These commands install, inspect and locally test source. They do not provision
Firebase, create Gusto credentials or deploy functions. The optional rules
emulator suite has its own prerequisites and acceptance boundary in
[Gusto Firebase setup](GUSTO-FIREBASE.md). Follow
[Gusto setup](GUSTO-SETUP.md) before explicitly enabling provider development.

## Troubleshooting and evidence

- **Lock mismatch:** review the package and its corresponding lock together;
  keep unrelated dependency updates out of a repair.
- **Wrong runtime:** compare `node --version` with the relevant app pin or
  Functions engine, and rerun `doctor` in the app shell.
- **Browser missing:** run the explicit `browser:install` command after the
  root install. Browser suites do not download Chromium automatically.
- **Registry/network failure:** retain the installation error and retry once
  access is available. A cached install is not proof that a fresh host can
  reach the registry.

This guide is checked against repository declarations. It does not claim a
new clean installation, Node 24/22 runtime execution, Windows acceptance or
provider/deployment verification; each execution needs its own scoped receipt.
