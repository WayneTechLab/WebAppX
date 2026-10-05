# How the SYSTEMX Menu Works

SYSTEMX combines a Bash operator menu with the shared Node/Vite runtime and
local LAN control service. Run the menu from the repository root:

```bash
bash .SYSTEMX/WSG-MENU.sh
```

It groups the system into these operator areas:

| Area | Operator purpose |
| --- | --- |
| Start into Production | Guided setup and optional release |
| Setup & Tooling | Bootstrap, auth, packets, Firebase, hooks |
| Deploy | Preflight and targeted Firebase deployment actions |
| Quality Checks | Type, lint, tests, audit, and security-related checks |
| Version | Version and changelog maintenance |
| Firebase | Login, projects, emulator, indexes, and setup helpers |
| Git | Status, pull, commit, and push helpers |
| Dev & App | Install, development server, build, and preview |
| System | Sync, diagnostics, validation, and security checks |
| Update | Repository update and release-oriented actions |
| Start of Day Local Session | Start Vite and SYSTEMX LAN with automatic port selection |
| End of Day Local Session | Stop only the PIDs recorded for this repo's local session |

The menu is a launcher, not an authorization system. Read the command it is
about to execute, verify the active project and account, and do not provide
secrets to a prompt unless you understand where they will be stored. A menu
choice may invoke vendor CLIs that create cost, change cloud resources, or
publish a release.

The current menu entry point is Bash. The Node-based app and LAN commands run
from PowerShell when Node/npm/Git are installed, but native PowerShell and CMD
launcher wrappers are not shipped in this revision. See [Platform Matrix](Platform-Matrix)
for supported and experimental lanes; do not document planned wrappers as
current tooling.

Local session commands never assume the default ports are free. They probe
loopback, choose open ports when needed, and write the owned process list to
ignored `.SYSTEMX/state/local-session.json`. End of Day reads that file and
stops only those recorded PIDs.

Current direct package commands:

```bash
npm run dev:systemx
npm run systemx:session:status
npm run systemx:session:stop
```

Never put secrets in menu prompts, command arguments, AI context, or operation
logs. Use provider-managed secret storage and explicit operator approval for
cloud actions.
