# Third-Party Services and Operator Responsibility

WTL WebApp Stack G1 integrates patterns and optional tooling around third parties such
as GitHub, Google Cloud, Firebase, npm, Stripe, Microsoft, browsers, MCP
servers, and AI providers. Each service has its own terms, pricing, availability,
security model, regional behavior, and change schedule. Wayne Tech Lab LLC does
not control those services and provides no warranty, SLA, managed support, or
guarantee that they meet a particular project’s requirements.

Use this template at your own risk and in accordance with applicable local laws,
contracts, standards, and organizational policies. The operator must produce,
secure, test, monitor, maintain, and update their own codebase and cloud
configuration. That includes, at minimum:

- validating dependencies and third-party access;
- configuring IAM, authentication, Security Rules, secrets, backup, and recovery;
- protecting user data and meeting privacy, accessibility, tax, licensing, and
  sector obligations;
- controlling cloud cost, domains, deployment approvals, and incident response;
- reviewing all AI-generated or agent-produced changes before use; and
- maintaining records, release notes, and a rollback plan.

The repository license governs the code. Preserve required license and copyright
notices for all components you use. Wayne Tech Lab LLC requests attribution when
this template is used as the foundation of a project. Fork, clone, and copy only
after performing your own technical, security, and legal review.
