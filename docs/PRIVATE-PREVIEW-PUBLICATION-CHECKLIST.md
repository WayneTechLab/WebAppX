# Private preview publication checklist

Status: **artifact design reviewed; runtime unadopted**. Prepared 2026-10-15. Agent 0 reviewed the proposed policy choices after independent source/artifact review. Actual identities, resource selections, approvals and runtime observations remain unselected. This is an optional adoption artifact, not an executed procedure or authorization.

Historical drafting basis: `42818dd7baf3d335f27c401c37d048bd842617fa`, supplied by Agent 0. The original preparation read then-current primary files without resolving Git revisions or running gates. The source tables retain those historical bytes; they do not bind the later CRM integration tree. Original draft/TODO wording describes preparation history; consult the [canonical catalog](backlog/webappx-1000-todo.json) for actual status. Final source re-review after CRM freezes is pending. See the [adoption index](ADOPTION-CONTRACTS.md) and [source-review record](evidence/adoption-contract-source-review.json).

## Original criterion

- ID: `WX-0628`; title: **Prepare a private preview publication checklist**.
- Priority `P1`; phase `production-readiness`; gate `operator`.
- Dependencies: none.
- Canonical source: `.SYSTEMX/deploy/canary-plan.md`.
- Original acceptance, unchanged: “For optional operator-approved adoption: An operator adoption checklist verifies fictional data, no secrets, indexing choice and access controls before exposing a preview beyond loopback.”


## Source boundary and proposed choice

The existing canary outline proposes gates, preview deployment, smoke checks and later production promotion. It does not supply an operator identity or access-control implementation. `index.html` declares `index,follow`; `public/robots.txt` allows `/`. `.firebaserc` selects the placeholder `your-firebase-project-id`. The native fictional HR/CMS/CRM identity and role controls demonstrate UI projections; they are not preview visitor authentication.

**Proposed private-preview policy:** deny exposure beyond loopback until a separately selected preview target enforces access control, a reviewer confirms the exact artifact contains only fictional material, and indexing is deliberately restricted. Select `noindex,nofollow` for private previews and an intentionally reviewed robots policy. Neither robots nor noindex authenticates visitors. A private URL or demo role selector cannot satisfy the access-control check. Do not change the reusable public template defaults merely to complete this draft.

## Bounded publication packet

Use one packet per immutable artifact and target, at most 20 evidence references and 10 unresolved findings. A reference includes digest, literal observation time, observer and scope; no credentials, raw cookies, private exports or browser storage bodies. Keep the packet in the adopter's restricted records. Proposed approval expires after 24 hours, after any source/artifact/configuration/target/access-list change, or after a newly discovered blocker, whichever occurs first. Preview exposure expires within seven days; renewal requires a new packet. These limits are proposed product policy, not existing enforcement.

### Actual adoption fields — not selected

| Field | Current entry |
| --- | --- |
| Intended audience and purpose | unselected |
| Exact source SHA / complete artifact digest / build receipt | unobserved |
| Preview project / Hosting site or other resource / channel / hostname | unselected |
| Separate preview publisher / independent reviewer / approving operator | unassigned |
| Access-control mechanism / permitted audience / anonymous-denial proof | unselected / unobserved |
| Indexing decision / actual response headers and HTML / robots result | unselected / unobserved |
| Fictional-data manifest / secret review / retention location | unobserved |
| Publication approval / expiry / revoke owner / rollback route | not authorized / unselected / unassigned / unselected |

### Complete pre-exposure checklist

Record `pass`, `fail`, or `unobserved` and an evidence reference on every row. `not applicable` needs a named reason and reviewer; it cannot substitute for data, secrets, access or indexing evidence.

| Check | Required evidence and refusal condition |
| --- | --- |
| Intent and target | Bind exact artifact digest to one preview resource, intended audience and expiry. Refuse an ambiguous project, inherited production default or target mismatch. |
| Fictional dataset | Enumerate fixture/reset groups actually included using the read-only fixture inventory and review built assets, test content and downloadable examples. Verify all names, emails, files, recruit/payroll figures and records are fictional; synthetic labels alone do not prove this. Exclude real user exports, local storage, private `.SYSTEMX` records and emulator datasets. |
| No secrets | Review source, dependency/build output and selected configuration; record tooling and manual review scope. Exclude `.env.local`, `.secrets.env`, service-account JSON, tokens, private certificates, cookies and webhook secrets. Browser-safe Firebase identifiers are not server secrets, but still require deliberate project selection. A scanner pass alone is insufficient. |
| Indexing | Choose private preview indexing explicitly. Verify actual built HTML and edge response, not merely source intent. Inspect robots separately. Refuse unchanged `index,follow` under this proposed private-preview policy. |
| Visitor access | Select real access control outside the fictional portal roles. Test a fresh unauthenticated client is denied before private content or downloads are served; test one permitted and one revoked fictional identity with no real data. Record assets/API/storage coverage and known gaps. Refuse public fall-through routes or an unprotected asset alternate origin. |
| Browser and network | Confirm preview target, links, API destinations, CSP and allowed origins; no production writes or inherited live credentials. All enabled forms must remain fictional/non-operational unless separately approved. |
| Required local checks | Attach exact-source CI, template integrity, drift and Hosting preflight receipts; failures remain blockers. They do not prove remote access control. |
| Restore and end | Name the preview revoke/expiry action, preservation location and target-specific rollback procedure. Test plans and observation receipts are distinct. Never reuse a production identity or delete unrelated resources. |
| Final independent approval | Reviewer compares exact packet, unresolved findings and selected exposure action. Approving operator names the target, artifact and expiry. A later production action requires its own authorization. |

