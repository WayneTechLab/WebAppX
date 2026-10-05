# Storage Policy

Firebase Storage should start closed and open only around explicit product
flows.

## Baseline

- Keep `storage.rules` in source control.
- Deny writes from unauthenticated users unless the project has a documented
  public upload flow.
- Validate ownership using `request.auth.uid` for user-owned objects.
- Keep generated exports and backups outside public buckets.

## Verification

Run `npm run ci:security` after changing `storage.rules` or `firebase.json`.
