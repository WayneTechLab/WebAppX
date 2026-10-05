# SYSTEMX Production Kit

The **SYSTEMX Production Kit** lives in:

```text
.SYSTEMX/KIT/Production/
```

It embeds **Wayne Tech Lab LLC. Master Production Kit v1.0** inside the public
template as both:

1. a SYSTEMX tool source for brand, media, platform, web, mobile, and document
   production work; and
2. a standalone repo folder that an LLM, SDK, CLI, MCP tool, or browser agent can
   read directly from GitHub.

## GitHub URLs

- Folder:
  [`.SYSTEMX/KIT/Production`](https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/KIT/Production)
- SYSTEMX kit index:
  [SYSTEMX-KIT-INDEX.md](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/KIT/Production/SYSTEMX-KIT-INDEX.md)
- Raw README:
  <https://raw.githubusercontent.com/WayneTechLab/WebAppX/main/.SYSTEMX/KIT/Production/README.md>

## What is included

| Area | Contents |
| --- | --- |
| Protected source | Approved Wayne Tech Lab source image and source-lock rules. |
| Brand Kit | Logos, layered masters, colors, typography, tokens, guidelines, and vendor handoff. |
| WebAPP | Web/PWA brand files, CSS, manifest, and React component. |
| iOS | AppIcon set, BrandLogo imageset, and SwiftUI constants. |
| Android | Launcher assets, Play icon, XML assets, colors, and Kotlin/Compose constants. |
| Media Kit | Press, social, Open Graph, and email signature assets. |
| Standard Document Set | DOCX, DOTX, and PDF executive document templates. |
| Manifest and checksums | JSON/CSV manifests and SHA-256 verification records. |

## LLM usage prompt

```text
Use the Wayne Tech Lab LLC Master Production Kit at:
https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/KIT/Production

Read SYSTEMX-KIT-INDEX.md first. Then read README.md,
00_Source_Locked/SOURCE_LOCK.md, Documentation/ASSET_MANIFEST.md, and
MANIFEST.json. Use only the subfolder relevant to my requested output.

Preserve the protected source artwork rules. Do not redraw or change the logo,
world map, arc, gradients, wordmark placement, or proportions unless I
explicitly approve a new kit version.

Return a file-by-file implementation plan before editing.
```

## SYSTEMX rule

The Production Kit is a source package. It should remain under `.SYSTEMX/KIT/`
unless a generated project intentionally promotes a specific asset into the
public application. This keeps the kit available to operators and LLMs without
accidentally making the entire kit part of a website deploy.
