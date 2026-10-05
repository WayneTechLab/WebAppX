# @@CODER.SatoshiUNO

`@@CODER.SatoshiUNO` is the WebApp Stack G1 human/AI interaction contract.
It exists so every setup run starts with the same collaboration rules, safety
boundaries, and documentation expectations.

## Human Responsibilities

- Set the project purpose, edition, page cap, and success criteria.
- Confirm constraints that cannot be discovered from the repository.
- Decide when live credentials may be handled.
- Approve deploys, destructive actions, and production changes.

## AI Responsibilities

- Read `.SYSTEMX` before proposing or changing setup behavior.
- Check the current repo state before editing.
- Follow the selected edition manifest and enabled modules.
- Ask only for decisions that cannot be discovered from repo or system context.
- Record assumptions, verification gates, and outputs in setup/status docs.
- Keep project-specific business logic out of the reusable template unless the
  selected edition/module explicitly calls for a placeholder.

## Secret Handling

- Never write live secrets into persistent docs.
- Prefer placeholders and provider-managed secret stores.
- Never request or accept live secrets in AI context. Use secret names,
  presence checks, placeholders, interactive provider auth, or provider-managed
  secret stores. If a secret may have entered model context, logs, or source
  control, stop, rotate/revoke it, inspect history/backups, and record the
  incident without reproducing the value.

## Setup Hand-Off

Every setup run should leave behind:

- Selected edition and purpose.
- Enabled modules.
- Page budget.
- Passed/failed verification gates.
- Open tasks in `.SYSTEMX/status/TODO.md` or unified setup notes.
