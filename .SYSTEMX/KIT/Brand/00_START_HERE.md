# WTL Standard Brand Guide Template v1.0

This package turns an approved client logo, a producer logo, and a short intake into the same six-page print-friendly brand-guidelines format shown in the included Bardo's BB example.

## Fast workflow

1. Duplicate this folder for the new client.
2. Replace `01_INPUT/CLIENT_LOGO_REPLACE_ME.png` with the approved client logo.
3. Use `01_INPUT/PRODUCER_LOGO_WAYNE_TECH_LAB_EXAMPLE.png` when Wayne Tech Lab LLC. is the producer, or replace the producer placeholder with another approved logo.
4. Complete `01_INPUT/CLIENT_INTAKE.md`.
5. Copy `02_CONFIG/project.blank.json` to `02_CONFIG/project.json` and fill every placeholder.
6. Give the whole ZIP to the LLM and instruct it to read `Pronpt_Injest_Brand_Guide.md` before generating anything.
7. Generate and approve each page one by one.
8. Save the pages in `06_OUTPUT/pages/` with the exact filenames in the output contract.
9. Run the preflight, stitch, and contact-sheet scripts.

## One-line instruction to the LLM

> Read `Pronpt_Injest_Brand_Guide.md`, use the supplied logos without modifying them, follow `02_CONFIG/project.json`, reproduce the included six-page example format, and return the six page PNGs, final PDF, contact sheet, and preflight report.

## Local commands

```bash
python3 -m pip install -r 05_SCRIPTS/requirements.txt
python3 05_SCRIPTS/extract_palette.py 01_INPUT/CLIENT_LOGO.png 02_CONFIG/detected_palette.json
python3 05_SCRIPTS/create_logo_variations.py 01_INPUT/CLIENT_LOGO.png 06_OUTPUT/logo_variations
python3 05_SCRIPTS/preflight_pages.py 06_OUTPUT/pages
python3 05_SCRIPTS/stitch_pages.py 06_OUTPUT/pages 06_OUTPUT/Client_Brand_Guidelines.pdf --title "Client Brand Guidelines"
python3 05_SCRIPTS/make_contact_sheet.py 06_OUTPUT/pages 06_OUTPUT/Client_Brand_Guidelines_Contact_Sheet.png
```

## Important

- The example Bardo's and Wayne Tech Lab logos are included only as visual and workflow examples.
- The client and producer logos must be placed as supplied, not regenerated.
- Image-generation systems can vary. The page naming, safe-zone guide, layout contract, prompt set, and stitching scripts are included to reduce variation and keep the result consistent.
- The example PDF is image-based because it preserves the approved visual layout. For searchable accessibility, create a separate tagged document rather than changing the visual master.
- No font files are included. Use properly licensed fonts or the stated fallbacks.
