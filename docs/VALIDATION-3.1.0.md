# Unified template 3.1.0 validation

Validated locally on macOS Apple Silicon on 2026-10-04. These results concern
source/tooling and local runtime tests, not a deployed Firebase environment.

| Check | Result |
| --- | --- |
| `npm ci` and strict `npm run ci:audit` | 0 vulnerabilities |
| `npm run ci:all` | Passed |
| Selected SYSTEMX tools suite | 143 tests: 138 passed, 5 platform-dependent cases skipped |
| Host import/mirror suite | 12 tests passed |
| LAN characterization | 9 tests passed |
| TypeScript and ESLint | Passed |
| Markdown links and host governance | Passed |
| Template seed, version and research validation | Passed |
| Selected immutable distribution | 141 payload files match current dotSYSTEMX bytes; manifest fingerprint verified |
| `npm run systemx:upstream:check` | Current public main b69801848a4f7b990c4ab4380bf435f37671e13a; no missing defaults |
| App build and LAN production isolation | Passed |
| `npm run deploy -- hosting --preflight` | Passed; no hosting deployment, Git commit or push performed by preflight |

The tests exercise imports preserving adopted records, ignored/untracked
collision refusal, read-only mirror previews, dirty-target refusal, immutable
upstream tamper detection and blank reusable records. LAN tests exercise
loopback guards, local read models, managed operating records and protected
runtime/source boundaries.

The Webflow research inventory now matches its packaged paths. Original
manifest/checksum evidence is retained alongside it. The LAN-Builder research
package and managed release files retain their original bytes.

Repository publication is verified separately against each live main ref and
identical Git tree. Existing histories remain independent. The separate
standalone dotSYSTEMX repository was not modified by this host integration.
