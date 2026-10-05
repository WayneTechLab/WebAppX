# Webflow-Class Research Overlay — Wave 0 Evidence

**Repository:** `SFWA-WTL-G1`  
**Date:** 2026-08-05  
**Scope:** local/private checkout before publication synchronization

## Research package

- Package validator: passed all 29 checks.
- Source corpus: 200 unique sources; 160 first-party Webflow, 20
  standards/security, and 20 comparator sources.
- Planning inventory: 91 feature rows, 106 backlog tasks, 13 roadmap waves, 27
  risks, 91 acceptance criteria, and 25 Wiki repair records.
- Clean-room notice retained under the package README and license/notice files.

## Integrated repository surfaces

- `.SYSTEMX/LAN/Research/Webflow/` preserves the research and planning corpus.
- `.SYSTEMX/LAN/Builder/contracts/` contains draft designer contracts and the
  current capability manifest.
- `.SYSTEMX/LAN/tests/characterization.test.mjs` exercises the current LAN
  boundary without overwriting the operator session record.
- README, `.SYSTEMX`, status, and Wiki source now distinguish current G1
  capabilities from the future Designer roadmap.
- Secret guidance now uses a never-paste policy; the setup capture path rejects
  secret-shaped configuration keys.

## Local port evidence

At review time, the current checkout was reachable at:

| Surface | Result | Ownership |
| --- | --- | --- |
| `127.0.0.1:5173` | Vite app and `/__systemx/` bridge returned HTTP 200 | this checkout |
| `127.0.0.1:7331` | direct SYSTEMX LAN returned HTTP 200 | this checkout |
| `127.0.0.1:8080` | HTTP 200 but owned by `/Users/waynetechlab/Documents/HFS` | unrelated; untouched |

The manually running 5173/7331 processes were verified by working directory and
were not stopped. `npm run systemx:session:status` reported no owned session
record because those processes were started outside `dev-session.mjs`; this is
recorded as a runtime distinction, not treated as a failed port check.

## Wave 0 exit criteria

The characterization and structural gates must pass again immediately before
commit/publication:

```bash
npm test
node .SYSTEMX/scripts/validate-markdown-links.mjs
node .SYSTEMX/scripts/verify-template-structure.mjs
npm run sync:system:check
npm run build
npm run ci:security
```

Wave 1 remains blocked until the Wiki repair scan, schema decisions, and this
evidence packet are reviewed with the resulting command output. Future waves
must not be marked complete from this document alone.
