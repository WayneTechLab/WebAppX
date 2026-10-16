# Proposed OAuth state-binding test contract — WX-0953

Prepared 2026-10-15. **V2 artifact design reviewed; adoption unselected and disabled.** Agent 0 reviewed the amended policy after independent source/artifact recheck. The reviewed v2 distinguishes sensitive incoming callback exposure, clean completion navigation and per-surface verified company/scope metadata. Original v1 draft hashes and historical supplied source basis `42818dd7baf3d335f27c401c37d048bd842617fa` remain in the [source-review record](evidence/adoption-contract-source-review.json); its later catalog-metadata observation is separately qualified. The original pending-review wording is drafting history. This specifies future tests and records no protocol execution, provider setup or canonical acceptance. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md).

## Original criterion and coverage

**WX-0953** — P1 / integrations / extensions / provider; source `docs/GUSTO-SETUP.md`; no dependencies; the original draft recorded TODO; current status comes from the [canonical catalog](backlog/webappx-1000-todo.json).

> An adoption test contract binds state, organization, initiating user, expiry and one-use callback without exposing a client secret.

| Criterion part | Contract evidence |
| --- | --- |
| State | 256-bit opaque random wire value, server digest record and exact-match callback validation |
| Organization + initiating user | Trusted membership/UID/session initiation binding; callback and pre-commit rechecks; wrong-scope fixtures |
| Expiry | Server clock, five-minute proposed state deadline, equality-boundary refusal |
| One-use callback | Atomic pending claim before exchange; concurrency, replay, crash and uncertain-failure outcomes |
| No client secret | Server-only credential reference; browser/URL/log/export exclusions and marker-leak tests |

## Current source and researched boundary

`docs/GUSTO-SETUP.md:679,711–718` leaves trusted mappings, token vault, serialized refresh and provider transport for adoption. `integrations/gusto/functions/src/backend.mjs:15–17,46–48` explicitly reports disconnected provider state and refuses proxy forwarding. `security.mjs:15–27` supplies verified UID/server-managed organization membership vocabulary. This proposal adds no runtime OAuth endpoint to those sources.

