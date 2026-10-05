# Step 11 — Commerce, Business, And Feature Modules

## Goal
Selected feature modules are enabled without hard-coding project-specific
business logic into the template.

## Actions
- Enterprise: enable all module placeholders.
- Business: enable business/forms and optional commerce modules.
- Consumer: enable standard commerce only when selected.
- Keep Stripe/server secrets out of persistent docs.

## Gate
Enabled modules match the edition manifest.
