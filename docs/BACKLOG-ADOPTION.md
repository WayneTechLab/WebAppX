# Reviewed backlog adoption

The [catalog](backlog/webappx-1000-todo.json) contains WebAppX proposals and
source acceptance. An adopted app keeps its own SYSTEMX task ledger. Use
[the host adoption tool](../scripts/backlog-adoption.py) to preview a small,
explicit selection and then create reviewed TODO intake in that app.

The tool runs locally with Python's standard library and the unchanged selected
SYSTEMX record APIs. It supports the outer root scope or one exact registered
child name. Preview prints JSON to stdout and creates no files, locks, tasks or
workers. Apply records tasks and refreshes their generated views. Runtime plans,
machine paths and observations belong in local files outside the public template.

## Select the adopted app and proposals

Start with an existing adopted app whose `.SYSTEMX/project.json` has its own
configured name. For a child, register it through the selected SYSTEMX project
workflow and select its exact name from `Projects/REGISTRY.json`. The explicit
`--app` identity must match the selected scope's configuration. The tool refuses
the WebAppX identity, the reusable source checkout, aliases, linked records and
targets inside managed `.SYSTEMX` or `.SYSTEMXP` paths.

Create a local selection using the
[selection schema](backlog/webappx-adoption-selection.schema.json):

```json
{
  "schemaVersion": 1,
  "tasks": [
    {
      "proposalId": "WX-0851",
      "owner": "agent.0",
      "scope": ["scripts/", "tests/"],
      "nextAction": "Review adoption requirements in this app"
    },
    {
      "proposalId": "WX-0855",
      "owner": "agent.0",
      "scope": ["docs/", "tests/"],
      "nextAction": "Review this app's action gate requirements"
    }
  ],
  "dependencies": [],
  "gates": []
}
```

Select 1–40 distinct proposals. Every owner must already exist in the selected
scope's agent registry. Task IDs are allocated after the largest existing TASK
number, following selection order. No role is registered automatically.

Every source WX dependency must resolve to another selected proposal or an
explicitly reviewed existing task. This remains true when the source dependency
is marked `done`. For example, an existing equivalent target task can be bound
with this entry in `dependencies`:

```json
{
  "proposalId": "WX-0001",
  "taskId": "TASK-007",
  "reviewedBy": "user",
  "reference": "Reviewed equivalent target prerequisite and its original evidence"
}
```

The tool validates that the existing task is present and the mapping is used.
Agent 0 or the owner reviews whether the existing task establishes the required
behavior in the adopted app. A target TODO prerequisite stays unfinished even
if the corresponding WebAppX proposal was accepted.

## Preview and review

Supply an explicit locally available catalog revision. Git resolves it to a
full commit, and the tool compares the committed catalog bytes with the current
source catalog. A missing commit or a mismatch refuses the operation. It does
not fetch. `catalog.sourceCommit` remains catalog origin metadata; it is not
substituted for the resolved revision that contains the reviewed catalog.

```bash
python3 -B scripts/backlog-adoption.py preview \
  --target /path/to/adopted-app --app 'Example App' --root \
  --catalog-revision REPLACE_WITH_REVIEWED_LOCAL_COMMIT \
  --selection /local/adoption-selection.json > /local/adoption-plan.json
```

For a registered child, replace `--root` with `--project 'Child App'` and use
`--app 'Child App'`. `--target` remains the containing adopted app directory.
These paths are examples; choose real local paths for your environment.

The [plan schema](backlog/webappx-adoption-plan.schema.json) records:

- The resolved catalog commit and exact catalog byte digest.
- The explicitly selected app, root or child scope, and record fingerprint.
- Each WX-to-TASK mapping, registered owner and complete target dependencies.
- Exact candidate TASK records, each `todo` with empty evidence and reviewer.
- Independent gate assessments and recorded target dependency states.
- An explicit boundary stating that intake does not authorize execution.

The fingerprint covers selected context, plan, tasks, focus, memory, agents,
optional role records, configured commands and generated views, plus the outer
project registry and identity. Local process state and lock files are excluded.
The plan digest covers the complete review plan. It detects changes; it is not
a signature or a permission grant.

Source completion evidence is never copied into the adopted tasks. Provenance
is a normal first history note containing the WX ID, catalog revision and
digest. Stored TASK objects keep the selected SYSTEMX format's exact fields.

## Review action gates

The coarse catalog labels `local`, `provider` and `operator` do not establish
credential requirements or access. Review the intended action and target, then
describe requirements and observations independently with the
[gate schema](backlog/webappx-adoption-gates.schema.json). Omitting a gate, or
leaving a requirement unreviewed, produces `unknown` for that dimension.

Each gate names one selected proposal, its criterion digest, an action and a
target. Its `requirements` contain these independent dimensions:

