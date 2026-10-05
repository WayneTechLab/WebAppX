# 05 Security, Login, And Account Levels

Security and login must be standardized before project-specific features are
built.

## Account Levels

| Level | Meaning | Standard Test Identity |
| ---: | --- | --- |
| 0 | Guest/public, not logged in | `Test-User_Public@example.test` |
| 1 | Free logged-in user/member | `Test-User_Free@example.test` |
| 2 | Paid user/pro | `Test-User_Paid@example.test` |
| 3 | Paid user/diamond | `Test-Pro@example.test` |
| 4 | Employee/admin/private | `Test-Admin@example.test` |
| 5 | Owner/super admin/private | `Test-SU@example.test` |

## Unified Login

Use the five-step Unified Login process:

1. Detect provider path.
2. Capture login intent.
3. Authenticate with Firebase/Auth provider.
4. Resolve account level and claims.
5. Route to the correct public, member, paid, admin, or owner surface.

Google/Firebase is the standard default. Use Microsoft 365 when the sender
mailbox lives there. Use GoDaddy support when DNS lives there. Use Stripe when
commerce is enabled.

## Firebase Sender Auth MFA

Set up login in this order:

1. Capture Firebase config and project ID.
2. Verify localhost, preview, custom, and production authorized domains.
3. Configure `sender@` or `noreply@` plus SPF, DKIM, DMARC, and Firebase Auth
   custom email domain records.
4. Enable primary providers such as email/password and Google.
5. Bootstrap profile docs and custom claims with `level`.
6. Enroll or require MFA for private/admin accounts.
7. Smoke test public, free, paid, admin, owner, and MFA challenge paths.

Record the sender provider, DNS provider, MFA factors, and manual verification
gates. Never record live SMTP passwords, app passwords, private keys, or service
account JSON.

## Security Rules

- Firestore and Storage are deny-by-default.
- Public reads must be explicit and narrow.
- Admin and owner access require custom claims or equivalent server-side checks.
- Secrets go in provider secret stores or ignored env files, never committed
  markdown.
- Setup scripts may pause for interactive login and must not fake completion.

## Required Checks

```bash
npm run ci:security
npm run account-levels:check
npm run auth:mfa:check
```
