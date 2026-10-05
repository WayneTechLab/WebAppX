# Unified template 3.1.0 guide

The public template and private mirror share identical tracked release files.
The shared release combines managed dotSYSTEMX 1.8.6-alpha.1, the Firebase webapp,
LAN builder/session controls, production kits, agent coordination and both
research packages. Reusable project, task, focus and memory records ship blank.

| Task | Guide |
| --- | --- |
| Start locally and adopt project records | [Getting started](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GETTING-STARTED.md) |
| Find the exact current command | [Command reference](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMMANDS.md) |
| Maintain identical public/private templates | [Template maintenance](https://github.com/WayneTechLab/WebAppX/blob/main/docs/TEMPLATE-MAINTENANCE.md) |
| Import managed defaults | [Standalone SYSTEMX integration](SYSTEMX-Standalone-Integration.md) |
| Inspect release inputs and included capabilities | [Feature/provenance map](https://github.com/WayneTechLab/WebAppX/blob/main/docs/UNIFIED-TEMPLATE.md) |
| Review recorded acceptance | [Validation receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.1.0.md) |

`npm run systemx:status` reports installation integrity and the selected release.
`npm run systemx -- status` reports task records. `npm run systemx:context`
provides the bounded Agent 0 resume packet. Use WSG menu option 12 or
`npm run systemx -- menu` for the managed operating tools.

The LAN dashboard Agent 0 panel displays the selected version, update policy,
registered roles, recorded tasks and child-project count. These are record
summaries, not running-agent or remote-service acceptance claims.

`npm run ci:all` and `template:check` validate the reusable blank release.
For an adopted app with real project records, use its configured checks and
`systemx:validate`; adapt the template-maintenance integration suite as needed.

The Designer roadmap remains evidence-gated. Read its capability manifest and
[LAN Builder Designer master plan](SYSTEMX-LAN-Builder-Designer-Master-Plan.md)
for implemented, guarded and planned capabilities.

## Security review

The unified template includes reviewed authorization and tooling repairs. Read [Security Review](Security-Review.md) for protected profile fields, literal secret-file configuration and validation boundaries.
