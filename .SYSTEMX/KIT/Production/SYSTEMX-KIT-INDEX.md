# SYSTEMX Production Kit Index

This folder contains **Wayne Tech Lab LLC. Master Production Kit v1.0** embedded
inside `.SYSTEMX` as a reusable production source package.

Canonical local path:

```text
.SYSTEMX/KIT/Production/
```

Canonical GitHub path:

```text
https://github.com/WayneTechLab/SFWA-WTL-TEMPLATE/tree/main/.SYSTEMX/KIT/Production
```

Raw README URL:

```text
https://raw.githubusercontent.com/WayneTechLab/SFWA-WTL-TEMPLATE/main/.SYSTEMX/KIT/Production/README.md
```

## Dual purpose

### 1. SYSTEMX template tool

Use this kit as the local source of truth for Wayne Tech Lab LLC production
assets when building:

- public-facing pages and brand sections;
- web app brand assets, CSS, manifest, and React logo component;
- iOS and Android app assets;
- media-kit outputs;
- social and Open Graph assets;
- executive document templates;
- design tokens, colors, typography, and handoff guidance.

### 2. Standalone LLM reference package

Point an LLM, CLI, SDK, or automation tool to this folder URL when you want the
model to generate outputs that match the kit exactly. The LLM should read this
index first, then the kit README, manifest, source lock, and relevant target
subfolder.

## Recommended LLM starter prompt

```text
Use the Wayne Tech Lab LLC Master Production Kit at:
https://github.com/WayneTechLab/SFWA-WTL-TEMPLATE/tree/main/.SYSTEMX/KIT/Production

First read:
1. SYSTEMX-KIT-INDEX.md
2. README.md
3. 00_Source_Locked/SOURCE_LOCK.md
4. Documentation/ASSET_MANIFEST.md
5. MANIFEST.json

Then use only the relevant subfolder for the requested output:
- Brand Kit for logos, colors, typography, tokens, guidelines, layered masters.
- WebAPP for website/PWA assets, CSS, manifest, and React logo component.
- iOS for Apple app assets and SwiftUI brand constants.
- Android for Android assets and Compose/Kotlin brand constants.
- Media Kit for social, Open Graph, press, and email assets.
- Standard Document Set for DOCX/DOTX/PDF executive templates.

Preserve the source-lock rules. Do not redraw the Wayne Tech Lab LLC logo or
change protected proportions, world map, arc, gradients, or wordmark placement.
Return a file-by-file implementation plan before making changes.
```

## Important source files

| File | Purpose |
| --- | --- |
| `README.md` | Human overview of the production kit. |
| `00_Source_Locked/SOURCE_LOCK.md` | Approval and modification rules for protected source artwork. |
| `00_Source_Locked/WTL_Approved_Source_1536x1024.png` | Approved source reference. |
| `MANIFEST.json` | Machine-readable file index with dimensions and SHA-256 values. |
| `MANIFEST.csv` | Spreadsheet-friendly manifest. |
| `CHECKSUMS.sha256` | CLI checksum verification source. |
| `RELEASE_NOTES.md` | Kit release notes. |

## Subfolder map

| Folder | Use |
| --- | --- |
| `Brand Kit/` | Logos, layered masters, colors, typography, design tokens, guidelines, and vendor handoff. |
| `Documentation/` | CSS, design, font, asset, and platform guidance. |
| `WebAPP/` | Web/PWA brand exports, manifest, CSS, and React component. |
| `iOS/` | AppIcon set, BrandLogo imageset, and SwiftUI constants. |
| `Android/` | Launcher assets, Play icon, XML, colors, and Kotlin/Compose constants. |
| `Media Kit/` | Press, social, Open Graph, and email signature assets. |
| `Standard Document Set/` | Editable DOCX/DOTX document templates and PDF previews. |

## SYSTEMX integration notes

- Keep the kit in `.SYSTEMX/KIT/Production/` so it is part of the operational
  layer, not the public deployable app bundle.
- Do not import kit files into `src/` unless the project intentionally needs a
  public brand asset.
- Use `MANIFEST.json` and `CHECKSUMS.sha256` to verify kit integrity after
  transfers, archives, or automation updates.
- Treat kit updates as versioned source updates. Do not overwrite v1.0 assets
  silently with generated replacements.
