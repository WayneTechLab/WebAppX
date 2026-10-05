# Repo Learning Scrape

The repo manifest scraper inventories accessible WayneTechLab repositories for
setup and operations patterns:

- `.SYSTEMX` layout
- GitHub workflows
- setup/deploy/security scripts
- package scripts
- Firebase config files
- docs/runbooks/wiki surfaces
- MCP/dev tooling hints

It does not copy app code into the template. Use the manifest to identify
reusable patterns, then document those patterns in modules or steps.

## Commands

```bash
node .SYSTEMX/Unified-Setup-Process/scrape/repo-manifest-scraper.mjs --list
node .SYSTEMX/Unified-Setup-Process/scrape/repo-manifest-scraper.mjs --dry-run
node .SYSTEMX/Unified-Setup-Process/scrape/repo-manifest-scraper.mjs --write
```

`--write` creates `repo-manifest.json`.

The default scan is capped at 25 repos for speed. Set `WSG_REPO_LIMIT=120` for a
broader authenticated inventory.
