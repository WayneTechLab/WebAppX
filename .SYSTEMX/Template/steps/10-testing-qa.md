# Step 10 — Testing & QA

> Unit tests (Vitest + Testing Library), end-to-end tests (Playwright), and
> automated accessibility/security gates — all runnable locally and in CI.

## 🎯 Goal
A green test suite: unit/component tests, e2e flows for the critical paths, and
a11y/security audits, wired into the CI pipeline from Step 09.

## ✅ Preconditions
- App builds and runs locally.
- Critical user journeys identified (auth, core CRUD, checkout if billing).

## ❓ Operator prompts
1. Which journeys are "critical path" and must have e2e coverage?
2. Target browsers for Playwright (Chromium default; add WebKit/Firefox?).
3. Minimum coverage threshold to enforce (optional)?

## ⌨️ Commands

### Unit / component (Vitest + Testing Library)
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom
```
`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
})
```
`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

### End-to-end (Playwright)
```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright codegen http://localhost:5173    # record flows
```
`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
})
```

### Example e2e smoke (`tests/smoke.spec.ts`)
```ts
import { test, expect } from '@playwright/test'
test('home renders + no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await expect(page).toHaveTitle(/.+/)
  expect(errors, errors.join('\n')).toHaveLength(0)
})
```

### Accessibility + security gates (optional but recommended)
```bash
npm install -D @axe-core/playwright        # a11y assertions in e2e
npm run ci:audit                           # npm audit → reports/npm-audit.json
```

### Add to CI (extend Step 09 `verify` job)
```yaml
      - run: npm run ci:test
      - run: npx playwright install chromium
      - run: npx playwright test
      - run: npm run ci:rules || true     # Firestore rules tests
```

## 📄 Generated files
- `vitest.config.ts`, `vitest.setup.ts`
- `playwright.config.ts`, `tests/*.spec.ts`
- `src/__tests__/**` unit tests

## 🔒 Security notes
- Use **test-mode** credentials and emulators for e2e — never prod data.
- Keep a **rules unit test** in the suite (data-exposure regressions).
- Run `npm audit` / dependency + secret scanning on every PR.
- Treat e2e fixtures/tokens as secrets; inject via CI secrets, not the repo.

## 🚦 Verification gate
```bash
npm run test            # unit/component green
npx playwright test     # e2e green
```
✅ Pass → proceed to [Step 11 — Build & Deploy](./11-build-deploy.md).
