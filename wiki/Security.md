# Security

OWASP Top 10 is the checklist. Every playbook step's `🔒 Security notes` maps back
to the non-negotiable defaults below.

## Security baseline (non-negotiable defaults)

- **Security headers** on Hosting: CSP, HSTS (preload), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP.
- **Firestore / Storage rules** are **deny-by-default**; tested with rules unit
  tests in local release gates.
- **WSG Level 0-5 account model** standardizes public, member, paid, diamond,
  admin, and owner access checks.
- **RBAC** via custom claims; privileged callables verify claims server-side.
- **MFA enforcement** option for admin roles.
- **Sender/auth/MFA order** is standardized: sender email, DNS, authorized
  domains, providers, claims, MFA, and smoke tests are verified before launch.
- **Secrets never in the repo**; `.env*` and `*secrets*` are git-ignored.
- **Dependency audit** (`npm audit`) + secret scanning in local release gates.
- **App Check** recommended for production to gate Firebase backends.
- **Stripe webhooks** verify signatures + use idempotency keys.

## Security headers (shipped in `firebase.json`)

The starter's `firebase.json` already applies a hardened header set to every
response:

| Header | Value (summary) |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; scripts/styles from self + https; `object-src 'none'`; `base-uri 'self'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |

Static assets under `assets/**` also get `Cache-Control: public, max-age=31536000,
immutable`.

> When you add Stripe, extend the CSP `script-src`/`frame-src` to include
> `https://js.stripe.com` and complete the test-mode checks in the
> [Stripe module](Setup-Playbook).

## Verifying headers on a live deploy

```bash
URL="https://<your-project>.web.app"
curl -sI "$URL" | grep -i strict-transport-security
curl -sI "$URL" | grep -i content-security-policy
```

## Handling secrets during setup (AI-assisted)

The current standard is **never paste live secrets into an AI chat, browser
context, repository file, issue, or log**. AI tools may receive secret names,
presence booleans, redacted error messages, and placeholder values only.

- Put client configuration in `.env.local` only when it is intended to be
  public client configuration; keep that file ignored.
- Put server secrets in Firebase Functions secrets, Google Cloud Secret Manager,
  an approved OS keychain, or another provider-managed secret store.
- Use interactive provider authentication or short-lived credentials. Do not
  use legacy Firebase tokens or commit service-account files.
- If a secret may have entered model context, a log, or source control, stop the
  operation, rotate/revoke it at the provider, inspect history and backups, and
  record the incident without reproducing the value.
- Deleting a chat is not a remediation or a guarantee that a secret was erased.

## The two-tier secret model

| Tier | Examples | Where it lives |
| --- | --- | --- |
| **Client (public)** | `VITE_FIREBASE_*`, `VITE_STRIPE_PUBLISHABLE_KEY` | Bundle / `.env.local` |
| **Server (secret)** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL_API_KEY` | Functions secrets / GCP Secret Manager / local secret store |

A Firebase web API key is **not** a secret — see
**[Environment Variables](Environment-Variables)**.

## Firestore / Storage rules

- Start **deny-by-default**; open up reads/writes per collection deliberately.
- Keep a **rules unit test** in the suite to catch data-exposure regressions
  (`@firebase/rules-unit-testing`).
- Deploy rules alongside hosting so they never drift:
  `bash .SYSTEMX/scripts/deploy.sh rules --project your-firebase-project-id`.

## Production hardening checklist

- [ ] HSTS + CSP present on the live response (curl checks above).
- [ ] Firebase Auth authorized domains include localhost, preview/beta, custom,
  and production hosts.
- [ ] Sender email uses the selected provider path and SPF/DKIM/DMARC records
  are verified.
- [ ] Deployed rules match the repo (no drift).
- [ ] **App Check** enforcement enabled for production backends.
- [ ] Stripe in **live** mode only after a passing test-mode smoke.
- [ ] No `.env*` / secret files bundled into `dist/`.
- [ ] `npm run ci:security` green with `0 failed, 0 warning(s)`.
- [ ] `npm audit --audit-level=moderate` reports `found 0 vulnerabilities`.
- [ ] MFA required for admin roles.
- [ ] `npm run auth:mfa:check` passes before enabling private/admin routes.

See [Step 07 — Security Rules](Setup-Playbook) and [Deployment](Deployment) for
the detailed gates.

## Reviewed template controls

See [Security Review](Security-Review.md) for the 2026-10-05 repairs, compatibility changes and local validation scope.
