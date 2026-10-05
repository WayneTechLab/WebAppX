# WebApp Stack G One Point Zero — Master Playbook

> The single source of truth for **what** this stack is, **why** each piece
> exists, and **which generic use cases** it is designed to cover. Read this
> first. Then execute the ordered steps in [`steps/`](./steps/).

> ⚡ **Just want a running app?** Skip the full build and use the prebuilt
> [`starter/`](./starter/) folder (or the live GitHub template
> [`WayneTechLab/WebAppX`](https://github.com/WayneTechLab/WebAppX)).
> It already contains Steps 02 (scaffold) and the skeletons for 03/04/07/09/11.
> Use this playbook when you need the *full* path: provisioning, Stripe, Cloud
> Functions, secrets, testing, and monitoring.

---

## 1. Purpose

Build the **same class of web application repeatably**: a marketing + product
site with authentication, a database, file storage, a serverless backend,
optional payments, CI/CD, automated testing, monitoring, and an AI-agent-friendly
toolchain — without re-deciding the architecture each time.

This document is **generic**. Anywhere you see `${PLACEHOLDER}`, the value is
supplied by the operator during [Step 01 — Interview](./steps/01-project-interview.md).

> New modular setup path: use
> [`../Unified-Setup-Process/README.md`](../Unified-Setup-Process/README.md)
> for edition-aware setup across Enterprise, Business, Consumer, WSGT, and
> WSGD. The ordered steps below remain the legacy golden-path source material.
> Human/AI collaboration follows
> [`@@CODER.SatoshiUNO`](../Unified-Setup-Process/standards/@@CODER.SatoshiUNO.md).
> The base starter visual system follows
> [`WSG-Basic-Visual-Baseline`](../Unified-Setup-Process/standards/WSG-Basic-Visual-Baseline.md):
> black, white, and neutral gray only.
> Access, Firebase claims, emulator users, and Playwright auth fixtures follow
> [`WSG-Account-Levels`](../Unified-Setup-Process/standards/WSG-Account-Levels.md).
> Provider-aware login, sender email, Microsoft 365, GoDaddy DNS, and Stripe
> setup follow [`Unified-Login`](../Unified-Setup-Process/standards/Unified-Login.md).

---

## 2. Generic use cases this stack covers

Any of these can be built on the identical baseline. The Interview step selects
which **modules** to enable so you only scaffold what you need.

### 2.1 Core application shapes
- **Marketing / brochure site** — fast static-first pages, SEO, sitemap, OG tags.
- **SaaS product front-end** — authenticated dashboard, role-based access (RBAC).
- **E-commerce / digital goods** — product catalog, Stripe Checkout, receipts.
- **Membership / subscription** — recurring billing, customer portal, entitlements.
- **Internal admin console** — privileged dashboards, audit logs, feature flags.
- **Content / docs portal** — markdown rendering, search, versioned content.
- **Lead-gen / forms platform** — validated forms, anti-spam, email notifications.
- **Booking / scheduling** — availability, intake forms, confirmation emails.

### 2.2 Cross-cutting capabilities (toggled per project)
- **Authentication** — email/password, OAuth providers, MFA enforcement.
- **Authorization** — custom claims, role gates, route guards, callable checks.
- **Data** — Firestore collections, security rules, composite indexes.
- **File handling** — Storage uploads with rules + virus/content guards.
- **Payments** — one-time + subscriptions, webhooks, idempotency.
- **Transactional email** — receipts, verification, notifications.
- **Background jobs** — scheduled functions (cron), queue-driven tasks.
- **Observability** — error tracking (Sentry), structured logging, tracing.
- **Compliance/security headers** — CSP, HSTS, COOP, frame-ancestors, etc.
- **SEO + discoverability** — sitemap.xml, robots.txt, structured data.
- **PWA / offline** — manifest, service worker (optional).
- **Internationalization** — locale routing + message catalogs (optional).
- **Agent automation** — Chrome DevTools MCP for UI validation in CI/dev.

### 2.3 Operational use cases
- **One-command deploy** to Firebase Hosting + Functions.
- **Preview / staging channels** for PR review.
- **Secret rotation** workflow (client config vs. server secrets).
- **Disaster recovery** — Firestore export/backup, rules versioning.
- **Cost guardrails** — budget alerts, usage caps on functions.

---

## 3. The reference stack (versions are pinned baselines, bump deliberately)

### 3.1 Language & framework
| Tool | Baseline | Why |
| --- | --- | --- |
| TypeScript | `~5.9` | Strict types across app, functions, scripts. |
| React | `^19` | Component model; concurrent features. |
| Local router | template-owned | Basic client navigation without an external router dependency. |

### 3.2 Build & styling
| Tool | Baseline | Why |
| --- | --- | --- |
| Vite | `^8` | Dev server + Rolldown/Rollup-compatible production build. |
| `@vitejs/plugin-react` / `-swc` | latest | JSX transform; SWC for speed. |
| Tailwind CSS | `^4` | Utility styling via `@tailwindcss/vite`. |
| Radix UI primitives | latest | Accessible, unstyled components. |
| `lucide-react` / `@phosphor-icons/react` | latest | Icon sets. |

### 3.3 Backend / platform
| Tool | Baseline | Why |
| --- | --- | --- |
| Firebase (web SDK) | `^12` | Auth, Firestore, Storage, RTDB, Analytics. |
| `firebase-admin` | `^13` | Privileged server SDK in functions. |
| Cloud Functions runtime | `nodejs22` | Serverless backend + webhooks + cron. |
| Google Cloud (`gcloud`) | latest | Underlying platform, IAM, billing, logs. |

### 3.4 Payments & comms (optional modules)
| Tool | Baseline | Why |
| --- | --- | --- |
| Stripe JS (`@stripe/stripe-js`) | `^8` | Client checkout. |
| Stripe (server, via functions) | latest | Webhooks, customers, subscriptions. |
| Email provider (SMTP/API) | provider-specific | Transactional email. |

### 3.5 Quality, testing, observability
| Tool | Baseline | Why |
| --- | --- | --- |
| Vitest + Testing Library | `^4` / latest | Unit + component tests. |
| Playwright | `^1.6x` | E2E + visual/a11y audits. |
| ESLint (flat config) | `^9` | Linting; `--max-warnings=0` in CI. |
| Sentry (`@sentry/react`) | `^10` | Error + performance monitoring. |
| `@firebase/rules-unit-testing` | `^5` | Firestore/Storage rules tests. |

### 3.6 Required CLIs (host machine)
| CLI | Install | Verified in step |
| --- | --- | --- |
| Node.js + npm (LTS, ≥ 20; 22 recommended) | nvm / installer | 00 |
| Git | OS package | 00 |
| GitHub CLI (`gh`) | `brew install gh` | 00 |
| Google Cloud CLI (`gcloud`) | Google installer | 00 |
| Firebase CLI (`firebase-tools`) | `npx --yes firebase-tools` or global `firebase` | 00 |
| Stripe CLI (`stripe`) | `brew install stripe/stripe-cli/stripe` | 00 (optional) |
| Chrome DevTools MCP | `npx chrome-devtools-mcp` | 08 (optional) |

---

## 4. Project layout produced by this template

```
<repo-root>/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js / theme via @tailwindcss/vite
├── eslint.config.js
├── vitest.config.ts  /  vitest.setup.ts
├── playwright.config.ts
├── firebase.json
├── firestore.rules / firestore.indexes.json
├── storage.rules / database.rules.json
├── .env.example                ← from templates/env.template
├── .secrets.env.example        ← from templates/secrets.env.template
├── public/                     ← robots.txt, sitemap.xml, manifest, icons
├── src/
│   ├── main.tsx / App.tsx
│   ├── config/                 ← firebase.ts, seo.ts, navigation.ts
│   ├── components/  hooks/  lib/  pages/  data/  types/  styles/
│   └── __tests__/
├── functions/
│   ├── package.json / tsconfig.json
│   └── src/                     ← index.ts, payments, email, scheduled jobs
├── tests/                       ← Playwright specs
└── scripts/                     ← deploy, security, seed helpers
```

---

## 5. Environment variable contract

Two tiers — never mix them.

### 5.1 Client tier (`VITE_*`) — shipped to the browser, **public by design**
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_STRIPE_PUBLISHABLE_KEY        # optional billing module
VITE_STRIPE_PRICE_*                # one per price/SKU
VITE_FUNCTIONS_BASE_URL            # callable/HTTP function host
VITE_SENTRY_DSN                    # optional monitoring
VITE_ENVIRONMENT                   # development | staging | production
```
> ⚠️ A Firebase web API key is **not** a secret — it identifies the project and
> is protected by Security Rules + App Check, not by hiding it. Server secrets
> are different (next tier).

### 5.2 Server tier (`secrets.env` / Functions config) — **never** in client bundle
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
EMAIL_API_KEY / SMTP_PASSWORD
SERVICE_ACCOUNT_JSON (or ADC)
ADMIN_BOOTSTRAP_TOKEN
```
Stored via `firebase functions:secrets`, local secret stores, or GCP Secret Manager — **never** committed.

---

## 6. Security baseline (non-negotiable defaults)

- **Security headers** on hosting: CSP, HSTS (preload), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP.
- **Firestore/Storage rules** deny-by-default; tested with rules unit tests in CI.
- **RBAC** via custom claims; privileged callables verify claims server-side.
- **MFA enforcement** option for admin roles.
- **Secrets** never in the repo; `.env*` and `*secrets*` are git-ignored.
- **Dependency audit** (`npm audit`) + secret scanning in CI.
- **App Check** recommended for production to gate Firebase backends.
- **Stripe webhooks** verify signatures + use idempotency keys.

OWASP Top 10 is the checklist; every step's `🔒 Security notes` maps back here.

---

## 7. Execution order (the ordered steps)

Run these **in sequence**. Each links to its detailed file. Do not advance past a
failed verification gate.

| # | Step | Produces | Gate |
| --- | --- | --- | --- |
| 00 | [Prerequisites](./steps/00-prerequisites.md) | All CLIs installed & authed | `--version` checks pass |
| 01 | [Project interview](./steps/01-project-interview.md) | `interview.answers` file | All required answers captured |
| 02 | [Scaffold](./steps/02-scaffold.md) | App skeleton builds | `npm run build` succeeds |
| 03 | [Firebase provision](./steps/03-firebase-provision.md) | Project + web config | `npx --yes firebase-tools use` resolves |
| 04 | [Env & secrets](./steps/04-env-and-secrets.md) | `.env` wired, secrets stored | App boots with config |
| 05 | [Stripe](./steps/05-stripe.md) *(optional)* | Products, prices, webhook | Test charge succeeds |
| 06 | [Cloud Functions](./steps/06-cloud-functions.md) | Deployed functions | Callable returns 200 |
| 07 | [Security rules](./steps/07-security-rules.md) | Rules + tests green | Rules unit tests pass |
| 08 | [MCP servers](./steps/08-mcp-servers.md) *(optional)* | Chrome MCP wired | Agent can drive a page |
| 09 | [CI/CD](./steps/09-ci-cd.md) | Local verification + repo secrets | Local checks green |
| 10 | [Testing & QA](./steps/10-testing-qa.md) | Unit + e2e suites | Full suite green |
| 11 | [Build & deploy](./steps/11-build-deploy.md) | Live hosting URL | Smoke test passes |
| 12 | [Post-launch](./steps/12-post-launch.md) | Monitoring + runbook | Alerts firing to a channel |

---

## 8. Decision matrix — what to ask the operator

The Interview (Step 01) gathers these. Summarized here so the master playbook is
self-contained.

| Decision | Options | Default |
| --- | --- | --- |
| Project type | brochure / SaaS / e-commerce / membership / admin / docs | SaaS |
| Display name | free text | — |
| Slug / package name | kebab-case | derived from name |
| Primary domain | FQDN or `*.web.app` | `${slug}.web.app` |
| GCP region | `us-west1`, `us-central1`, `europe-west1`, … | `us-west1` |
| Firebase project | create new / use existing | create new |
| Auth providers | email, google, github, apple… | email + google |
| Billing module | yes / no | no |
| Email module | yes / no + provider | no |
| Monitoring (Sentry) | yes / no | yes |
| MCP automation | yes / no | no |
| CI/CD host | Local verification / Firebase deploy | Local verification |

---

## 9. "Convert a Firebase project from the web console" — what to capture

When the operator already created (or will create) the Firebase project in the
console, capture the **web app config** object. In the Firebase console:
**Project settings → General → Your apps → SDK setup & config (Config)**. It
yields exactly the `VITE_FIREBASE_*` values in §5.1. Step 03 walks this in detail
and also supports creating the project headlessly via `firebase projects:create`.

---

## 10. Definition of done

The build is complete when the unified intake is complete, the legacy gates pass,
and:
- The site is reachable at the chosen domain over HTTPS with security headers.
- Auth, data reads/writes, and (if enabled) a test payment work end-to-end.
- CI is green and blocks merges on lint/type/test failures.
- Errors report to the monitoring channel and a runbook exists.
- No secret values exist in the repo history.

Proceed to [Step 00 — Prerequisites](./steps/00-prerequisites.md).
