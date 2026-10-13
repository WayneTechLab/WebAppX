# Unified template 3.2.0 guide

WebAppX combines managed dotSYSTEMX 1.9.0-alpha.5, the Firebase webapp,
LAN builder/session controls, production kits, agent coordination and both
research packages. New capabilities include optional Agent Y CLI handoffs,
explicit child-project CLI routing, the tools guide, blank access/map seeds and
schema 2 media integrity. Reusable project, task, focus and memory records ship
blank. No private mirror is configured for WebAppX.

| Task | Guide |
| --- | --- |
| Start locally and adopt project records | [Getting started](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GETTING-STARTED.md) |
| Find the exact current command | [Command reference](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMMANDS.md) |
| Set up optional Agent Y in an adopted app | [Agent Y New App Setup](Agent-Y-New-App-Setup.md) |
| Maintain the base and an explicitly selected optional mirror | [Template maintenance](https://github.com/WayneTechLab/WebAppX/blob/main/docs/TEMPLATE-MAINTENANCE.md) |
| Import managed defaults | [Standalone SYSTEMX integration](SYSTEMX-Standalone-Integration.md) |
| Inspect release inputs and included capabilities | [Feature/provenance map](https://github.com/WayneTechLab/WebAppX/blob/main/docs/UNIFIED-TEMPLATE.md) |
| Review recorded source/local acceptance | [3.2.0 validation receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.2.0.md) |

`npm run systemx:status` reports installation integrity and the selected release.
`npm run systemx -- status` reports task records. `npm run systemx:context`
provides the bounded Agent 0 resume packet. Use WSG menu option 12 or
`npm run systemx -- menu` for the managed operating tools.
`npm run systemx -- tools-guide` explains explicit `.SYSTEMXP` selection and
the separately installed CLI's `systemx projects --target OUTER -- ...` routing.
Imports preserve original snapshots and downstream records; recognized bootstrap
changes are previewed and backed up before refresh.

The LAN dashboard Agent 0 panel displays the selected version, update policy,
registered roles, recorded tasks and child-project count. These are record
summaries, not running-agent or remote-service acceptance claims.

`npm run ci:all` and `template:check` validate the reusable blank release.
For an adopted app with real project records, use its configured checks and
`systemx:validate`; adapt the template-maintenance integration suite as needed.
The [Agent Y new-app guide](Agent-Y-New-App-Setup.md) shows actual project check
configuration, role activation, ignored private prompt/state verification and
the required clean-repository setup checkpoint before preparing a job.

The template seeds only Agent 0. `roles-init --apply` in an adopted app adds
X/Y/Z records without starting a provider. The CLI receives a bounded task
packet and uses its own reviewed account; it does not inherit the app chat.
Agent 0 checks and accepts the returned revision. Draft PRs require explicit
per-task opt-in, and Agent Y has no merge command. Native Windows supports role
and handoff previews, while `agent-y run --apply` remains unavailable in this alpha.
The historical [3.1.0 receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.1.0.md)
retains its original revision and platform scope.

The Designer roadmap remains evidence-gated. Read its capability manifest and
[LAN Builder Designer master plan](SYSTEMX-LAN-Builder-Designer-Master-Plan.md)
for implemented, guarded and planned capabilities.

## Security review

The unified template includes reviewed authorization and tooling repairs. Read [Security Review](Security-Review.md) for protected profile fields, literal secret-file configuration and validation boundaries.
