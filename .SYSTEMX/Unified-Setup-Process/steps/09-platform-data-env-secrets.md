# Step 09 — Platform, Data, Env, And Secrets

## Goal
Firebase, Firestore, Storage, Functions, environment files, and secret handling
are configured for the edition.

## Actions
- Capture Firebase config through existing helpers. The Web helper accepts the
  full Firebase SDK snippet exactly as copied from the Firebase console; end the
  paste with `WSG_END`.
- Keep client `VITE_*` values separate from server secrets.
- Use Functions/GCP/GitHub secret stores for production secrets.
- Capture sender email choices through the
  [`Unified Login`](../standards/Unified-Login.md) standard: sender provider,
  DNS provider, from address, reply-to address, and non-secret project IDs.
- Verify Firebase Auth authorized domains before OAuth/MFA testing.
- Follow [`Firebase Sender Auth MFA`](../standards/Firebase-Sender-Auth-MFA.md)
  for the ordered sender/auth/domain setup.
- If Google Workspace/Firebase is selected, verify Firebase/GCloud login and
  DNS records before enabling custom sender behavior.
- If Microsoft 365 is selected, verify `m365 login` and record the tenant/mailbox
  assumptions without committing credentials.

## Gate
The app can boot with config and no live secret is committed.
