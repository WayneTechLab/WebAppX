# First-Time Setup Intake

These files are the pause-and-fill packet for a new project created from the
template. The setup scripts now package this intake into one setup zip after OS,
stack-mode, and edition selection.

## Fill Order

1. [`01-PROJECT-BRIEF.md`](./01-PROJECT-BRIEF.md)
2. [`02-EDITION-MODULES.md`](./02-EDITION-MODULES.md)
3. [`03-PAGES-ROUTES.md`](./03-PAGES-ROUTES.md)
4. [`04-DATA-AUTH-SECURITY.md`](./04-DATA-AUTH-SECURITY.md)
5. [`05-INTEGRATIONS-DEPLOY.md`](./05-INTEGRATIONS-DEPLOY.md)
6. [`07-MASTER-PLAN.md`](./07-MASTER-PLAN.md)
7. [`08-INSTRUCTIONS-AND-CONSTRAINTS.md`](./08-INSTRUCTIONS-AND-CONSTRAINTS.md)
8. [`09-BUSINESS-PLAN.md`](./09-BUSINESS-PLAN.md)
9. [`10-FIRST-PHASE-TODO.md`](./10-FIRST-PHASE-TODO.md)
10. [`11-PROJECT-ARCHITECTURE.md`](./11-PROJECT-ARCHITECTURE.md)
11. [`12-FRONTEND-UI-UX-PLAN.md`](./12-FRONTEND-UI-UX-PLAN.md)
12. [`13-BACKEND-DATA-INTEGRATION-PLAN.md`](./13-BACKEND-DATA-INTEGRATION-PLAN.md)
13. [`14-SECURITY-OPERATIONS-PLAN.md`](./14-SECURITY-OPERATIONS-PLAN.md)
14. [`15-LAUNCH-POST-LAUNCH-PLAN.md`](./15-LAUNCH-POST-LAUNCH-PLAN.md)
15. [`06-AI-REINJECTION-PROMPT.md`](./06-AI-REINJECTION-PROMPT.md)

After filling the files, paste or reference `06-AI-REINJECTION-PROMPT.md` in the
AI/code tooling session so the next pass can continue setup from durable project
context instead of chat memory.

## Version History

Each setup script run should append a one-line event to
`.SYSTEMX/logs/setup-history.jsonl`. Keep assumptions and decisions in markdown;
keep live secrets in provider secret stores or ignored env files only.
