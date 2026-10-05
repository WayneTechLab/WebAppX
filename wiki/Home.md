# WebAppX Wiki

Unified webapp release **3.1.0** uses standalone SYSTEMX **1.8.6-alpha.1**.
This wiki belongs to WayneTechLab/WebAppX; public dotSYSTEMX remains the
universal upstream. Start with [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration),
[Quick Start](Quick-Start), and [Update Log](Update-Log).

The retained guides below cover the Firebase/LAN builder and production kits.
They describe available workflows; project adoption still requires configuration
and scoped verification. Public derivatives are reviewed and published separately.

# WebAppX Wiki

<p align="center">
  <a href="https://WayneTechLab.com">
    <img src="https://raw.githubusercontent.com/WayneTechLab/WebAppX/main/docs/assets/wayne-tech-lab-logo.png" alt="Wayne Tech Lab LLC" width="720">
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/WayneTechLab/WebAppX/main/docs/assets/systemx-logo.svg" alt="WebAppX - .SYSTEMX Forever WebApp - A Product Provided by Wayne Tech Lab LLC. - Version. Generation 1" width="720">
</p>

Welcome to the public **WebAppX — ".SYSTEMX Forever WebApp"** wiki from
[Wayne Tech Lab LLC](https://WayneTechLab.com). This is the deep-dive home for a
repeatable Firebase web app standard built around React, TypeScript, Vite,
Firebase, local verification, Playwright, MCP/browser tooling, and SYSTEMX.
The template has now grown beyond a starter scaffold: `.SYSTEMX/LAN` is the
local-only SYSTEMX Local Control builder for editing and managing the current
checkout while keeping production Firebase Hosting clean.

## Product Label

**WebAppX**<br>
**".SYSTEMX Forever WebApp"**<br>
**A Product Provided by Wayne Tech Lab LLC.**<br>
**Version. Generation 1**

[Use The Template](https://github.com/WayneTechLab/WebAppX/generate) |
[Repository](https://github.com/WayneTechLab/WebAppX) |
[WayneTechLab.com](https://WayneTechLab.com) |
[Update Log](Update-Log)

## Start Here

| If you want to... | Go to |
| --- | --- |
| Get a running app in minutes | **[Quick Start](Quick-Start)** |
| Use `.SYSTEMX` from idea to production | **[User Ingest & Production Setup](User-Ingest-and-Production-Setup)** |
| Open the local builder/control surface | **[SYSTEMX LAN Builder](SYSTEMX-LAN-Builder)** |
| Run the LAN from start of day through handoff | **[SYSTEMX LAN Operations Manual](SYSTEMX-LAN-Operations-Manual)** |
| Integrate with the local LAN routes and guarded actions | **[SYSTEMX LAN API Reference](SYSTEMX-LAN-API-Reference)** |
| Connect the WebApp login, admin shell, and LAN auth contract | **[Unified Login and Admin Operations](Unified-Login-and-Admin-Operations)** |
| Read the LAN Builder Designer master plan | **[SYSTEMX LAN Builder Designer Master Plan](SYSTEMX-LAN-Builder-Designer-Master-Plan)** |
| Read local evidence and operation logs | **[SYSTEMX Logs and Evidence](SYSTEMX-Logs-and-Evidence)** |
| Point an LLM at approved production assets | **[Production Kit](Production-Kit)** |
| Produce PDF brand guidelines from approved logos | **[Brand Guide Kit](Brand-Guide-Kit)** |
| Apply the reusable four-corner site navigation standard | **[WTL Site Shell G1](WTL-Site-Shell-G1)** |
| Understand the stack | **[Architecture & Stack](Architecture-and-Stack)** |
| Learn the AI and browser tooling standard | **[Agent Mesh & Tooling Standard](Agent-Mesh-and-Tooling-Standard)** |
| Know where everything lives | **[Project Structure](Project-Structure)** |
| Configure Firebase and env files | **[Environment Variables](Environment-Variables)** |
| Ship safely | **[Security](Security)** |
| Deploy to Firebase | **[Deployment](Deployment)** |
| Test locally | **[Testing & QA](Testing-and-QA)** |
| Track template changes | **[Update Log](Update-Log)** |

## Managed tools and current release guides

Use [the unified template guide](Unified-Template-Guide) for adoption, commands,
upstream imports, source parity and release provenance. `npm run systemx:status`
checks installation integrity; `npm run systemx -- status` reads recorded tasks.
WSG menu option 12 opens the selected managed tools. Project records ship blank.

## Included route model

The current template ships with a fuller public route baseline:

| Group | Routes |
| --- | --- |
| Primary icon rail | `/`, `/about`, `/contact`, `/social` |
| Public pages | `/services`, `/features`, `/docs`, `/faq`, `/support`, `/security` |
| Footer governance routes | `/accessibility`, `/privacy`, `/terms`, `/changelog` |
| System states | `/403`, `/500`, `/offline` |
| Staff boundary | `/login`, `/admin` |

`/login` and `/admin` read the same local SYSTEMX status model used by the LAN:
Firebase emulator email/password locally, claim-gated Level 4 / 5 cards, and
documentation-only LAN status in production builds.

## Idea To Production

```mermaid
flowchart LR
    Idea["Idea / Brief"] --> Intake["SYSTEMX Intake"]
    Intake --> Setup["Tooling + Firebase Setup"]
    Setup --> Build["React + Vite Build"]
    Build --> Verify["Local QA + Security Checks"]
    Verify --> Deploy["Firebase Deploy"]
    Deploy --> Handoff["Docs + Update Log + Handoff"]
```

## SYSTEMX Operating Model

```mermaid
flowchart TD
    Human["Operator"] --> Agent0["Agent 0"]
    Agent0 --> Menu["SYSTEMX Menu"]
    Agent0 --> Lanes["Subagent Lanes"]
    Menu --> Scripts["Scripts"]
    Menu --> LAN["SYSTEMX LAN Builder"]
    Scripts --> Browser["Playwright / Chrome DevTools MCP"]
    Scripts --> Firebase["Firebase / GCloud"]
    LAN --> Current["Current Checkout"]
    LAN --> Logs["Local Evidence Logs"]
    Lanes --> Evidence["Evidence + Checkpoints"]
    Evidence --> Archive["Archive + Update Log"]
```

## Designer roadmap status

The LAN builder is a working guarded current-template editing surface, not a
finished visual-editor platform. The research-backed LAN Builder Designer roadmap is
maintained as a separate, evidence-gated program. Wave 0 truth, safety,
documentation, and characterization are complete for the research integration;
later capabilities—typed
document graph, command journal, responsive style engine, reusable component
versions, CMS bindings, source round-trip, snapshots, publishing, plugins, and
collaboration—remain planned until their acceptance criteria pass.

Read the [SYSTEMX LAN Builder Designer Master Plan](SYSTEMX-LAN-Builder-Designer-Master-Plan)
and the repository's [research corpus](https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/LAN/Research/LAN-Builder).

## Who Benefits

| Beneficiary | Benefit |
| --- | --- |
| Solo builders | A working Firebase-ready base instead of a blank repo. |
| Small teams | One setup, one menu, one doc standard, one local verification path. |
| Agencies | A repeatable client-project base with clearer handoff. |
| AI-assisted developers | Agent 0 and subagents get bounded lanes and evidence rules. |
| Operators | Local scripts and menu flows before production deploys. |
| Security reviewers | Predictable places for env guidance, rules, warnings, and checks. |

## Ground Rules

This template is provided as-is. Fork, clone, and copy it at your own risk. You
are responsible for your own security review, credentials, service terms,
privacy obligations, accessibility, compliance, testing, and production support.

The public template stays generic. Project-specific vendors, customer workflows,
private dashboard steps, and proprietary connector logic belong in the project
created from the template.
