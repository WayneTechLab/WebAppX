# Step 12 — CI, MCP, QA, And Automation

## Goal
Quality gates, MCP validation, security checks, and WSG-AGI sync are wired.

## Actions
- Run `npm run sync:system:check`.
- Confirm CI calls npm scripts rather than duplicating logic.
- Configure Chrome DevTools MCP validation loops for Enterprise, WSGT, and WSGD as needed.
- Keep Firebase, Google Cloud, and Stripe MCP adapters as project-approved placeholders unless the selected project has a vetted adapter package.
- Standardize Playwright auth fixtures around Level 0-5 identities from
  [`WSG Account Levels`](../standards/WSG-Account-Levels.md).
- Use local Firebase emulators for account-level tests before touching live
  projects.
- Include `npm run auth:mfa:check` in local security gates before enabling
  private/admin surfaces.
- Validate popup and redirect login paths with Chrome/Playwright where the
  edition enables Unified Login.

## Gate
CI command list is known and local gates are runnable.
