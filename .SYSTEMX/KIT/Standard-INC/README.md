# Standard INC setup kit

Version 1.0.0. A reusable operating kit for a client or project that needs an INC parent, shared email, and multiple businesses or projects. It documents an existing or planned corporate structure; it does not form a legal entity.

Start with [the kit index](SYSTEMX-KIT-INDEX.md), then [intake](01_INPUT/INTAKE.md) and [setup](02_SETUP/SETUP.md). The [example portfolio](EXAMPLE_PORTFOLIO.md) illustrates names and routing. Copy the [blank configuration](03_CONFIG/portfolio.blank.json) into your adopted workspace; keep this source kit blank.

## What it delivers

- One INC owner and shared operating policy, with explicit client boundaries.
- A portfolio registry connecting legal entities, brands, projects, domains, and mailboxes.
- Named SYSTEMXP project scopes using the existing SYSTEMX project manager.
- An email ownership and routing plan, provider handoff, evidence, and rollback.
- Optional website and brand handoffs using existing kits and approved client assets.

## Scope decisions

| Situation | Setup |
| --- | --- |
| One INC, email only | INC operations scope; leave websites empty. |
| One INC, several businesses | INC operations scope plus one named scope per independently managed business. |
| Client engagement under an INC | Separate client scope and sources; document account owner and access expiry. |
| Several unrelated INCs | Use separate workspaces where access or retention differs; otherwise register separate operations scopes and name every shared resource owner. |
| No INC requirement | Use ordinary SYSTEMX PROJECTS; this kit is optional. |

[PROJECTS](../../docs/PROJECTS.md) is authoritative for project paths and command schemas. This kit's portfolio configuration is a separate business registry, never a replacement for SYSTEMX's project registry, task ledger, or installation metadata.

## Acceptance

Local validation checks the written plan. Operational acceptance requires recorded account access, routing tests, owner review, and a completed [handoff](04_TEMPLATES/HANDOFF.md). No service is provisioned by reading or validating the kit.
