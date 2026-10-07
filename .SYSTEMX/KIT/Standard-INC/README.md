# Generic portfolio template

All values are editable examples, not configured accounts.

## Customization

| Replace | Generic value | Editing rule |
|---|---|---|
| Parent and primary brand | Example Industries INC. / Example Kitchen LLC. | Replace names, folder slugs and email suffix consistently. |
| Other brands | Brand One / Brand Two / Brand Three | Replace names, slugs, suffixes and subdomains. |
| Shared domain | example.com | Replace throughout. All brand email addresses use this domain. |
| Hosting prefix | prefix | Replace in Firebase targets; verify site availability and project association. |
| Temporary mail host | TEMP-HOST.example.com | Enter the actual host providing temporary administrative access. |
| Access provider / owner | SERVICE-PROVIDER.example.com | Enter the provider/owner; record migration ownership. |
| Future mail platforms | Google Enterprise / Workspace and Microsoft 365 | Select the receiving-mail system per mailbox and verify routing. |

## Website matrix

| Company / project | Website | Firebase Hosting naming target | Future standalone .com |
|---|---|---|---|
| Example Industries INC. | industries.example.com | prefix-example-industries.web.app | Deferred / choose later |
| Example Kitchen LLC. | example.com | prefix-example-kitchen.web.app | Deferred / choose later |
| Brand One LLC. | brandone.example.com | prefix-brand-one.web.app | Deferred / choose later |
| Brand Two LLC. | brandtwo.example.com | prefix-brand-two.web.app | Deferred / choose later |
| Brand Three LLC. | brandthree.example.com | prefix-brand-three.web.app | Deferred / choose later |

## Email matrix

| Role | Example Industries INC. | Example Kitchen LLC. | Brand One LLC. | Brand Two LLC. | Brand Three LLC. |
|---|---|---|---|---|---|
| Info | Info-Example-Industries@example.com | Info@example.com | Info-Brand-One@example.com | Info-Brand-Two@example.com | Info-Brand-Three@example.com |
| Chef | Chef-Example-Industries@example.com | Chef@example.com | Chef-Brand-One@example.com | Chef-Brand-Two@example.com | Chef-Brand-Three@example.com |
| Support | Support-Example-Industries@example.com | Support@example.com | Support-Brand-One@example.com | Support-Brand-Two@example.com | Support-Brand-Three@example.com |
| Contact | Contact-Example-Industries@example.com | Contact@example.com | Contact-Brand-One@example.com | Contact-Brand-Two@example.com | Contact-Brand-Three@example.com |
| Billing | Billing-Example-Industries@example.com | Billing@example.com | Billing-Brand-One@example.com | Billing-Brand-Two@example.com | Billing-Brand-Three@example.com |
| Social | Social-Example-Industries@example.com | Social@example.com | Social-Brand-One@example.com | Social-Brand-Two@example.com | Social-Brand-Three@example.com |
| Partner | Partner-Example-Industries@example.com | Partner@example.com | Partner-Brand-One@example.com | Partner-Brand-Two@example.com | Partner-Brand-Three@example.com |
| Party | Party-Example-Industries@example.com | Party@example.com | Party-Brand-One@example.com | Party-Brand-Two@example.com | Party-Brand-Three@example.com |
| Location-1001 | Location-1001-Example-Industries@example.com | Location-1001@example.com | Location-1001-Brand-One@example.com | Location-1001-Brand-Two@example.com | Location-1001-Brand-Three@example.com |
| NoReply | NoReply-Example-Industries@example.com | NoReply@example.com | NoReply-Brand-One@example.com | NoReply-Brand-Two@example.com | NoReply-Brand-Three@example.com |

## Routing

| Address type | Routing rule |
|---|---|
| Support, Contact, Billing, Social, Partner, Party, Location-1001 | Forward to the Chef mailbox in the same project column. |
| Info | Administrative mailbox, separate from public forwarding; configure administrative privileges separately. |
| Chef | General public mailbox; receives the matching brand's inbound aliases. |
| NoReply | Automated sender. Set Reply-To to the matching Chef mailbox. Decide and document inbound handling separately. |

## Drive layout

```text
PROJECT ROOT/
|-- .SYSTEMX/
|   |-- existing shared logic, AI/, status/ and source references
|   '-- .SYSTEMXP/
|       |-- README.md | PROJECT_INDEX.json | TASK_TEMPLATE.md
|       |-- example-industries/ [PROJECT.json, WORK_LOG.md, DECISIONS.md]
|       |-- example-kitchen/    [same control files]
|       |-- brand-one/          [same control files]
|       |-- brand-two/          [same control files]
|       '-- brand-three/        [same control files]
'-- Example Industries INC./
    |-- README_PORTFOLIO.md | WEBSITE_REGISTRY.json | EMAIL_REGISTRY.json
    |-- SYSTEMX_INHERITANCE.md | README.md | design.md | website.md
    |-- .SYSTEMXP.md [pointer to the corporate central record]
    |-- assets/ [corporate master logo]
    |-- Example Kitchen LLC./
    |-- Brand One LLC./
    |-- Brand Two LLC./
    '-- Brand Three LLC./
        Each restaurant: README.md, design.md, website.md, .SYSTEMXP.md,
        assets/master-logo.png; pointer links to its central record.
```

## Checklist

| Checklist item | Evidence | Status |
|---|---|---|
| Drive folders and controls | Folder IDs, shared rules link, index, work log and decisions | Not started |
| Brand and website plan | Original logo, design.md, domain and Hosting project/site mapping | Not started |
| Email accounts and aliases | Info/Chef, seven forwarding aliases, NoReply sender and Reply-To tests | Not started |
| DNS and delivery verification | Web DNS/TLS; mail records; inbound/outbound and forwarding tests | Not started |
| Release and future .com migration | Approval, redirect/canonical plan, migration ownership and rollback | Not started |

## Concurrent work

Unique task ID; project ID; sponsor/reviewer; writer; allowed files; baseline revisions; advisory claim; status; sources; assumptions; output versions; evidence; open decisions; rollback; start/completion timestamps. Separate drafts, one writer per file, re-read before commit. This is documentation, not automatic locking.
