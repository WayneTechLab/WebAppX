# Secrets Standard

The template separates browser-safe configuration from server-side secrets.

## Files

- `.env.example` documents browser-safe `VITE_*` values.
- `.env.local` stores local browser config and must not be committed.
- `.secrets.env` stores local server/deploy secrets and must not be committed.
- Hosted secrets belong in Firebase, Google Cloud, GitHub, or the chosen
  production secret manager.

## Rules

- Never commit real API keys, service account JSON, Stripe secrets, webhook
  secrets, GitHub tokens, or private certificates.
- Treat Firebase Web config as public identifier config, but still avoid
  hard-coding project-specific values into this reusable template.
- Use placeholders in docs and examples.
- Rotate secrets after any accidental paste into an AI chat, issue, log, or
  committed file.

## Checks

Run:

```bash
npm run ci:security
```

The generic checker looks for required Firebase rule files, obvious live-secret
patterns in example env files, and high severity npm audit findings.
