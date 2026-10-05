# Step 02 — Scaffold

> Stand up the TypeScript + React + Vite + Tailwind application skeleton so that
> `npm run build` produces a `dist/` you could deploy. No Firebase wiring yet.

## 🎯 Goal
A buildable app skeleton with the standard project layout, strict TS, ESLint
flat config, Tailwind, and the npm scripts the rest of the template expects.

## ✅ Preconditions
- Step 01 complete; `interview.answers` populated (`SLUG`, `DISPLAY_NAME`, …).

## ❓ Operator prompts
- Confirm `SLUG` (becomes the `package.json` `name`).
- Confirm React 19 + Vite 8 baseline (default yes).

## ⚡ Fast path (recommended) — copy the prebuilt starter
The template ships a ready-made app that already satisfies this step's goal
(pages: Home, About, Services, Docs, Login, Contact, 404 + Navbar/Footer layout,
router, Firebase config, hosting/rules, CI). Use it instead of scaffolding by hand:

```bash
# From this Template folder, copy the runnable app into your repo root:
cp -R starter/. .            # or: cp -R .SYSTEMX/Template/starter ~/projects/my-app
npm install
npm run dev                  # → http://localhost:5173

# Or start from the live GitHub template:
gh repo create ${SLUG} --template WayneTechLab/WebAppX --private --clone
```
Then jump to [Step 03 — Firebase Provision](./03-firebase-provision.md). The
manual commands below are the from-scratch equivalent if you prefer to build it
yourself.

## ⌨️ Commands
```bash
# Create the Vite + React + TS app in the repo root (run from repo root):
npm create vite@latest . -- --template react-ts

# Core runtime deps
npm install zod react-hook-form @hookform/resolvers \
  clsx tailwind-merge class-variance-authority lucide-react

# Tailwind 4 (Vite plugin) + Radix primitives (add the ones you use)
npm install -D tailwindcss @tailwindcss/vite
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs @radix-ui/react-popover @radix-ui/react-select \
  @radix-ui/react-tooltip

# Tooling
npm install -D typescript-eslint eslint @eslint/js eslint-plugin-react-hooks \
  eslint-plugin-react-refresh globals tsx
```

### Minimal `vite.config.ts`
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: { sourcemap: false, reportCompressedSize: false },
})
```

### Standard scripts (merge into `package.json`)
```jsonc
{
  "name": "${SLUG}",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b --noCheck && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run --pool=threads --maxWorkers=1",
    "ci:lint": "eslint . --max-warnings=0",
    "ci:typecheck": "tsc --noEmit -p tsconfig.json",
    "ci:build": "vite build"
  }
}
```

### Recommended folder layout
```bash
mkdir -p src/{components,hooks,lib,pages,config,data,types,styles,__tests__} \
         public tests scripts
```

## 📄 Generated files
- `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`
- `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Empty domain folders under `src/`.

## 🔒 Security notes
- Enable `"strict": true` in `tsconfig.json`.
- Add a `.gitignore` covering `node_modules`, `dist`, `.env*`, `*secrets*`,
  `interview.answers`, `*.log`, `.firebase/`.
- Do not import server-only packages (e.g. `firebase-admin`, `stripe`) into
  `src/` — they belong in `functions/` only.

## 🚦 Verification gate
```bash
npm install
npm run typecheck && npm run lint && npm run build
ls dist/index.html
```
✅ Pass → proceed to [Step 03 — Firebase Provision](./03-firebase-provision.md).
