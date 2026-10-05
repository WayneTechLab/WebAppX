# Unified template command reference

Run from the repository root. Use `npm ci` for the committed lockfile.

## App and local session

| Command | Behavior |
| --- | --- |
| `npm run dev` | Vite webapp only; use its printed URL |
| `npm run dev:systemx` | Owned app + LAN + Firebase emulator session with available loopback ports |
| `npm run dev:firebase` | Alias for the integrated local session |
| `npm run systemx:lan` | Direct LAN service only |
| `npm run systemx:session:status` | Read current session ownership and URLs |
| `npm run systemx:session:stop` | Stop only owned session processes |
| `npm run build` | TypeScript/Vite build plus LAN artifact-isolation check |
| `npm run preview` | Preview the built app |

## Managed SYSTEMX and agent coordination

| Command | Behavior |
| --- | --- |
| `npm run systemx -- menu` | Managed tooling menu; WSG menu option 12 opens the same tools |
| `npm run systemx:status` | Selected release, pin/update policy and immutable integrity |
| `npm run systemx:validate` | Validate outer project records and generated work views |
| `npm run systemx:context` | Bounded Agent 0 resume packet |
| `npm run systemx -- status` | Recorded task counts; separate from installation status |
| `npm run systemx -- projects list` | Registered child-project scopes |
| `npm run systemx -- roles-init` | Preview Agent X/Z role initialization |
| `npm run systemx:upstream:check` | Read-only preview against reviewed dotSYSTEMX public main |
| `npm run systemx:upstream:import` | Explicit additive import and pin; retains host files and adopted records |

Set `WTL_SYSTEMX_SOURCE` or use `python3 -B scripts/sync-systemx.py --source
/path/to/dotSYSTEMX` when the standalone checkout lives elsewhere. Installation
status is not task status, and registered roles are not observed worker processes.

The managed launchers are `bash .SYSTEMX/SYSTEMX.sh <command>` and
`.\.SYSTEMX\SYSTEMX.ps1 <command>` in PowerShell. The legacy WSG menu and
full template gate use Bash; Node-based app/LAN commands remain separate.

## Validation and maintenance

| Command | Scope |
| --- | --- |
| `npm run ci:lint` / `npm run ci:typecheck` | App source quality |
| `npm test` | Local LAN characterization and managed-status contract |
| `npm run ci:audit` | Strict dependency audit |
| `npm run docs:links` | Local Markdown/wiki links, including managed distribution docs |
| `npm run research:validate` | Adapted LAN-Builder package integrity |
| `npm run sync:system:check` | Host versions, generated metadata and menu drift |
| `npm run systemx:tools:test` | Test the selected immutable standalone distribution |
| `npm run systemx:integration:test` | Import preservation and reusable-template mirror regressions |
| `npm run template:check` | Blank template seeds, snapshots, versions and both research inventories |
| `npm run ci:all` | Complete reusable-template release gate; requires blank seeds |
| `npm run deploy -- hosting --preflight` | Deployment gates without commit, push or hosting deployment |
| `npm run wiki:check` / `npm run wiki:sync` | Preview / publish checked-in pages to this checkout's GitHub wiki |

For adopted applications, configure appropriate checks in `.SYSTEMX/project.json`.
The template's blank-seed release checks are for maintaining the reusable template.

## Identical template mirrors

```bash
# Preview changes from this clean, committed source:
python3 -B scripts/sync-template.py --target /path/to/template-mirror
# Explicitly apply the reviewed tracked-file changes:
python3 -B scripts/sync-template.py --target /path/to/template-mirror --apply
# After reviewing and committing the target, verify exact parity:
npm run template:check -- --against /path/to/template-mirror
```

The mirror tool preserves `.git` and local-only files, refuses dirty checkouts,
ignored/untracked collisions and file/directory transitions, and validates the
source's blank seeds before writing. It does not commit, push, sync a wiki, or
merge active application records. See [template maintenance](TEMPLATE-MAINTENANCE.md).

## Security regression checks

`npm run security:controls:test` runs the operational regressions and is included in `ci:all`. `npm run security:rules:test` requires isolated loopback Firebase Auth/Firestore emulators for `demo-systemx`. See [Security Review](SECURITY-REVIEW.md) for supported secret keys and account administration.
