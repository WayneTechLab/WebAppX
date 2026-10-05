# SYSTEMX WEBPORTAL

SYSTEMX WEBPORTAL is the local-only management surface for `.SYSTEMX`. The G1
implementation is named **SYSTEMX LAN** and is intentionally separate from the
public React/Vite/Firebase application.

## Local-only contract

- Source is committed under `.SYSTEMX/LAN`.
- The dashboard starts at `http://127.0.0.1:7331/`.
- If that port is busy, SYSTEMX selects the next open loopback port.
- The server binds only to loopback.
- Vite exposes a development-only `/__systemx/` bridge to the LAN service.
- Firebase Hosting does not serve the dashboard as a public route.
- Production Hosting continues to publish `dist` only.
- `npm run build` runs a production leakage guard before a publish claim is
  accepted.

## Directory map

| Path | Purpose |
| --- | --- |
| `.SYSTEMX/LAN/Website_Dashboard.html` | HTML5 dashboard entry |
| `.SYSTEMX/LAN/Website/` | Tracked CSS, JavaScript, components, and assets |
| `.SYSTEMX/LAN/Temp/` | Ignored temporary runtime output |
| `.SYSTEMX/LAN/Backup/` | Ignored local pre-write backups |
| `.SYSTEMX/LAN/Files/` | Ignored local operator files and imports |
| `.SYSTEMX/LAN/server.mjs` | Loopback-only local server |
| `.SYSTEMX/LAN/dev-session.mjs` | Starts Vite plus LAN with safe auto-ports |
| `.SYSTEMX/LAN/session-control.mjs` | Shows or stops only the owned local session |
| `.SYSTEMX/LAN/Builder/` | Contracts, importer, and runtime helpers |

## Commands

```bash
npm run dev
npm run dev:systemx
npm run systemx:lan
npm run systemx:session:status
npm run systemx:session:stop
npm run build
```

`npm run dev` starts only the public Vite app. `npm run dev:systemx` starts the
public Vite app and SYSTEMX LAN sidecar, then prints the active URLs.
`npm run systemx:lan` starts only the direct local dashboard server.

Session status and stop controls use the ignored local session record. That
record contains only ports and PIDs started by this repository, so end-of-day
cleanup does not close another local project that happens to use the default
Vite or LAN ports.

## Security rules

- No generic shell endpoint.
- No environment file reader.
- No secret display.
- No `Temp`, `Backup`, or `Files` static serving.
- No `0.0.0.0` binding by default.
- No Firebase rewrite or deployment path for LAN.

## Roadmap

1. ✅ Production leakage guard for `dist` and Firebase Hosting output.
2. Guarded allowlisted SYSTEMX action registry for local tools.
3. Agent 0 bus visualization and start/end-of-day evidence.
4. Setup wizard driven by the 20-phase process.
5. Deployment preflight and dry-run controls with high-friction confirmation.

The clean-room LAN Builder Designer research overlay expands this roadmap into 13 gated
waves. It is a research and implementation program, not a claim that the
current LAN exposes every visual-editor feature. See
[SYSTEMX LAN Builder Designer Master Plan](SYSTEMX-LAN-Builder-Designer-Master-Plan) and the
machine-readable [capability manifest](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/LAN/Builder/contracts/capability-manifest.json).
