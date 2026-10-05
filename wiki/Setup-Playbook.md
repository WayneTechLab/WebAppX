# Setup Playbook (Steps 00–12)

The full, ordered path from a bare machine to a deployed, monitored,
billing-enabled product. **Run the steps in sequence** — do not advance past a
failed verification gate. Later steps depend on artifacts produced earlier.

For new SYSTEMX work, the canonical planning layer is
`.SYSTEMX/Unified-Setup-Process/` and its intake/master-plan files. This wiki
page and `.SYSTEMX/Template/steps/00-12` are the detailed compatibility
playbook for the Firebase/Vite product path; they are not a second competing
roadmap for the LAN Builder. Use the LAN Builder Designer master plan for Designer
waves and this playbook for application setup/deploy gates.

> Source of truth:
> [`.SYSTEMX/Template/WEBAPP-STACK-G1.0.md`](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/Template/WEBAPP-STACK-G1.0.md)
> and the per-step guides in
> [`.SYSTEMX/Template/steps/`](https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/Template/steps).

## Ways to run it

| Mode | Entry point |
| --- | --- |
| **Scripted** (interactive) | `bash .SYSTEMX/Template/setup.sh` |
| **Guided (agent)** | Feed the agent `WEBAPP-STACK-G1.0.md`, then the `steps/` files one at a time |
| **Guided (human)** | Read the master playbook, work `steps/00` → `steps/12` by hand |

## The ordered steps

| # | Step | Produces | Verification gate |
| --- | --- | --- | --- |
| 00 | **Prerequisites** | All CLIs installed & authed | `--version` checks pass |
| 01 | **Project interview** | `interview.answers` file | All required answers captured |
| 02 | **Scaffold** | App skeleton builds | `npm run build` succeeds |
| 03 | **Firebase provision** | Project + web config | `npx --yes firebase-tools use` resolves |
| 04 | **Env & secrets** | `.env` wired, secrets stored | App boots with config |
| 05 | **Stripe** *(optional)* | Products, prices, webhook | Test charge succeeds |
| 06 | **Cloud Functions** | Deployed functions | Callable returns 200 |
| 07 | **Security rules** | Rules + tests green | Rules unit tests pass |
| 08 | **MCP servers** *(optional)* | Chrome MCP wired | Agent can drive a page |
| 09 | **Verification + deploy** | Local checks + Firebase deploy flow | Local gates green |
| 10 | **Testing & QA** | Unit + e2e suites | Full suite green |
| 11 | **Build & deploy** | Live hosting URL | Smoke test passes |
| 12 | **Post-launch** | Monitoring + runbook | Alerts firing to a channel |

## Step conventions

Every step file follows the same shape:

- **🎯 Goal** — what "done" means.
- **✅ Preconditions** — what must already be true.
- **❓ Operator prompts** — questions for the human running setup.
- **⌨️ Commands** — copy-pasteable shell, parameterized by `${PLACEHOLDERS}`.
- **📄 Generated files** — files this step creates/modifies.
- **🔒 Security notes** — guardrails (map to **[Security](Security)**).
- **🚦 Verification gate** — the check that must pass to advance.

Placeholders are `${SCREAMING_SNAKE_CASE}` and resolved from the answers captured
in Step 01.

## The Interview (Step 01) decision matrix

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
| Release host | Local verification / Firebase deploy | Local verification |

## Generic use cases the stack covers

Any of these build on the identical baseline; the Interview selects which
**modules** to enable so you only scaffold what you need:

- **Marketing / brochure site** — fast static-first pages, SEO, sitemap, OG tags.
- **SaaS product front-end** — authenticated dashboard, RBAC.
- **E-commerce / digital goods** — catalog, Stripe Checkout, receipts.
- **Membership / subscription** — recurring billing, customer portal, entitlements.
- **Internal admin console** — privileged dashboards, audit logs, feature flags.
- **Content / docs portal** — markdown rendering, search, versioned content.
- **Lead-gen / forms platform** — validated forms, anti-spam, email notifications.
- **Booking / scheduling** — availability, intake forms, confirmation emails.

## Definition of done

The build is complete when the unified intake is complete, the legacy gates pass,
and:

- The site is reachable at the chosen domain over HTTPS with security headers.
- Auth, data reads/writes, and (if enabled) a test payment work end-to-end.
- Local release gates are green before merge or deploy.
- Errors report to a monitoring channel and a runbook exists.
- No secret values exist in the repo history.
# Unified Setup Process

For new builds, use `.SYSTEMX/Unified-Setup-Process/` first. It defines **WSG
20-phase canonical setup plan plus the 10-phase compatibility map**, five edition manifests, 10 phases, 15
steps, repo learning, and the `@@CODER.SatoshiUNO` human/AI interaction
standard.

The legacy `.SYSTEMX/Template/steps/00-12` playbook remains the golden-path
source material for detailed Firebase, payments, Functions, local QA, and deploy
instructions.

The validation starter uses Home, About, Services, Docs, and Contact pages with
the WSG Basic Visual Baseline: black, white, and neutral gray only.

The unified process also defines WSG Account Levels for Level 0-5 auth,
Firebase custom claims, local emulator users, and Playwright fixtures. Unified
Login defines the provider flow: Google/Firebase by default, Microsoft 365 when
the sender mailbox lives there, GoDaddy when DNS lives there, and Stripe when
commerce is enabled.

## First-Time Intake Pause

For a new project from the template, setup pauses after identity/provider login
so the human can fill:

- `.SYSTEMX/Unified-Setup-Process/intake/01-PROJECT-BRIEF.md`
- `.SYSTEMX/Unified-Setup-Process/intake/02-EDITION-MODULES.md`
- `.SYSTEMX/Unified-Setup-Process/intake/03-PAGES-ROUTES.md`
- `.SYSTEMX/Unified-Setup-Process/intake/04-DATA-AUTH-SECURITY.md`
- `.SYSTEMX/Unified-Setup-Process/intake/05-INTEGRATIONS-DEPLOY.md`
- `.SYSTEMX/Unified-Setup-Process/intake/06-AI-REINJECTION-PROMPT.md`

Re-inject the last file into the AI/code tooling session to continue setup.
Setup and deploy history live in `.SYSTEMX/logs/`.
