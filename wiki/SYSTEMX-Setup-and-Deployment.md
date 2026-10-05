# How Setup and Deployment Work

SYSTEMX combines an intake process with scripts. The intake files clarify the
product and operating decisions; scripts perform repeatable local actions. The
two are complementary: a script cannot infer risk acceptance, and a document
does not deploy an application.

## Setup flow

1. Start the menu or run the bootstrap script in check mode.
2. Complete the ordered intake and master-plan material.
3. Establish Firebase/Google Cloud projects, IAM, billing, domains, and rules.
4. Configure local client values and approved secret storage.
5. Build a minimal product slice and run quality/security gates.
6. Export or import structured setup packets when a handoff needs a bounded
   context package.

Useful non-production checks are:

```bash
npm install
npm test
bash .SYSTEMX/WSG-MENU.sh
npm run system:audit
npm run sync:system:check
bash .SYSTEMX/scripts/deploy.sh --preflight
```

## Deployment flow

The deploy helper supports a full or targeted path. Start with preflight or
dry-run, then explicitly select the project and target. For example:

```bash
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run --project your-project-id
bash .SYSTEMX/scripts/deploy.sh --rollback-info --project your-project-id
```

A real deployment is an operator-approved event. Confirm the Git branch and
diff, identity, target project, rules, release notes, quality results, monitoring
plan, and rollback instructions. After deployment, test the key user journey and
record the release. See [Deployment](Deployment) and
[WTL Standard Setup Guide](WTL-Standard-Setup-Guide).
