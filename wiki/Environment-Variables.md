# Environment Variables

There are **two tiers** of configuration. Never mix them.

## 1. Client tier (`VITE_*`) — shipped to the browser, **public by design**

These are bundled into the client and are safe to ship. Copy `.env.example` to
`.env.local` and fill them in:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# Optional
VITE_FUNCTIONS_BASE_URL=          # callable/HTTP function host
VITE_SENTRY_DSN=                  # monitoring (optional)
VITE_ENVIRONMENT=development      # development | staging | production

# Optional billing module
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_PRICE_*=              # one per price/SKU
```

> ⚠️ A Firebase web API key is **not** a secret — it identifies the project and is
> protected by **Security Rules + App Check**, not by hiding it. Do not try to
> "lock it down" by keeping it out of the bundle; that is expected behavior.

### Where to find the Firebase values

Firebase console → **Project settings** → **General** → **Your apps** → **SDK
setup & config** → select **Config**. The object maps 1:1 to the `VITE_FIREBASE_*`
variables above.

## 2. Server tier (secrets) — **never** in the client bundle

These belong in Cloud Functions secrets, GCP Secret Manager, or another local
secret store — **never** committed:

```bash
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
EMAIL_API_KEY / SMTP_PASSWORD
SERVICE_ACCOUNT_JSON           # (or use Application Default Credentials)
ADMIN_BOOTSTRAP_TOKEN
```

Store them with, e.g.:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

## How config is consumed

`src/config/firebase.ts` reads `import.meta.env.VITE_*` and **only** initializes
Firebase when an API key and project ID are present:

```ts
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
export const app = isConfigured ? initializeApp(firebaseConfig) : null
```

This is why the starter **builds and runs before** you add any Firebase config —
the SDK simply stays dormant (and logs a dev-only warning).

## Git hygiene

The `.gitignore` is configured so real values never get committed:

```
.env
.env.*
!.env.example
*.secret
*secrets*
!*.secrets.env.example
```

- ✅ `.env.example` (and `*.secrets.env.example`) **are** tracked — they're
  templates with empty values.
- ❌ `.env`, `.env.local`, and anything matching `*secret*` are **ignored**.

## Environments

The baseline assumes `development` and `production`. Add `staging` via the
Interview step (Step 01) if you want a preview tier. Drive behavior off
`VITE_ENVIRONMENT` in the client and per-environment secrets on the server.
