# SYSTEMX Brand Guide Kit

The **SYSTEMX Brand Guide Kit** lives in:

```text
.SYSTEMX/KIT/Brand/
```

It embeds **WTL Brand Guide Standard Template v1.0** inside the public S.F.W.A.
Template so operators, LLMs, SDK tools, CLI workflows, and local automation can
produce a consistent six-page PDF brand-guidelines package from approved logo
artwork and intake data.

## GitHub URLs

- Folder:
  [`.SYSTEMX/KIT/Brand`](https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/KIT/Brand)
- SYSTEMX kit index:
  [SYSTEMX-KIT-INDEX.md](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/KIT/Brand/SYSTEMX-KIT-INDEX.md)
- Raw prompt ingest:
  <https://raw.githubusercontent.com/WayneTechLab/WebAppX/main/.SYSTEMX/KIT/Brand/Prompt_Ingest_Brand_Guide.md>

## What it produces

| Output | Purpose |
| --- | --- |
| Six page PNGs | One approved image page for each section of the guide. |
| PDF brand guide | Stitched client-facing brand-guidelines document. |
| Contact sheet | Fast visual review of all pages before delivery. |
| Preflight report | Local validation for expected page count, file names, and page dimensions. |

## Required six pages

1. Cover
2. Brand Overview & Typography
3. Color Palette & Logo Anatomy
4. Clear Space, Minimum Size & Approved Variations
5. Incorrect Usage & Brand Applications
6. Back Cover

## Copy-paste LLM instruction

```text
Use the SYSTEMX Brand Guide Kit at https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/KIT/Brand. Read SYSTEMX-KIT-INDEX.md first, then 00_START_HERE.md and Prompt_Ingest_Brand_Guide.md. Use the supplied logos as locked artwork, fill project.json from CLIENT_INTAKE.md, generate the six required page PNG files, run preflight, stitch the PDF, and return the PDF, pages, contact sheet, and preflight report.
```

## Local operator flow

```bash
cd .SYSTEMX/KIT/Brand
python3 -m pip install -r 05_SCRIPTS/requirements.txt
python3 05_SCRIPTS/preflight_pages.py 06_OUTPUT/pages
python3 05_SCRIPTS/stitch_pages.py 06_OUTPUT/pages 06_OUTPUT/Client_Brand_Guidelines.pdf --title "Client Brand Guidelines"
python3 05_SCRIPTS/make_contact_sheet.py 06_OUTPUT/pages 06_OUTPUT/Client_Brand_Guidelines_Contact_Sheet.png
```

Before running the final scripts, replace the placeholder logo files, complete
`01_INPUT/CLIENT_INTAKE.md`, create `02_CONFIG/project.json` from
`02_CONFIG/project.blank.json`, and generate the six page files into
`06_OUTPUT/pages/`.

## Logo and IP rules

- Logos are locked artwork.
- Do not redraw, regenerate, crop, recolor, stretch, or reinterpret supplied
  logos unless the owner explicitly approves a new asset version.
- Do not claim exact logo fonts unless the client supplies font metadata.
- Remove or replace example client assets before distributing a client-specific
  production package outside the project team.
- Do not store secrets, credentials, private customer strategy, or paid-service
  access details inside brand-guide packets.

## SYSTEMX rule

The kit remains under `.SYSTEMX/KIT/Brand/` as a source package. Generated
deliverables should stay in the working project or client delivery folder unless
you intentionally promote them into public documentation.
