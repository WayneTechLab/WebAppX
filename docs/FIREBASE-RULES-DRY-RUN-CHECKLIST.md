# Firebase rules dry-run evidence checklist

Status: **artifact design reviewed; runtime unadopted**. Prepared 2026-10-15. Agent 0 reviewed the proposed policy choices after independent source/artifact review. Actual identities, resource selections, approvals and runtime observations remain unselected. This is an optional adoption artifact, not an executed procedure or authorization.

Historical drafting basis: `42818dd7baf3d335f27c401c37d048bd842617fa`, supplied by Agent 0. The original preparation read then-current primary files without resolving Git revisions or running gates. The source tables retain those historical bytes; they do not bind the later CRM integration tree. Original draft/TODO wording describes preparation history; consult the [canonical catalog](backlog/webappx-1000-todo.json) for actual status. Final source re-review after CRM freezes is pending. See the [adoption index](ADOPTION-CONTRACTS.md) and [source-review record](evidence/adoption-contract-source-review.json).

## Original criterion

- ID: `WX-0830`; title: **Add Firebase rules dry-run evidence checklist**.
- Priority `P1`; phase `production-readiness`; gate `operator`.
- Dependencies: none.
- Canonical source: `firestore.rules`.
- Original acceptance, unchanged: “For optional operator-approved adoption: Document emulator policy evidence, target project review and deployment approval separately so local passing tests do not imply deployed rule acceptance.”


## Three independent decisions

| Decision | What it establishes | What it cannot establish |
| --- | --- | --- |
| Local emulator policy evidence | Exact reviewed policy/test bytes produced the recorded synthetic permit/deny outcomes in an owned loopback emulator session. | Selected cloud project, deployed policy, cloud identity grants, real employee authorization or provider acceptance. |
| Target project review | An authorized reviewer identifies the intended project/database/resource, current deployed policy and exact proposed rules change, including merged grants. | Permission to deploy or proof that a later deploy succeeded. |
| Deployment approval and later observation | An operator approves a specific policy digest/action/target; a separate actual receipt and readback can establish the observed deployed version. | A generic future authorization, unrelated rule/function targets or approval for live business actions. |

All three actual decisions are unobserved/not authorized in this draft. A local green result must never be copied into a deployed-acceptance field.

## Current source scope

Root `firebase.json` points to `firestore.rules` and `firestore.indexes.json`, with `storage.rules` separately configured. `.firebaserc` remains `your-firebase-project-id`, not a chosen target. The root Firestore policy is a generic account-level example with own/admin profile rules, protected authority fields, owner registry rules and client-denied security collections. It is not the optional HR tenant ruleset.

`tests/security/firestore-rules.test.mjs` uses Firebase **client** SDK requests, explicit `127.0.0.1:` Auth/Firestore emulator endpoints and literal project `demo-systemx`. Its synthetic fixtures use emulator-only admin setup to seed claims/data; the assertions then use client access. The existing alias is `npm run security:rules:test`. **That alias is not part of the current 68-stage `ci:all` list.** A full-CI receipt therefore cannot stand in for an actual root emulator run.

The optional HR module has a separate isolated `test:rules` procedure described by `docs/GUSTO-FIREBASE.md`, with a demo project, owned free loopback ports and Firebase CLI/Java prerequisites. Its organization/membership/time-off evidence is a separate scope. Do not replace the app's rules with that reference file; review the complete merged policy. As the guide explains, overlapping allows can broaden access and Admin SDK access bypasses client rules, so backend authorization needs independent evidence.

## Actual evidence packet — not selected

Proposed bounds: one exact candidate policy per packet, at most 30 policy cases, 20 evidence references and 10 unresolved findings. Record every case outcome; an omitted/overflowed case prevents a complete policy claim. Keep raw local logs in restricted evidence storage and publish only redacted summaries/digests. No tokens, emulator export bodies, live user data or absolute host paths belong in the portable packet. A material policy, test, runtime or target change invalidates the affected review.

### A. Local emulator evidence worksheet

| Field/check | Required entry | Current result |
| --- | --- | --- |
| Source identity | Exact source SHA, full policy/config/test/dependency digests; preserve original bytes and timestamps. | unobserved |
| Runtime | OS/architecture, Node/npm, Firebase CLI and Java versions; relevant lockfiles. | unobserved |
| Owned loopback endpoints | Actual available Auth/Firestore ports; PID/command/CWD ownership proof and explicit synthetic demo project; no remote endpoint. | unselected |
| Fixture scope | Literal fictional identities, claims, memberships and document IDs; setup authority distinct from tested client requests. | unselected |
| Test invocation | Exact current alias and explicit loopback environment names; no values/tokens beyond safe endpoint identifiers in public report. | unexecuted |
| Outcomes | Literal expected permit/deny and actual result for each case, terminal exit, complete log digest and test totals. | unobserved |
| Cleanup | Client disposal plus only owned emulator shutdown; preserve failing logs; do not stop unrelated processes or import private datasets. | unobserved |
| Limitations | Untested paths/actions/merged grants, SDK/runtime differences and live deployment boundary. | source scope only |

Before a future authorized emulator run, check listener ownership and choose free ports. Do not install/start emulators or contact a real project merely to fill this draft. If a prerequisite is unavailable, record unavailable and stop that execution branch.

### B. Literal source-defined root cases

The following expectations are authored in the existing test source; they were **not executed by this drafting task**. Dynamic generated IDs must be captured safely in an actual receipt rather than invented here.