| Dimension | Reviewed requirement | Reported observation |
| --- | --- | --- |
| `credentials` | List of credential/account labels, or an empty list when unnecessary | Per-label `available`, `unavailable` or `unknown` and a reference |
| `operatorAuthorization` | Boolean indicating whether authorization is required for this action | `authorized`, `denied` or `unknown`, with matching action, target, authority and reference |
| `localPrerequisites` | List of local prerequisite labels, or an empty list when unnecessary | Per-label `met`, `unmet` or `unknown` and a reference |

Requirements use `{ "reviewed": true, "required": ... }`. Use `reviewed: false`
for unreviewed requirements. Observations cannot turn that into a reviewed
requirement. A reviewed empty list or `required: false` yields `not_required`.
Absent observations yield `unknown`; unavailable credentials, unmet local
prerequisites and denied matching authorization yield `blocked`. An authorization
for a different action or target remains `unknown`.

Credential observations contain labels and reported availability. The tool
does not read environment variables or secret files, inspect credentials, or
contact providers. Fields such as `value`, `token` and `secret` are outside the
contract and are rejected. Keep references free of secrets as well.

Compute `criterionSha256` from the exact catalog acceptance string with the
tool's canonical JSON encoding. This local command prints the digest for one
selected proposal without editing anything:

```bash
python3 -B -c 'import hashlib,json; c=json.load(open("docs/backlog/webappx-1000-todo.json")); s=next(i["acceptance"] for i in c["items"] if i["id"]=="WX-0851"); print(hashlib.sha256(json.dumps(s,ensure_ascii=False,separators=(",",":")).encode()).hexdigest())'
```

A gate entry has this shape; replace the digest and reviewed observations:

```json
{
  "proposalId": "WX-0851",
  "criterionSha256": "REPLACE_WITH_64_CHARACTER_CRITERION_DIGEST",
  "action": "prepare-local-adoption-preview",
  "target": "Example App development records",
  "requirements": {
    "credentials": { "reviewed": true, "required": [] },
    "operatorAuthorization": { "reviewed": true, "required": false },
    "localPrerequisites": { "reviewed": true, "required": ["selected-python"] }
  },
  "observations": {
    "credentials": [],
    "operatorAuthorization": {
      "state": "unknown", "action": "", "target": "", "by": "", "reference": ""
    },
    "localPrerequisites": [
      { "name": "selected-python", "state": "met", "reference": "Reviewed local version receipt" }
    ]
  }
}
```

The preview reports `reported_ready` only when all required dimensions have
matching reported observations and target dependencies are recorded `done`.
It retains each independent dimension and dependency status. Reported readiness
is a planning observation. It does not dispatch work or establish verified
provider access, operational acceptance or execution authority. TODO status is
never a readiness signal.

## Apply the reviewed intake

```bash
python3 -B scripts/backlog-adoption.py apply \
  --target /path/to/adopted-app --app 'Example App' --root \
  --catalog-revision REPLACE_WITH_THE_SAME_REVIEWED_LOCAL_COMMIT \
  --plan /local/adoption-plan.json --authorize-intake
```

`--authorize-intake` expresses the deliberate action to record this reviewed
TODO batch in the selected app. Existing authorized work can proceed under its
session authority. This flag does not grant worker execution or provider access.
Unknown or blocked action gates can coexist with accepted TODO intake.

Apply uses the selected upstream coordination lock, reloads the scope and
records, rebuilds the complete preview, and refuses any changed plan. Child
intake locks both the outer registry scope and child records, in that order.
It validates the entire candidate ledger and renders every derived view before
mutation. Existing tasks remain intact, while context, plan, focus, memory,
roles and commands are preserved. The upstream atomic ledger replacement holds
the complete batch; generated pages follow its normal refresh behavior.

After a concurrent change, create and review a new preview. A repeated apply
refuses the already adopted WX IDs and creates no duplicates. Lock contention
preserves the other writer's lock. The coordination protocol covers cooperating
local tools; direct edits do not acquire it. If an I/O failure interrupts view
refresh after ledger replacement, inspect the ledger and use the selected
SYSTEMX `refresh-work`/`validate` workflow to regenerate views.

## Local verification

```bash
python3 -B -m unittest discover -s tests/systemx -p test_adoption.py -v
```

Fixtures create temporary adopted root and registered child records from the
selected blank seeds. They check exact stored records, preservation, source
completion isolation, complete dependencies, stale/tampered plans, registry and
identity binding, target aliases, linked records, contention and independent
gate errors. Pure fixture APIs explicitly label captured catalog facts
`fixture-captured-facts`; the CLI always resolves and checks committed provenance.
No reusable ledger, immutable release, actual adopted app or provider is changed
by this verification. Supported path contracts are portable; these local checks
do not establish native Windows x64/ARM64 runtime acceptance.
