# Architecture & Stack

The stack is an opinionated, **vendor-neutral-where-possible** baseline. Versions
are **pinned baselines** — bump them deliberately, not accidentally.

## At a glance

| Layer | Default choice | Swap-friendly? |
| --- | --- | --- |
| Language | TypeScript (strict) | No — assumed everywhere |
| UI runtime | React 19 | Yes (Preact/Solid possible, not covered) |
| Build / dev server | Vite 8 | No — core of the template |
| Styling | Tailwind CSS 4 + Radix UI primitives | Yes |
| Auth / DB / Storage | Firebase (Auth, Firestore, Storage, RTDB) | Partial |
| Serverless backend | Firebase Cloud Functions (module-selectable Node runtime) | Yes (Cloud Run noted) |
| Payments | Stripe (Checkout + Webhooks) | Yes (optional) |
| Hosting | Firebase Hosting | Yes (Cloud Run / static host noted) |
| Cloud platform | Google Cloud (`gcloud`) | No — Firebase lives on GCP |
| Errors / tracing | Sentry | Yes (optional) |
| Unit tests | Vitest + Testing Library | Yes |
| E2E tests | Playwright | Yes |
| Lint / format | ESLint 9 (flat config) | Yes |
| Release gates | Local verification + Firebase deploy | Yes |
| Agent tooling | SYSTEMX AI standard + Chrome DevTools MCP + Playwright codegen | Yes (optional) |

## Version baselines

### Language & framework
| Tool | Baseline | Why |
| --- | --- | --- |
| TypeScript | `~5.9` | Strict types across app, functions, scripts |
| React | `^19` | Component model; concurrent features |
| Local router | template-owned | Basic client navigation without an external router dependency |

### Build & styling
| Tool | Baseline | Why |
| --- | --- | --- |
| Vite | `^8` | Dev server + Rolldown/Rollup-compatible production build |
| `@vitejs/plugin-react` | `^5` | JSX transform |
| Tailwind CSS | `^4` | Utility styling via `@tailwindcss/vite` |
| `lucide-react` | latest | Icon set |

### Backend / platform (playbook modules)
| Tool | Baseline | Why |
| --- | --- | --- |
| Firebase (web SDK) | `^12` | Auth, Firestore, Storage, RTDB, Analytics |
| `firebase-admin` | `^13` | Privileged server SDK in functions |
| Cloud Functions runtime | `nodejs22` | Serverless backend + webhooks + cron |
| Google Cloud (`gcloud`) | latest | Platform, IAM, billing, logs |

### Quality, testing, observability
| Tool | Baseline | Why |
| --- | --- | --- |
| Vitest + Testing Library | `^4` / latest | Unit + component tests |
| Playwright | `^1.6x` | E2E + visual/a11y audits |
| ESLint (flat config) | `^9` | Linting; `--max-warnings=0` in local gates |
| Sentry (`@sentry/react`) | `^10` | Error + performance monitoring |
| `@firebase/rules-unit-testing` | `^5` | Firestore/Storage rules tests |

## How the runtime is wired

```mermaid
flowchart TD
    A[index.html] --> B[src/main.tsx]
    B --> C[Local router · src/router.tsx]
    C --> D[Layout · Navbar + Page + Footer]
    D --> E[Pages: Home / About / Services / Docs / Login / Contact / 404]
    B -.imports.-> F[src/config/firebase.ts]
    F -->|VITE_FIREBASE_* present| G[(Firebase: Auth · Firestore · Storage)]
    F -->|not configured| H[Guarded no-op exports · app still boots]
```

- **`src/config/firebase.ts`** only calls `initializeApp` when a project ID is
  present, so the template **builds and runs before credentials exist**. Exports
  (`auth`, `db`, `storage`) are `null` until configured.
- **`vite.config.ts`** sets the `@` → `src` path alias and splits `react` and
  `firebase` into separate chunks.
- **Tailwind 4** is loaded via the `@tailwindcss/vite` plugin (no separate
  `tailwind.config.js` required for the baseline).
- **Playwright Chromium** is the browser baseline for e2e recording and
  `npx playwright codegen`; keep it installed alongside Chrome when using the
  optional MCP browser loop.
- **`.SYSTEMX/AI`** is the generic agent and tooling standard. It defines
  Agent 0, subagent lanes, message envelopes, external connector adapters,
  browser/desktop automation boundaries, and recovery playbooks.

## Required CLIs (full playbook)

| CLI | Install | Used in |
| --- | --- | --- |
| Node.js + npm (Node 24 LTS baseline) | nvm / official installer | local tooling |
| Git | OS package | all |
| GitHub CLI (`gh`) | `brew install gh` | template/repo operations |
| Google Cloud CLI (`gcloud`) | Google installer | provisioning |
| Firebase CLI (`firebase-tools`) | approved `npx --yes firebase-tools` or global `firebase` | provisioning + deploy |
| Stripe CLI (`stripe`) | `brew install stripe/stripe-cli/stripe` | billing (optional) |
| Chrome DevTools MCP | `npx chrome-devtools-mcp` | agent automation (optional) |
| Playwright Chromium | `npx playwright install chromium` | e2e recording + browser parity |
| SYSTEMX AI check | `npm run ai:standard:check` | agent-standard drift check |

> The local Bash bootstrap can verify and, on supported shells, install selected
> tools. Review it before use. It does not grant cloud access, create projects,
> or make a production decision. Native PowerShell install wrappers are not
> shipped in this revision.

See the full rationale in
[`.SYSTEMX/Template/WEBAPP-STACK-G1.0.md`](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/Template/WEBAPP-STACK-G1.0.md).

## Standalone integration in this unified template

The current universal tools, docs, examples and MEDIA library are retained in
`.SYSTEMX/.systemx/releases/<selected-version>/`. `INSTALLATION.json` selects and
pins that release; `SYSTEMX.sh` routes to it. Outer `GLOBAL`, `PLAN`, `WORK`,
`MEMORY` and `AGENTS` ship reusable records; `project.json` supplies host
commands and checks to configure for the adopted project. Import receipts
live in `.SYSTEMX/imports/`; manager runtime receipts remain ignored under
`.SYSTEMX/.systemx/operations/`. Historical LAN status and feature evidence retain
their original scope. See [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration.md).
