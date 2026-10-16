# Adopt a private WTL webapp clone

Choose the destination and review the identity checklist below before creating
an app. This example describes deliberate adoption; it does not create a
repository, configure services or record a successful installation. Native
HR/CMS/CRM mocks need no Firebase or Gusto account. Starting a mock or passing
preflight does not authorize a production deployment.

For an authorized new private repository, substitute your reviewed destination:

```bash
# Requires repository access. Choose your own destination and Firebase configuration.
gh repo create my-private-app --template WayneTechLab/WebAppX --private --clone
cd my-private-app
npm ci
npm run systemx:status
npm run systemx:validate
npm run dev:systemx
```

Use the [locked installation guide](../DEPENDENCY-INSTALLATION.md) to select
Node/npm before `npm ci`. For account-free evaluation without emulators,
`npm run dev:mock` starts only the native app. The integrated `dev:systemx`
session has its own installed-tool prerequisites and readiness boundaries.

## Review five identity categories

1. **Repository and destination.** Choose the private repository owner/name,
   remote and local folder explicitly. Keep the public template source separate
   from private work. After configuring the adopted remote, this supported
   read-only observation checks the expected identity:

   ```bash
   npm run repository:identity -- --expected-repository OWNER/REPO --json
   ```

   `OWNER/REPO` is your reviewed destination, not a literal template value.
   The [identity command](../REPOSITORY-IDENTITY.md) reads local Git and contacts
   that reviewed GitHub remote's main; it is not an offline check, a fetch or
   permission to create/publish a repository. Inspect unavailable/refused
   observations before continuing. `gh repo create` above is a separate
   authorized creation action.
2. **Package identity.** Review [`package.json`](../../package.json) `name`,
   [`package-lock.json`](../../package-lock.json) top-level `name` and
   `packages[''].name` together. If maintaining the sibling starter, review its
   [manifest](../../.SYSTEMX/Template/starter/package.json) and
   [lock](../../.SYSTEMX/Template/starter/package-lock.json) independently. The
   optional [Functions package](../../integrations/gusto/functions/package.json)
   and its lock have their own deliberate identity. Preserve version/runtime
   selections and dependencies unless separately changing them; avoid blind
   string replacement or regenerating locks merely to review the names.
3. **Site branding.** Review [`index.html`](../../index.html) title, description
   and OpenGraph fields; [`public/favicon.svg`](../../public/favicon.svg),
   [`public/robots.txt`](../../public/robots.txt),
   [`HomePage.tsx`](../../src/pages/HomePage.tsx),
   [`Navbar.tsx`](../../src/components/layout/Navbar.tsx),
   [`Footer.tsx`](../../src/components/layout/Footer.tsx), the public README and
   chosen brand assets. Review corresponding starter fields if retaining that
   distribution. Inspect [`siteControls.ts`](../../src/config/siteControls.ts)
   separately for enabled site controls. A package or remote rename does not
   replace rendered branding; verify the adopted app's actual pages.
4. **Deployment target.** [`.firebaserc`](../../.firebaserc) starts with
   `your-firebase-project-id`. Review it together with
   [`firebase.json`](../../firebase.json),
   [`firestore.rules`](../../firestore.rules),
   [`firestore.indexes.json`](../../firestore.indexes.json),
   [`storage.rules`](../../storage.rules) and approved environment configuration.
   Select any Hosting target/project deliberately; leave unused targets and
   services unconfigured. Keep secrets in approved local/backend storage, never
   in public template files. Read [service setup](../GETTING-STARTED.md#configure-services-and-deployment) and
   [environment boundaries](../ENVIRONMENT-CONFIGURATION.md) before activation.
5. **Project records.** Configure the adopted outer
   [`.SYSTEMX/project.json`](../../.SYSTEMX/project.json) metadata and reviewed
   check/command argument arrays. Populate only the adopted project's accepted
   GLOBAL, PLAN, WORK, MEMORY and AGENTS records, following
   [`.SYSTEMX/START-HERE.md`](../../.SYSTEMX/START-HERE.md). Reusable public seeds
   remain blank; private project history never goes upstream. Preserve selected
   `INSTALLATION.json` and immutable release snapshots. Installation/import
   behavior follows the [managed integration contract](../SYSTEMX-INTEGRATION.md)
   and explicit reviewed imports.

## Verify the selected adoption scope

After the deliberate edits and locked installation, use source/report checks:

```bash
npm run development:check
npm run environment:check
npm run systemx:status
npm run systemx:validate
node scripts/fixture-inventory.mjs --check
npm run template:check
```

Review each result's scope. `template:check` checks template/starter integrity;
intentional adopted divergence needs review rather than rewriting immutable
fingerprints or copying over private records to make it pass. Source reports do
not establish service health, provider adoption, native Windows behavior or
publication. Run the app's relevant tests and required publication gates at the
appropriate final source boundary. This documentary checklist executes none of
those actions.

## Preserve records during later updates

The template ships blank context, plan, task and memory records. Configure
`.SYSTEMX/project.json` for your application and populate only your own accepted
work. Retain the selected managed release snapshot and `INSTALLATION.json`
together. Use `npm run systemx -- roles-init` to preview event/review role setup;
activate roles explicitly in the adopted project when needed.

For an existing application, use the reviewed standalone additive installer
instead of copying a template over existing records. Keep its existing ledger,
code, service configuration and authority boundaries.

For later standalone updates, keep a reviewed dotSYSTEMX source checkout on the
machine and use `WTL_SYSTEMX_SOURCE=/path/to/dotSYSTEMX npm run systemx:upstream:check`.
See [integration](../SYSTEMX-INTEGRATION.md) for the complete import/verification flow.
