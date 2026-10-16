# Deployment identity separation adoption design

Status: **artifact design reviewed; runtime unadopted**. Prepared 2026-10-15. Agent 0 reviewed the proposed policy choices after independent source/artifact review. Actual identities, resource selections, approvals and runtime observations remain unselected. This is an optional adoption artifact, not an executed procedure or authorization.

Historical drafting basis: `42818dd7baf3d335f27c401c37d048bd842617fa`, supplied by Agent 0. The original preparation read then-current primary files without resolving Git revisions or running gates. The source tables retain those historical bytes; they do not bind the later CRM integration tree. Original draft/TODO wording describes preparation history; consult the [canonical catalog](backlog/webappx-1000-todo.json) for actual status. Final source re-review after CRM freezes is pending. See the [adoption index](ADOPTION-CONTRACTS.md) and [source-review record](evidence/adoption-contract-source-review.json).

## Original criterion

- ID: `WX-0814`; title: **Prepare optional deployment identity separation**.
- Priority `P1`; phase `production-readiness`; gate `operator`.
- Dependencies: none.
- Canonical source: `docs/SECRETS.md`.
- Original acceptance, unchanged: “For optional operator-approved adoption: An adoption design assigns distinct preview and production identities with minimal reviewed permissions and no secrets committed to workflow source.”


## Current boundary

`docs/SECRETS.md` and the inherited secrets standard prohibit committing local env files, service-account JSON, live keys and deploy tokens. The browser example configuration is separate from server secrets; it does not grant deployment authority. The selected `.firebaserc` value is still a placeholder. `.SYSTEMX/scripts/deploy.sh` has different Hosting/rules/Functions modes and a preflight-only mode. Capability and target selection must therefore be explicit rather than inferred from one broad deploy credential.

This design defines semantic capabilities. It deliberately assigns **no current provider IAM role names or real accounts**. At adoption, the provider's current official permission definitions and actual effective grants must be reviewed against these capabilities. A proposed identity is not a provisioned identity or proof of least privilege.

## Proposed identity and capability matrix

| Role identifier (design only) | Allowed purpose | Explicitly denied |
| --- | --- | --- |
| `pr-validator` | Read public source; isolated dependency install and required local gates; write only owned ephemeral logs/artifacts. Proposed repository token scope `contents: read` in the separate workflow design. | Cloud deployment credentials, provider API secrets, production environment access, identity administration, release/tag/source publication. |
| `preview-publisher` | Publish the approved immutable artifact to one reviewed preview resource, inspect that resource and revoke its own preview where the provider supports the reviewed scope. | Production Hosting, production channels, rules/indexes/Functions, IAM/secrets administration, arbitrary project discovery or target override. |
| `production-hosting-publisher` | Deploy only the operator-approved artifact to one selected production Hosting resource after independent review. | Preview identity reuse, rules/indexes/Functions, IAM/secrets administration, application data access unless separately justified. |
| `rules-publisher` (optional separate adoption) | Apply only the reviewed rule/index artifact to explicitly named project/database/storage resources after its own approval. | Hosting promotion, provider/business operations, IAM grant changes, unrelated projects. |
| `identity-administrator` | Separately approved identity provisioning, grant review and emergency revoke procedure. | Automatic participation in PR/build/deploy jobs; approving its own grant elevation. |

**Required separation:** preview and production subjects are distinct immutable identities, use separate credentials or broker bindings, and have no interchangeable environment selection. Naming one key twice or switching a broad account's project flag does not meet this design. Separate preview and production cloud projects are the proposed default; any shared-project resource scope needs provider-specific effective-permission proof and an independently reviewed exception. If the provider cannot enforce the required boundary, adoption remains blocked.

## Credential and invocation contract

- No credential literal or secret material enters workflow source, examples, repo artifacts, PR logs or portable portal backups. Workflow references may name approved secret *handles* only after adoption; handles are not supplied here.
- Prefer short-lived workload credentials with a reviewed subject/audience/environment binding if the adopter can support them. This is a proposal, not configured federation. Any stored secret alternative needs a custody, rotation and revoke owner and a review explaining why it is necessary.
- A token is issued only after the selected protected environment and deployment approval. Bind subject, artifact digest, exact target, action family and expiry; credentials for preview cannot satisfy production requests.
- Set a proposed maximum credential lifetime of 15 minutes and approval lifetime of 24 hours. The provider may have different limits; adopt a supported tighter limit or block until a reviewed alternative exists. Never silently fall back to a long-lived broad key.
- Use structured arguments with the exact target. Refuse missing target, target override, unknown action family, stale artifact, absent approval, expired credential or unresolved effective-permission review.
- Preflight requires no production mutation authority. Do not mint production credentials merely to run validation. Any validation needing remote read access needs its own reviewed read capability.
- No automatic retry after uncertain mutation. Preserve receipt, determine actual target state and request an intentional action under the adopter's process.

