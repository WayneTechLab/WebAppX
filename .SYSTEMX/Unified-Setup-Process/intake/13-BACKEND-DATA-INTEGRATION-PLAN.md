# 13 Backend Data Integration Plan

- Data model:
- APIs and contracts:
- Background jobs/functions:
- Third-party integrations:
- Reliability and failure handling:

## Builder data-plane decisions

The LAN builder uses separate adapters and schemas for different data shapes.
It does not expose a universal database editor.

| Data shape | Preferred service | Local verification |
| --- | --- | --- |
| Draft pages, tokens, builder metadata | Firestore | Firestore emulator |
| Presence and transient coordination | Realtime Database, optional | Realtime Database emulator or LAN memory |
| Relational CRM/reporting/transactions | Firebase SQL Connect backed by Cloud SQL for PostgreSQL | SQL Connect emulator/local PostgreSQL path |
| Web media | Cloud Storage for Firebase | Storage emulator |
| Staff documents and production-kit files | Google Drive/Shared Drive | Local fixture, then explicit OAuth-scoped sync |
| Internal archives | Google Cloud Storage | Local checksum fixture, then GCloud adapter |

### Required contracts

- every collection has an owner, environment, provider, schema version, and
  read/write capability declaration;
- SQL Connect schema and operations are committed only when the project has
  explicitly selected the relational module;
- browser code consumes approved typed operations, not raw SQL or unrestricted
  provider APIs;
- every external write has a dry-run/preview or conflict report where the
  provider supports it;
- provider health, auth identity, and project/instance identity are shown in
  the LAN dashboard without exposing secrets;
- exports are checksummed and include provider identity and environment;
- local emulator fixtures are the default test target.

See [`../../LAN/BUILDER-SYSTEM-PLAN.md`](../../LAN/BUILDER-SYSTEM-PLAN.md) for
the full storage matrix, sync bridge, and implementation waves.
