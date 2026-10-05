# 04 Edition And Modules

Web Stack Generation supports five editions.

## Editions

| Edition | Purpose | Page Cap |
| --- | --- | --- |
| Enterprise | All options for production-grade systems | No template cap |
| Business | Selected business-tier options | 100 pages |
| Consumer | Standard web app or commerce web app | 50 pages |
| WSGT | Test fork for standard tooling, MCP, CI, and template validation | Test-defined |
| WSGD | Dev fork for local development tooling and future standards | Dev-defined |

## Standard Modules

- Pages and route registry
- Auth and account levels
- Unified Login
- Firebase Hosting
- Firestore
- Storage
- Functions
- Commerce and Stripe
- Email/sender provider
- SEO and analytics
- CI/CD
- MCP/dev tooling
- Security checks
- Monitoring and alerts
- Docs and runbooks
- Repo-learning scrape

## Resolution Rules

- Enterprise enables all reusable modules.
- Business enables auth, business pages, optional commerce, forms, Firebase,
  CI/CD, monitoring, security, and docs.
- Consumer enables marketing pages, optional commerce, Firebase, optional auth,
  CI/CD, security, and deploy docs.
- WSGT validates template/tooling changes before promotion.
- WSGD stages experiments and future standards.

Do not copy app-specific business modules into the template. Convert durable
patterns into generic modules, placeholders, or docs.

