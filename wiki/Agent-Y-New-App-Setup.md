# Set up Agent Y in a new WebAppX app

This guide applies to **WebAppX 3.2.0 with managed dotSYSTEMX 1.9.0-alpha.5**.
Agent Y takes one Agent 0 task into a separately installed CLI provider, works
on a task branch in a separate Git worktree, and returns a local commit for
review. Draft PR publication is an optional choice made when preparing that task.

Run these steps in **your new adopted app**, where you own the project records.
The reusable WebAppX repository keeps its registry, tasks and memory blank.
Examples below create records only when you run them in that adopted app.

| Role | Responsibility |
| --- | --- |
| Agent 0 | Select the task, provider, allowed paths and branch/PR policy; integrate and accept the result. |
| Agent X | Record observed events, times and original evidence. It does not run schedules. |
| Agent Y | Execute one bounded CLI handoff and the explicitly allowed task branch/PR lifecycle. |
| Agent Z | Review the same versioned evidence questions at the acceptance boundary. A score does not accept or merge work. |

The [selected Agent Y manual](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/.systemx/releases/1.9.0-alpha.5/docs/AGENT-Y.md)
defines the exact alpha.5 commands. The
[CLI/tools guide](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/.systemx/releases/1.9.0-alpha.5/docs/CLI-TOOLS.md)
covers installed CLI routing and working directories. Read
[Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration.md) for update ownership.

## 1. Create and verify the adopted app

Replace `YOUR_OWNER/my-app` with the repository you intend to create. GitHub CLI
must already be installed and signed into the account authorized to create it.
You can also use GitHub's [Use this template](https://github.com/WayneTechLab/WebAppX/generate)
button and clone the resulting repository.

```bash
gh repo create YOUR_OWNER/my-app --template WayneTechLab/WebAppX --private --clone
cd my-app
npm ci
npm run systemx:status
npm run systemx:validate
git remote get-url origin
```

Check that `origin` names **your app**, and that installation status selects
`1.9.0-alpha.5`, pinned with manual updates. Read the outer
`.SYSTEMX/START-HERE.md` and `INSTALLATION.json`, then the selected release's
`STANDARD.md` and `START-HERE.md`. Keep managed snapshots under
`.SYSTEMX/.systemx/releases/` immutable, including the retained original release.
Your app's context, plan, tasks, access matrix, map and memory belong in the
outer `.SYSTEMX`; edit those when adopting your approved project requirements.

On native PowerShell, the equivalent core inspection uses the included launcher:

```powershell
gh repo create YOUR_OWNER/my-app --template WayneTechLab/WebAppX --private --clone
Set-Location my-app
npm ci
py -3 -I -B .\.SYSTEMX\manager.py status --target .
& .\.SYSTEMX\SYSTEMX.ps1 validate
git remote get-url origin
```

Native Windows supports role setup, provider detection, preparation and run
previews, and job inspection. **Agent Y `run --apply` is unavailable on native
Windows in this alpha**, because descendant-process termination is unverified.
This restriction applies to Windows x64 and ARM64. A prepared Windows job
cannot be executed on a different host by copying its private sidecar. Agent 0
must reconcile that handoff and prepare a separate authorized job on a supported
host. Core PowerShell and project record tools remain available.

## 2. Configure real app checks

Review and adapt the new app's inherited `AGENTS.md` with its owner before
populating context or tasks. Its blank-seed and `ci:all` instructions apply to
maintaining the reusable template; the adopted app needs accepted app-specific
gates. Preserve snapshot integrity, secret handling, evidence and operator
deployment authorization. WebAppX itself continues to ship blank records.

Edit `.SYSTEMX/project.json` for the adopted app. The inherited `integration`
entry runs `systemx:integration:test`, which includes blank-template checks;
drop or adapt that entry before populating app records. Keep applicable security,
audit, documentation, research and behavioral checks rather than removing them
to make adoption pass.
`npm run ci:all` and `npm run template:check` maintain the reusable blank template
and intentionally reject populated seeds.

For a new app that still uses the supplied npm scripts, this is a starting
configuration. Replace `My App` and the description, retain any additional
checks your app requires, and use executables available on your host:

