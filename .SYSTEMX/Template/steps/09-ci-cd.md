# Step 09 — Verification and Deploy

> Local verification gates plus a deploy pipeline to Firebase Hosting +
> Functions.

## 🎯 Goal
A green local verification flow that runs lint, typecheck, unit tests, rules
tests, and build before a Firebase deploy.

## ✅ Preconditions
- `GITHUB_REPO` exists and you can push.
- `gh auth login` complete (Step 00).
- Build + tests pass locally.

## ❓ Operator prompts
1. Deploy from a workstation or a Firebase release job?
2. Use preview channels for staging?
3. Which environments deploy from which branches?

## ⌨️ Commands

### Local verification and deploy configuration
```bash
# Keep deploy credentials in Firebase / GCP and local secret stores.
# The base template does not ship runner-based secrets or hosted runner infrastructure.
```

### Branch protection
Use Firebase deploy gates, manual review, and the local verification scripts
instead of workflow-runner branch protection in the base template.

## 📄 Generated files
- Local verification notes and deploy checklist files as needed.

## 🔒 Security notes
- Keep deploy service accounts outside the repo and outside any hosted automation.
- Add a **secret-scanning** + `npm audit` check in your local or external release flow.
- Never echo secrets in logs.
- Review every external automation package before adding it.
- Protect the deploy target with review, not a billable runner dependency.

## 🚦 Verification gate
```bash
npm run ci:lint
npm run ci:typecheck
npm run ci:test
npm run ci:build
```
✅ Pass → proceed to [Step 10 — Testing & QA](./10-testing-qa.md).
