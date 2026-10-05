# SYSTEMX KIT

`.SYSTEMX/KIT/` stores reusable production-ready kits that can be consumed in
two ways:

1. **As part of this template** — SYSTEMX scripts, docs, setup packets, and LLM
   prompts can reference the kit as a local source of approved brand,
   production, document, web, mobile, and media assets.
2. **As a standalone repo reference** — an LLM, SDK, CLI, or automation process
   can be pointed at the GitHub URL for this folder and instructed to use it as
   the exact source package for generating brand-compliant outputs.

## Kits

| Kit | Path | Purpose |
| --- | --- | --- |
| Production Kit | `.SYSTEMX/KIT/Production/` | Wayne Tech Lab LLC master production kit: brand assets, platform assets, media kit, web app brand component, mobile assets, document templates, manifests, and checksum records. |
| Brand Guide Kit | `.SYSTEMX/KIT/Brand/` | WTL Brand Guide Standard Template v1.0: intake, layout contracts, page prompts, preflight/stitch scripts, examples, and PDF brand-guidelines production flow. |

## Operating rule

Kits are source packages. Do not casually rewrite, flatten, or “improve” their
contents. Add wrapper docs, indexes, scripts, or integration notes around the
kit when SYSTEMX needs automation, but preserve the kit’s internal source
contract unless a human explicitly approves a kit version update.
