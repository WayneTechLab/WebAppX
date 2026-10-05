> Current architecture: this unified template consumes managed standalone defaults.
> Read [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration) first.
> The webapp-specific controls below remain host extensions; the current task
> authority is `.SYSTEMX/WORK/TASKS.json` and selected defaults come from INSTALLATION.json.

# SYSTEMX Sync and Controlled Updates

This page was previously titled `SYSTEMX-AGI-Sync-and-Controlled-Updates`.
The slug was renamed to reduce confusion around autonomous-AI terminology while
preserving the same governed sync behavior.

`SYSTEMX Sync` is the current name for the governance synchronization path in
WTL WebApp Stack G1. It aligns managed operational metadata such as versions and
generated agent adapters. It is not an autonomous artificial general
intelligence, a self-modifying application, or an unattended production
deployment service.

The historical `AGI` label remains in filenames for compatibility and must not
be read as a claim of autonomous intelligence. The current npm interface is
`npm run sync:system` and `npm run sync:system:check`; the underlying shell
entry point is `bash .SYSTEMX/wsg-agi.sh`. The older `npm run wtl:sync` and
`npm run wtl:agi` names are not present in the current package manifest.

Use its check mode before releases:

```bash
npm run sync:system:check
```

The check detects operational drift. A non-check run may update the files it
manages; review and commit those changes like any other source change. Sync
does not approve a deployment, create cloud credentials, bypass branch
protection, or decide whether a production change is safe.

Deployment remains a controlled action through the deploy helper and vendor
authentication. It should require an authorized operator or an approved CI
identity, explicit target selection, quality evidence, monitoring, and a
rollback plan. Future automation should preserve these controls rather than
remove them.

If “self-update” is desired, define it as a reviewed update pipeline: fetch a
known source, verify integrity and compatibility, run tests in a non-production
environment, obtain approval, deploy deliberately, and retain rollback. Never
allow an agent or script to silently upgrade production dependencies or security
policies without evidence and accountable approval.

## Standalone imports, host sync and repository mirrors

These are separate update paths:

| Operation | Check / preview | Explicit update |
| --- | --- | --- |
| Host metadata | `npm run sync:system:check` | `npm run sync:system` |
| Managed defaults | `npm run systemx:upstream:check` | `npm run systemx:upstream:import` |
| Identical template tree | `python3 -B scripts/sync-template.py --target /path/to/mirror` | Same command with `--apply` |
| Wiki pages | `npm run wiki:check` | `npm run wiki:sync` |

An import retains active outer records and pins verified upstream defaults. A
mirror is for clean reusable template repositories with blank seeds; it copies
tracked files without committing or pushing. After reviewing/committing both
repositories, `npm run template:check -- --against /path/to/mirror` verifies
identical trees. It excludes Git history and ignored local resources.

Read the [template maintenance guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/TEMPLATE-MAINTENANCE.md)
for source review, publication and live-remote verification.
