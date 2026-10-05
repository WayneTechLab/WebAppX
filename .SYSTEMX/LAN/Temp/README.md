# SYSTEMX LAN Temp

Ignored local runtime files for SYSTEMX Local Control sessions belong here.
Do not store secrets in this folder.

Typical contents:

- `operations.jsonl` — local LAN events such as page-model updates, source
  saves, component-registry updates, and inventory-only ingest runs.
- `ingest/<run-id>/manifest.json` — read-only existing-project inventory
  findings. These are review manifests, not bridge-install commands.
- session scratch files, process metadata, and temporary local exports.

These files are evidence for the local operator. They are not public website
content, not Firebase Hosting output, and not production CMS records.
