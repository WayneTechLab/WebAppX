# Template security review — 2026-10-05

The Codex Security source review identified and repaired eight security findings
across Firebase authorization, the local LAN builder, synchronization and operator
tooling. The public template and private mirror carry the same repaired files.
The selected immutable SYSTEMX release remains unchanged.

| Boundary | Resulting behavior |
| --- | --- |
| Firestore profile authority | Every client create/update protects privileged fields. Staff can edit ordinary profile data; deleting a profile containing protected fields requires a trusted backend. Owner registry management remains available to verified owners. Root and starter rules are identical. |
| LAN source and assets | Source, font and public asset paths reject symbolic links, including linked parent directories. Backups reject linked directories; source temporary files use exclusive creation. |
| Template mirror | Preview and apply refuse symbolic links in tracked source and destination paths before reading or copying release files. |
| Wiki synchronization | Preview and publish refuse linked source pages and cloned destination pages before copying. |
| Background deployment | The child retains the target, explicit project, preflight/audit/dry-run/check and skip flags. Unknown flags and incomplete values fail. Read-only modes reject version bumps and lint fixes. |
| Secret configuration | Deployment reads environment assignments as literal data. It does not source the files, expand variables or evaluate commands. Only documented provider keys are imported. |
| Shell launcher | The installed launcher quotes the checkout path as a shell literal. |
| Version metadata | Governance, version bump, deployment and Git hooks pass paths, versions and branch names as arguments to fixed JavaScript programs. |

## Account administration

Protected profile fields are `level`, `role`, `admin`, `subscriptionTier`, `tier`,
`mfaRequired`, `securityProfile` and `claims`. Their creation, change or removal
belongs in an authenticated, authorized backend workflow. An ordinary profile
may still be created by its user and updated by that user or staff. Staff may
delete a profile only if it contains none of the protected fields.

Custom claims and the owner-controlled `adminUsers` registry remain supported.
Missing optional claims/profile fields use explicit defaults with the
[Firebase Rules Map API](https://firebase.google.com/docs/reference/rules/rules.Map).
Client demo levels remain presentation fixtures, not production authorization.

## Secret-file compatibility

`.secrets.env` takes precedence over `.SYSTEMX/secrets.env`. Both use literal
`KEY=value` assignments, optional `export`, comments and quoted values. Shell
commands, variable expansion and executable shell startup configuration are not
supported. Quote values containing spaces, apostrophes or backslashes; the setup
writer produces compatible quoted values automatically. Keep these files ignored
and private.

Supported keys are:

```text
STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET EMAIL_API_KEY
SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD EMAIL_FROM_ADDRESS
ADMIN_BOOTSTRAP_TOKEN FIREBASE_TOKEN GOOGLE_APPLICATION_CREDENTIALS
FIREBASE_PROJECT_ID GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT
SYSTEMX_GOOGLE_FONTS_API_KEY
```

Unsupported keys fail before the deployment pipeline. Configure runtime/tool
settings in the operator's trusted environment instead of secret-data files.
Review the reader before adding another provider key.

## Validation and scope

The final local checks passed: 172 tests, with five case-sensitive-filesystem
checks skipped on this macOS volume. The dependency audit reported zero known
vulnerabilities. The deployment preflight passed in a disposable checkout and
performed no Git push or Firebase deployment.

`npm run ci:all` includes the operational control regressions, LAN checks, managed
tool tests, template/import tests, lint, type checking, dependency audit, research
checksums, documentation links and the production build/isolation check.

`npm run security:controls:test` checks background argument preservation, launcher
quoting, metadata strings, secret value round trips, wiki link rejection and
root/starter rule parity. `npm test` includes filesystem-boundary and data-parser
tests. Template integration tests cover tracked mirror-link rejection.

`npm run security:rules:test` requires explicit loopback Auth and Firestore emulator
endpoints and always uses `demo-systemx`. Run it through Firebase `emulators:exec`
with an isolated configuration. It checks denied authority changes alongside
allowed member/staff profile work and owner registry operations. It refuses to run
against configured production services.

The review covered active application, starter, LAN, installer, sync, deployment,
hook and managed-tool implementations. Supporting research/media and test fixture
files were not individually security-audited. Source and emulator evidence do not
establish deployed Firebase rules, production MFA/App Check or Windows runtime
acceptance. Deploying rules requires the operator's separate production action.
The local preview application shares controller authority through the Vite bridge;
run reviewed project code. Concurrent hostile modification by a process with the
same operating-system authority remains outside the pathname checks' guarantee.
