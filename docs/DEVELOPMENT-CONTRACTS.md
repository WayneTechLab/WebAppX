# Runtime and client environment contracts

The root app and `.SYSTEMX/Template/starter` both pin **Node 24.22.0** in
`.nvmrc` and `.node-version`, declare **Node >=24.0.0** in `engines.node`, and
record **npm 11.11.0** in `packageManager`. The exact Node selection gives a
fresh shell a reproducible starting point. The minimum engine declaration
matches the dependency-free doctor; it does not certify every newer runtime.
Node 24.22.0 was the LTS selection checked against the
[official Node releases page](https://nodejs.org/en/about/previous-releases)
on 2026-10-15. Review a later patch explicitly when updating these files.

With `nvm-sh` already installed on macOS, run:

```bash
nvm install
nvm use
node --version
npm --version
npm ci
```

The first command downloads the pinned runtime if needed; these are operator
setup commands. The maintenance checker itself never downloads or installs.
For Windows x64 or ARM64, read `.node-version` in PowerShell with
`Get-Content .node-version`, then select that exact release in your installed
Node version manager before `npm ci`. `.node-version` also serves tools that
understand that standard filename. Selecting the version alone is separate
from verifying app behavior on that architecture.

## Read-only maintenance checks

```bash
node scripts/check-development-contracts.mjs
node scripts/check-development-contracts.mjs --json
node --test tests/setup/development-contracts.test.mjs
```

The check fails when root and starter `engines` or `packageManager` differ,
when either lockfile's root engine metadata differs, when a runtime pin is
missing or floating, or when the four Node pins disagree or precede the
declared minimum. It compares declarations; use `npm run doctor` to report
the versions actually selected in the current shell.

For client environment coverage, the check scans the root README, host
`docs/` and `wiki/` Markdown, app source and `src/vite-env.d.ts`. It separately
checks the starter's README, source, declarations and example. Each named
client variable must appear as an assignment in the corresponding public
`.env.example` or as an explicit optional extension marker:

```dotenv
# @optional VITE_STRIPE_PUBLISHABLE_KEY
# @optional VITE_STRIPE_PRICE_*
```

These markers document optional app extensions; they do not activate Stripe
or create an integration. Literal names accessed in app source also need an
`ImportMetaEnv` declaration. A generic documented family such as
`VITE_FIREBASE_*` is covered by matching example assignments. An optional
TypeScript property by itself does not excuse a missing example or marker.

Only public `.env.example` files are read. The checker does not load ignored
`.env`, `.env.local`, server secrets, shell environment values, secret stores
or provider credentials. It reports variable names and counts, never example
values. It does not mutate files, start services or make network requests.
Managed release snapshots and reusable project-record seeds are unchanged.
