# Step 10 — Security And Governance

## Goal
Security posture is documented, checked, and edition-appropriate.

## Actions
- Apply deny-by-default rules.
- Document public-read exceptions.
- Run `npm run ci:security`.
- Run `npm run auth:mfa:check`.
- Confirm MFA/App Check/RBAC guidance where applicable.
- Use [`WSG Account Levels`](../standards/WSG-Account-Levels.md) for Level 0-5
  route, rules, claims, and test expectations.
- Use [`Firebase Sender Auth MFA`](../standards/Firebase-Sender-Auth-MFA.md)
  when Firebase Auth, sender email, or MFA is enabled.
- Treat Level 4 and Level 5 as private/admin surfaces that require MFA guidance
  and server-side checks.

## Gate
Security and auth/MFA checks pass or warnings are documented with owners.
