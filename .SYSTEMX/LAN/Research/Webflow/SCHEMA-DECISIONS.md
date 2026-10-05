# Designer Contract Decisions — Wave 0

These decisions keep the supplied research schemas useful without promoting
unimplemented future behavior into the current G1 contract.

## Accepted as draft inputs

All nine `designer-*.schema.json` files are retained as versioned draft inputs
for later waves. They are not imported by the current LAN server and are not
treated as a public API.

| Contract | Decision | First adoption wave |
| --- | --- | --- |
| `designer-document` | Accept the normalized graph direction; require stable IDs, source ownership, and migrations before canonical adoption. | Wave 2 |
| `designer-command` | Accept typed command envelopes; require journal, inverse operation, revision, and authorization fields before mutations use it. | Wave 3 |
| `designer-evidence` | Accept evidence linkage as a required release concept; current JSONL operation logs remain the source for G1. | Wave 3 |
| `designer-style` | Accept selector/token/breakpoint vocabulary; no current style writer is implied. | Wave 6 |
| `designer-component` | Accept definition/instance/slot/variant direction; current registry is metadata-only. | Wave 7 |
| `designer-cms` | Accept collection/field/item/binding direction; current CMS/CRM data is local fixture data. | Wave 8 |
| `designer-publish-manifest` | Accept immutable release-manifest direction; current deploy helper remains the authority. | Wave 10 |
| `designer-plugin` | Accept capability-scoped extension direction; no arbitrary plugin execution is enabled. | Wave 11 |
| `designer-presence` | Accept collaboration metadata direction; no hosted presence or branch merge is enabled. | Wave 12 |

## Rejected for current G1

- Universal two-way source round trips without a source-ownership classification.
- Arbitrary shell, arbitrary plugin, or unrestricted MCP execution.
- Treating a browser DOM snapshot as authoritative React/TypeScript source.
- Provider writes from the local designer without authenticated, target-checked
  adapters and explicit operator approval.
- Calling the current LAN a complete Webflow replacement.

## Promotion rule

A draft contract becomes canonical only when its wave adds schema validation,
fixtures, migration/version rules, characterization or integration tests,
operator documentation, security review, and a passing exit evidence packet.
