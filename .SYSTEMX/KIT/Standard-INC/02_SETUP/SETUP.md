# Setup an INC portfolio

## 1. Establish the workspace

Read outer `.SYSTEMX/INSTALLATION.json`, then STANDARD and START-HERE from its active release. Use one existing installation. Record accepted INC/client constraints in outer GLOBAL and cross-project outcomes in PLAN. Keep the public kit and reusable task/memory seeds blank.

Copy `03_CONFIG/portfolio.blank.json` to an adopted INC operations scope or a private working directory. Fill intake and obtain the account owner's accepted requirements before provider changes.

## 2. Register operations and business scopes

Use existing commands from the workspace root. Names below are examples:

```bash
bash .SYSTEMX/SYSTEMX.sh projects add INC-Operations --kind operations
bash .SYSTEMX/SYSTEMX.sh projects add INC-Operations --kind operations --apply
bash .SYSTEMX/SYSTEMX.sh projects add Brand-One --kind operations --apply
bash .SYSTEMX/SYSTEMX.sh projects context --project INC-Operations --agent agent.0
```

On Windows use `powershell -File .SYSTEMX/SYSTEMX.ps1` with the same arguments. Python must be installed for either launcher. Preview each new project first; creation refuses existing destinations. Do not edit the runtime registry to add business metadata.

```text
workspace/
|-- .SYSTEMX/
|   |-- KIT/Standard-INC/                    reusable source
|   |-- Projects/REGISTRY.json               manager-owned project identities
|   |-- Projects/INC-Operations/.SYSTEMXP/   shared operations records
|   '-- Projects/Brand-One/.SYSTEMXP/        business records
'-- client-deliverables/                     optional external working files
```

All children are named; no nameless central `.SYSTEMXP` or second installation. Business files may live beside a child marker or in an external source recorded in SOURCES.json. Drive folder IDs are source references, not proof of a local SYSTEMXP installation.

## 3. Adopt records without duplicate authority

Store `portfolio.json`, intake, and shared email evidence in INC-Operations working files beside `.SYSTEMXP`. Add a directory source in its SOURCES.json with an explicit relative base. Each business owns its plan, ledger, decisions, assets and delivery acceptance. Record shared dependencies as outer coordination tasks; child task dependencies remain local.

```bash
bash .SYSTEMX/SYSTEMX.sh projects task-add --project INC-Operations --title "Accept portfolio ownership and mail plan" --acceptance "Owner accepts registry and routing decisions"
bash .SYSTEMX/SYSTEMX.sh projects validate --project INC-Operations
bash .SYSTEMX/SYSTEMX.sh projects validate
```

Use project-qualified task references in cross-project handoffs. Record writer, allowed files, baseline revision, evidence and next step in the existing assignment/task flow. Re-read shared files before commits. Advisory claims and Drive synchronization do not lock files.

## 4. Prepare and validate

Fill business records, mailbox owners/providers and routes using [the contract](../03_CONFIG/CONTRACT.md). Validate offline:

```bash
node .SYSTEMX/KIT/Standard-INC/05_SCRIPTS/validate.mjs path/to/portfolio.json
node .SYSTEMX/KIT/Standard-INC/05_SCRIPTS/validate.mjs path/to/portfolio.json --registry .SYSTEMX/Projects/REGISTRY.json
```

The registry option verifies every scope is registered, with canonical paths. The blank seed is checked with `--blank`; it does not pass adopted-plan validation.

## 5. Implement email and optional assets

Follow [email operations](EMAIL.md). For websites record actual Hosting site IDs separately from human target aliases and public web.app URLs; verify project association with the account owner. Use Brand for guides and Production's source-lock/manifest pattern for approved client exports. Shared ownership does not authorize copying another client's assets.

When a business also needs an app, continue through [Unified Setup](../../../Unified-Setup-Process/README.md) using that business's selected scope, accepted stack and edition. Map its approved NoReply sender into the [sender/auth standard](../../../Unified-Setup-Process/standards/Firebase-Sender-Auth-MFA.md). Keep domain receiving-mail ownership separate from application sender credentials and login roles. Email-only INC setup requires no Firebase app or authentication configuration.

## 6. Accept and hand off

Run SYSTEMX project validation, retain configuration and evidence revisions, and complete [handoff](../04_TEMPLATES/HANDOFF.md). Leave failed delivery checks and undecided migration steps open in the actual task ledger. Archive superseded plans deliberately and remove temporary access after accepted cutover.
