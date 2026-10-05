# Ubuntu, Linux, and WSL2 Setup

## Support position

Ubuntu and WSL2 are compatibility lanes for the shared Node/Vite/SYSTEMX LAN
runtime. The local builder is loopback-only and uses the same port ownership and
session controls as macOS and Windows. Distribution package installation is not
silently assumed; verify each vendor CLI before using it.

Use Python 3.12 or newer for host imports/mirrors and confirm the Firebase
emulator runtime prerequisites. The current release receipt records macOS
acceptance; Linux/WSL execution remains a separate compatibility check.

## Existing clone

```bash
git clone https://github.com/WayneTechLab/WebAppX.git my-app
cd my-app
npm ci
npm run systemx:status
npm run systemx:validate
npm test
npm run dev:systemx
```

Check or stop only the processes owned by this checkout:

```bash
npm run systemx:session:status
npm run systemx:session:stop
```

## Validation

```bash
npm run typecheck
npm run lint
npm run build
npm run sync:system:check
npm run system:audit
```

## Optional bootstrap and browser tooling

Inspect the local bootstrap before running it:

```bash
bash .SYSTEMX/scripts/bootstrap.sh --check
npm run browser:install
npm run browser:codegen
```

The browser commands install/use Playwright Chromium for local recording and
smoke work. Point them at the printed Vite URL, not a hard-coded port when
another project is active.

For WSL2, keep the repository inside the Linux filesystem for reliable file
watching and permissions. Use Windows-host VS Code/Chrome only as an explicit
operator choice; never treat their presence as proof that Linux package setup
completed.

## Cloud tools

Install Google Cloud CLI, Firebase CLI, and optional provider CLIs from their
official sources. Authenticate interactively or with approved short-lived CI
identity. Do not save tokens, service-account JSON, or private keys in the repo,
logs, or AI context.

See [One-Line Workstation Start](One-Line-Install) and [Platform Matrix](Platform-Matrix).
