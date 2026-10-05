# Monitoring Standard

Projects created from this template should define monitoring during setup, not
after the first production incident.

## Baseline Signals

- Hosting availability and response status.
- JavaScript runtime errors.
- Auth failures and unusual sign-in volume.
- Firestore and Storage permission-denied spikes.
- Cloud Functions errors, cold starts, and latency if functions are enabled.
- Billing and quota thresholds.

## Recommended Tools

- Firebase console for Hosting, Firestore, Storage, and Functions.
- Google Cloud Monitoring for alerts and dashboards.
- Sentry or equivalent for browser error reporting.
- Local verification gate health for release readiness.

## Alert Ownership

Each downstream project should document:

- Primary responder.
- Escalation contact.
- Production Firebase project ID.
- Rollback command or console path.
- Secret rotation owner.
