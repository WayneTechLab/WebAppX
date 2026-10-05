# 11 — LAN and Project Wiki Drift Audit

## Finding summary

The wiki contains two incompatible generations of SYSTEMX guidance. Some pages accurately describe the active LAN and current package scripts; others advertise removed installers, launchers, package commands, paths, and future gates that are already implemented.

This is not cosmetic. A local control plane depends on documentation as an authority boundary. Broken commands and contradictory secret guidance can cause unsafe operator behavior.

## P0 findings

### WIKI-P0-001 — AI secret handling

`wiki/Security.md` states that operators using an AI-assisted setup will paste live keys and secrets into the AI session and then delete the conversation.

**Required correction:** never paste live server secrets into AI chats. Use provider secret stores, Secret Manager, OS keychain, short-lived authorization, or local protected prompts that do not enter model context. Add a rotation procedure for suspected exposure.

### WIKI-P0-002 — Removed one-line installers and launchers

`One-Line-Install.md`, `Windows-Setup.md`, `Linux-Setup.md`, and related pages reference `install.sh`, `install.ps1`, PowerShell launchers, and `npm run wtl:*` commands that were removed or are not present in the current `package.json`.

**Required correction:** choose one supported bootstrap path, test it on every claimed platform, and generate command tables from `package.json`/script manifests.

### WIKI-P0-003 — Missing/removed setup paths

Several pages reference deleted `.SYSTEMX/Template/steps/*` content and legacy setup generations.

**Required correction:** publish one canonical process version and a migration note for legacy material.

## P1 findings

- Node guidance conflicts: >=20/22 recommended vs. Node 24 installer/platform claims.
- `SYSTEMX-WEBPORTAL.md` and root-folder documentation call the production leakage assertion future work even though it is implemented in the build.
- Root/folder standard lists directories and thin launchers removed from the current repository.
- `Architecture-and-Stack.md` lists modules/dependencies that do not ship in the baseline and points to removed bootstrap paths.
- `Testing-and-QA.md` and contribution notes call scripts that may be absent or only conditional.
- `SYSTEMX-Standard.md`, sync, setup/deploy, and agent pages reference `wtl:*` commands absent from current `package.json`.
- setup terminology conflicts across 20 phases, 10 phases, 15 steps, and legacy steps 00–12.
- version/product naming is inconsistent across repository/package/wiki generations.
- wiki README page inventory does not fully match the sidebar.
- hidden white-paper pages are linked from content but omitted from navigation.

## Repair strategy

### 1. Generate command documentation

Create a script that reads `package.json` and a SYSTEMX command manifest, then generates:

- supported npm scripts;
- platform launch commands;
- flags and risk level;
- source implementation path;
- last-tested platform/version.

### 2. Add documentation assertions

A docs test should fail when:

- a documented local file path does not exist;
- an `npm run` command is not in `package.json`;
- a shell/PowerShell script path does not exist;
- a wiki link target is missing;
- the documented version/Node baseline conflicts with canonical manifests;
- banned secret-handling phrases appear.

### 3. Establish sources of truth

| Subject | Canonical source |
| --- | --- |
| Product version | `.SYSTEMX/version/version.json` plus synchronized `package.json` |
| Node/platform support | one platform manifest |
| Commands | `package.json` and command registry manifest |
| LAN status | tested feature manifest generated from code/tests |
| Setup process | one versioned process manifest |
| Security policy | `SECURITY.md` plus `.SYSTEMX` security standard |
| Wiki | generated/validated publication projection |

### 4. Deprecate, do not silently rewrite history

Keep a concise legacy migration page that maps old commands and paths to current replacements. Remove stale commands from active quick-start pages.

## Definition of done

- every documented command exists and passes a dry-run/check mode;
- every linked path exists;
- all version and Node requirements agree;
- no page instructs users to paste secrets into AI context;
- current implemented LAN capabilities are generated from tests/manifests;
- sidebar and wiki inventory match;
- docs validation runs in `npm run build` or a dedicated release gate.
