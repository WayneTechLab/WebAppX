# Adopt a private WTL webapp clone

```bash
# Requires repository access. Choose your own destination and Firebase configuration.
gh repo create my-private-app --template WayneTechLab/WebAppX --private --clone
cd my-private-app
npm ci
npm run systemx:status
npm run systemx:validate
npm run dev:systemx
```

The template ships blank context, plan, task and memory records. Configure
`.SYSTEMX/project.json` for your application and populate only your own accepted
work. Retain the selected managed release snapshot and `INSTALLATION.json`
together. Use `npm run systemx -- roles-init` to preview event/review role setup;
activate roles explicitly in the adopted project when needed.

For an existing application, use the reviewed standalone additive installer
instead of copying a template over existing records. Keep its existing ledger,
code, service configuration and authority boundaries.

For later standalone updates, keep a reviewed dotSYSTEMX source checkout on the
machine and use `WTL_SYSTEMX_SOURCE=/path/to/dotSYSTEMX npm run systemx:upstream:check`.
See [integration](../SYSTEMX-INTEGRATION.md) for the complete import/verification flow.
