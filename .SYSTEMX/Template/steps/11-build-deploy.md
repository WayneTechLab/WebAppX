# Step 11 — Build & Deploy

> Produce the production build, deploy to Firebase Hosting + Functions, apply
> security headers, and run a post-deploy smoke test against the live URL.

## 🎯 Goal
The app is live over HTTPS at the chosen domain, with security headers, working
auth/data, and (if enabled) a successful **live** test transaction.

## ✅ Preconditions
- Steps 02–10 green.
- `.firebaserc` points at the target project or `--project` is provided.
- CI is green (Step 09) — ideally deploy via CI, manual is the fallback.

## ❓ Operator prompts
1. Deploy to a **preview channel** first, or straight to `live`?
2. Custom domain now, or `${SLUG}.web.app` for launch?
3. Flip Stripe from test → live keys? (only after a test smoke passes)

## ⌨️ Commands

### Security headers (in `firebase.json` → hosting.headers)
```jsonc
"headers": [{
  "source": "**",
  "headers": [
    { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https: https://js.stripe.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; connect-src 'self' https: wss: data: blob:; frame-src 'self' https://js.stripe.com; object-src 'none'; base-uri 'self'" },
    { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" },
    { "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" }
  ]
}]
```

### Build + deploy
```bash
npm run build

# Preferred template path:
bash .SYSTEMX/scripts/deploy.sh --preflight
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run
bash .SYSTEMX/scripts/deploy.sh app --project "${FIREBASE_PROJECT_ID}"
bash .SYSTEMX/scripts/deploy.sh rules --project "${FIREBASE_PROJECT_ID}"

# Preview channel fallback:
npx --yes firebase-tools hosting:channel:deploy preview-$(date +%Y%m%d) --expires 7d --project "${FIREBASE_PROJECT_ID}"
```

### Custom domain
```bash
# In the Firebase console: Hosting → Add custom domain → follow DNS steps.
# Verify HTTPS cert provisioned before announcing.
```

### Post-deploy smoke
```bash
URL="https://${SLUG}.web.app"     # or your custom domain
curl -sI "$URL" | grep -i strict-transport-security      # headers applied
curl -sI "$URL" | grep -i content-security-policy
# Manually: load the site, sign in, do one core action, (test) checkout.
```

## 📄 Generated files
- Updated `firebase.json` (headers, rewrites, redirects).
- `dist/` build artifact + `version.json`.

## 🔒 Security notes
- Confirm **HSTS + CSP** are present on the live response (the curl checks above).
- Verify the deployed **security rules** match the repo (no drift).
- Only switch Stripe to **live keys** after a passing test-mode smoke.
- Enable **App Check** enforcement for production backends.
- Double-check no `.env*`/secret files were bundled into `dist/`.

## 🚦 Verification gate
```bash
curl -sI "https://${SLUG}.web.app" | grep -i strict-transport-security
bash .SYSTEMX/scripts/deploy.sh --check --project "${FIREBASE_PROJECT_ID}"
# Live site loads, auth works, one core flow completes end-to-end.
```
✅ Pass → proceed to [Step 12 — Post-Launch](./12-post-launch.md).
