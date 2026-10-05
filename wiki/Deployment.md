# Deployment

Ship the production build to **Firebase Hosting** (and Functions/rules), apply
security headers, and run a post-deploy smoke test.

> Detailed source:
> [Step 11 — Build & Deploy](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/Template/steps/11-build-deploy.md).

## Fastest path: the control menu

Run the control menu and use the **Deploy** submenu:

```bash
bash .SYSTEMX/WSG-MENU.sh     # → Deploy
```

It drives [`.SYSTEMX/scripts/deploy.sh`](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/scripts/deploy.sh),
a generic pipeline: quality gates → build → version/changelog → commit → push →
Firebase deploy, with **smart targets** (only deploys what your `firebase.json`
defines).

### Operational scripts (`.SYSTEMX/scripts/`)

| Script | Does |
| --- | --- |
| `bootstrap.sh` | Install + authenticate + verify SDKs/CLIs. Flags: `--check`, `--install`, `--auth`, `--with-stripe`, `--with-mcp`, `--with-m365`, `--with-godaddy`, `--interactive-login`, `--yes` |
| `deploy.sh` | Full pipeline. Targets: `all/full`, `app`, `hosting`, `rules`, `functions`. Flags: `--preflight`, `--audit`, `--dry-run`, `--check`, `--rollback-info`, `--fast`, `--bg`, `--fix`, `--bump <patch\|minor\|major>`, `--project <id>`, `--skip-tests`, `--skip-deploy`, `--open` |
| `deploy-hosting.sh` | Build + deploy Hosting only |
| `deploy-rules.sh` | Deploy Firestore + Storage rules only |
| `deploy-functions.sh` | Compile + deploy Cloud Functions (no-op until `functions/` exists) |
| `quality-check.sh` | Run typecheck + lint + tests (missing scripts skipped) |
| `version-bump.sh` | Bump semver + sync `.SYSTEMX/webapp-version/` |
| `firebase-setup.sh` | Firebase login + project selection (generic, no hard-coded IDs) |

```bash
# Examples
bash .SYSTEMX/scripts/deploy.sh --preflight      # gates + build, no git/deploy
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run
bash .SYSTEMX/scripts/deploy.sh rules
bash .SYSTEMX/scripts/deploy.sh app --fast
bash .SYSTEMX/scripts/deploy.sh --check
bash .SYSTEMX/scripts/deploy.sh --rollback-info
bash .SYSTEMX/scripts/deploy.sh --bump patch     # bump then full deploy
bash .SYSTEMX/scripts/deploy.sh --project my-id  # override Firebase project
```

## Manual path

## Prerequisites

- Firebase CLI: `npx --yes firebase-tools login` or a global `firebase` install
- A Firebase project, and `.firebaserc` pointing at it (`npx --yes firebase-tools use --add`).
- A green build locally (`npm run build`).

## One-time setup

```bash
npx --yes firebase-tools login
npx --yes firebase-tools use --add        # select/create your project
```

> Edit `.firebaserc` so the `default` alias is your real project ID. The starter
> ships a valid lowercase placeholder: `your-firebase-project-id`.

## Build & deploy

```bash
npm run build

# Preferred template deploy path:
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run
bash .SYSTEMX/scripts/deploy.sh hosting --project your-firebase-project-id
```

With the full playbook (Functions enabled), deploy everything:

```bash
bash .SYSTEMX/scripts/deploy.sh app --project your-firebase-project-id
bash .SYSTEMX/scripts/deploy.sh rules --project your-firebase-project-id
```

## Custom domain

In the Firebase console: **Hosting → Add custom domain → follow DNS steps**.
Verify the HTTPS certificate is provisioned **before** announcing.

## Post-deploy smoke test

```bash
URL="https://<your-project>.web.app"   # or your custom domain

# Headers applied?
curl -sI "$URL" | grep -i strict-transport-security
curl -sI "$URL" | grep -i content-security-policy

# Then manually: load the site, sign in, do one core action,
# and (if billing) run a test-mode checkout.
```

## Security checklist before going live

- [ ] **HSTS + CSP** present on the live response (curl checks above).
- [ ] Deployed **security rules** match the repo (no drift).
- [ ] **App Check** enforcement enabled for production backends.
- [ ] Stripe switched to **live** keys only after a passing test-mode smoke.
- [ ] No `.env*` / secret files bundled into `dist/`.

See **[Security](Security.md)** for the full baseline.

## Local verification and deploys

Prefer running the verification gates locally, then deploying from the
workstation to Firebase. This template intentionally does not ship GitHub
runner-based automation, so release reproducibility comes from the versioned
scripts and the Firebase deploy path rather than billable infrastructure. See
[Step 09 — Verification and Deploy](Setup-Playbook.md).

## Hosting config reference

`firebase.json` controls hosting:

- `public: "dist"` — the Vite build output.
- `rewrites: [{ "source": "**", "destination": "/index.html" }]` — SPA routing.
- `headers` — the hardened security header set (see **[Security](Security.md)**).
- `assets/**` gets long-lived immutable caching.
