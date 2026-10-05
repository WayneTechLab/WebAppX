# Wiki source

These Markdown files are the source for the
[**GitHub Wiki**](https://github.com/WayneTechLab/WebAppX/wiki).

GitHub wikis are backed by a **separate git repository**
(`WayneTechLab/WebAppX.wiki.git`). Keeping the pages here, in the main
repo, lets us version and review them alongside the code; they are then published
to the wiki repo.

This template is intended to be verified locally and deployed directly to
Firebase instead of shipping billable runner infrastructure in the base
template.

## Pages

| File | Wiki page |
| --- | --- |
| `Home.md` | Landing page |
| `Unified-Template-Guide.md` | Current release, adoption, commands and mirror workflow |
| `SYSTEMX-Standalone-Integration.md` | Managed standalone imports and host extension ownership |
| `Quick-Start.md` | Quick Start |
| `One-Line-Install.md` | One-line workstation start and current installer boundary |
| `WTL-Standard-Setup-Guide.md` | Idea-to-production operator sequence |
| `Windows-Setup.md` | Windows 11 setup and support truth |
| `Linux-Setup.md` | Ubuntu/Linux/WSL setup and support truth |
| `Platform-Matrix.md` | Platform and architecture matrix |
| `Architecture-and-Stack.md` | Architecture & Stack |
| `Project-Structure.md` | Project Structure |
| `Environment-Variables.md` | Environment Variables |
| `Security.md` | Security |
| `Agent-Mesh-and-Tooling-Standard.md` | Agent Mesh & Tooling Standard |
| `SYSTEMX-LAN-Builder.md` | SYSTEMX LAN Builder and provider architecture |
| `SYSTEMX-LAN-Operations-Manual.md` | Detailed LAN staff and builder runbook |
| `SYSTEMX-LAN-API-Reference.md` | Local LAN routes, session authority, and mutation contract |
| `Unified-Login-and-Admin-Operations.md` | WebApp Firebase Auth, admin shell, and LAN provider operations |
| `SYSTEMX-LAN-Builder-Designer-Master-Plan.md` | Research-backed LAN Builder Designer roadmap and gates |
| `SYSTEMX-WEBPORTAL.md` | Local-only WEBPORTAL/LAN isolation contract |
| `SYSTEMX-Standard.md` | SYSTEMX operating white paper |
| `SYSTEMX-Starter-Prompts-and-Smart-Routing.md` | Agent prompts and token-saving routing |
| `SYSTEMX-Logs-and-Evidence.md` | SYSTEMX local logs, evidence, backups, and status records |
| `Production-Kit.md` | SYSTEMX Production Kit |
| `Brand-Guide-Kit.md` | SYSTEMX Brand Guide Kit |
| `Setup-Playbook.md` | Setup Playbook + Unified Setup intake |
| `Deployment.md` | Deployment |
| `Testing-and-QA.md` | Testing & QA |
| `Update-Log.md` | Update Log |
| `FAQ.md` | FAQ |
| `_Sidebar.md` | Right-hand navigation |
| `_Footer.md` | Page footer |

## Non-wiki `.SYSTEMX` references

These are intentionally kept in `.SYSTEMX` instead of duplicated into wiki pages:

- `.SYSTEMX/Unified-Setup-Process/README.md`
- `.SYSTEMX/Unified-Setup-Process/intake/`
- `.SYSTEMX/Unified-Setup-Process/standards/WSG-Account-Levels.md`
- `.SYSTEMX/Unified-Setup-Process/standards/Unified-Login.md`
- `.SYSTEMX/AI/`
- `.SYSTEMX/LAN/`
- `.SYSTEMX/status/`
- `.SYSTEMX/webapp-version/`
- `.SYSTEMX/scripts/deploy.sh`

## Publishing to the GitHub Wiki

> The wiki must be enabled once: repo **Settings → Features → Wikis**, then create
> the first page in the UI so the `.wiki.git` repo exists.

```bash
npm run wiki:check
npm run wiki:sync
```

The sync script derives the wiki destination from this checkout's GitHub origin,
preserves wiki-only pages and history, and pushes without forcing. Preview first.
