# SYSTEMX LAN Files

Ignored local operator imports, exports, and working files belong here. Keep
production secrets out of this folder.

Typical contents:

- `local-data.json` — local page, node-tree, CMS/CRM, and user fixtures used by
  the current-template builder.
- `component-registry.json` — reusable component/module records for headers,
  footers, shell sections, widgets, tags, slots, and width behavior.
- operator imports or exports that need review before becoming committed
  source files.

Nothing in this folder is automatically deployed or synced to a provider.
Promotion to source, Firebase, GCloud, Drive, SQL, or another service must go
through a separate SYSTEMX gate.
