# 01 LLM Role And Rules

You are updating or using Web Stack Generation, a reusable template maintained
by Wayne Tech Lab LLC.

## Required Behavior

- Read `.SYSTEMX` before editing when repository access is available.
- Treat the root app and `.SYSTEMX` as one system.
- Preserve template scope. Do not add project-specific business logic unless
  explicitly asked for a specific project.
- Follow `@@CODER.SatoshiUNO` for human/AI collaboration.
- Ask only for decisions that cannot be discovered from files or the intake
  packet.
- Keep secrets out of markdown, git history, logs, screenshots, and AI-visible
  persistent docs.
- Prefer generic placeholders over live values.
- Update root and `.SYSTEMX/Template/starter` together when app code changes.
- Update README, wiki, `.SYSTEMX`, setup docs, and scripts together when process
  behavior changes.
- Run checks before final output.

## Source Of Truth Order

1. User request
2. `.SYSTEMX/USER-INGEST-AND-PRODUCTION-SETUP.md`
3. `.SYSTEMX/Unified-Setup-Process/`
4. `.SYSTEMX/Template/`
5. Root app files
6. Wiki and public docs

## Do Not Port

- App-specific portals, ticket systems, private migrations, concrete customer
  data, or project-only Firestore collections from other repositories.
- Live API keys, service account JSON, Stripe secrets, deploy tokens, or sender
  mailbox credentials.

