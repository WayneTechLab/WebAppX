# Standard INC kit index

Canonical source: `.SYSTEMX/KIT/Standard-INC/`. Version 1.0.0.

Read in order:

1. [README](README.md): scope and ownership.
2. [Intake](01_INPUT/INTAKE.md): accepted requirements.
3. [Setup](02_SETUP/SETUP.md): adopt and register named scopes.
4. [Email operations](02_SETUP/EMAIL.md): routing and migration.
5. [Configuration contract](03_CONFIG/CONTRACT.md) and [blank seed](03_CONFIG/portfolio.blank.json).
6. [Evidence](04_TEMPLATES/EVIDENCE.md) and [handoff](04_TEMPLATES/HANDOFF.md).
7. [Example](EXAMPLE_PORTFOLIO.md): illustrative portfolio, never live configuration.

## Integration map

| Existing source | Use here |
| --- | --- |
| [SYSTEMX PROJECTS](../../docs/PROJECTS.md) | Project creation, selection, tasks, source references and validation. |
| [Shared workspaces](../../docs/SHARED-WORKSPACES.md) | Drive and chat ownership; one writer per shared record. |
| [Brand kit](../Brand/SYSTEMX-KIT-INDEX.md) | Intake, layout/output contracts and approved client brand guide workflow. |
| [Production kit](../Production/SYSTEMX-KIT-INDEX.md) | Source lock, asset manifest, platform exports and document handoff patterns. |
| [Integration ownership](../../../docs/SYSTEMX-INTEGRATION.md) | KIT is a host extension; managed releases remain immutable. |
| [Unified Setup](../../Unified-Setup-Process/README.md) | Optional app stack/edition intake and implementation phases. |
| [Sender/Auth/MFA standard](../../Unified-Setup-Process/standards/Firebase-Sender-Auth-MFA.md) | Optional application sender integration, secret storage and auth readiness. |

Use the Brand and Production kits' workflow contracts, asset provenance and acceptance approach. Their Wayne Tech Lab and example client artwork is not a default identity for an INC. Select approved client assets and record licenses, source revision and asset owner.

## Operator / LLM instruction

Read this index and the selected SYSTEMX release instructions. Confirm the INC, client and allowed workspace. Copy blank configuration into adopted project records, obtain intake facts, register explicitly selected projects through existing commands, and record business-to-project mappings. Validate the plan, then perform only authorized provider changes. Return the configuration revision, routing evidence, scope validation, open decisions, rollback and owner handoff.

## Package contract

`03_CONFIG/portfolio.blank.json` remains empty of adopted accounts and clients.
Templates carry no actual credentials or task state. [validate.mjs](05_SCRIPTS/validate.mjs) performs read-only configuration validation. Kit changes use a reviewed version and [release notes](RELEASE_NOTES.md); existing adopted portfolios are migrated deliberately.

Run `npm run kit:inc:check` from the WebAppX root to check the blank seed and routing regression tests. The repository's full CI includes this check.
