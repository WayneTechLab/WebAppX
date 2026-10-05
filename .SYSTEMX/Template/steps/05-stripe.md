# Step 05 — Stripe (optional billing module)

> Skip entirely if `BILLING=no`. Otherwise: create products + prices, wire
> Checkout on the client, and verify webhooks against your local/cloud functions.

## 🎯 Goal
A working test-mode payment: products/prices exist, the client can open Checkout,
and a signed webhook updates Firestore.

## ✅ Preconditions
- Stripe CLI installed + `stripe login` done (Step 00).
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` stored as secrets (Step 04).
- Functions skeleton exists (Step 03; fleshed out in Step 06).

## ❓ Operator prompts
1. List each SKU: name, `one_time | recurring`, amount (minor units), currency.
2. Recurring interval (`month | year`) for subscriptions.
3. Test mode first (always) — go live only after Step 11 smoke test.

## ⌨️ Commands

### Create products + prices (test mode)
```bash
# Example — repeat per SKU from the interview:
stripe products create --name "Growth Plan" --description "Monthly subscription"
stripe prices create \
  --product prod_XXX --unit-amount 4900 --currency usd \
  --recurring interval=month
# Record each price id as VITE_STRIPE_PRICE_<NAME> in .env.local
```

### Client publishable key + price IDs (`.env.local`)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_STRIPE_PRICE_GROWTH_MONTHLY=price_xxx
```

### Client Checkout (sketch)
```ts
import { loadStripe } from '@stripe/stripe-js'
const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!)
// Call your createCheckoutSession callable (Step 06), then:
await stripe!.redirectToCheckout({ sessionId })
```

### Local webhook testing
```bash
# Forward Stripe events to your local function:
stripe listen --forward-to localhost:5001/${PROJECT_ID}/${GCP_REGION}/stripeWebhook
# In another shell, trigger a test event:
stripe trigger checkout.session.completed
```

## 📄 Generated files
- `src/lib/stripePaymentService.ts` (client)
- `functions/src/payments.ts` (server: session creation + webhook handler)
- `src/data/productCatalog.ts` (price IDs mapped from env)

## 🔒 Security notes
- **Verify webhook signatures** with `STRIPE_WEBHOOK_SECRET` on every event.
- Use **idempotency keys** on charge/session creation to avoid double-billing.
- Never trust client-sent amounts — derive prices server-side from the catalog.
- Keep `STRIPE_SECRET_KEY` server-only; only the `pk_*` publishable key is `VITE_*`.
- Reconcile fulfillment off the **webhook**, not the client redirect.

## 🚦 Verification gate
```bash
stripe trigger checkout.session.completed   # webhook returns 200
# Firestore shows the order/subscription doc written by the handler.
```
✅ Pass → proceed to [Step 06 — Cloud Functions](./06-cloud-functions.md).