```json
{
  "schemaVersion": 1,
  "project": {
    "name": "My App",
    "description": "The approved purpose of this adopted application."
  },
  "checks": [
    { "name": "lint", "command": ["npm", "run", "ci:lint"] },
    { "name": "types", "command": ["npm", "run", "ci:typecheck"] },
    { "name": "app-tests", "command": ["npm", "test"] },
    { "name": "security", "command": ["npm", "run", "ci:security"] },
    { "name": "audit", "command": ["npm", "run", "ci:audit"] },
    { "name": "documentation", "command": ["npm", "run", "docs:links"] },
    { "name": "research", "command": ["npm", "run", "research:validate"] }
  ],
  "commands": {
    "dev": ["npm", "run", "dev:systemx"],
    "build": ["npm", "run", "build"],
    "deploy": []
  }
}
```

Commands are argument arrays, executed from the selected app directory without
shell expansion. Choose app-specific behavioral checks for the task; lint and
types alone do not establish user-visible acceptance. Deployment configuration
and operator authorization remain separate from this local setup.

```bash
npm run systemx -- check --dry-run
npm run systemx:check
npm run build
```

These checks are run by Agent 0. The Agent Y controller does not execute project
checks or retain the provider's stdout/stderr as test evidence.

## 3. Preview and activate optional roles

From the adopted app's root:

```bash
bash .SYSTEMX/SYSTEMX.sh roles-init
# Review register/add/preserve and the selected scope, then apply:
bash .SYSTEMX/SYSTEMX.sh roles-init --apply
bash .SYSTEMX/SYSTEMX.sh agent-y providers
bash .SYSTEMX/SYSTEMX.sh validate
```

PowerShell equivalents:

```powershell
& .\.SYSTEMX\SYSTEMX.ps1 roles-init
# Review the preview before applying:
& .\.SYSTEMX\SYSTEMX.ps1 roles-init --apply
& .\.SYSTEMX\SYSTEMX.ps1 agent-y providers
& .\.SYSTEMX\SYSTEMX.ps1 validate
```

`roles-init --apply` registers **Agent X, Agent Y and Agent Z** and creates
missing blank role memories, event/schedule records, Agent Y `JOBS.json` and
the review policy. It preserves existing records and starts no provider.
`agent-y providers` detects installed CLI names; it does not install a CLI,
authenticate an account, test a model or authorize paid usage.

Choose one installed provider per task. This guide uses `codex`; `copilot` is
another built-in name. Confirm the CLI's actual account and configured execution
settings through that provider before dispatch. The CLI does not inherit the
Codex app/IDE conversation, and its usage consumes the same project time and
resource budget as other workers. An optional `--model NAME` must name a model
the selected installed provider and account actually support.

