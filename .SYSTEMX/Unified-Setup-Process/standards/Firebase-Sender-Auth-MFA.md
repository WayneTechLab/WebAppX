# Firebase Sender Auth MFA Standard

This standard captures the reusable login and security lessons from
WayneTechLab and DARQ-style projects without importing project-specific
business logic. Use it whenever a generated WebStack app enables Firebase Auth,
sender email, account levels, MFA, commerce, or admin/private surfaces.

## Core Rule

Unified Login is an ordered system, not one component. Configure and verify
sender email, authorized domains, primary providers, account bootstrap, custom
claims, MFA challenge handling, Firestore/Storage rules, and smoke tests in that
order.

## Ordered Setup

1. **Provider decision**
   - Ask whether the sender mailbox is Google Workspace, Microsoft 365, or other
     SMTP/API.
   - Ask whether DNS is GoDaddy or another DNS provider.
   - Default to Google Workspace plus Firebase/GCloud when unknown.

2. **Firebase project and auth domains**
   - Capture the Firebase Web SDK config with the copy-paste parser.
   - Set `.firebaserc`, `firebase.json`, and ignored env files from the captured
     values.
   - Add local, preview, custom, and production hostnames to Firebase Auth
     authorized domains before testing OAuth.
   - Keep `/__/auth/**` popup routes compatible with Firebase Auth. When auth
     popups fail, check `Cross-Origin-Opener-Policy`, CSP, and preview domains.

3. **Sender email**
   - Standard address: `sender@<project-domain>` or `noreply@<project-domain>`.
   - Verify SPF, DKIM, DMARC, and Firebase Auth custom email domain records
     before production email flows are enabled.
   - Google Workspace path: mailbox or alias plus Gmail/Workspace-approved SMTP
     or API credentials.
   - Microsoft 365 path: mailbox plus Microsoft 365/Graph-aware SMTP or API
     credentials.
   - Other provider path: host, port, TLS mode, username, from, and reply-to.
   - Store passwords, app passwords, API keys, private keys, and service account
     JSON only in secret stores or ignored env files.

4. **Primary login providers**
   - Email/password and Google are the default generic providers.
   - Optional providers include Microsoft/OIDC/SAML, Apple, GitHub, X/Twitter, or
     project-specific social providers.
   - Prefer popup on desktop and redirect fallback on mobile, embedded browsers,
     popup-blocked, popup-closed, or cancelled popup states.
   - Persist only non-secret pending auth state needed to recover from redirects.

5. **Account bootstrap**
   - Create or reconcile `users/{uid}` profile documents after primary sign-in.
   - Mirror privileged access into Firebase custom claims using `level`.
   - Keep profile level and claim level synchronized by trusted backend code.
   - Bootstrap Level 5 ownership from verified owner email or controlled setup
     input, not from a hardcoded production UID.

6. **MFA enrollment gate**
   - Level 4 and Level 5 accounts must be documented as MFA-required.
   - Projects with private or paid surfaces should provide a security setup gate
     after first sign-in until at least one factor is enrolled.
   - Supported generic factors: email OTP, SMS/phone second factor, TOTP, and
     backup/recovery codes when implemented.
   - OTP/TOTP/recovery collections are backend-only and must not be readable or
     writable by clients.

7. **MFA challenge flow**
   - Catch `auth/multi-factor-auth-required` and preserve the resolver only for
     the active challenge.
   - Offer the user enrolled factors in preference order.
   - Clear stale resolver, redirect, and local session markers when the user
     changes account or cancels.
   - Add timeout and recovery paths so the app never remains stuck behind a
     blank login or permanent loading state.

8. **Rules and authorization**
   - Firestore and Storage are deny-by-default.
   - Public reads must be narrow and intentional.
   - User self-edits must use an allowlist and must block privileged fields such
     as `level`, `role`, `admin`, `subscriptionTier`, `mfaRequired`, and
     `securityProfile`.
   - Level 4 can manage lower levels only when the project explicitly allows it.
     Level 5 owns emergency/admin promotion flows.
   - Server checks must enforce the same account levels used by UI route guards.

9. **Preview-first validation**
   - Validate login on localhost, preview/beta hosting, and production domains.
   - Test with a fresh browser profile and an already signed-in browser profile.
   - Test Level 0 public render, Level 1 profile bootstrap, paid route denial,
     Level 4 admin route, Level 5 owner route, and at least one MFA challenge.
   - Verify sender email delivery before launch.

## Common Break Causes

- Firebase Auth authorized domains did not include preview/custom domains.
- Auth popup headers blocked Firebase popup communication.
- Redirect callback state was lost or stale local storage was reused.
- `auth/multi-factor-auth-required` was treated as a generic login failure.
- MFA resolver state was not cleared when switching accounts.
- User profile creation was blocked by Firestore rules.
- Firestore rules allowed self-edit of privileged account fields.
- Custom claims and profile `level` drifted apart.
- Sender email DNS or SMTP was configured after login flows were already tested.
- Public routes waited on private auth bootstrapping and rendered as blank pages.

## Required Template Checks

```bash
npm run auth:mfa:check
npm run ci:security
```

