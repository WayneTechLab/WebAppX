# Canary Deploy Plan

Use this plan when a downstream project needs a safer rollout than a direct
production deploy.

## Template Default

The base template deploys directly after passing local and CI gates. Canary
hosting channels are optional and should be enabled per project.

## Recommended Flow

1. Run `npm run sync:system:check`.
2. Run `bash .SYSTEMX/scripts/deploy.sh --preflight`.
3. Deploy to a Firebase preview channel.
4. Smoke test auth, primary navigation, Firestore reads/writes, and forms.
5. Promote or deploy to production.

## Rollback

Use Firebase Hosting release history to roll back to the last known good
release, then open a follow-up issue with the failed checks and remediation.
