# Operations readiness review index

This index addresses WX-0800 and uses the accepted WX-0751
[health vocabulary](MONITORING.md). Review date: **2026-10-15**; inspected
working source uses integration baseline
`aae465ae033f3191a69ed7d40056b0c6e2159e17`. It indexes existing ownership,
monitoring, recovery, secrets and release-rehearsal records. This review runs
no new service check or production rehearsal.

The reusable template supplies local tools and evidence. **Unadopted production
services are deferred.** A downstream operator must select the real project,
environment and service owners before their readiness can be accepted. An
unassigned responder, rotation owner or rollback owner remains unassigned.

## Readiness records

Dates below identify the original evidence or this source review. A receipt's
starting source base retains its original qualification; a new index review
does not turn it into an observation of a new revision or live environment.

| Area and records | Responsible role | Applicable environment | Evidence date and scope | Current readiness / adoption status |
| --- | --- | --- | --- | --- |
| **Ownership:** [template maintenance](TEMPLATE-MAINTENANCE.md), [managed ownership map](SYSTEMX-INTEGRATION.md), [agent instructions](../AGENTS.md) | WayneTechLab template maintainer; Agent 0 coordinates integration. Adopted service owner: **unassigned**. | Public reusable source and managed defaults; downstream app ownership must be selected separately. | Reviewed 2026-10-15 at the baseline above; documents identify public/default/host record responsibilities. No responder or deployed target is observed. | Source ownership documented. Production ownership and escalation: **deferred until adoption**. The blank reusable records stay blank. |
| **Monitoring:** [health vocabulary](MONITORING.md), [security assumptions](SECURITY-ASSUMPTIONS.md), [session controls](GETTING-STARTED.md#start-the-integrated-local-workspace) | Local session operator owns their verified processes. Adopted monitor/responder and escalation backup: **unassigned**. | Local source/browser/LAN observations; optional emulator/provider and deployed health each have separate scopes. | Monitoring/assumptions reviewed 2026-10-15, original source base `f197affabfe125321c439d8a50854abe684c2355`; [session receipt](SESSION-CONTRACTS-QA-2026-10-15.md) observed 2026-10-15 from starting base `4ca558015a66c4f7b9f50eb085f98ab62c1c8335`. | Local observation contracts exist. Production signals, alert thresholds, response interval and contact routing: **deferred**. Stored startup readiness and a live PID do not establish current authenticated health. |
| **Native workspace recovery:** [state contract](PORTAL-STATE-CONTRACT.md), [recovery glossary](WORKSPACE-RECOVERY-GLOSSARY.md), [portal guide](TEMPLATE-PORTALS.md) | Person operating an isolated fictional browser workspace. Adopted data recovery owner: **unassigned**. | Readable native HR/CMS/CRM browser records at one scheme/host/port and profile. | The [session/state receipt](SESSION-CONTRACTS-QA-2026-10-15.md), observed 2026-10-15 from starting base `4ca558015a66c4f7b9f50eb085f98ab62c1c8335`, records local Chromium state/recovery checks. | Local fictional recovery behavior documented and historically exercised. Production backup storage, retention, recovery objectives and restore exercise: **deferred**. Browser restore points are not a production backup service. |
| **Installation and local recovery:** [runbook](RUNBOOK.md), [provenance](SYSTEMX-PROVENANCE.md), [upstream review](SYSTEMX-UPSTREAM-REVIEW.md), [adoption recovery](BACKLOG-ADOPTION.md#apply-the-reviewed-intake) | Template maintainer for source; selected downstream operator for their installation and records. Production mitigation owner: **unassigned**. | Reviewed local checkout, selected managed defaults and explicitly selected adopted scope. | [SYSTEMX adoption receipt](SYSTEMX-ADOPTION-QA-2026-10-15.md), observed 2026-10-15, starting base `f8494b750447af7d4e39695f4a6fceeff29f48bb`, records temporary fixtures and unchanged source seeds/releases. | Local preservation/refusal/recovery references exist. Actual downstream installation acceptance and production mitigation rehearsal: **deferred**. An inventory match is not a live restore. |
| **Secrets:** [secret handling](SECRETS.md), [configuration proposal](ENVIRONMENT-CONFIGURATION.md), [security assumptions](SECURITY-ASSUMPTIONS.md) | Template maintainer owns placeholder/example hygiene. Adopted secret custodian and rotation/incident owner: **unassigned**. | Public examples and separately managed local/server/provider secrets. | Handling guidance reviewed 2026-10-15. [Operational receipt](OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md), observed 2026-10-15 from starting base `f197affabfe125321c439d8a50854abe684c2355`, covers example-contract and local release checks. | Public handling rules documented. Production secret store, access inventory, rotation schedule and rotation rehearsal: **deferred**. No secret availability, validity or rotation was checked by this index. |
| **Local release rehearsal:** [maintenance gates](TEMPLATE-MAINTENANCE.md#review-and-validate-the-source), [command effects](COMMAND-SAFETY.md), [QA map](QA-COVERAGE-MAP.md), [latest integrated local receipt](SYSTEMX-ADOPTION-QA-2026-10-15.md#integrated-publication-gates) | Template maintainer and Agent 0; the operator accepts the actual release scope. | Local source, temporary fixtures, owned browser processes and production build artifacts. | Latest linked receipt observed 2026-10-15 from starting base `f8494b750447af7d4e39695f4a6fceeff29f48bb`: 46 CI stages and Hosting preflight, with push/deployment explicitly skipped by preflight. | Historical local release preparation passed for that receipt's examined implementation. A changed release needs its own gates. This evidence supplies no deployed-health or provider pass. |
| **Production rollout and rollback:** [runbook](RUNBOOK.md), [optional canary outline](../.SYSTEMX/deploy/canary-plan.md), [selected operations standard](../.SYSTEMX/.systemx/releases/1.9.0-alpha.6/docs/OPERATIONS.md#release-preparation) | Adopted release operator, primary responder and rollback/mitigation owner: **unassigned**. | Explicitly selected downstream preview/production target and accepted data/services. | Guidance reviewed 2026-10-15. No production rollout, rollback or target-specific health observation is supplied by this review or its local preflight references. | **Deferred: production service unadopted.** Assign owners, last accepted release, rollback conditions/steps and post-rollback validation before launch. Production deployment requires explicit operator authorization. |
| **Optional provider readiness:** [Gusto setup](GUSTO-SETUP.md), [Firebase/provider boundaries](GUSTO-FIREBASE.md), [membership proposal](TENANT-MEMBERSHIP-PROPOSAL.md) | Adopted integration owner and authorized provider-account operator: **unassigned**. | Separately selected provider Demo or production tenant/company and exact operation. | Source reviewed 2026-10-15. Existing backend reports `providerConnected: false` and `payrollExecutionEnabled: false`; no new provider observation is made here. | **Deferred: provider connection unadopted.** Review membership, mappings, scopes, token transport, reconciliation, provider evidence and operation authority separately. |

## Complete an adopted service review

The adopted runbook should resolve the following fields for each enabled
service. Keep real contacts, private evidence, secrets and machine-specific
paths in the downstream app's protected records.

| Required adopted fact | Evidence needed before accepting readiness |
| --- | --- |
| Service and environment | Exact project/account/tenant, region or target where applicable, deployed release identifier and service URL. |
| Ownership and response | Named accountable owner, primary responder, escalation backup, coverage/response interval and an accepted contact route. A registry role is not proof of a running responder. |
| Monitoring | Service-appropriate availability/workflow/error/cost signals, thresholds, observation times and alert delivery/response evidence. |
| Data recovery | Protected backup location and retention, required recovery objectives, a selected restore exercise, integrity checks and responsible owner. |
| Secrets | Approved store, scoped access owner, revocation/rotation procedure and dated rotation evidence without secret values. |
| Release and rollback | Accepted source/artifact and target; authorized rollout plan; last known good release; rollback trigger, owner, procedure and target-specific post-recovery checks. |
| Provider operations, if enabled | Actual connection and scope acceptance, current tenant/resource bindings, tested operation and partial-operation recovery; selected operator authority. |

Use `documented`, `observed locally`, `accepted in the selected environment`,
`deferred`, `unobserved`, or `not applicable with reason` to describe the actual
scope. Deferred required work remains unresolved; it is not a pass. Retain the
original observation timestamp, examined revision, command/action, environment,
owner, outcome, evidence location and recheck trigger.

Local `ci:all`, Hosting preflight, configuration badges, source publication and
an optional canary outline cannot populate production/provider acceptance.
After a separately authorized deployment or recovery action, observe the actual
release and authenticated workflow, then record that new evidence in the
adopted service's runbook under the [health contract](MONITORING.md).
