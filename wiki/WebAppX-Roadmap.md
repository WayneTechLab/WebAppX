# WebAppX roadmap — 1,000 proposed TODOs

The public template has a structured catalog of **exactly 1,000 unstarted
proposals**, covering 20 areas with 50 items each. Existing HR, CMS, CRM,
persistence, backups and restore/Undo remain the implemented baseline. The list
describes future improvements and focused verification, not 1,000 completed
features, known defects or automatically authorized jobs.

## Read and filter

- [Roadmap and sequencing](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBAPPX-ROADMAP.md)
- [Complete 1,000-item list](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/WEBAPPX-1000-TODO.md)
- [Canonical JSON](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/webappx-1000-todo.json)
- [Spreadsheet CSV](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/webappx-1000-todo.csv)
- [SYSTEMX host planning pointer](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/WEBAPPX-ROADMAP.md)

Every item has a stable `WX-0001`–`WX-1000` ID, priority, phase, specific
acceptance check, existing source pointer, acceptance gate and dependencies.

```bash
npm run backlog:summary
npm run backlog -- --area mock-recovery --priority P1 --limit 10
npm run backlog -- --id WX-0151
npm run backlog:render
npm run backlog:check
```

The JSON is canonical; Markdown and CSV are generated. The CI check verifies
the exact count, ordered IDs, 20 groups of 50, unique titles/acceptance, existing
source paths, earlier dependencies and synchronized views. Queries remain local.

## Scope and activation

The areas cover setup, portal architecture, three HR groups, two CMS groups,
two CRM groups, mock recovery, identity, Firebase, security/privacy, quality and
accessibility, design, operations, delivery, SYSTEMX, adoption documentation and
optional integrations/localization.

P1/P2/P3 prioritize review. The phases are foundation, portal maturity,
production readiness and extensions. Local checks use synthetic evidence;
provider and operator gates require separately approved optional environments.
Read source before activating a proposal. Create only a bounded set of canonical
tasks in an adopted app, with actual acceptance and assignment. The public
template's SYSTEMX context, plan, task and memory seeds remain blank.

## SYSTEMX refresh

The selected release remains the latest **1.9.0-alpha.6**. Reviewed public main
`3fb59429c878268f1081ca255a1f32fafc5dcfba` changed only upstream README/wiki
content outside `.SYSTEMX`; its complete source tree matches the original import
commit. The host importer now recognizes that case while preserving original
receipt bytes and rejecting changed same-version trees. No import application
was needed. See [Managed SYSTEMX](SYSTEMX-Standalone-Integration.md) and the
[refresh/roadmap QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-ROADMAP-QA-2026-10-14.md).
