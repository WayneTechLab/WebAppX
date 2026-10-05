> Current architecture: this unified template consumes managed standalone defaults.
> Read [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration) first.
> The webapp-specific controls below remain host extensions; the current task
> authority is `.SYSTEMX/WORK/TASKS.json` and selected defaults come from INSTALLATION.json.

# The SYSTEMX Standard

## A white paper for governed web-app delivery

SYSTEMX is the operational control layer packaged with WTL WebApp Stack G1. It provides
an ordered setup process, a shared Node.js menu, reusable intake packets, quality and
security checks, deployment helpers, runbooks, and version/status material.
It is intended to make repeatable work easier to inspect; it is not a security
certification, managed service, autonomous agent, or substitute for engineering
judgment.

The standard is built around a simple principle: an idea becomes production work
only through explicit decisions, evidence, and accountable operators. Scripts
can collect inputs, run checks, and invoke vendor CLIs. They cannot establish
your compliance, own your data, approve your release, or guarantee service
availability.

## Read the white paper

- [Executive Summary](SYSTEMX-Executive-Summary)
- [A CISO Note From the Founder](SYSTEMX-CISO-Note)
- [Wayne Tech Lab LLC: purpose and technology selection](SYSTEMX-Wayne-Tech-Lab-Purpose)
- [Security Overview](SYSTEMX-Security-Overview)
- [Long-Term Warnings](SYSTEMX-Long-Term-Warnings)
- [.ENV Solutions](SYSTEMX-Environment-Solutions)
- [How the Menu System Works](SYSTEMX-Menu-Operations)
- [How Setup and Deployment Work](SYSTEMX-Setup-and-Deployment)
- [How Start and End of Day Work](SYSTEMX-Operating-Rhythm)
- [SYSTEMX Sync and Controlled Updates](SYSTEMX-Sync-and-Controlled-Updates)
- [Agent 0 and Subagents](SYSTEMX-Agent-0-and-Subagents)
- [Third-Party Services and Operator Responsibility](SYSTEMX-Third-Party-and-Operator-Responsibility)

## Scope and version reality

The current G1 implementation is cross-platform at the shared Node/Vite/LAN
runtime boundary. Start the menu with `bash .SYSTEMX/WSG-MENU.sh` or start the
local builder with `npm run dev:systemx`; `npm run sync:system:check` checks
generated operational surfaces for drift. macOS Apple Silicon, Windows 11
x64/ARM64, Ubuntu, and WSL are documented with their support levels in
[Platform Matrix](Platform-Matrix). Capabilities are represented as supported
only after implementation, testing, review, and release. Historical `wtl:*`
npm aliases are not current package interfaces.

Wayne Tech Lab LLC provides this template under its repository license, as a
base for builders to adapt. Use it at your own risk, keep required third-party
notices, and request attribution to Wayne Tech Lab LLC when it forms the basis
of your project.
