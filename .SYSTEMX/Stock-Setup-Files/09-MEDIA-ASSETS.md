# 09 Media And Assets Standard

Use this file when an LLM is working with images, video, icons, fonts, uploads,
downloads, product media, or social preview assets.

## Media Principles

- Use real or generated bitmap imagery when a page needs visual assets.
- Use specific product/place/person/state media when users need to inspect a
  real thing.
- Avoid dark, blurred, cropped, stock-like, or purely atmospheric media for
  product or operational pages.
- Use SVG or code-generated visuals for icons, simple diagrams, and custom game
  or tool assets.
- Keep source assets organized and documented.

## Standard Asset Folders

Use these paths unless a project has a stronger convention:

- `public/`: public static files.
- `public/media/`: public images/video/audio.
- `public/og/`: Open Graph and social preview images.
- `src/assets/`: imported app assets.
- `.SYSTEMX/docs/`: media policy and runbook notes.
- `.SYSTEMX/Unified-Setup-Process/intake/`: human-provided brand/media notes.

## Required Media Metadata

For production media, track:

- Filename.
- Purpose.
- Source/owner.
- License.
- Alt text.
- Dimensions.
- Optimization status.
- Replacement plan if temporary.

## Optimization Rules

- Prefer modern formats when safe: WebP/AVIF for images, MP4/WebM for video.
- Keep large assets out of the JavaScript bundle unless import is required.
- Use explicit dimensions or aspect ratios to avoid layout shift.
- Add meaningful alt text for informative images.
- Use empty alt text only for decorative images.
- Do not commit raw, oversized working files unless they are intentionally part
  of the template.

## Security Rules

- Validate upload content type and size in Storage rules.
- Never trust client-provided file names as authorization.
- Store private uploads behind account-level rules.
- Keep public media paths intentionally public and documented.

