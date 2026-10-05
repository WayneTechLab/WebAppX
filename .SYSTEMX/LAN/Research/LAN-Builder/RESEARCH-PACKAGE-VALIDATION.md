# Validation Report

Status: **PASSED**  
Package: **SFWA-WTL-LAN-BUILDER-DESIGNER-RESEARCH-PACKAGE-v1.0.0**  
Validation date: **2026-08-05**

## Structural expectations

- exactly 200 unique local research records;
- exactly 160 primary capability records, 20 standards/security records, and 20 comparator records;
- stable `REF-001..REF-160`, `STD-001..STD-020`, and `CMP-001..CMP-020` keys with no external locator field;
- at least 90 feature rows and 100 backlog tasks;
- at least 13 roadmap waves, 25 risks, and 20 wiki repairs;
- every JSON file parses;
- no empty files or prohibited identity tokens;
- every entry in `RESEARCH-PACKAGE-SHA256SUMS.txt` matches the file bytes.

## Validator output

```text
LAN Builder Designer package validator
[PASS] package-root
[PASS] manifest
[PASS] checksums
[PASS] no-empty-files
[PASS] identity-scan
[PASS] json-parse
[PASS] source-count: 200
[PASS] source-ids: REF-001..REF-160, STD-001..STD-020, and CMP-001..CMP-020
[PASS] source-refs: stable local keys
[PASS] external-locators: omitted
[PASS] source-groups: 160 / 20 / 20
[PASS] source-csv-count: 200
[PASS] planning row minimums
VALIDATION PASSED
```

Run `python3 tools/validate_package.py` from this package directory, or
`npm run research:validate` from the repository root. The validator is offline:
it proves package structure, counts, JSON/CSV validity, identity policy, and
checksums. It does not claim that the current G1 slice already implements the
future Designer kernel or structural source round-trip waves.