## Actual adoption record — intentionally unselected

| Required binding | Current value |
| --- | --- |
| Preview subject / project / resource / credential mechanism | unassigned / unselected / unselected / unselected |
| Production subject / project / resource / credential mechanism | unassigned / unselected / unselected / unselected |
| Optional rules publisher and resource | unassigned / unselected |
| Provider permission definition revision / exact grant allowlist / effective-grant observation | unobserved / unselected / unobserved |
| Credential custody / revoke operator / independent approver | unassigned / unassigned / unassigned |
| Approved workflow and artifact digests / issued-at / expires-at | unobserved |
| Negative boundary probes / rotation or revoke drill | unobserved |
| Provisioning / preview deploy / production deploy approval | not authorized / not authorized / not authorized |

The minimum review packet has at most 10 identities, 20 exact capabilities per identity and 20 evidence references. Expand deliberately with review rather than truncating grants; an incomplete grant inventory cannot establish least privilege. Retain only subject/resource identifiers, permission names, times, digests and redacted result labels. Keep tokens, key JSON and full provider error bodies outside the packet.

## Adoption and independent verification sequence

1. Inventory existing identities and all effective inherited/direct grants using an authorized read procedure. Record unknowns as blockers; do not infer restrictions from display names.
2. Map each semantic capability to the current provider permission/action/resource and review denied capabilities. Verify preview and production identity inequality and target separation.
3. Obtain independent approval for the proposed provisioning/grant change before it is performed. Keep privilege-elevation authority separate from deployment approval.
4. Following authorized provisioning, test permit and deny boundaries on owned nonproduction resources. Include preview subject attempting the production resource, wrong-target refusal, expired credentials and PR job secret absence. This draft contains expected results only.
5. Record actual grants and observations, compare to the approved design, then enable the reviewed workflow. A grant change, identity replacement, target change or workflow credential change invalidates the affected approval.
6. Review at least every 90 days (proposed), on incident and before the first production deployment. Revoke unused bindings through a separately authorized action; preserve historical receipts rather than editing them.

## Literal fictional cases — not observations

**Worked case `identity-fiction-01`:** design subjects `subject-preview-A` and `subject-production-B` target `resource-preview-A` and `resource-production-B` respectively. Preview capability is `publish-preview-artifact`; production capability is `publish-production-hosting`. A fictional review rejects rules/IAM/data capabilities from both. An independent fictional reviewer `reviewer-example-02` would check the provider's actual definitions before any grant. No real identity, reviewer or resource is selected by these labels.

**Denied cases:** the same immutable subject is proposed for both environments, even with two secret names: deny. A preview token has inherited production deployment rights: deny until excess grants are removed by an authorized process and re-observed. A PR asks for production credentials to run `build`: deny. A production approval names digest A but deploy invocation names B: deny. A 15-minute token expires during an uncertain operation: do not retry or issue a broader fallback credential; inspect state first. A rules update is bundled into Hosting approval: deny and obtain separate rule-specific review/approval.

## Acceptance mapping and root decisions

Distinct preview/production identities are assigned as design roles, minimal capabilities and explicit denials are tabulated, secret handling and exact-target approval are specified, and actual adoption fields remain unselected. Agent 0 reviewed these design choices without creating accounts. Remaining adoption requirements are provider-specific permission mapping, real resource/subject selection, custody and independent approval, then actual positive/negative boundary evidence. No IAM changes, credential provisioning, cloud read or deployment occurred.

## Historical examined source and provenance

Repository-relative paths and SHA-256 of examined bytes:

| Public source | SHA-256 |
| --- | --- |
| `docs/SECRETS.md` | `a3060d87cb9bb85f27d0d55155816ceb582742a47f4a16149104740acd73fc23` |
| `.SYSTEMX/docs/SECRETS.md` | `6d334af5502d65ca74d343d80ef25638b4ceb5c7429a3d3e06878577397973b9` |
| `.firebaserc` | `7bcf963e0b6bc46870d5719968cfcf78503947004aac8a731e729abc859dd705` |
| `firebase.json` | `f5cbf9d99d5cc271b000d493982ae9f1481aa1ed4c92d4f35dc4ecbe8b9c48eb` |
| `.SYSTEMX/scripts/deploy.sh` | `c07dd6ff0d631a663a3737fd719e566cf96a686a95230d5d8a00082d929dbfe2` |

These are historical supplied-basis source observations only. They do not establish current deployed settings, cloud access, a successful CI run, account availability or operator acceptance. Re-review a changed source or target before adoption.
