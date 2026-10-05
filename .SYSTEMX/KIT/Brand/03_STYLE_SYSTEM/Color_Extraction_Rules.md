# Color Extraction Rules

1. Analyze the approved client logo, not screenshots of a website.
2. Select 4-5 primary colors: dominant accent, dark accent, highlight/accent, light neutral, dark neutral.
3. Select 4-6 secondary neutrals for layout support.
4. Preserve the exact logo colors when the client provides official values.
5. When values are sampled from raster artwork, label them `approximate sampled values`.
6. Provide HEX and RGB for digital use. Provide CMYK as a print starting point, not a guaranteed press match.
7. Avoid heavy full-page color fills. Keep the booklet warm-white and print-friendly.
8. Verify body-text contrast against backgrounds.

Run `python 05_SCRIPTS/extract_palette.py 01_INPUT/CLIENT_LOGO.png` to create a starting palette JSON.