For Codex, follow the [official CLI installation and sign-in guide](https://learn.chatgpt.com/docs/codex/cli)
for your platform. Open `codex` once to complete its own sign-in flow, then exit
that interactive session before dispatching the Agent Y task. Verify the
terminal installation and login with:

```bash
codex --version
codex login status
```

For Copilot, use [GitHub's CLI installation and authentication guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli),
complete its `/login` flow if needed, and select `--provider copilot` instead.
Use the provider's authenticated local session; Agent Y does not forward the
controller's GitHub/cloud token environment into its worker.

## 4. Assign one real task and checkpoint setup

This example assigns an approved About page copy change. Replace the title,
acceptance and scope for your actual task. The first task in a new empty ledger
returns `TASK-001`; otherwise use the **returned ID** throughout this guide.
`task-add` and `task-set` write records immediately; they do not have preview flags.

```bash
bash .SYSTEMX/SYSTEMX.sh task-add \
  --title "Use the approved app introduction on the About page" \
  --owner agent.y \
  --scope "src/pages/AboutPage.tsx" \
  --acceptance "The About page shows the exact approved app introduction" \
  --acceptance "Only the assigned file changes and the applicable app checks pass" \
  --next "Review the bounded Agent Y prompt and prepare a local result"

# Set this to the ID printed by task-add:
task_id='TASK-001'
bash .SYSTEMX/SYSTEMX.sh task-show "$task_id"
bash .SYSTEMX/SYSTEMX.sh task-set "$task_id" --status in_progress \
  --next "Run the reviewed Codex CLI handoff without a PR"
```

The task must belong to `agent.y`, have satisfied dependencies and be
`in_progress` before preparation. Agent 0 retains the original acceptance
criteria. Use a narrow repository-relative `--allow-path` later; do not allow the
whole repository. Agent Y cannot own coordination, Git metadata or secret paths.
The controller does not derive `--allow-path` from the task's descriptive scope;
Agent 0 must verify that both match the approved assignment.

Review the actual setup diff. In this new app, commit the approved role, config,
task and context changes before preparing a handoff. The following stages the
selected record directories; inspect every staged file before committing:

```bash
git status --short
git diff -- AGENTS.md .SYSTEMX
git check-ignore -v -- .SYSTEMX/logs/roles/example.json
git add -- AGENTS.md .SYSTEMX/project.json .SYSTEMX/AGENTS .SYSTEMX/EVENTS \
  .SYSTEMX/REVIEWS .SYSTEMX/WORK .SYSTEMX/CURRENT.md \
  .SYSTEMX/GLOBAL .SYSTEMX/PLAN .SYSTEMX/MEMORY
git diff --cached --stat
git diff --cached
git commit -m "Configure app checks and the first Agent Y task"
# Publish the reviewed setup through your app's normal Git policy:
git push origin main
git fetch origin main
git status --short --untracked-files=all
git rev-parse HEAD
git rev-parse refs/remotes/origin/main
git ls-remote origin refs/heads/main
```

Review your app's Actions and webhooks before pushing; publication may trigger
them. This example assumes your reviewed base branch is `main`. Use its actual
branch name otherwise. Preparation requires the selected Git repository to be
clean. Before proceeding, confirm that HEAD, `origin/main` and GitHub's direct
`main` ref identify the intended setup commit. Preserve local material if they
do not agree; do not reset or force-push to make the example fit.

## 5. Prepare a private bounded prompt

The template includes `/local/` and `/state/` ignores inside `.SYSTEMX`.
Confirm the role receipt, private prompt and job sidecar/archive locations are
ignored and untracked:

```bash
git check-ignore -v -- \
  .SYSTEMX/logs/roles/example.json \
  .SYSTEMX/local/agent-y/approved-task.md \
  .SYSTEMX/state/agent-y/Y-example.json \
  .SYSTEMX/state/agent-y/archives/Y-example.bundle
git ls-files -- .SYSTEMX/local .SYSTEMX/state
```

`check-ignore` should name effective ignore rules; `ls-files` should produce
no entries for those private paths. Stop and reconcile already tracked private
files and their history if it does. Git ignores do not prevent force-adds,
whole-folder backups, Drive sync or other external copies.

Create the prompt locally, then replace `APPROVED_DESCRIPTION` with the actual
approved copy **before** preparing the job:

```bash
mkdir -p .SYSTEMX/local/agent-y
cat > .SYSTEMX/local/agent-y/approved-task.md <<'PROMPT'
Apply this approved task only in src/pages/AboutPage.tsx.
Replace the current About page introduction with exactly:
APPROVED_DESCRIPTION

Keep the current page structure, navigation and unrelated copy intact.
Do not edit .SYSTEMX records, credentials, configuration or unrelated files.
Do not commit, move HEAD, push or open/modify a PR; the controller owns those actions.
Run applicable local checks if available, and report limitations honestly.
Stop when this assigned copy change is complete or a blocker needs Agent 0.
Agent 0 will inspect the returned commit and independently record check evidence.
PROMPT
chmod 600 .SYSTEMX/local/agent-y/approved-task.md
```

The prompt must be a regular, unlinked UTF-8 file inside the selected repository,
at most 64 KiB. Keep passwords, keys, session tokens and unnecessary private
context out of it. It must be outside the allowed source paths. Add the task's
actual check commands, necessary source references, time/resource budget and
stop condition to the reviewed prompt. The current controller's execution limit
is 30 minutes; it has no separate per-job budget flag.

At preparation, the selected CLI executable's absolute path, SHA-256 and file
identity are bound in ignored host-local state. A replaced or updated executable
is refused at launch; review it and prepare a new handoff rather than editing
the saved sidecar. Prepared prompts are hashed too; changing the prompt later
requires a new reviewed handoff.

## 6. Preview and save the Codex handoff

Capture the absolute app path while still in its root. `--base main` names the
existing `origin/main` tracking branch; do not pass `origin/main` as the flag value.
The branch must be new and task-owned. This example uses no PR flag, so the result
stays local for Agent 0 review.

```bash
REPO_ROOT="$(pwd -P)"
task_branch="codex/agent-y/$task_id-about-introduction"
prepare_args=(
  --task "$task_id"
  --provider codex
  --repo "$REPO_ROOT"
  --base main
  --prompt-file "$REPO_ROOT/.SYSTEMX/local/agent-y/approved-task.md"
  --allow-path "src/pages/AboutPage.tsx"
  --branch "$task_branch"
)
bash .SYSTEMX/SYSTEMX.sh agent-y prepare "${prepare_args[@]}"
# Review the exact task/base/branch/path/provider and openDraftPr:false:
bash .SYSTEMX/SYSTEMX.sh agent-y prepare "${prepare_args[@]}" --apply
```

Use the returned `Y-...` ID. Saving prepares a portable job record and a private
local sidecar; it starts no CLI. **After preparation, keep `origin/main` and the
remote base unchanged until the run finishes.** Committing/pushing the new
coordination metadata to `main` at this point would move the prepared base and
make the run refuse it. Preparation deliberately writes `JOBS.json`, so the
coordinator checkout can show that tracked change before running.

Native PowerShell can preview and save the same handoff with an argument array:

```powershell
$appRepo = (Get-Location).Path
$taskId = 'TASK-001' # replace with the task-add result
$prepareArgs = @(
  '--task', $taskId, '--provider', 'codex', '--repo', $appRepo,
  '--base', 'main',
  '--prompt-file', (Join-Path $appRepo '.SYSTEMX\local\agent-y\approved-task.md'),
  '--allow-path', 'src/pages/AboutPage.tsx',
  '--branch', "codex/agent-y/$taskId-about-introduction"
)
& .\.SYSTEMX\SYSTEMX.ps1 agent-y prepare @prepareArgs
# After reviewing the preview:
& .\.SYSTEMX\SYSTEMX.ps1 agent-y prepare @prepareArgs --apply
```

The PowerShell example assumes steps 2–5 have created and checkpointed the
actual task and private prompt. Its native Windows job remains preview-only at
execution time under the current limitation.

## 7. Preview and run on a supported host

```bash
# Replace this placeholder with the ID returned by prepare --apply:
y_id='Y_RETURNED_ID'
bash .SYSTEMX/SYSTEMX.sh agent-y show "$y_id"
bash .SYSTEMX/SYSTEMX.sh agent-y run "$y_id"
# After reviewing the run plan, on a supported host:
bash .SYSTEMX/SYSTEMX.sh agent-y run "$y_id" --apply
bash .SYSTEMX/SYSTEMX.sh agent-y show "$y_id"
```

The apply step creates a separate temporary worktree at the prepared commit,
passes the bounded task packet to the selected CLI and checks its changed paths.
The provider should edit the allowed source and leave HEAD/branch unchanged.
The controller stages and commits the inspected change itself. A successful
local job returns `review_pending`, a `headOid` and changed-path evidence.
It does not change the canonical task to `done`, run your app checks or merge
the result into the coordinator's checkout.

The worktree and path checks are workflow controls. They do not give a provider
authority over `.SYSTEMX` records or isolate all host filesystem/network access.
CLI authentication caches and interpreter/dependency trust remain host concerns.
For untrusted work, choose an appropriate OS/container boundary without controller
credentials or coordination-record write access. Provider output is task data
for Agent 0 review, not new authority.

The worktree path is recorded in the ignored local sidecar. Inspect the exact
result without printing the full sidecar:

```bash
worktree="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["worktree"])' \
  ".SYSTEMX/state/agent-y/$y_id.json")"
head_oid="$(git -C "$worktree" rev-parse HEAD)"
git -C "$worktree" status --short
git -C "$worktree" show --stat "$head_oid"
git -C "$worktree" show "$head_oid" -- src/pages/AboutPage.tsx
```

If execution fails, preserve the job and worktree. A timeout is not cancellation.
Inspect the existing controller/process and any remote artifacts before retrying.
Use `agent-y recover Y_ID` preview only for a stranded same-host job whose
controller is confirmed gone; recovery records failure and preserves work.
`agent-y abandon Y_ID --reason "Reviewed reason"` previews retirement of a
genuinely unrun prepared handoff; apply it explicitly before a replacement.

## 8. Check, review and accept with Agent 0

Run your app's checks against the returned worktree, so the evidence concerns
the proposed change. Record original output and exit status tied to `head_oid`.

```bash
cd "$worktree"
npm ci
npm run systemx:check
npm run build
# Inspect the changed page in the app and verify its exact approved copy.
cd "$REPO_ROOT"
```

If a check fails or the behavior misses an acceptance criterion, stop acceptance
and record the gap/next action. The controller's success or a review score alone
cannot make the task done. Store the actual check evidence under your app's
evidence policy; private local logs require an appropriate retained reference
before sharing or removing them.

After successful checks, use the actual original evidence reference below:

```bash
bash .SYSTEMX/SYSTEMX.sh task-set "$task_id" --status needs_review \
  --evidence "REPLACE_WITH_ORIGINAL_CHECK_EVIDENCE_AND_CHECKED_COMMIT"
```

Agent X can record the observed check event with its real occurrence time and
source/evidence revision. For Agent Z review, use the actual checked source
revision and evidence snapshot identifier:

```bash
bash .SYSTEMX/SYSTEMX.sh agent-z prepare \
  --kind task --subject "$task_id" --task "$task_id" \
  --revision "$head_oid" \
  --evidence-revision "REPLACE_WITH_ACTUAL_EVIDENCE_SNAPSHOT_ID" \
  --stage checked
# After reviewing, repeat that exact prepare command with --apply.
# Evaluate the retained questions in the returned request, using original evidence.
bash .SYSTEMX/SYSTEMX.sh agent-z score R_RETURNED_ID
bash .SYSTEMX/SYSTEMX.sh agent-z score R_RETURNED_ID --apply
```

Do not fabricate answers or evidence to complete a scorecard. Agent 0 reviews
the original task criteria and the resulting report. If gaps remain, return
the task to `in_progress` or `blocked` with a concrete next step.

For the default local-result path, checkpoint the coordinator's reviewed job,
task and review records, inspect the resulting clean state, then integrate the
returned commit through your app's normal Git policy. A manual local integration
can use `git cherry-pick "$head_oid"` **after** that review and checkpoint.
Run any integration checks required by your app, retain the delivered revision,
then accept explicitly:

```bash
bash .SYSTEMX/SYSTEMX.sh task-set "$task_id" --status done --reviewer agent.0 \
  --evidence "REPLACE_WITH_ACCEPTANCE_AND_DELIVERED_REVISION_REFERENCE"
bash .SYSTEMX/SYSTEMX.sh validate
```

An accepted local result can retain its job as `review_pending`; that job state
describes the delivery channel, while `WORK/TASKS.json` owns task acceptance.
Publish the integrated change and reviewed records only through the authorized
app Git workflow. Retain the task worktree until its disposition is reviewed.

## Optional: explicitly opt into a draft PR

Choose this path **before preparing** the task, with an authenticated authorized
GitHub CLI/account and a reviewed GitHub `origin`. Add `--open-draft-pr` to both
the preview and apply preparation commands. Do not run the local-only example
first and then change its saved job policy.

A successful authorized run may push only its previously absent task branch and
open a draft PR after controller scope/commit checks. It still requires Agent 0's
project checks and review. Record `done` only after the criteria are accepted,
then preview/apply readiness separately:

```bash
bash .SYSTEMX/SYSTEMX.sh agent-y pr-ready "$y_id"
bash .SYSTEMX/SYSTEMX.sh agent-y pr-ready "$y_id" --apply
```

Keep the prepared remote base unchanged through `pr-ready`. Pushing coordinator
records to `main` or another writer advancing the base will make readiness refuse
the stale handoff. Reconcile that state with Agent 0 before any replacement.
Do not cherry-pick the PR change onto its base before readiness.

Agent Y has **no merge command**. Merge follows a separately authorized GitHub
workflow. Cancellation and cleanup are separate operations:

| Operation | Required state and effect |
| --- | --- |
| `agent-y pr-close Y_ID --reason "Reviewed reason"` | Preview; requires canonical task `cancelled` with a recorded reason. Adding `--apply` closes the owned unmerged PR and preserves its branch/worktree. |
| `agent-y pr-cleanup Y_ID` | Preview; requires verified remote merge and accepted `done`. Adding `--apply` archives the owned branch, verifies the archive/head and then removes its owned branch/worktree under the cleanup gates. |

Inspect actual remote state after push/PR failures: a branch or draft may exist
even if the job records failure. Reconcile it rather than making duplicates.
Local-only jobs do not use these PR cleanup commands.

## A registered child project uses its own scope

For an existing registered `NAME`, keep child tasks, roles, memory and reviews
in `.SYSTEMX/Projects/NAME/.SYSTEMXP`. Do not create another `.SYSTEMX` installation
inside it. Use the actual registered name from `projects list` on every operation:

```bash
bash .SYSTEMX/SYSTEMX.sh projects list
bash .SYSTEMX/SYSTEMX.sh projects roles-init --project NAME
bash .SYSTEMX/SYSTEMX.sh projects roles-init --project NAME --apply
bash .SYSTEMX/SYSTEMX.sh projects agent-y providers --project NAME
bash .SYSTEMX/SYSTEMX.sh projects task-add --project NAME \
  --title "The approved child task" --owner agent.y \
  --scope "src/feature/" --acceptance "The agreed behavior has original check evidence"
bash .SYSTEMX/SYSTEMX.sh projects task-set TASK_RETURNED_ID --project NAME \
  --status in_progress --next "Prepare the reviewed child CLI handoff"
bash .SYSTEMX/SYSTEMX.sh projects agent-y prepare --project NAME \
  --task TASK_RETURNED_ID --provider codex \
  --repo "/absolute/path/to/selected-work-repository" --base main \
  --prompt-file "/absolute/path/to/selected-work-repository/ignored/approved-task.md" \
  --allow-path "src/feature/" --branch "codex/agent-y/TASK_RETURNED_ID-approved-change"
```

The last example contains explicit placeholders: substitute the real child task
ID, repository, private ignored prompt, allowed source path and valid task branch.
Apply only after preview and checkpointing the selected work repository. Later
run/show/review/task commands must retain the same `--project NAME` selection.
Verify the child's `.SYSTEMXP/state/` sidecars and archives are ignored when its
coordination records are Git-backed. The prompt always lives inside `--repo`,
even if child records live elsewhere. Child check commands run from
`.SYSTEMX/Projects/NAME/`, not its `.SYSTEMXP` records directory or an external
work repository. Configure each command's argument array to target the intended
code directory explicitly; source-reference metadata does not redirect it.

With a separately installed current SYSTEMX CLI, the explicit outer-target
equivalent is:

```bash
systemx projects --target "/absolute/path/to/outer-workspace" -- roles-init --project NAME
systemx projects --target "/absolute/path/to/outer-workspace" -- agent-y show Y_RETURNED_ID --project NAME
```

Routing is offline by default and selects verified managed defaults. It neither
downloads a new release nor grants access to referenced repositories or cloud files.

See [Getting started](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GETTING-STARTED.md),
[Command reference](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMMANDS.md),
[Unified Template Guide](Unified-Template-Guide.md) and
[Security Review](Security-Review.md) for the rest of the adopted-app workflow.
