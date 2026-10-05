# Alert Recommendations

Downstream projects should turn these into concrete Google Cloud Monitoring,
Firebase, Sentry, or provider-specific alerts.

## Launch Minimum

- Hosting availability check fails.
- Cloud Functions error count increases above baseline.
- Firestore permission-denied rate spikes.
- Storage permission-denied rate spikes.
- Billing exceeds the project threshold.
- CI fails on the default branch.

## Response Standard

Every alert should include the owning project, severity, responder, dashboard
link, and rollback or mitigation note.