| Case | Fixture/action | Source-defined expectation |
| --- | --- | --- |
| `root-member-profile` | Level-1 client creates/changes own `displayName`; reads synthetic `members/fixture`. | permit; returned literal displayName/label match assertions |
| `root-member-authority` | Same client changes any of `level`, `role`, `admin`, `subscriptionTier`, `tier`, `mfaRequired`, `securityProfile`, `claims`. | deny each of eight independent field attempts with `permission-denied` |
| `root-member-registry` | Member writes own `adminUsers` entry or replaces profile with `level: 5`. | deny both |
| `root-member-delete` | Member deletes its own profile after refused authority edits. | deny; this case is not proof that a protected field was ever written |
| `root-staff-ordinary` | Level-4 client edits ordinary displayName, edits/deletes an ordinary member profile. | permit |
| `root-staff-authority` | Level-4 client changes protected authority, deletes protected profile or creates owner registry grant. | deny |
| `root-owner-registry` | Level-5 client creates, reads, inactivates and deletes its registry fixture. | permit with literal level assertion |

These source cases do not exhaust root policy paths, Storage rules, unauthenticated access or the HR module. For an adopted ruleset, add/review explicit client cases for anonymous denial, wrong user, inactive/cross-organization membership, each protected collection/action and any merged/public grant that matters to that app. Mark new cases **planned/unobserved** until run; do not relabel this source table as their evidence.

### C. Target project review worksheet

| Required target binding | Current value |
| --- | --- |
| Adopting organization / authorized project reviewer | unselected / unassigned |
| Exact Firebase project / database / Storage bucket if relevant | unselected |
| Current deployed policy version/digest and authorized observation reference | unobserved |
| Candidate complete merged rule/index files and digests | unobserved |
| Path/action/role change table; broader allows and backend bypass review | unobserved |
| Environment (preview/production) and selected rules-only operation | unselected |
| Reviewed target equality across config, command and approval | unobserved |
| Unresolved blockers / conclusion | target unselected; review incomplete |

Never treat the placeholder default as a real target. No root generic role or demo claim grants access to a real organization. An inherited broader rule or unknown deployed version blocks a deploy-readiness conclusion until reviewed.

### D. Operator deployment approval and observation

The approver must be independent of the rule author and bind the exact target, candidate rule/index digests, selected operation, related local evidence, unresolved risks, authorization time and expiry (proposed maximum 24 hours). The approved action must not include unrelated Hosting/Functions/IAM changes. Actual approving operator is **unassigned**; approval is **not authorized**.

After a separately authorized deployment, capture actual command/result, deployed version and independent readback/smoke evidence with literal observation time. If result is uncertain or deployed bytes differ, preserve the receipt, stop further changes and inspect actual state; do not retry automatically or claim success from the preceding emulator pass. This draft performs neither deployment nor cloud readback.

## Literal fictional worked and denied packets — not observations

**Worked packet `rules-fiction-01`:** candidate `policy-example-A` is proposed for fictional `project-example-A` / database `(default)`. It lists the seven grouped source case families above and additional app-specific cases, all with expected outcomes. If a future owned run supplies actual results, that completes only section A/B for its exact scope. A separate reviewer must still examine actual deployed policy and target in C, and an actual operator must approve D. The example deliberately leaves those real-world decisions unfilled.

**Denied packets:** a full-CI success is submitted as root emulator proof: refuse because the alias is outside the 68 stages. An admin seed write succeeds and is offered as client authorization proof: refuse. The HR reference suite passes but the complete merged app policy is not reviewed: refuse target readiness. Candidate policy A is tested but policy B is approved: stale evidence, refuse. The placeholder project is used as a deploy target: refuse. A non-loopback endpoint is offered to the root suite: its existing guard refuses; no live fallback. A deployment times out: status uncertain, no automatic retry and no deployed acceptance.

## Acceptance mapping and root decisions

Sections A/B supply the emulator evidence checklist, C isolates target project review, and D isolates operator approval and post-deploy observation. Proposed packet bounds, independent review and 24-hour approval expiry are resolved design choices. Agent 0 reviewed this artifact design without emulator or cloud actions. Actual runtime results, target selection, merged-rule review, operator approval and deployed rule evidence remain absent. No rule bytes, project configuration or provider setting changed.

## Historical examined source and provenance

Repository-relative paths and SHA-256 of examined bytes:

| Public source | SHA-256 |
| --- | --- |
| `firestore.rules` | `da607c38e2acb644763722887c6286e1c33ba3c98edf845d36c23a8e2825d482` |
| `firebase.json` | `f5cbf9d99d5cc271b000d493982ae9f1481aa1ed4c92d4f35dc4ecbe8b9c48eb` |
| `.firebaserc` | `7bcf963e0b6bc46870d5719968cfcf78503947004aac8a731e729abc859dd705` |
| `tests/security/firestore-rules.test.mjs` | `58d43f49a74175c0ce3c2203fbc630fb2b19cf6fd28a6c6fbc9de21b5ebf3bd5` |
| `package.json` | `9dfe138a4cc64035e703cd7219d67a9bd95a346fc7c0e5cd4f21295bef61475d` |
| `scripts/check-template.sh` | `059480f0a672973732e21d53b44176692ce94054213a7062df07c3136c8e8e9c` |
| `docs/GUSTO-FIREBASE.md` | `802c817e29204088e1a0852e98f8ce0dc126edc36c003b6a6afd4a0672466d75` |

These are historical supplied-basis source observations only. They do not establish current deployed settings, cloud access, a successful CI run, account availability or operator acceptance. Re-review a changed source or target before adoption.
