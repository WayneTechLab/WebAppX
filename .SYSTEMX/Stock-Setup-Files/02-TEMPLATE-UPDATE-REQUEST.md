# 02 Template Update Request

Use this file to ask an LLM to produce an updated version of the template.

## Request

Update Web Stack Generation with the following goal:

```text
<describe the requested update>
```

## Scope

- Target: template / project generated from template / `.SYSTEMX` only / docs
  only / scripts only
- Edition: Enterprise / Business / Consumer / WSGT / WSGD / all
- Must update root app: yes / no
- Must update `.SYSTEMX/Template/starter`: yes / no
- Must update wiki/docs: yes / no
- Must update setup scripts/menu: yes / no
- Must update design/media/content standards: yes / no
- Must preserve backwards compatibility: yes / no

## Constraints

- Keep template generic.
- Keep local `.SYSTEMX` scripts canonical.
- Keep local npm scripts and `.SYSTEMX` checks as the canonical verification path.
- Do not remove legacy `.SYSTEMX/Template/steps/00-12`; mark old flows as
  legacy when superseded.
- Prefer warnings/placeholders over hard failures for optional integrations.

## Desired Output

The LLM should return:

- Summary of changes
- Files changed
- Commands run
- Checks passed or failed
- Any assumptions
- Next actions
