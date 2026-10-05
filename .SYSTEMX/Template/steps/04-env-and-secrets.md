# Step 04 — Environment & Secrets

> Wire the two tiers of configuration: **client** `VITE_*` values (safe to ship)
> and **server** secrets (never shipped, never committed). Make the app boot with
> real Firebase config.

## 🎯 Goal
`.env` populated with `VITE_FIREBASE_*` (and optional `VITE_*` module values);
server secrets stored in a secret manager; `src/config/firebase.ts` initializes
the SDK; the dev server boots and connects.

## ✅ Preconditions
- Step 03 complete; web config captured.
- Decisions on billing/email/monitoring from `interview.answers`.

## ❓ Operator prompts
- Confirm the captured `VITE_FIREBASE_*` values.
- For each enabled module, confirm which secrets exist vs. need creating.

## ⌨️ Commands

### 1. Create the client env files from templates
```bash
cp Template/templates/env.template ./.env.example
cp Template/templates/secrets.env.template ./.secrets.env.example

# Real local values (git-ignored):
cp .env.example .env.local
${EDITOR:-vi} .env.local   # paste the VITE_FIREBASE_* values from Step 03
```

### 2. Initialize the Firebase client SDK
`src/config/firebase.ts`:
```ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

### 3. Store **server** secrets (never in the repo)
```bash
# Firebase Functions secrets (preferred for Functions runtime):
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set EMAIL_API_KEY        # if email module

# ...or GCP Secret Manager directly:
echo -n "<value>" | gcloud secrets create STRIPE_SECRET_KEY --data-file=- \
  --project "$PROJECT_ID"
```

### 4. Type the client env (`src/vite-env.d.ts`)
```ts
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_FUNCTIONS_BASE_URL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_ENVIRONMENT?: 'development' | 'staging' | 'production'
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

## 📄 Generated files
- `.env.example`, `.secrets.env.example` (committed, **empty** values only)
- `.env.local` (git-ignored, real client values)
- `src/config/firebase.ts`, `src/vite-env.d.ts`

## 🔒 Security notes
- **Never** commit `.env.local`, `.secrets.env`, or any file with real secret
  values. Confirm `.gitignore` covers `.env*` (except `*.example`) and `*secrets*`.
- Keep `STRIPE_SECRET_KEY` / webhook secrets **only** in the secret manager and
  read them inside Functions — never expose them as `VITE_*`.
- Rotate any secret that has ever touched the clipboard of a shared machine.
- Run a secret scan before the first push (Step 09 wires this into CI).

## 🚦 Verification gate
```bash
npm run dev    # app boots; no "Firebase: Error (auth/invalid-api-key)"
# In the browser console, auth/db handles should initialize without throwing.
git check-ignore .env.local && echo ".env.local is ignored ✅"
```
✅ Pass → proceed to [Step 05 — Stripe](./05-stripe.md) *(or skip to Step 06 if
no billing)*.