### Publication, observation and closure

1. Before approval, keep service loopback-only. Produce/review the packet without changing public settings.
2. Following a separate explicit approval, an authorized operator may expose only the selected artifact on the selected preview target. This draft performs no exposure.
3. Capture actual unauthenticated denial, permitted-audience access, indexing and fictional download observations against the published artifact. A mismatch requires stopping exposure through the selected revoke path and preserving evidence; do not overwrite the approved packet.
4. Record closure/expiry and confirm the preview is no longer accessible to the previous audience. Do not describe source or preview success as production acceptance.

## Literal fictional cases — not observations

**Worked design case `preview-fiction-01`:** a packet proposes artifact `fictional-artifact-A`, audience `reviewer-01` and `reviewer-02`, hostname `preview.example.invalid`, seven-day maximum lifetime and private indexing. Its *hypothetical* evidence set contains reviewed fictional fixture manifest `fixture-set-A`, no-secret review `secret-review-A`, anonymous denial `access-deny-A`, permitted access `access-allow-A` and exact-source local receipts `local-A`. If those facts were actually observed and independently approved, only that exposure could be authorized. `.invalid` is a fictional identifier, not a functioning control or resource.

**Denied cases:** `preview-fiction-02` leaves the built HTML `index,follow` despite a private indexing decision: blocked. `preview-fiction-03` includes an employee's real export disguised as a fixture: blocked and preserve/remediate through the adopter's process. `preview-fiction-04` relies solely on the HR role picker or a long URL: blocked. `preview-fiction-05` approves artifact A but proposes to expose B: stale approval, blocked. `preview-fiction-06` passes all source checks but lacks anonymous-denial evidence for downloadable assets: blocked.

## Acceptance mapping and root decisions

| Original requirement | Draft coverage |
| --- | --- |
| Operator adoption checklist | Packet, nine required checks, publication/closure sequence and explicit approval field. |
| Fictional data / no secrets | Separate manifest and secret review checks, failure cases and public-source bindings. |
| Indexing choice / access controls before beyond-loopback exposure | Private default proposal, actual-edge evidence, explicit anonymous denial and expiry. |

Agent 0 reviewed this artifact's design completeness without activating a preview. Proposed policy choices are resolved here: private indexing, seven-day expiry, 24-hour approval age and independent review. Actual project/site/channel/access mechanism/operator, preview acceptance and any execution remain unselected. No deployment, access test or indexing change was performed.

## Historical examined source and provenance

Repository-relative paths and SHA-256 of examined bytes:

| Public source | SHA-256 |
| --- | --- |
| `.SYSTEMX/deploy/canary-plan.md` | `fca6a890f4a066f1f5347568a565aa5a86d6390d45b056f15217b1e2d8db47f8` |
| `index.html` | `15c4b21da48c9f9b040e901867dcb6c075c783dbf6e9313b175e3e1e4bcbd862` |
| `public/robots.txt` | `16ceb5ee3e0dc13aa9adf31a3ebbe45a1d965b8c2b9f72eaf84e5911e140ed95` |
| `.firebaserc` | `7bcf963e0b6bc46870d5719968cfcf78503947004aac8a731e729abc859dd705` |
| `firebase.json` | `f5cbf9d99d5cc271b000d493982ae9f1481aa1ed4c92d4f35dc4ecbe8b9c48eb` |
| `docs/SECRETS.md` | `a3060d87cb9bb85f27d0d55155816ceb582742a47f4a16149104740acd73fc23` |
| `.SYSTEMX/docs/SECRETS.md` | `6d334af5502d65ca74d343d80ef25638b4ceb5c7429a3d3e06878577397973b9` |

These are historical supplied-basis source observations only. They do not establish current deployed settings, cloud access, a successful CI run, account availability or operator acceptance. Re-review a changed source or target before adoption.
