# SYSTEMX Security Overview

Security in SYSTEMX is a continuous operating discipline. The baseline supports
checks and documentation, but the application owner must configure and verify
the controls that protect their particular users and data.

## Control expectations

- Use least privilege for Google Cloud IAM, Firebase administration, repository
  access, CI credentials, and service accounts.
- Design Firestore and Storage Security Rules around authenticated identity,
  ownership, roles, and explicit denial—not around trusted client behavior.
- Keep privileged operations server-side. Browser-delivered `VITE_*` values are
  public configuration, not a place for secrets.
- Require review and tests for authentication, authorization, rules, payment,
  upload, and data-export changes.
- Use protected branches, dependency updates, monitoring, audit trails, and a
  tested rollback and incident process.
- Review third-party SDKs, MCP servers, browser extensions, and agent access as
  part of the application’s supply chain.

Run the available project checks before release:

```bash
npm run ci:lint
npm run typecheck
npm run test
npm run ci:security
npm run sync:system:check
```

Passing checks is evidence, not a guarantee. See [Security](Security),
[.ENV Solutions](SYSTEMX-Environment-Solutions), and
[Third-Party & Operator Responsibility](SYSTEMX-Third-Party-and-Operator-Responsibility).
