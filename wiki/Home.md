# WebAppX Wiki

Unified webapp release **3.4.0** uses standalone SYSTEMX **1.9.0-alpha.6**.
This wiki belongs to WayneTechLab/WebAppX; public dotSYSTEMX remains the
universal upstream. Start with [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration.md),
[Quick Start](Quick-Start.md), [Agent Y setup for a new app](Agent-Y-New-App-Setup.md),
and [Update Log](Update-Log.md).

The retained guides below cover Firebase, the LAN builder, Gusto/HR and production kits.
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
[Update Log](Update-Log.md)

## Start Here

| If you want to... | Go to |
| --- | --- |
| Get a running app in minutes | **[Quick Start](Quick-Start.md)** |
| Preview native HR portal workflows and selected genuine SDK flows | **[Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md)** |
| Delegate one adopted-app task to an installed CLI | **[Agent Y New App Setup](Agent-Y-New-App-Setup.md)** |
| Use `.SYSTEMX` from idea to production | **[User Ingest & Production Setup](User-Ingest-and-Production-Setup.md)** |
| Open the local builder/control surface | **[SYSTEMX LAN Builder](SYSTEMX-LAN-Builder.md)** |
| Run the LAN from start of day through handoff | **[SYSTEMX LAN Operations Manual](SYSTEMX-LAN-Operations-Manual.md)** |
| Integrate with the local LAN routes and guarded actions | **[SYSTEMX LAN API Reference](SYSTEMX-LAN-API-Reference.md)** |
| Connect the WebApp login, admin shell, and LAN auth contract | **[Unified Login and Admin Operations](Unified-Login-and-Admin-Operations.md)** |
| Read the LAN Builder Designer master plan | **[SYSTEMX LAN Builder Designer Master Plan](SYSTEMX-LAN-Builder-Designer-Master-Plan.md)** |
| Read local evidence and operation logs | **[SYSTEMX Logs and Evidence](SYSTEMX-Logs-and-Evidence.md)** |
| Point an LLM at approved production assets | **[Production Kit](Production-Kit.md)** |
| Produce PDF brand guidelines from approved logos | **[Brand Guide Kit](Brand-Guide-Kit.md)** |
| Apply the reusable four-corner site navigation standard | **[WTL Site Shell G1](WTL-Site-Shell-G1.md)** |
| Understand the stack | **[Architecture & Stack](Architecture-and-Stack.md)** |
| Learn the AI and browser tooling standard | **[Agent Mesh & Tooling Standard](Agent-Mesh-and-Tooling-Standard.md)** |
| Know where everything lives | **[Project Structure](Project-Structure.md)** |
| Configure Firebase and env files | **[Environment Variables](Environment-Variables.md)** |
| Ship safely | **[Security](Security.md)** |
| Deploy to Firebase | **[Deployment](Deployment.md)** |
| Test locally | **[Testing & QA](Testing-and-QA.md)** |
| Track template changes | **[Update Log](Update-Log.md)** |

## Managed tools and current release guides

Use [the unified template guide](Unified-Template-Guide.md) for adoption, commands,
upstream imports, source parity and release provenance. `npm run systemx:status`
checks installation integrity; `npm run systemx -- status` reads recorded tasks.
WSG menu option 12 opens the selected managed tools. Project records ship blank.
Use `npm run systemx -- tools-guide` for CLI and explicit child-project routing.
The optional Agent Y CLI lane complements Agent X event records and Agent Z
reviews under Agent 0; imports do not activate roles or start providers. New
access/map records are blank adoption seeds. Native Windows Agent Y execution
remains unavailable pending verified descendant-process termination; current
macOS checks do not establish Windows x64/ARM64 or Firebase deployment acceptance.
The [new-app guide](Agent-Y-New-App-Setup.md) covers role preview/apply, private
prompts, real app checks, setup commits, a local-result handoff and optional
draft PR gates. Keep the reusable template's records blank; activate roles only
in the adopted scope.

## Gusto and HR workspace

The portable `.SYSTEMX/GUSTO/` package provides routes, capability ownership,
role policy and adoption contracts. In Vite development, `/hr/demo` offers
synthetic management, employee, manager and contractor portals with app-owned
state that resets on refresh. Native source includes onboarding, benefit elections,
timesheet approval, simulated payroll/pay statements, leave balances and decisions,
assignments/acknowledgments, asset returns, scoped activity, dashboards/reports and
an employee-to-manager/HR service desk. The portable 64-page contract remains
unchanged; request/activity routes are host extensions. `/hr/demo/sdk` uses the genuine
Gusto React SDK 0.56.6 directory, administrative onboarding and payroll execution
components against isolated local mock records; its mock API is absent
from Hosting and `npm run preview`.

Connected portals remain unconfigured and require trusted identity/memberships
and an adopted server integration. The optional Firebase module is disabled by
default. Other SDK workflows and live payroll need separate acceptance. Follow
[Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md) for the
preview, setup and validation path.

The current automated HR suite passes **70 tests** across native workflows,
people/linked operations, insights, service desk, SDK-client mocks and backend
boundaries. The [HR portal guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL.md)
and [portal QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md)
record the selected native browser paths verified after a full reload: linked
assignments, asset return, leave decisions, service requests, own pay statements
and scoped reports. Avery's simulated payroll/statement reconciled at $240
gross/$48 illustrative withholding/$25 benefit/$167 net; other employee and
auditor views retained their scope. This did not rerun the separate SDK UI or
establish provider acceptance. The earlier October 14
41-test receipt and October 13 39-test release receipt remain historical.

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

Read the [SYSTEMX LAN Builder Designer Master Plan](SYSTEMX-LAN-Builder-Designer-Master-Plan.md)
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
