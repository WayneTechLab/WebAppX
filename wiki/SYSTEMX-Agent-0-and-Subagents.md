# Agent 0 and Subagents

This page is the hub for the SYSTEMX coordination model.

Use these pages together:

- [Agent 0 Operating Model](SYSTEMX-Agent-0-Operating-Model)
- [How Subagents Work](SYSTEMX-How-Subagents-Work)
- [Starter Prompts and Smart Routing](SYSTEMX-Starter-Prompts-and-Smart-Routing)

## Core model

Agent 0 is the accountable coordinator. Subagents are bounded workers. Agent 0
keeps the wide view of the mission, assigns lanes, collects evidence, and owns
integration and release decisions. Subagents work inside narrow scopes and
report back in compact packets.

## Why SYSTEMX separates the roles

- Agent 0 protects the wide mission context.
- Subagents reduce parallel research or implementation time.
- `.SYSTEMX` keeps the durable record outside ephemeral chat history.
- The local message bus helps long missions stay compact and replayable.

## Working order

1. Read the mission and lane state in `.SYSTEMX/status/`.
2. Let Agent 0 assign a bounded wave and lane.
3. Use subagents only when a narrow lane benefits from parallel work.
4. Route work to the cheapest effective tool first: scripts, CLI, local files,
   SDKs, APIs, MCP, then broader LLM reasoning only when needed.
5. Archive old coordination traffic so token drag stays low over time.
