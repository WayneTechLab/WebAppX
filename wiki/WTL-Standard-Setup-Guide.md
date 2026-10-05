# WTL Standard Setup Guide

## The process of idea into production

This guide is the operator sequence for turning an idea into a production web
application using WTL WebApp Stack G1. It is a governance guide, not a promise that a
script can secure, approve, or operate a product on your behalf. The project
owner remains responsible for architecture, code, security, testing, legal
compliance, billing, and production decisions.

## 1. Define the work before writing code

Start with the business purpose, users, data categories, jurisdictions, budget,
availability target, and the person accountable for release approval. Complete
the ordered files in `.SYSTEMX/Unified-Setup-Process/intake/`, beginning with
the project brief and ending with the launch and post-launch plan. Treat the
answers as design inputs—not as secrets or production configuration.

Choose a minimal first release. Record what is explicitly out of scope, who may
access data, and what would make a deployment unsafe. For regulated, financial,
health, child-data, or high-impact workloads, obtain qualified legal, privacy,
and security review before collecting or processing data.

## 2. Create the project and establish local tooling

Create a repository from the template, clone it, install dependencies, and make
the first working build before connecting any cloud account.

```bash
npm install
npm test
bash .SYSTEMX/WSG-MENU.sh
npm run dev
npm run build
```

SYSTEMX is a shared Node/Vite control layer with a Bash menu and Node-based LAN
runner. The menu surfaces setup, quality, Firebase, Git, and deployment actions.
The Node runner detects available loopback ports and records owned processes;
platform-specific installer wrappers remain a follow-up. Use the [One-Line
Workstation Start](One-Line-Install) page for the tested clone path.

## 3. Establish the Firebase and Google Cloud foundation

Create or select a Google Cloud project, enable billing only when the project
owner approves it, and create the Firebase project and web app. Use least
privilege IAM. Separate development, staging, and production projects where the
risk, team size, or data classification requires it.

Before application development proceeds, decide and document:

- Firebase Authentication providers, authorized domains, MFA expectations, and
  account roles.
- Firestore and Storage data model, retention, backup, and Security Rules.
- Cloud Functions boundaries and service-account permissions.
- Hosting target, custom-domain ownership, DNS, monitoring, and rollback owner.
- Cost alerts, quotas, incident contacts, and offboarding procedure.

Use the detailed [Environment Variables](Environment-Variables),
[Security](Security), and [Architecture & Stack](Architecture-and-Stack) pages
alongside the `.SYSTEMX/Template/steps/03-firebase-provision.md` and
`07-security-rules.md` source guides.

## 4. Configure environment and secrets safely

Copy `.env.example` to `.env.local`; commit neither the local file nor server
secrets. Firebase client configuration is not a secret, but it must still match
the intended project. Keep privileged credentials, payment keys, signing keys,
and service-account material in an approved secret-management system and out of
the browser bundle. See [.ENV Solutions](SYSTEMX-Environment-Solutions).

## 5. Build through quality gates

Implement the smallest end-to-end vertical slice. Review authorization and data
rules with the same care as UI code. Before a handoff or release, run the
applicable checks:

```bash
npm run typecheck
npm run ci:lint
npm run test
npm run ci:security
npm run build
npm run sync:system:check
```

Fix findings rather than bypassing gates. Record accepted risk, its owner, and
its expiry in the project’s decision record.

## 6. Preflight, deploy, verify, and retain rollback information

Use a non-mutating preflight first, select the Firebase project deliberately,
and verify the deployed result with a real user path. The deploy script can
target hosting, rules, functions, or the app:

```bash
npm run deploy -- --target hosting --preflight
npm run deploy -- --target hosting --dry-run --project your-project-id
npm run deploy -- --rollback-info --project your-project-id
```

Only an authorized operator should run a real deployment. Review the Git diff,
release notes, rules changes, monitoring, and rollback path first. The detailed
workflow is in [Setup & Deployment](SYSTEMX-Setup-and-Deployment).

## 7. Operate the product after launch

Production is the start of an operating commitment: monitor errors and billing,
review dependencies and access, test recovery, rotate credentials when needed,
and maintain documentation. Use [Start & End of Day](SYSTEMX-Operating-Rhythm)
for a lightweight operating cadence and [Long-Term Warnings](SYSTEMX-Long-Term-Warnings)
for risk that does not disappear after launch.

## Related standard

The [SYSTEMX Standard](SYSTEMX-Standard) explains the operational model, its
security boundaries, the menu and packet flow, and the limits of automation.
