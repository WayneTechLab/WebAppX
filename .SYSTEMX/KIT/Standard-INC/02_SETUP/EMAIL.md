# INC email operations and migration

## Written routing contract

All portfolio addresses use the accepted shared domain. Address comparisons are case-insensitive for this kit; confirm provider behavior before setup. Each business has Info and Chef receiving mailboxes, seven public aliases (Support, Contact, Billing, Social, Partner, Party, Location-1001), and a NoReply automated sender.

Info remains separate from public forwarding. Administrative privileges are assigned to named identities in the provider's access controls; creating an Info address grants no privilege. Chef receives the business's public aliases. NoReply uses that business's Chef as Reply-To; choose monitored, forward-to-Chef, or reject inbound handling explicitly.

Configure one inbound receiving system per address/domain routing plan. If Google Workspace and Microsoft 365 coexist, retain an accepted split-delivery design and provider-specific routing evidence. A list of future platforms is not a routing configuration.

## Sequence and evidence

| Phase | Required work | Acceptance evidence |
| --- | --- | --- |
| Inventory | Export mailbox/alias inventory, retention needs, existing records and delegations; confirm DNS and account owner. | Dated inventory, backup location and owner review. |
| Design | Map each address to owner, provider, recipient, reply policy and source scope; decide split delivery if needed. | Accepted configuration revision and decisions. |
| Prepare | Configure receiving mailboxes, access controls, aliases and authorized senders; verify provider-required domain records. | Provider record references and access review. |
| Pilot | Test an approved business and automated sender before shared-domain cutover. | Inbound, outbound, alias, Reply-To and inbound NoReply results. |
| Cutover | Follow the approved window and DNS/routing plan; retain old delivery path per agreed retention period. | Change timestamps, observed delivery and owner acceptance. |
| Stabilize | Monitor failures and replies, remove temporary admin access, confirm support ownership. | Post-cutover checks and access removal evidence. |

Use the chosen provider's current instructions for verification, MX, SPF, DKIM and DMARC values. Keep one SPF policy per domain and include only authorized senders. Check alignment and authentication in received headers; stage DMARC enforcement according to the accepted inventory. Do not infer successful delivery from DNS alone.

For each public alias send an external message and verify the expected business's Chef receives it without a loop or cross-client delivery. Test Chef and Info directly, outbound replies, automated sender authentication, Reply-To, and chosen NoReply inbound behavior. Include attachments or client workflows when intake requires them.

## Recovery and offboarding

Before changing shared DNS, retain old records, provider configuration, export/backup references, rollback trigger, rollback owner and a restoration test plan. DNS restoration alone cannot undo messages already delivered or migrated. Reconcile queues, duplicate delivery and retained data after recovery.

Record temporary provider access expiry. Transfer domain, mailbox, recovery and billing ownership to named accepted owners; revoke temporary sessions/delegations and test recovery access. Store credential references outside this kit. Record retention and deletion decisions for each client separately.
