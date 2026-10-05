# Step 08 — MCP Servers (optional agent tooling)

> Skip if `MCP=no`. Otherwise wire **Chrome DevTools MCP** so an AI agent can
> open, drive, screenshot, and validate the running app — locally and in CI.

## 🎯 Goal
An agent can launch the dev server, navigate pages, inspect the DOM/console, and
take screenshots through the Chrome DevTools MCP server.

## ✅ Preconditions
- Google Chrome installed (Step 00).
- App runs locally (`npm run dev`).
- An MCP-capable client (your IDE/agent) available.

## ❓ Operator prompts
1. Which agent/client will consume MCP (VS Code, Claude, etc.)?
2. Headless or headed Chrome for CI runs?
3. Any additional MCP servers needed (filesystem, GitHub, Playwright)?

## ⌨️ Commands

### Chrome DevTools MCP
```bash
# Runs the server on demand; no global install required:
npx chrome-devtools-mcp@latest --help
```

### Register with an MCP client (example: VS Code `.vscode/mcp.json`)
```jsonc
{
  "servers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

### Optional companion MCP servers
```jsonc
{
  "servers": {
    "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] },
    "github":     { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  }
}
```

### Typical agent loop (pseudocode)
```
1. start dev server (npm run dev)
2. MCP: navigate to http://localhost:5173/
3. MCP: assert no console errors; screenshot key pages
4. MCP: drive auth + a core flow; capture results
5. fail the task if assertions/screenshots regress
```

## 📄 Generated files
- `.vscode/mcp.json` (or the client-specific MCP config).
- Optional `scripts/agent-smoke.md` describing the agent validation loop.

## 🔒 Security notes
- Point MCP at **localhost / staging**, never production with real user data.
- Give MCP servers the **minimum** scope (no broad filesystem/root access).
- For the GitHub MCP server, use a **fine-grained PAT** with least privilege.
- Never let an agent commit secrets it discovers while inspecting pages.

## 🚦 Verification gate
```bash
npm run dev &                 # start the app
# Through your agent: navigate to the dev URL and capture a screenshot.
# ✅ Agent returns a screenshot + a "no console errors" assertion.
```
✅ Pass → proceed to [Step 09 — CI/CD](./09-ci-cd.md).
