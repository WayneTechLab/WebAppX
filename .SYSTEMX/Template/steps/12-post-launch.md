# Step 12 — Post-Launch

> The app is live — now make it observable, recoverable, and cost-bounded. This
> is what turns a deploy into an operable product.

## 🎯 Goal
Errors and performance flow to a monitoring channel, backups + a runbook exist,
and budget alerts protect against runaway cost.

## ✅ Preconditions
- Step 11 complete; site is live.
- A team channel (email/Slack/etc.) to receive alerts.

## ❓ Operator prompts
1. Where should alerts go (email, Slack, PagerDuty)?
2. Monthly budget cap + alert thresholds (e.g. 50/90/100%)?
3. Backup cadence + retention for Firestore?
4. Who owns the on-call / runbook?

## ⌨️ Commands

### Monitoring (Sentry — if enabled)
```bash
# Client init in src/main.tsx (guarded by VITE_SENTRY_DSN):
#   import * as Sentry from '@sentry/react'
#   if (import.meta.env.VITE_SENTRY_DSN) Sentry.init({ dsn, environment, tracesSampleRate: 0.1 })
```
Set `VITE_SENTRY_DSN` in env + CI secrets. Verify an event arrives by throwing a
test error in a staging build.

### Budget alerts (GCP)
```bash
# Create a billing budget with alert thresholds:
gcloud billing budgets create \
  --billing-account="${BILLING_ACCOUNT_ID}" \
  --display-name="${SLUG} monthly budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0
```

### Firestore backups (export)
```bash
# One-off export:
gcloud firestore export "gs://${PROJECT_ID}-backups/$(date +%F)" --project "$PROJECT_ID"
# Schedule via a scheduled Cloud Function (Step 06) or Cloud Scheduler + export.
```

### Function cost/abuse guardrails
- `maxInstances` set on every function (Step 06).
- Rate limiting + App Check on public endpoints.
- Alerting on error-rate + latency via Cloud Monitoring.

### Runbook
Create `docs/RUNBOOK.md` covering: how to deploy/rollback, where logs live, how
to rotate secrets, incident contacts, and the recovery procedure from backups.

## 📄 Generated files
- `docs/RUNBOOK.md`, `docs/MONITORING.md`, `docs/SECRETS.md`
- Scheduled backup function (optional).
- Budget + alert policy (in GCP).

## 🔒 Security notes
- Rotate secrets on a schedule; document the procedure in `docs/SECRETS.md`.
- Restrict who can deploy to production (branch protection + IAM).
- Keep an **audit log** of admin actions; review periodically.
- Test the **restore-from-backup** path at least once — an untested backup is
  not a backup.
- Subscribe to dependency advisories; patch high-severity CVEs promptly.

## 🚦 Verification gate
```bash
# A test error appears in the monitoring dashboard.
# A budget alert email/notification is confirmed received.
gcloud firestore operations list --project "$PROJECT_ID" | head   # export ran
```
✅ Pass → **Done.** You have repeatably built another app on **WebApp Stack G One
Point Zero**. To do it again, copy `Template/` into the next repo and start at
[Step 00](./00-prerequisites.md).
