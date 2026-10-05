# Step 06 — Cloud Functions (serverless backend)

> Build the privileged backend: callable functions, HTTP endpoints, webhooks,
> and scheduled (cron) jobs — all on the Node 22 Functions runtime.

## 🎯 Goal
Deployed functions where a callable returns 200, secrets are bound, and (if
enabled) the Stripe webhook + scheduled jobs run.

## ✅ Preconditions
- Step 03 initialized `functions/` (TypeScript, Node 22).
- Step 04 stored server secrets.

## ❓ Operator prompts
1. Which backend pieces are needed: `callables`, `http`, `webhooks`, `cron`?
2. Region — default `${GCP_REGION}` (keep same as Firestore for latency).

## ⌨️ Commands

### Install + configure
```bash
cd functions
npm install firebase-admin firebase-functions
npm install stripe          # if billing
# tsconfig already set to Node 22 by `firebase init functions`
cd ..
```

### `functions/src/index.ts` (entry + admin init)
```ts
import { initializeApp } from 'firebase-admin/app'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'

initializeApp()
setGlobalOptions({ region: '${GCP_REGION}', maxInstances: 10 })

// Example callable with auth + RBAC check
export const ping = onCall((req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  return { ok: true, uid: req.auth.uid }
})

// Example scheduled job (cron)
export const nightly = onSchedule('0 3 * * *', async () => {
  // ...maintenance work...
})
```

### Bind secrets to functions that need them
```ts
import { defineSecret } from 'firebase-functions/params'
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')
// export const stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY] }, handler)
```

### Local emulate + deploy
```bash
npx --yes firebase-tools emulators:start --only functions,firestore,auth   # local
bash .SYSTEMX/scripts/deploy.sh functions --project "${FIREBASE_PROJECT_ID}"
```

## 📄 Generated files
- `functions/src/index.ts` and module files (`payments.ts`, `email.ts`,
  `scheduled-jobs.ts`, `adminAuth.ts`, …) as modules require.
- `functions/package.json` / `functions/tsconfig.json`.

## 🔒 Security notes
- Every callable/HTTP handler must **verify auth + claims** before acting.
- Validate and **sanitize all inputs** (use `zod` schemas) — treat clients hostile.
- Set `maxInstances` to cap cost/abuse; add rate limiting on sensitive endpoints.
- Read secrets via `defineSecret`, never from `process.env` literals in the repo.
- Enforce App Check on callables that back the web client.

## 🚦 Verification gate
```bash
bash .SYSTEMX/scripts/deploy.sh functions --project "${FIREBASE_PROJECT_ID}"
# Call the ping callable from an authed client → expect { ok: true }.
npx --yes firebase-tools functions:log --only ping --project "${FIREBASE_PROJECT_ID}" | tail -n 20
```
✅ Pass → proceed to [Step 07 — Security Rules](./07-security-rules.md).