Gusto's [App Integrations OAuth2 guide](https://docs.gusto.com/app-integrations/docs/oauth2) documents a random URL-safe state, its callback match before server-side token exchange, exact redirect configuration and a separate company authorization flow. Its currently documented ten-minute **authorization-code** lifetime is not this proposal's state lifetime. The [Embedded authentication guide](https://docs.gusto.com/embedded-payroll/docs/authentication-and-authorization) describes separate system/company token flows; this contract must be selected only for an actual authorization-code path, not imposed on a different grant by analogy.

The current OAuth security BCP, [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.7), requires CSRF protection bound to the user agent and discusses one-use state and verified PKCE support. This design retains state binding. A chosen provider/client flow must independently establish code-injection protection, PKCE/client-auth support and issuer/mix-up protection; no provider-specific PKCE support is inferred from the template or this draft. Unsupported required protection blocks adoption.

## Default inert selection

```json
{
  "enabled": false,
  "providerProgram": null,
  "environment": null,
  "authorizationServer": null,
  "authorizationEndpoint": null,
  "tokenEndpoint": null,
  "publicClientId": null,
  "serverCredentialReference": null,
  "exactRedirectUri": null,
  "orgId": null,
  "allowedScopes": [],
  "brokerSessionPolicy": null,
  "approvalReference": null
}
```

No missing value defaults to Demo, production, a hostname from a query, a client-supplied organization or a global credential. Environment, client registration, exact redirect URI, issuer/endpoints, requested/accepted scopes and trusted token-vault service must agree before initiation. Redirect targets after callback are selected same-origin route identifiers, never caller-supplied URLs. A native role selector, paid tier, possession of a Firebase token string or available credential alone grants no connection authority.

## Proposed trusted flow

### Initiation

1. A trusted server verifies the current identity and a server-managed active membership with the explicitly selected integration-connect capability for the selected organization. Derive UID, organization and current membership version; do not trust browser role/company/UID fields.
2. Establish a server-managed browser-session binding. Proposed cookie properties are Secure, HttpOnly, Path `/` and SameSite=Lax for the selected top-level GET callback, with no broad Domain. Authenticate/bind the broker session through an approved server verification path. A different callback method/provider requires a deliberate cookie/CSRF review, not disabling protections.
3. Generate exactly 32 bytes from a cryptographic random source and encode as canonical 64 lowercase hex characters. No timestamp, incrementing ID, Math.random fallback, organization or PII inside state. Store SHA256 of the wire UTF-8 value in the private attempt record, not its raw value. Refuse entropy/source/store failures without a redirect.
4. Bind the immutable attempt to organization, initiating verified UID, session binding, membership version, provider program/environment/client/issuer/redirect, requested scope set, connection revision and selected post-connect route. Proposed expiry is `createdAt + 300 seconds`. The duration is a product recommendation for root review, not a provider mandate.
5. Return only the selected authorization redirect containing the public client ID, exact redirect, response type, opaque state and any separately accepted protocol protection. Client secret, verifier/credential material, internal attempt payload and tokens remain server-only. Never serialize this attempt into native backups, browser local/session storage, analytics or error traces.

### Callback validation and atomic claim

6. At the exact server callback route, parse one state plus exactly one recognized code or provider-error outcome. Reject duplicate parameters, malformed/noncanonical state, code+error together, unexpected issuer/program/environment or arbitrary redirect fields. The incoming authorization-code callback necessarily places code/state in its browser navigation URL; this contract does not promise absence from that original request, browser history/developer tools or a raw browser trace. Configure application/middleware diagnostics to exclude the callback query before logging, and separately review infrastructure capture before adoption. Never reflect code/state/provider error text into HTML, JSON, a new browser request, a completion URL or an application-generated trace event.
7. Verify the current server session, initiating UID and active organization membership. Lookup the digest within that private attempt namespace, then compare exact bound values, server time (`now < expiresAt`), connection revision and approved config. Wrong-user/tenant/session/malformed callbacks do not consume the legitimate attempt; they return a generic refusal with no existence details. These refusals cannot be used to switch or infer a tenant.
8. **In one atomic private-store transaction**, re-read the pending attempt and current trusted binding/version checks, then transition `pending → redeeming` with one opaque server claim/fence. The transaction's callback must perform no provider exchange: transactional retries must not duplicate side effects. If claim cannot commit, exchange count is zero. Concurrent callbacks receive at most one winning claim.
9. A matching provider-denial callback atomically consumes the valid attempt as `denied`; it performs no token exchange or connection write. An unknown arbitrary error string is reduced to a fixed category, not echoed or persisted.

### Exchange, completion and failure

10. Only the winning claimant may perform **one** server-to-selected-token-endpoint exchange using the bound code/redirect/client and the server-only credential reference. Do not follow endpoint redirects to unselected hosts. Bound time/response size and redact transport diagnostics. Tokens are held only in the approved private path; none is returned to the browser.
11. Validate the exact provider grant and actual authorized company/scopes against the selected organization mapping. A company chosen at the provider is untrusted until independently validated/mapped; callback query `company` is never that proof. A mismatch fails terminally without attaching credentials to another tenant.
12. Before connection/vault commit, recheck attempt fence, config, current membership/revocation, organization and connection revision. Commit the credential reference/accepted connection and terminal `succeeded` outcome atomically in the adopted persistence boundary, or use a reviewed durable idempotent vault/outbox design if stores differ. This contract does not pretend a provider exchange and two independent databases form one transaction. Missing cross-store recovery design blocks activation.
13. Once claimed, an attempt never returns to pending. Invalid grant/explicit exchange refusal → `failed`; network timeout or crash with uncertain exchange outcome → `uncertain`; provider denial → `denied`. No automatic authorization-code retry or reconnect using the same state. The user must deliberately initiate a new attempt after a safe status/recovery decision. A new connection/revision invalidates conflicting pending attempts at claim/commit.

### Clean completion and exposure boundary

Every terminal/refused callback path returns `Cache-Control: no-store` and `Referrer-Policy: no-referrer` and issues an HTTP **303** to the fixed same-origin path `/integrations/gusto/connection-result`, with **no query or fragment**. This is an inert proposed route, not an implemented endpoint. The redirect Location is selected by trusted configuration, never derived from callback text. The completion page reads only a generic bounded outcome through the bound server session and has no third-party resources; unknown/wrong-user attempts expose no attempt/tenant existence. If trusted response construction fails, return a generic no-store/no-referrer error without echo or external resource, never an unsafe fallback redirect.

The resulting location and all new app-controlled HTML/JSON, browser requests, logs, analytics, portable files and application-created trace events must omit raw code/state/credential and arbitrary provider error text. A required server-to-approved-token-endpoint exchange still contains its code and server credential in the private protocol request; that explicitly selected exchange is not a public response/logging destination. The owned fake exchange may inspect its fictional code as private test input without copying it to diagnostics. Client secrets never enter the browser, even on initial authorization/callback navigation.

A clean redirect prevents continued propagation; it does not erase or prove redaction of the original browser request, developer-tools capture, redirect chain or already-created raw infrastructure trace. Such captures are sensitive evidence and cannot be published as sanitized by assertion. Adopted log/APM/proxy configuration must demonstrate the required exclusions or remain unavailable. Future browser fixtures use only fictional markers, distinguish incoming navigation from subsequent app-controlled outputs, and preserve their protected evidence boundary.

Tokens received but not committed are never exposed or silently attached. Their bounded private recovery/revocation procedure and owner are required before activation; any real provider cleanup would need its separate scope. A crash in `redeeming` leaves a consumed fence; a sweeper may mark it uncertain, never replay exchange. Proposed terminal digest/outcome retention is 24 hours, containing only redacted categories and bound pseudonymous IDs, then deletion; this is a root-review policy recommendation. Expiry and unknown-state refusal remain authoritative even if physical cleanup is delayed. No client secret or raw code/state/token belongs in that history.

## Literal fictional base fixtures

The following deterministic wire state is deliberately insecure **test-only input**, never a production generator output:

```json
{
  "wireState": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "privateAttempt": {
    "attemptId": "attempt-fiction-001",
    "stateDigest": "a8ae6e6ee929abea3afcfc5258c8ccd6f85273e0d4626d26c7279f3250f77c8e",
    "orgId": "org-fiction-a",
    "initiatingUid": "uid-fiction-alex",
    "sessionBinding": "session-fiction-7",
    "membershipVersion": "membership-4",
    "program": "fictional-authorization-code-stub",
    "environment": "owned-fixture",
    "issuer": "https://oauth.fixture.invalid",
    "publicClientId": "client-fiction-1",
    "redirectUri": "https://app.fixture.invalid/integrations/gusto/callback",
    "requestedScopes": ["fictional.directory.read"],
    "connectionRevision": "connection-0",
    "createdAtSeconds": 1792065600,
    "expiresAtSeconds": 1792065900,
    "state": "pending"
  },
  "callback": {
    "code": "FICTIONAL-ONE-USE-CODE",
    "state": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  }
}
```

The digest is the literal SHA256 of the stated wire UTF-8 string. Stub scopes/endpoints are fictional and must not be mistaken for Gusto support. The owned future fake has two separate narrow surfaces: exchange yields only a fake private credential reference; a server grant-verification surface yields sanitized independently checked company/scope metadata. This is not a claim that a real Gusto token response contains these fields. A real adopter must select and validate the provider's actual company/scope proof before making its verified projection. Neither surface returns an actual token or client secret.

```json
{
  "exchangeStubResult": { "credentialReference": "vault-fixture-001" },
  "verifiedGrantStubResult": {
    "credentialReference": "vault-fixture-001",
    "issuer": "https://oauth.fixture.invalid",
    "program": "fictional-authorization-code-stub",
    "environment": "owned-fixture",
    "publicClientId": "client-fiction-1",
    "providerCompanyId": "company-fiction-a",
    "grantedScopes": ["fictional.directory.read"]
  },
  "trustedCompanyMapping": {
    "orgId": "org-fiction-a",
    "providerCompanyId": "company-fiction-a",
    "version": "company-map-3",
    "status": "approved"
  },
  "expectedAcceptedConnection": {
    "orgId": "org-fiction-a",
    "initiatingUid": "uid-fiction-alex",
    "providerCompanyId": "company-fiction-a",
    "companyMappingVersion": "company-map-3",
    "program": "fictional-authorization-code-stub",
    "environment": "owned-fixture",
    "grantedScopes": ["fictional.directory.read"],
    "credentialReference": "vault-fixture-001",
    "revision": "connection-1",
    "status": "accepted-in-owned-fixture"
  }
}
```

Compare the bound attempt and selected configuration with the verified-grant result for issuer, program, environment and public client ID. Compare the exchange result's credential reference with the verified-grant result's credential reference; the exchange result has no grant-metadata fields and the pending attempt has no credential reference. The trusted mapping binds the verified company to the attempt's organization, and its captured version must remain current at commit. Granted scopes must match the explicitly accepted set here; missing required metadata on its specified surface, another company or an extra write scope refuses. Expected records come from these literals, not a reducer or provider response copied into the oracle. Entropy tests separately assert exactly 32 cryptographic bytes requested, distinct outputs under supplied deterministic sequences and failure without fallback.

## Required outcomes and complete-state assertions

Each case starts from an independent literal fixture unless it explicitly continues another case. Compare the complete attempt, connection/vault projection, unrelated organizations and redacted diagnostics. Count exchange calls independently of reducers. No cases below have been run.

| ID | Exact fixture variation | Expected outcome |
| --- | --- | --- |
| OS-01 | Default disabled/unselected configuration | Initiation/callback refuse; zero attempt/connection/vault writes, zero exchange |
| OS-02 | Base bindings, active member, now `1792065630`, the literal exchange/verified-grant/mapping fixtures above | Exactly one claim/exchange/verification and the complete literal expected accepted connection; attempt terminal succeeded; no credential/code/raw state in app response or completion redirect |
| OS-03 | State last character changed to `0`, missing state, 63/65 characters or duplicate state/code keys | Refuse; base pending attempt unchanged; zero exchange |
| OS-04 | Current organization `org-fiction-b` | Refuse; no connection/read leakage across tenants; base unchanged |
| OS-05 | Current UID `uid-fiction-riley`, absent login or session `session-fiction-8` | Refuse; zero exchange, legitimate pending attempt unconsumed |
| OS-06 | Now `1792065900` or later | Expired; zero exchange even if attempt document still exists |
| OS-07 | Replay the successful OS-02 callback | Refuse; exactly one exchange/connection total; original terminal record unchanged |
| OS-08 | Two simultaneous matching callbacks with a barrier before atomic claim | Exactly one winner; one exchange; loser observes consumed/conflict and writes no connection |
| OS-09 | Transaction retries its callback three times before successful claim | Exactly one external exchange after commit, not three; one terminal outcome |
| OS-10 | Claim transaction/store unavailable | Fail closed; zero exchange and no optimistic connection |
| OS-11 | Correct state plus `error=access_denied`, no code | One consumed denied outcome, zero exchange/connection; safe fixed message |
| OS-12 | Correct state plus code and error together, wrong issuer/client/redirect/environment | Refuse before claim/exchange; base unchanged |
| OS-13 | Member revoked/config changed/connection revision becomes `connection-1` before claim | Refuse; zero exchange and no stale connection overwrite |
| OS-14 | Member revoked or connection revision changes after claim, before commit | Terminal failed; no connection commit or exposed token; invoke only selected private recovery contract |
| OS-15 | Keep exchange reference fixed; change verified grant company to `company-fiction-b` or granted scopes to include `fictional.payroll.write` | Terminal failed; one winning exchange/verification, zero accepted connection; trusted mapping/unrelated organizations unchanged; no fallback organization selection |
| OS-16 | Invalid grant or explicit exchange error | One exchange, consumed failed; retry same state denied |
| OS-17 | Timeout, lost response or worker crash after claim | Consumed uncertain; same-state exchange never retried; no connected-success claim |
| OS-18 | Vault/connection commit failure or crash across stores | No partial accepted connection; durable recovery/fence required, no state reset or browser token |
| OS-19 | Inject `FICTIONAL_SECRET_DO_NOT_LOG` separately as server secret, fictional callback code or provider error/query | Server secret never appears in browser input/output. The explicitly constructed incoming callback/test-private exchange may contain its fictional code marker; all new app-controlled HTML/JSON/redirects/browser requests, application logs/trace events, backups and error bodies omit markers. Do not assert that the original browser navigation/raw trace never contained its callback query. |
| OS-20 | Native export/import/restore/Undo or client role/tier mutation | No effect on private attempt, one-use fence, broker identity or server membership |
| OS-21 | Arbitrary post-connect URL or callback open-redirect target | Refuse; only selected same-origin route IDs allowed |
| OS-22 | Expired attempt physically deleted, old state submitted | Unknown/expired refusal; no resurrection or token exchange |
| OS-23 | Run success, denied and malformed fictional callback paths; inspect the callback response and next same-origin request separately | Each safe redirect is exactly 303 to `/integrations/gusto/connection-result` with no query/fragment, no-store/no-referrer, no marker-bearing Referrer or third-party completion request. Original callback URL remains explicitly sensitive input evidence. |
| OS-24 | Verification metadata is absent, credential reference differs, or company mapping changes to version `company-map-4` before commit | Fail terminally with no accepted connection; no inferred company/scope from the reference or callback query; unrelated mappings remain unchanged |

## Material decisions and activation boundary

Proposed resolved choices: confidential server broker; explicit organization/user/session binding; 32 random bytes; five-minute server expiry; one atomic claim before any exchange; terminal consumption on failure/uncertainty; no automatic code retry; no credential in browser/log/portable files. These are review recommendations, not claims that Gusto mandates these exact local values.

Still unselected: provider program/authorization-code applicability, environment/client registration, exact issuer/endpoints/redirect, company and scope acceptance, verified PKCE/code-injection protection, vault/store transaction or recovery design, membership/step-up policy, retention owner and operator approval. Agent 0 reviewed this complete artifact contract without credentials or an OAuth roundtrip. An adopted implementation and authorized provider acceptance remain separate; this draft changes neither gate labels nor backlog status.
