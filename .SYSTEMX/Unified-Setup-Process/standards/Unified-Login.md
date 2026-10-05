# Unified Login Standard

Unified Login is the template standard for onboarding accounts, identity
providers, sender email, and local test access. It is provider-aware but assumes
Google/Firebase Cloud as the default platform.

## G1 local implementation

The WebApp `/login` page and SYSTEMX LAN `Providers` panel use the shared
[`auth-provider-registry.json`](../../LAN/Builder/contracts/auth-provider-registry.json)
contract. In local development, Firebase is initialized against the
`demo-systemx` Auth emulator and only Email + password is enabled. Run
`npm run dev:systemx` before testing the form. Google, email-link/code,
custom-token, and OIDC/SAML SSO remain explicit readiness states; they are not
silently simulated or enabled by a browser-side switch.

`/admin` is a claim-gated management shell for Level 4/5 operators. A client
selector or local storage value never grants admin authority. Firebase rules,
trusted functions, custom claims, and provider configuration remain authoritative
for real projects. The local LAN can show CMS/CRM, Cloud, Stripe, SEO, and
tooling readiness, but it does not mutate those providers without a separate
allowlisted adapter and deployment gate.

## Five-Step Login Process

1. **Identify provider stack**
   - Ask whether sender and workforce email use Google Workspace, Microsoft 365,
     or another provider.
   - Ask whether DNS is managed in GoDaddy or another registrar.
   - Default assumption: Google Workspace plus Firebase/GCloud.

2. **Authenticate platform CLIs**
   - GitHub CLI: `gh auth login`
   - Google Cloud CLI: `gcloud auth login`
   - Application Default Credentials for local dev:
     `gcloud auth application-default login`
   - Firebase CLI: `firebase login --no-localhost`
   - Stripe CLI when commerce is enabled: `stripe login`
   - Microsoft 365 CLI when selected: `m365 login`

3. **Capture app and sender settings**
   - Paste the Firebase Web SDK config into the setup helper.
   - Capture sender domain, sender address, reply-to address, and provider.
   - Keep SMTP/API credentials in secret stores or ignored local env files.

4. **Verify auth, email, and security state**
   - Confirm Firebase project access.
   - Confirm sender DNS requirements: SPF, DKIM, DMARC, and Firebase Auth custom
     domain records where applicable.
   - Confirm Stripe account and webhook setup when commerce is enabled.
   - Confirm account-level fixtures and route/security expectations.

5. **Record handoff without secrets**
   - Write provider choices, non-secret IDs, required manual gates, and remaining
   setup actions into `.SYSTEMX/status/` or setup notes.
   - Never paste live passwords, app passwords, private keys, service-account
     JSON, SMTP secrets, or Stripe secret keys into committed docs.

## Required Order Of Operations

Use this order before declaring login complete:

1. Capture Firebase config and project ID.
2. Verify Firebase Auth authorized domains for localhost, preview, custom, and
   production hosts.
3. Configure sender address and DNS records.
4. Enable primary auth providers.
5. Bootstrap profile docs and custom claims.
6. Enroll or require MFA for private/admin accounts.
7. Run public/member/paid/admin/owner smoke tests in a fresh browser profile.

If any step fails, fix it before continuing. Most broken login systems come from
testing MFA or OAuth before sender email, domains, headers, and claims are
settled.

## Sender Email Provider Matrix

| Provider | Standard CLI / Tooling | Notes |
| --- | --- | --- |
| Google Workspace / Gmail SMTP | `gcloud`, `firebase`, DNS lookup tools | Standard path for Firebase Auth email and `sender@` or `noreply@` addresses. |
| Microsoft 365 | Microsoft 365 CLI (`m365`) | Use when the sender mailbox or tenant is Microsoft-managed. |
| Other SMTP | Provider docs plus secret storage | Capture host, port, username, from/reply-to, and TLS mode. |
| GoDaddy DNS | GoDaddy API/CLI wrapper or manual DNS console | Used for DNS verification; API credentials must stay in secret storage. |

## Setup Question

During setup, ask:

> Which provider manages the sender address for this project: Google Workspace,
> Microsoft 365, or other SMTP? Is DNS managed in GoDaddy?

If the answer is unknown, proceed with Google/Firebase defaults and record a
manual follow-up.

For MFA-specific ordering, see
[`Firebase-Sender-Auth-MFA.md`](Firebase-Sender-Auth-MFA.md).
