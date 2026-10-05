# Additional Production Notes

- Keep the source-lock folder read-only in source control.
- Use semantic versioning for future brand releases.
- Preserve both white-background and transparent exports.
- Use the supplied icon canvases for app stores; do not crop the map or arc manually.
- Test transparent assets on both light and dark backgrounds before release.
- Store vendor-specific CMYK conversions outside the source-lock folder.
- Do not package or redistribute font files; reference approved font families through platform tooling.
- Run checksum verification after transferring the ZIP to long-term storage.
