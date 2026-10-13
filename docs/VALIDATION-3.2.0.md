# WebAppX 3.2.0 validation — 2026-10-12

This receipt covers the public reusable WebAppX source template on macOS Apple
Silicon. The managed defaults are dotSYSTEMX **1.9.0-alpha.5**, imported from
public main **aba9620ac07c9fe27572fd37ba80df8d1deeded4**. The distribution manifest
SHA-256 is **483e564855c8f3ecd9255a06fdb7994a0df85cc23fa3a531ecd638746378cd37**.
The [import receipt](../.SYSTEMX/imports/1.9.0-alpha.5.json) records the exact
source revision, fingerprint and recognized bootstrap changes. Installation
policy selects and pins this version with manual updates.

## Integrated changes

- Add optional Agent Y CLI delegation and draft PR lifecycle, explicit installed
  CLI child-project routing, current CLI/tools guidance, and new workflow media.
- Ship blank access matrices and project maps for root and child creation seeds.
  The registry still seeds only Agent 0, with no tasks or registered projects.
- Refresh recognized stock bootstraps with exact local backups before additive
  imports. Preserve adopted records and customized extensions; reject customized
  bootstraps, source revision changes and unsafe receipt paths before mutation.
- Verify all retained snapshots and schema-2 binary bytes while supporting
  reviewed text newline equivalence, including outer Windows CRLF bootstraps.
- Run unchanged upstream tests in a verified temporary snapshot copy with exact
  repository packaging metadata bound to the import commit and its own SHA-256.
- Keep documentation checks out of private runtime folders and symlink targets.
  Make check-mode deployment metadata read only.

## Verification results

The complete `npm run ci:all` gate exited successfully. It used Node v25.8.1,
npm 11.11.0 and Python 3.14.5 with dependencies installed locally using `npm ci`.

| Gate | Observed result |
| --- | --- |
| Template seeds, retained releases and root bootstraps | Passed |
| Selected managed defaults | Integrity verified; manual pin 1.9.0-alpha.5 |
| Project-record validation | Passed; blank reusable records preserved |
| Host governance drift | No drift detected |
| Research inventories and checksums | Passed |
| Unchanged upstream suite | 230 tests; successful with 5 filesystem-specific skips |
| Import, template and mirror regressions | 27 tests passed |
| Operational controls | 8 tests passed |
| App/LAN characterization and security controls | 11 tests passed |
| Lint and TypeScript | Passed |
| Markdown links | Passed across 604 files |
| Security, account-level, auth/MFA and AI standards | Passed |
| Root and starter dependency audits | Zero vulnerabilities reported |
| Production build and LAN isolation | Passed |
| `npm run deploy -- hosting --preflight` | Passed; no push or Firebase deployment |

The corrected preflight also preserved all six examined metadata paths byte
for byte: deployment journal, deployment count, app version text, version JSON,
changelog, and public version metadata. Its temporary/local logs remain outside
the tracked release changes. Deployment count remains zero.

The strict audit initially detected source-map-js 1.2.1. Both root and starter
locks now resolve 1.2.2, the patched version identified by
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
The previous shared dependency link was retained in ignored local history;
the sibling repository's dependency installation was preserved.

## Preservation and evidence limits

The original 1.8.6-alpha.1 managed snapshot and its fingerprint are unchanged.
Git comparisons also found no changes to app source, Firebase rules/configuration,
LAN controls and research, production/brand kits, or frozen original media bytes.
The host and starter package versions are aligned at 3.2.0.

Five upstream tests require distinct case spellings on a case-sensitive
filesystem and were skipped by their existing guards on this host. Windows
x64/ARM64 runtime acceptance was not executed. Native Windows Agent Y execution
retains the upstream fail-closed limitation for descendant process termination.
Source and local checks do not establish Firebase cloud, device or staff
acceptance. The [3.1.0 receipt](VALIDATION-3.1.0.md) retains its original scope.
