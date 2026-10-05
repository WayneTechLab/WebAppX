# Starter Prompts and Smart Routing

This page gives starter prompt patterns for using Agent 0, subagents, and
`.SYSTEMX` together while working with LLMs, SDKs, CLI tools, MCP servers,
APIs, local scripts, and other tooling.

## Routing principle

For max token savings, route work to the cheapest reliable tool first:

1. Existing `.SYSTEMX` docs, status, and scripts
2. Local files and repository search
3. CLI or shell command with bounded output
4. SDK or direct API call for a specific known operation
5. MCP server when it is the right scoped connector
6. Broader LLM reasoning only after the cheaper surfaces have narrowed the task

Use subagents only when the task truly benefits from parallel bounded lanes.

## Starter prompt: Agent 0 mission setup

```text
Read .SYSTEMX/INSTALLATION.json and follow the selected release's START-HERE.md
and STANDARD.md. Load the outer project's GLOBAL/CONTEXT.md, PLAN/MASTER-PLAN.md,
MEMORY/PROJECT.md, WORK/TASKS.json and AGENTS/agent.0/MEMORY.md.
Use npm run systemx:context for the bounded resume packet. Continue the accepted
plan and ledger at the next incomplete step; preserve exact IDs and evidence.
Delegate only when authorized by the user and environment.
```

## Starter prompt: one bounded subagent lane

```text
You are a bounded subagent. Work only in the assigned lane and file scope.
Before editing, inspect current state and preserve unrelated changes. Report
back with status, files changed, checks run, blockers, and next smallest action.
Do not widen scope without an Agent 0 checkpoint.
```

## Starter prompt: docs + SYSTEMX alignment

```text
Update the implementation, then align README, .SYSTEMX docs, and the Wiki in
the same pass. Prefer existing scripts and status files before inventing new
structure. Keep output compact and operator-readable.
```

## Starter prompt: SDK / CLI / MCP / API routing

```text
Use smart routing for token savings. Check repository docs and scripts first,
then local files, then CLI, then SDK or direct API, then MCP only when it is
the right scoped connector. Use the LLM mainly to plan, summarize, verify, and
integrate evidence rather than to replace deterministic tooling.
```

## Starter prompt: long mission with bus + waves

```text
Operate in waves. Start by defining mission ID, wave ID, lane scopes, and exit
conditions. Use the canonical task ledger and scoped memory for compact checkpoint packets.
A message bus is an optional host integration, not a supplied runtime. Keep the live context focused on the
current wave only.
```

## Practical token-saving rules

- Do not ask the model to rediscover what `.SYSTEMX` already documents.
- Do not use broad browsing or giant file dumps when a targeted command works.
- Do not spawn subagents for trivial edits.
- Do not let every worker read the whole repo if only one surface matters.
- Archive old wave traffic into compact summaries.
- Reuse deterministic scripts and commands for repeated operations.

## Smart routing examples

- Use `rg` before asking an LLM where code lives.
- Read `.SYSTEMX/WORK/TASKS.json`, `WORK/FOCUS.json`, the generated `CURRENT.md`
  and selected agent memory for current project state. Legacy `.SYSTEMX/status/`
  pages retain the LAN feature roadmap rather than the canonical project ledger. A dedicated `wtl:bus` npm command is not part
  of the current package manifest; use the documented checkpoint format and
  keep any future bus adapter behind a tested contract.
- Use direct provider CLI or SDK for known deploy/status actions instead of
  explaining them from memory.
- Use MCP when a connected tool can safely answer the task with less manual
  token-heavy reasoning.
