# Step 06 — Bootstrap Tooling And Environment

## Goal
Required CLIs and local dependencies for the selected edition are installed and
authenticated.

## Actions
- Run `.SYSTEMX/scripts/bootstrap.sh --check`.
- For full setup, run `.SYSTEMX/scripts/bootstrap.sh --with-stripe --with-mcp --interactive-login`.
- Install/auth missing tools according to the edition manifest.
- Include Chrome DevTools MCP plus Firebase/GCloud/Stripe MCP placeholders for WSGT, WSGD, and Enterprise when selected.
- When login/email is enabled, capture whether sender email is Google Workspace,
  Microsoft 365, or other SMTP, and whether DNS is GoDaddy or another provider.
- Keep Google/Firebase as the default platform path unless the intake answers
  select a different provider.
- Pause for the human to complete each browser/terminal login before verification continues.

## Gate
Required tools report versions, auth state is known, and MCP launch paths are documented.
