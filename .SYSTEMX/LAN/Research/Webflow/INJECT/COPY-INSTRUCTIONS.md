# Copy and Merge Instructions

This ZIP is a research and implementation-planning package. It does not modify the GitHub repository automatically.

## Review-first merge

From a clean working branch at the root of `SFWA-WTL-TEMPLATE`:

```bash
# Extract this package outside the repository first.
python tools/validate_package.py

# Inspect the inject tree.
find INJECT -type f -maxdepth 8 -print

# Copy proposed files into a working branch only after review.
rsync -av --itemize-changes INJECT/ ./

git status --short
git diff -- .SYSTEMX wiki
```

On systems without `rsync`, copy the contents of `INJECT/` while preserving relative paths.

## Important

- The proposed JSON Schemas are architecture drafts (`schemaVersion: 1`) and should be reviewed before becoming canonical.
- Do not overwrite newer repository content blindly.
- Do not remove current `server.mjs`, `Website_Dashboard.html`, or dashboard assets until characterization tests and compatibility adapters exist.
- Begin with Wave 0; do not inject all future features in one unreviewed code wave.
- Keep the full research package outside public application source or under a documentation-only `.SYSTEMX` path ignored by product builds.

## Validation after merge

Run the repository's **current** verified commands from `package.json`; do not rely on stale wiki aliases. At minimum, preserve typecheck, lint, build, LAN isolation, and relevant security checks. Add the new docs/path/command validator during Wave 0.
