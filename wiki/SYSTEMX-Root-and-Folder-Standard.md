> Current architecture: this unified template consumes managed standalone defaults.
> Read [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration) first.
> The webapp-specific controls below remain host extensions; the current task
> authority is `.SYSTEMX/WORK/TASKS.json` and selected defaults come from INSTALLATION.json.

# SYSTEMX Root and Folder Standard

WTL WebApp Stack G1 treats `.SYSTEMX` as the default operational root. New tooling,
logs, setup files, AI coordination notes, scripts, local dashboard files, and
workflow state should live under `.SYSTEMX` unless a framework, vendor, or
public web runtime requires a root path.

## What belongs in `.SYSTEMX`

| Area | Default path |
| --- | --- |
| SYSTEMX CLI and shared libraries | `.SYSTEMX/cli`, `.SYSTEMX/lib` |
| Setup, CI, security, local-session, and utility scripts | `.SYSTEMX/scripts` |
| AI, agent, prompt, and adapter-governance docs | `.SYSTEMX/AI` |
| Agent 0 and subagent operating runbooks | `.SYSTEMX/docs` |
| Active boards, master plan, TODO, DONE, and agent lanes | `.SYSTEMX/status` |
| Ignored local state, bus archives, and runtime metadata | `.SYSTEMX/state` |
| Sanitized operation logs | `.SYSTEMX/logs` |
| Local-only LAN WEBPORTAL | `.SYSTEMX/LAN` |
| Setup packets, standards, intake, and manifests | `.SYSTEMX/Standard-MD-Files`, `.SYSTEMX/Stock-Setup-Files`, `.SYSTEMX/Unified-Setup-Process` |

## What must remain at repository root

These files stay at root because the app, package manager, GitHub, Firebase, or
coding-agent tools expect them there:

- `package.json`, `package-lock.json`
- `index.html`, `src/`, `public/`, `vite.config.ts`, `tsconfig.json`,
  `eslint.config.js`
- `firebase.json`, `.firebaserc`, `firestore.rules`,
  `firestore.indexes.json`, `storage.rules`
- `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `SUPPORT.md`,
  `CODE_OF_CONDUCT.md`, `CHANGELOG.md`
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- `.github/`, `.cursor/`, `.windsurf/`, `.clinerules/`, `.continue/`,
  `.junie/`, `.amazonq/`
- No undocumented convenience launcher is assumed. The current menu entry point
  is `bash .SYSTEMX/WSG-MENU.sh`; native PowerShell/CMD launchers remain a
  planned cross-platform improvement and must not be documented as shipped.

The rule is simple: root is for required public app surfaces and vendor
discovery files; `.SYSTEMX` is for the operating system around the app.

## Current cleanup rule

The legacy root `scripts/` folder is not used. SYSTEMX-owned scripts now live
under `.SYSTEMX/scripts`, including:

- `.SYSTEMX/scripts/setup/seed-test-users.mjs`
- `.SYSTEMX/scripts/security/run_security_checks.sh`

## AI document rule

Use `.SYSTEMX/AI` for AI maps and prompt/routing standards. Keep root
`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and the vendor rule files only because
their tools require those locations. Do not create `CODEX.md`, `CoPilot.md`, or
`GPT.md` aliases.

## Local-only rule

`.SYSTEMX/LAN` is committed as template source but is never part of the public
Firebase Hosting deployment. `npm run build` runs the production leakage guard;
release evidence must retain that passing result and must fail if LAN files,
markers, or development-only attributes enter `dist`.
