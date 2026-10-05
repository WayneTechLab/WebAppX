# SYSTEMX Brand Guide Kit

This folder contains **WTL Brand Guide Standard Template v1.0**, a reusable
six-page brand-guidelines production kit for turning approved logos, intake
answers, layout contracts, and page prompts into a polished PDF brand guide.

Canonical path:

```text
.SYSTEMX/KIT/Brand/
```

## What this kit produces

- Six US Letter portrait brand-guide pages.
- A stitched PDF brand-guidelines document.
- Contact sheet previews for review.
- Preflight reports for page size, naming, and completeness.
- Repeatable prompt and script flow that an LLM, SDK, CLI, local operator, or
  automation lane can follow.

## Start here

Read these files in order:

1. [`00_START_HERE.md`](00_START_HERE.md)
2. [`Prompt_Ingest_Brand_Guide.md`](Prompt_Ingest_Brand_Guide.md)
3. [`01_INPUT/CLIENT_INTAKE.md`](01_INPUT/CLIENT_INTAKE.md)
4. [`02_CONFIG/project.blank.json`](02_CONFIG/project.blank.json)
5. [`02_CONFIG/layout_contract.json`](02_CONFIG/layout_contract.json)
6. [`02_CONFIG/output_contract.json`](02_CONFIG/output_contract.json)
7. [`04_PAGE_PROMPTS/`](04_PAGE_PROMPTS/)
8. [`05_SCRIPTS/`](05_SCRIPTS/)

The file `Pronpt_Injest_Brand_Guide.md` is preserved from the source kit as a
compatibility copy for existing prompts and references. New work should point to
`Prompt_Ingest_Brand_Guide.md`.

## One-line LLM instruction

```text
Use the SYSTEMX Brand Guide Kit at https://github.com/WayneTechLab/SFWA-WTL-TEMPLATE/tree/main/.SYSTEMX/KIT/Brand. Read SYSTEMX-KIT-INDEX.md first, then 00_START_HERE.md and Prompt_Ingest_Brand_Guide.md. Use the supplied logos as locked artwork, fill project.json from CLIENT_INTAKE.md, generate the six required page PNG files, run preflight, stitch the PDF, and return the PDF, pages, contact sheet, and preflight report.
```

## Normal operator flow

1. Duplicate this folder into the working project or work inside a generated
   project copy.
2. Replace `01_INPUT/CLIENT_LOGO_REPLACE_ME.png` with the approved client logo.
3. Replace or confirm `01_INPUT/PRODUCER_LOGO_REPLACE_ME.png`.
4. Complete `01_INPUT/CLIENT_INTAKE.md`.
5. Copy `02_CONFIG/project.blank.json` to `02_CONFIG/project.json`.
6. Generate each of the six pages listed in `Prompt_Ingest_Brand_Guide.md`.
7. Save pages under `06_OUTPUT/pages/`.
8. Run the Python preflight and stitch scripts.
9. Review the PDF and contact sheet before delivery.

## Local commands

From `.SYSTEMX/KIT/Brand/`:

```bash
python3 -m pip install -r 05_SCRIPTS/requirements.txt
python3 05_SCRIPTS/preflight_pages.py 06_OUTPUT/pages
python3 05_SCRIPTS/stitch_pages.py 06_OUTPUT/pages 06_OUTPUT/Client_Brand_Guidelines.pdf --title "Client Brand Guidelines"
python3 05_SCRIPTS/make_contact_sheet.py 06_OUTPUT/pages 06_OUTPUT/Client_Brand_Guidelines_Contact_Sheet.png
```

## Safety and ownership rules

- Treat client and producer logos as locked artwork.
- Do not redraw, regenerate, crop, recolor, stretch, or reinterpret supplied
  logos unless the owner explicitly approves a new asset version.
- Do not include secrets, account credentials, customer-private strategy, or
  paid-service access details in generated brand packets.
- Example assets are examples only. Remove or replace example client assets
  before distributing a client-specific production package outside the project
  team.
- The resulting PDF is a production aid, not legal, trademark, accessibility,
  or compliance advice.

## SYSTEMX integration rule

This kit is committed under `.SYSTEMX/KIT/Brand/` so it can be referenced from
the public template and from GitHub URLs. Generated outputs belong in local
project workspaces unless they are intentionally promoted into a project’s
public docs or client deliverables.
