# MCP and Agents

Root `AGENTS.md` is the canonical repository instruction map. Drift-checked
adapters cover Claude Code, Gemini CLI, GitHub Copilot, Cursor, Windsurf, Cline,
Continue, Junie, and Amazon Q.

`CODEX.md`, `CoPilot.md`, and `GPT.md` are intentionally not created because
they are not the recognized repository standards. Codex uses `AGENTS.md`,
GitHub Copilot uses `.github/copilot-instructions.md`, and Gemini CLI uses
`GEMINI.md`.

Run `npm run mcp:chrome -- --help` to inspect the optional Chrome DevTools MCP
adapter, and use `npm run browser:install` plus `npm run browser:codegen` for
the Playwright browser lane. Firebase, Google Cloud, and Stripe adapters are
opt-in provider integrations, not automatic package scripts in this revision.
Use local or staging resources and no production secrets.
Google Cloud remote MCP and Stripe MCP are not enabled automatically; review
provider authentication, scopes, account/project target, and audit controls.

Subagents multiply token, tool, and review usage. Assign disjoint files, finite
objectives, least privilege, no secrets, and mandatory report-backs. The parent
agent owns integration, tests, security review, and publication.
