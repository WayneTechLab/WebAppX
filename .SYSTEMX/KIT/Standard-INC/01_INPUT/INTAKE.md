# INC / client intake

Fill this in an adopted scope, not the source kit. Unknown required facts block the affected setup step.

| Required fact | Accepted value / source | Owner |
| --- | --- | --- |
| INC legal name, business ID, jurisdiction reference | | |
| Engagement client and sponsor; setup scope | | |
| Account/domain owner and migration approver | | |
| Operations project name; business/project boundaries | | |
| Shared mail domain and DNS control evidence | | |
| Current mail provider; temporary admin host and access expiry | | |
| Receiving provider per mailbox; current aliases and exports | | |
| Info administrative owner; Chef/public response owner | | |
| Automated sender owner; inbound NoReply decision | | |
| Client data access, retention and offboarding requirements | | |
| Migration window, timezone, support contact and rollback owner | | |
| Optional websites, Hosting project/site owner, approved logos | | |

## Decisions to accept

- Which entities are legal businesses and which are brands or engagements?
- Which independently managed unit needs a named SYSTEMXP scope?
- Is Info only an administrative contact mailbox, or does its named user also need provider admin rights? Record those separately.
- Are aliases sufficient, or are shared mailboxes, groups or licensed users required?
- Which project owns shared DNS/mail work and who accepts each business's delivery tests?
- What evidence establishes client permission and when must access be removed?

Use private adopted records for provider IDs and account references. Store secrets in the approved credential store; record references only.
