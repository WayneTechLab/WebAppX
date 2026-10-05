# Agent Mesh And Tooling Standard

This page documents the generic SYSTEMX standard for Agent 0, subagent lanes,
browser automation, MCP tooling, desktop control, external service connectors,
and recovery paths.

The public template keeps this vendor-neutral. Project-specific providers,
customer workflows, private dashboards, and proprietary adapter logic belong in
the project using the template, not in the template itself.

## Canonical Source

The canonical files live under `.SYSTEMX/AI/`:

| File | Purpose |
| --- | --- |
| `.SYSTEMX/AI/AGENT-MESH-STANDARD.md` | Agent 0, subagent lanes, message bus, checkpoint, memory, and archive rules. |
| `.SYSTEMX/AI/TOOLCALLING-AND-BROWSER-AUTOMATION.md` | Playwright, Chrome DevTools MCP, local browser control, and desktop fallback rules. |
| `.SYSTEMX/AI/EXTERNAL-SERVICE-CONNECTOR-STANDARD.md` | Generic adapter pattern for outside services, SDKs, CLIs, dashboards, and webhooks. |
| `.SYSTEMX/AI/RECOVERY-PLAYBOOK.md` | Popup, permission, auth, port, process, and apply/blocker recovery paths. |
| `.SYSTEMX/AI/agent-mesh.schema.json` | Minimal machine-readable schema for durable agent messages. |

Run the standard check locally:

```bash
npm run ai:standard:check
```

## Agent 0 Pattern

Agent 0 is the coordinator. It owns the mission, chooses lanes, reviews
evidence, decides when to archive, and asks the operator for credentials,
production approval, paid-service actions, or ambiguous account decisions.

Subagents are scoped lanes, not hidden authority. Use lanes such as `research`,
`code`, `test`, `browser`, `desktop`, `connector`, `security`, `docs`, and
`release`.

Every durable checkpoint should include mission ID, wave ID, lane, sender,
receiver, status, summary, evidence, blockers, next action, and creation time.

## Browser And MCP Loop

Use this local-first route:

```bash
npm run dev
npm run browser:install
npm run browser:codegen
npm run mcp:chrome
```

Use Playwright for repeatable browser flows and Chrome DevTools MCP for live
DOM, console, network, and screenshot evidence. Keep these pointed at localhost,
emulators, or staging by default.

## Apple Silicon And Desktop Automation

On macOS Apple Silicon, automation must account for app permissions, Keychain
prompts, GUI shell `PATH`, browser auth windows, and Accessibility API shape.

The standard is:

- prefer browser-first auth when a native auth presenter stalls
- make local UI labels bounded and meaningful for screen tools
- avoid recursive accessibility dumps
- stop and replace only the process owned by this repo/session
- keep secrets in OS keychain or ignored env files
- never click through paid, destructive, or permission-escalation prompts

## External Connector Pattern

Treat every outside service as a connector with mode, auth method, allowed
read-only actions, write actions requiring preflight, secret names only, webhook
events, evidence expectations, and deny reasons.

This lets projects add vendor SDKs, dashboards, and APIs without teaching the
public template private business logic.

## Recovery Ladder

When automation hits a popup, stalled apply operation, blocked browser flow, or
unknown prompt:

1. Capture URL, visible text, screenshot, command, and logs.
2. Classify the blocker.
3. Try the lowest-risk alternate route.
4. Record a dead-letter entry if the lane cannot continue.
5. Ask the operator when the next step involves credentials, production state,
   paid services, or unclear account ownership.

Dead-letter entries are part of the standard. They prevent Agent 0 and future
subagents from wasting tokens rediscovering the same blocker.

## Standalone integration in this unified template

The current universal tools, docs, examples and MEDIA library are retained in
`.SYSTEMX/.systemx/releases/<selected-version>/`. `INSTALLATION.json` selects and
pins that release; `SYSTEMX.sh` routes to it. Outer `GLOBAL`, `PLAN`, `WORK`,
`MEMORY` and `AGENTS` ship reusable records; `project.json` supplies host
commands and checks to configure for the adopted project. Import receipts
live in `.SYSTEMX/imports/`; manager runtime receipts remain ignored under
`.SYSTEMX/.systemx/operations/`. Historical LAN status and feature evidence retain
their original scope. See [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration).
