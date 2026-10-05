# Packaged research validation

The historical report below described the original research package before
repository packaging. Its checksum list referenced 16 paths that were renamed
or omitted during packaging. Unified template 3.1.0 retains that original list
and manifest in `*.original.*` and supplies a new packaged inventory.
`npm run template:check` verifies the current inventory; it does not rerun the
historical research methodology or implement the planned Designer features.

# Validation Report

Status: **PASSED**  
Package: **SFWA-WTL-WEBFLOW-RESEARCH-MASTER-PLAN-v1.0.0**  
Validation date: **2026-08-05**

## Structural expectations

- exactly 200 unique research URLs;
- exactly 160 first-party Webflow sources;
- source IDs `1..200` and unique stable source keys;
- at least 90 feature rows and 100 backlog tasks;
- at least 13 roadmap waves, 25 risks, and 20 wiki repairs;
- every JSON file parses;
- no empty files;
- every entry in `SHA256SUMS.txt` matches the file bytes.

## Validator output

```text
SYSTEMX Webflow Master Plan validator — 29 checks
[PASS] required:00_README.md: required package file
[PASS] required:MANIFEST.json: required package file
[PASS] required:SHA256SUMS.txt: required package file
[PASS] required:.SYSTEMX/LAN/Research/Webflow/00-EXECUTIVE-SUMMARY.md: required package file
[PASS] required:.SYSTEMX/LAN/Research/Webflow/20-IMPLEMENTATION-MASTER-PLAN.md: required package file
[PASS] required:sources/SOURCE-CATALOG-200.csv: required package file
[PASS] required:sources/SOURCE-CATALOG-200.json: required package file
[PASS] required:planning/FEATURE-MATRIX.csv: required package file
[PASS] required:planning/BACKLOG.csv: required package file
[PASS] required:planning/ROADMAP.csv: required package file
[PASS] required:planning/RISK-REGISTER.csv: required package file
[PASS] required:planning/WIKI-REPAIR-MATRIX.csv: required package file
[PASS] required:INJECT/.SYSTEMX/LAN/WEBFLOW-DEEP-RESEARCH-MASTER-PLAN.md: required package file
[PASS] required:INJECT/.SYSTEMX/LAN/Builder/contracts/designer-document.schema.json: required package file
[PASS] json-parse: 20 JSON files
[PASS] source-count: found 200
[PASS] source-global-ids: IDs must be 1..200
[PASS] source-ids-unique: source_id uniqueness
[PASS] source-urls-unique: URL uniqueness
[PASS] webflow-source-count: must be exactly 160
[PASS] source-url-shape: all sources use HTTPS
[PASS] source-csv-count: found 200
[PASS] rows:planning/FEATURE-MATRIX.csv: found 91, minimum 90
[PASS] rows:planning/BACKLOG.csv: found 106, minimum 100
[PASS] rows:planning/ROADMAP.csv: found 13, minimum 13
[PASS] rows:planning/RISK-REGISTER.csv: found 27, minimum 25
[PASS] rows:planning/WIKI-REPAIR-MATRIX.csv: found 25, minimum 20
[PASS] no-empty-files: 
[PASS] checksums: 
VALIDATION PASSED
```

The validator is offline. It proves package structure, counts, JSON validity, and checksums. The separate research pass live-resolution reviewed all 200 catalog entries on 2026-08-05, with canonical-route confirmation used for redirected, reorganized, or unusually large pages. Neither check guarantees that third-party URLs will remain unchanged after the research cut.
