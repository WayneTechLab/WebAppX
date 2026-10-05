# 07 Output Checklist

The LLM must finish with a concise implementation report.

## Required Report

- What changed
- Why it changed
- Files changed
- Commands run
- Checks passed
- Checks skipped and why
- Assumptions
- Remaining risks
- Next actions

## Required File Alignment

If source code changes:

- Root `src/`
- `.SYSTEMX/Template/starter/src/`
- Root `package.json`
- Starter `package.json`
- Root Firebase rules
- Starter Firebase rules

If setup behavior changes:

- `.SYSTEMX/README.md`
- `.SYSTEMX/USER-INGEST-AND-PRODUCTION-SETUP.md`
- `.SYSTEMX/Unified-Setup-Process/`
- `.SYSTEMX/Template/`
- `.SYSTEMX/WSG-MENU.sh`
- `README.md`
- `wiki/`

If security/login behavior changes:

- `.SYSTEMX/Unified-Setup-Process/standards/WSG-Account-Levels.md`
- `.SYSTEMX/Unified-Setup-Process/standards/Unified-Login.md`
- `firestore.rules`
- `storage.rules`
- security scripts
- test user setup scripts

If design/media/content behavior changes:

- `.SYSTEMX/Standard-MD-Files/08-DESIGN.md`
- `.SYSTEMX/Standard-MD-Files/09-MEDIA-ASSETS.md`
- `.SYSTEMX/Standard-MD-Files/10-CONTENT-SEO.md`
- `.SYSTEMX/Standard-MD-Files/11-ACCESSIBILITY-UX.md`
- `.SYSTEMX/Standard-MD-Files/12-BRAND-TOKENS.md`
- `.SYSTEMX/Unified-Setup-Process/standards/WSG-Basic-Visual-Baseline.md`
- public docs/wiki references

## Refusal Or Pause Conditions

Pause and ask the human when:

- A live secret is needed.
- A provider login must be completed interactively.
- The target edition is unclear and would change page caps or enabled modules.
- A destructive git or deploy action is requested ambiguously.
