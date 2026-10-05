# One-Line Workstation Start

The current public template does **not** publish a remote `install.sh`,
`install.ps1`, or `bootstrap-windows.ps1` endpoint. Do not pipe an unreviewed
remote script into a shell. The supported one-line commands below clone the
template, install its pinned npm dependency graph, run the local characterization
test, and start the loopback-only app plus SYSTEMX LAN.

## macOS, Linux, or WSL2

```bash
git clone https://github.com/WayneTechLab/WebAppX.git my-app && cd my-app && npm ci && npm test && npm run dev:systemx
```

## Windows 11 PowerShell 7

```powershell
git clone https://github.com/WayneTechLab/WebAppX.git my-app && Set-Location my-app && npm ci && npm test && npm run dev:systemx
```

These start the repository-local development services only. They do not create
cloud projects, authenticate accounts, deploy, install VS Code, or collect
secrets. The printed ports are authoritative because SYSTEMX selects free
loopback ports for this checkout rather than assuming another project is
stopped.

## Existing checkout

```text
npm ci
npm test
npm run dev:systemx
```

Use the direct bootstrap only after inspecting it and only from a visible local
terminal:

```bash
bash .SYSTEMX/scripts/bootstrap.sh --check
```

The bootstrap provides inspected Bash guidance. The managed operating tools
now include `.SYSTEMX/SYSTEMX.ps1`; this is distinct from a remote workstation
installer or a native PowerShell version of the WSG lifecycle menu. The Node
app/LAN commands run separately when their prerequisites are installed.
Use Python 3.12 or newer for host tooling and verify Firebase emulator Java
prerequisites before starting the integrated session.

## Verify or stop the owned local session

```bash
npm run systemx:session:status
npm run systemx:session:stop
```

`systemx:session:stop` only stops processes recorded as owned by this repo. It
must not terminate another project’s Vite, Firebase emulator, or control port.

## Next checks

```bash
npm run typecheck
npm run lint
npm run build
npm run sync:system:check
npm run system:audit
```

Read [Quick Start](Quick-Start), [Windows Setup](Windows-Setup), [Linux Setup](Linux-Setup),
and [Platform Matrix](Platform-Matrix) before adding Firebase, Google Cloud, or
optional provider tooling.
