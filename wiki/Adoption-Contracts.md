# Optional Adoption Contracts

Fourteen public guides cover the seventeen original artifact criteria listed
below. Their proposed policies have been reviewed as source and document
designs. Runtime services, external operators, provider bindings, deployment
identities and target resources remain unselected unless a later explicit
adoption receipt records them. Reading or copying a guide performs no setup.

The [source index](https://github.com/WayneTechLab/WebAppX/blob/main/docs/ADOPTION-CONTRACTS.md)
records the artifact review boundary and fingerprints. The
[canonical catalog](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/webappx-1000-todo.json)
records actual completion states, gates and original dependencies. This page
does not accept criteria or turn a design into installed enforcement.

## Identity and owner decisions

| Public guide | Exact original artifact criteria | Adoption still required |
| --- | --- | --- |
| [Identity adoption contracts](https://github.com/WayneTechLab/WebAppX/blob/main/docs/IDENTITY-ADOPTION-CONTRACTS.md) | **WX-0511** trusted membership provisioning boundaries; **WX-0527** custom-token issuer contract; **WX-0534** portal-specific permission bundles; **WX-0637** session step-up requirements | Select trusted backend writers, independent approvers, issuer/audience/scope/lifetime and recent-authentication enforcement. Browser role fields and paid account level do not establish these capabilities. Principals, project, signer and verifier remain unselected. |
| [Owner recovery runbook](https://github.com/WayneTechLab/WebAppX/blob/main/docs/OWNER-RECOVERY-RUNBOOK.md) | **WX-0517** optional owner recovery procedures | Record prerequisites and evidence, then obtain independent approval before any real identity is restored or elevated. No recovery or elevation was executed by this artifact. |

WX-0534 retains its original dependencies on **WX-0501** and **WX-0503**. The
permission design does not replace those dependencies with a subscription tier.

## Security and provider boundaries

| Public guide | Exact original artifact criterion | Adoption still required |
| --- | --- | --- |
| [Report-only CSP proposal](https://github.com/WayneTechLab/WebAppX/blob/main/docs/CSP-REPORT-ONLY-ADOPTION-PROPOSAL.md) | **WX-0612** optional content security policy adoption | Review finite Firebase, SDK, image, font and conditional origins, then select any Hosting change and report collector. No header or collector is activated. |
| [Webhook retention proposal](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBHOOK-RETENTION-ADOPTION-PROPOSAL.md) | **WX-0617** optional webhook retention controls | Select collection, redacted fields, bounded duration and deletion/TTL operation before storing provider payloads. No collection or deletion worker is installed. |
| [Download authorization contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DOWNLOAD-AUTHORIZATION-ADOPTION-CONTRACT.md) | **WX-0627** optional download authorization contracts | Bind tenant/resource/version/expiry and one-use authority to an atomic current-authorization and stream boundary. A displayed URL or demo role grants nothing. No issuer or attachment service is installed. |
| [Private preview publication checklist](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PRIVATE-PREVIEW-PUBLICATION-CHECKLIST.md) | **WX-0628** private preview publication checklist | Review fictional data, secrets, indexing and visitor access before exposure beyond loopback. No target, access mechanism or exposure is selected. |
| [Incident evidence capture](https://github.com/WayneTechLab/WebAppX/blob/main/docs/INCIDENT-EVIDENCE-CAPTURE.md) | **WX-0635** optional incident evidence capture guidance | Preserve revision, time, affected synthetic scope and redacted evidence before any separately approved production change. This guide performs no collection or mutation. |
| [OAuth state-binding test contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/OAUTH-STATE-BINDING-ADOPTION-TEST-CONTRACT.md) | **WX-0953** optional OAuth state-binding design | Bind organization, initiating user/session, expiry and one-use callback without a client secret in browser code. Real bindings remain unselected; initiation and exchange stay disabled. |

## Operations and delivery decisions

| Public guide | Exact original artifact criterion | Adoption still required |
| --- | --- | --- |
| [Error telemetry adapter contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/ERROR-TELEMETRY-ADAPTER-CONTRACT.md) | **WX-0760** optional application error telemetry adapter | Select approved redacted fields, finite event volume and asynchronous failure/cleanup behavior before configuring transport. Default is disabled; no collector, endpoint or transport is configured. |
| [GitHub Actions adoption design](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GITHUB-ACTIONS-ADOPTION-DESIGN.md) | **WX-0802** optional GitHub Actions adoption workflow design | Adopt reviewed PR gates, explicit permissions, immutable pins and fresh merge binding after edits or base retargeting, without production deployment credentials. No workflow or Actions run is installed or executed by this design. |
| [Deployment identity separation](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DEPLOYMENT-IDENTITY-SEPARATION.md) | **WX-0814** optional deployment identity separation | Select distinct preview/production subjects and minimal reviewed grants, with no secrets in workflow source. No IAM grants, credentials or target identities are selected. |
| [Windows x64/ARM64 runner matrix](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WINDOWS-X64-ARM64-RUNNER-MATRIX.md) | **WX-0820** Windows x64 and ARM64 CI acceptance matrix | Run the specified host/import/test/build checks on each actual architecture after satisfying prerequisites. Both native runner coverage columns remain unavailable; no Windows execution is claimed. |
| [Firebase rules dry-run checklist](https://github.com/WayneTechLab/WebAppX/blob/main/docs/FIREBASE-RULES-DRY-RUN-CHECKLIST.md) | **WX-0830** Firebase rules dry-run evidence checklist | Record emulator policy evidence, selected-project review and deployment approval separately. No emulator receipt, policy deployment or deployed-rule readback is provided. |
| [Release readiness decision worksheet](https://github.com/WayneTechLab/WebAppX/blob/main/docs/RELEASE-READINESS-DECISION-WORKSHEET.md) | **WX-0850** release readiness decision worksheet | Assemble actual local gates, optional provider evidence, blockers and operator deployment approval as distinct decisions. No actual release candidate packet or deployment approval is selected. |

WX-0850 retains its original **WX-0835** dependency. Of these seventeen original
criteria, sixteen retain their operator gate; WX-0953 retains its provider gate.
A reviewed artifact can satisfy its stated design scope only through the
canonical acceptance process. It does not establish a live provider operation.

## Use the evidence at its recorded scope

The [identity paper matrix](https://github.com/WayneTechLab/WebAppX/blob/main/docs/evidence/identity-adoption-matrix.json)
contains 79 literal allow/deny examples. It is a preserved paper matrix, not an
executed authorization service. Its historical draft/TODO metadata and
unselected real-operator fields stay intact. No actual token issuer, OAuth
exchange, trusted membership backend or recent-authentication enforcement is
created by those examples.

The [source/artifact review record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/evidence/adoption-contract-source-review.json)
retains the original supplied source basis and later explicit review entries.
Historical dates, commits, catalog snapshots and package observations describe
their own checkpoints. They do not become current browser or CI receipts merely
because these guides are linked. The dated
[CRM adoption QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/CRM-ADOPTION-QA-2026-10-15.md)
records the separate focused runtime-2 browser pass of 35 groups. That local
native observation does not execute these fourteen optional adoption designs.
Current source consistency, integrated CI, Hosting preflight, independent browser
review and any later acceptance remain separate pending decisions.

Local native mocks remain account-free and use fictional records. Optional
provider and backend examples retain their fail-closed boundaries. A local test
result cannot establish production deployment, live provider behavior, actual
incident response, a Windows runner result or manual screen-reader acceptance.
Select real services and people only under the guide's explicit operator review.

- [CRM Duplicates and Merges](CRM-Duplicates-and-Merges.md)
- [Template Portals](Template-Portals.md)
