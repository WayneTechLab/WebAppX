# Step 01 — Sync Repo, Login, And Select Edition

## Goal
Repo state is known, remotes are synced, required logins are checked, and one
edition manifest is selected.

## Actions
- Run `git status --short --branch` and confirm branch/remotes.
- Run `gh auth status`; check Firebase/GCloud/Stripe auth if the edition requires them.
- For interactive auth, use `bash .SYSTEMX/scripts/bootstrap.sh --with-stripe --with-mcp --interactive-login`.
- Ask whether the sender address is managed by Google Workspace, Microsoft 365,
  or another SMTP provider; ask whether DNS is managed in GoDaddy.
- Select one edition from `editions/`.
- Record the edition in setup notes or `interview.answers`.

## Gate
The operator can state the branch, remote, selected edition, and each missing
auth/tooling item in the required login order.
