# Optional adoption contracts

Status: **artifact designs reviewed; runtime unadopted**. The fourteen guides below
cover seventeen original design criteria. Agent 0 reviewed their proposed policies
after independent source/artifact review, including five bounded v2 amendments.
Publication gates, final CRM source consistency and canonical completion receipts
remain separate. This index records no installed service, selected external
operator, provider operation or runtime acceptance.

## Reviewed artifact designs

| Guide | Original design scope | Runtime boundary |
| --- | --- | --- |
| [Identity adoption contracts](IDENTITY-ADOPTION-CONTRACTS.md) | WX-0511 membership provisioning; WX-0527 custom-token issuer; WX-0534 portal permission bundles; WX-0637 recent-authentication step-up matrix | Principals, approvers, project, signer and verifier remain unselected; no services are installed. |
| [Report-only CSP proposal](CSP-REPORT-ONLY-ADOPTION-PROPOSAL.md) | WX-0612 finite native/SDK/conditional-origin policy | No header or report collector activated. |
| [Webhook retention proposal](WEBHOOK-RETENTION-ADOPTION-PROPOSAL.md) | WX-0617 bounded stored payload and redaction design | No collection, deletion worker, subscription or TTL setup. |
| [Download authorization contract](DOWNLOAD-AUTHORIZATION-ADOPTION-CONTRACT.md) | WX-0627 tenant/resource/expiry and one-use atomic authorization/stream fence | No ticket issuer, attachment service or download enforcement installed. |
| [OAuth state-binding test contract](OAUTH-STATE-BINDING-ADOPTION-TEST-CONTRACT.md) | WX-0953 organization/user/session/expiry and one-use callback paper tests | All bindings unselected; initiation and callback exchange disabled. |
| [Owner recovery runbook](OWNER-RECOVERY-RUNBOOK.md) | WX-0517 prerequisites, evidence and independent approval | No real identity restored or elevated. |
| [Error telemetry adapter contract](ERROR-TELEMETRY-ADAPTER-CONTRACT.md) | WX-0760 redacted DTOs, finite volume and exact asynchronous terminal/transport lifecycle | Default disabled; no collector, endpoint or transport configured. |
| [Windows x64/ARM64 runner matrix](WINDOWS-X64-ARM64-RUNNER-MATRIX.md) | WX-0820 native host/import/test/build coverage with explicit prerequisites and gaps | Both architecture coverage columns remain unavailable; no runner executed. |
| [Incident evidence capture](INCIDENT-EVIDENCE-CAPTURE.md) | WX-0635 revision/time/synthetic scope/redacted evidence before approved changes | No incident collection or production mutation. |

## Reviewed delivery designs and checklists

| Guide | Original design scope | Runtime boundary |
| --- | --- | --- |
| [Private preview publication checklist](PRIVATE-PREVIEW-PUBLICATION-CHECKLIST.md) | WX-0628 fictional data, no secrets, indexing choice and visitor access controls before beyond-loopback exposure | No preview target, access mechanism, operator or exposure selected. |
| [GitHub Actions adoption design](GITHUB-ACTIONS-ADOPTION-DESIGN.md) | WX-0802 existing required PR gates, explicit permissions and no production deployment credentials; v2 includes edited/base-retarget events and fresh merge binding | No workflow, action pins, runner/account settings or PR execution adopted. |
| [Deployment identity separation](DEPLOYMENT-IDENTITY-SEPARATION.md) | WX-0814 separate preview/production subjects, minimal reviewed capabilities and no workflow-source secrets | No actual identities, grants, credentials or target resources selected. |
| [Firebase rules dry-run checklist](FIREBASE-RULES-DRY-RUN-CHECKLIST.md) | WX-0830 distinct emulator policy evidence, target-project review and deployment approval | No emulator receipt, selected project, policy deployment or readback recorded. |
| [Release readiness decision worksheet](RELEASE-READINESS-DECISION-WORKSHEET.md) | WX-0850 separate local gates, optional provider evidence, blockers and operator deployment approval; original WX-0835 dependency retained | No actual candidate packet, publication receipt, deployment approval or deployment selected. |

## Read the design evidence correctly

The [source/artifact review record](evidence/adoption-contract-source-review.json)
retains original draft and public artifact fingerprints. The
[79-case identity paper matrix](evidence/identity-adoption-matrix.json) is copied
byte for byte, including its historical draft/TODO metadata and unselected real
operator fields. Its literal allow/deny outcomes are paper examples, not results
of an executable authorization service.

Original source observations retain supplied implementation basis
`42818dd7baf3d335f27c401c37d048bd842617fa` and their original catalog hash. They
are separate from later payroll/setup CI and the current CRM implementation.
The delivery guides preserve the historical primary `package.json` fingerprint
`9dfe138a4cc64035e703cd7219d67a9bd95a346fc7c0e5cd4f21295bef61475d`.
The integration tree separately appends tests to `portals:test` and
`browser:smoke:test`; its different package fingerprint and exact append list
are recorded in the source-review record. The unchanged 134 script names and
68-stage source table are not execution evidence or approval of changed stage
contents. A new source review will be bound explicitly after CRM freezes; no
historical observation is silently refreshed. Read the canonical
[catalog](backlog/webappx-1000-todo.json) for actual statuses and dependencies.

Agent 0's artifact design review accepts the proposed scope for reviewable
public guidance only. An adopter must still select actual people, services,
policy revisions, custody, deployment identities and operation authority where
required. Account-free native mocks and the optional provider/backend examples
retain their own boundaries. These documents perform no external setup.
