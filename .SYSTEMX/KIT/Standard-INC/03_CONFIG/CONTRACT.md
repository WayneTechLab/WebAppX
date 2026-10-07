# Portfolio configuration contract v1

[portfolio.blank.json](portfolio.blank.json) is a blank adoption seed. The runtime SYSTEMX project registry is a different schema and remains manager-owned.

[portfolio.example.json](portfolio.example.json) demonstrates the supplied five-business email recipe with illustrative owners/providers and no websites. Its forward-to-Chef NoReply policy is an example decision. It can pass structural validation while every account, approval and operational test remains unconfigured. Replace these examples only in an adopted private copy.

## Fields

| Field | Contract |
| --- | --- |
| schemaVersion | Exactly 1. |
| inc | id, legalName, owner, operationsProject; nonempty strings in an adopted plan. |
| sharedDomain | Lowercase DNS mail domain. |
| businesses | Nonempty array: id, name, kind (business, brand, client or project), project (registered name). IDs unique; distinct units have distinct projects. |
| mailboxes | Each has address, businessId, role (Info or Chef), owner and provider. Exactly one of each role per business. |
| aliases | Each has address, businessId, role and forwardsTo. Exactly the seven public roles per business; target is its Chef. |
| senders | Each has address, businessId, role (NoReply), owner, provider, replyTo, inboundHandling (monitored, forward-to-chef or reject). One per business. |
| websites | Optional array: businessId, hostname, hostingProjectId, hostingSiteId, hostingTarget, owner. Empty for email-only setup; fields are nonempty for a planned website. |
| migration | owner, sourceProvider, temporaryAdminHost, window, rollbackRef, approvalRef; nonempty for an adopted plan. Window includes date/time/timezone in prose; refs point to private adopted evidence/decisions. |

All email addresses use sharedDomain and are unique across mailbox, alias and sender records. Mail routing stays within each business. Shared domain/INC changes affect every unit and belong to the operations scope.

Info and Chef are routing-role identifiers inherited from the supplied recipe. The actual mailbox addresses may use the client's accepted naming, such as admin and hello; their local parts need not equal those role labels. This version validates the supplied seven-alias recipe. A different role set requires an explicitly versioned contract change rather than silently deleting required records.

## Validator guarantees and limits

The read-only validator rejects missing/unknown fields, invalid enums, duplicate addresses/IDs, orphan business references, cross-business routes, incomplete role sets and malformed canonical registry mappings. With `--registry`, it checks the selected project names exist; without it, registration is unverified.

Passing means the written plan is structurally consistent. It does not verify DNS, provider access, licenses, legal formation, data retention, actual delivery, Hosting availability, or owner acceptance. Retain those in [evidence](../04_TEMPLATES/EVIDENCE.md).

Keep live provider IDs and customer data private. No passwords, tokens, recovery codes or secret keys belong in this configuration. Registry examples in [EXAMPLE_PORTFOLIO](../EXAMPLE_PORTFOLIO.md) remain illustrative.
