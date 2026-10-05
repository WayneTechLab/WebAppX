# Step 01 — Project Interview

> Collect every project-specific value **once**, up front. Every later step reads
> from the answers file produced here. This is the only place humans make
> decisions; everything after is mechanical.

## 🎯 Goal
A completed `interview.answers` file (copied from
[`../templates/interview.answers.template`](../templates/interview.answers.template))
with all required placeholders resolved.

## ✅ Preconditions
- Step 00 complete (all CLIs authenticated).
- You know the product name and whether you need billing/email/monitoring.

## ❓ Operator prompts (ask in this order)

### A. Identity
1. **Display name** — human-facing product name (e.g. "Acme Portal").
2. **Slug** — kebab-case, used for package name + default subdomain
   (e.g. `acme-portal`). Must be DNS-safe and unique on Firebase.
3. **Description** — one sentence for `package.json` + SEO meta.
4. **Primary domain** — custom FQDN (`app.acme.com`) or leave blank to use
   `${SLUG}.web.app`.

### B. Project shape
5. **Project type** — `brochure | saas | ecommerce | membership | admin | docs`.
6. **GCP region** — default `us-west1`. Others: `us-central1`, `europe-west1`,
   `asia-southeast1`. Pick closest to your users; it pins Firestore + Functions.

### C. Firebase
7. **Create new project or use existing?**
8. If existing: the **Firebase project ID** and the **web app config** (the
   `VITE_FIREBASE_*` six/seven values — see Step 03 §"capture web config").
9. **Platforms** to configure: any of `web`, `ios`, `android`. Default: `web`.
   For each selected platform you will **paste the project info Firebase gave
   you** — see §F below.
10. **Auth providers** to enable: any of `email`, `google`, `github`, `apple`,
    `phone`. Default: `email,google`.

### D. Optional modules (yes/no)
10. **Billing (Stripe)?** If yes: list the SKUs/prices to create (name +
    one-time/recurring + amount + currency).
11. **Transactional email?** If yes: provider (`smtp` or an API like a mail API)
    + from-address.
12. **Monitoring (Sentry)?** If yes: the DSN (or create the project in Step 12).
13. **MCP automation?** (Chrome DevTools MCP for agent-driven UI checks.)

### E. Delivery
14. **GitHub repo** — `owner/name` (existing or to be created).
15. **CI/CD** — Firebase-first local verification and deploy flow.
16. **Environments** — which of `development`, `staging`, `production`.

### F. Firebase project info — paste what Firebase gave you (per platform)
The `projectId` / project number is the **same** across Web, iOS, and Android.
Provide it once; the per-platform app identifiers differ. `setup.sh` (and
`WSG-MENU` option 4) will collect these and write them to `interview.answers`.

| Platform | Where it comes from | Keys captured |
| --- | --- | --- |
| **Web** | Console → Project settings → Your apps (Web) → SDK config | `VITE_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId) |
| **iOS** | The `GoogleService-Info.plist` you downloaded | `IOS_BUNDLE_ID`, `IOS_APP_ID` (GOOGLE_APP_ID), `IOS_API_KEY`, `IOS_CLIENT_ID`, `IOS_REVERSED_CLIENT_ID`, `IOS_STORAGE_BUCKET` |
| **Android** | The `google-services.json` you downloaded | `ANDROID_PACKAGE_NAME`, `ANDROID_APP_ID` (mobilesdk_app_id), `ANDROID_API_KEY`, `ANDROID_STORAGE_BUCKET` |

> You can **paste the full Web SDK snippet** exactly as Firebase provides it
> (`import ...`, comments, `const firebaseConfig = { ... }`, `initializeApp`,
> `getAnalytics`) and finish with `WSG_END`. You can also paste only the
> `firebaseConfig` block, or point the prompt at the
> **`GoogleService-Info.plist` / `google-services.json` file path** and it will
> be parsed automatically (manual field entry is always available as a fallback).

## ⌨️ Commands
```bash
# From the Template directory, seed your answers file:
cp templates/interview.answers.template ./interview.answers
# Open it and fill in every REQUIRED line. Leave optional modules blank to skip.
${EDITOR:-vi} ./interview.answers

# (interview.answers is git-ignored — it can hold environment-ish values.)
```

`setup.sh` will prompt for each of these interactively and write the same file.
The quickest path is the control menu, which also installs/authenticates tooling:

```bash
bash ../WSG-MENU.sh        # → option 4: Capture Firebase project info (Web/iOS/Android)
```

## 📄 Generated files
- `interview.answers` (git-ignored) — the resolved values consumed by later steps.

## 🔒 Security notes
- `interview.answers` may contain a Sentry DSN, domain, project IDs — keep it
  **out of version control** (it is git-ignored by the template).
- Do **not** put `STRIPE_SECRET_KEY`, webhook secrets, or service-account JSON
  here. Those go to a secret store in Step 04/05, never a flat file in the repo.

## 🚦 Verification gate
```bash
# Every REQUIRED key is non-empty:
grep -E '^(DISPLAY_NAME|SLUG|PROJECT_TYPE|GCP_REGION|FIREBASE_MODE|AUTH_PROVIDERS|GITHUB_REPO)=' interview.answers \
  | grep -vE '=\s*$' | wc -l   # expect 7
```
✅ Pass → proceed to [Step 02 — Scaffold](./02-scaffold.md).
