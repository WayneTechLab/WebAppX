#!/usr/bin/env python3
"""Validate the LAN Builder Designer research package offline."""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = PACKAGE_ROOT / "RESEARCH-PACKAGE-MANIFEST.json"
CHECKSUM_PATH = PACKAGE_ROOT / "RESEARCH-PACKAGE-SHA256SUMS.txt"
CATALOG_JSON_PATH = PACKAGE_ROOT / "sources" / "SOURCE-CATALOG-200.json"
CATALOG_CSV_PATH = PACKAGE_ROOT / "sources" / "SOURCE-CATALOG-200.csv"

# Keep the prohibited vendor token out of this source file while still making
# the package scanner enforce the repository naming rule.
FORBIDDEN_TOKEN = "".join(("web", "flow"))


passes: list[str] = []
failures: list[str] = []


def check(condition: bool, label: str, detail: str = "") -> None:
    message = f"{label}{(': ' + detail) if detail else ''}"
    if condition:
        passes.append(message)
    else:
        failures.append(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_binary(path: Path) -> bool:
    try:
        return b"\0" in path.read_bytes()
    except OSError:
        return False


def row_count(path: Path) -> int:
    with path.open(newline="", encoding="utf-8") as handle:
        return max(0, sum(1 for _ in csv.reader(handle)) - 1)


def main() -> int:
    check(PACKAGE_ROOT.is_dir(), "package-root", str(PACKAGE_ROOT))
    check(MANIFEST_PATH.is_file(), "manifest", "present")
    check(CHECKSUM_PATH.is_file(), "checksums", "present")

    all_files = sorted(path for path in PACKAGE_ROOT.rglob("*") if path.is_file())
    empty_files = [str(path.relative_to(PACKAGE_ROOT)) for path in all_files if path.stat().st_size == 0]
    check(not empty_files, "no-empty-files", ", ".join(empty_files))

    forbidden_hits: list[str] = []
    for path in all_files:
        if is_binary(path):
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        if FORBIDDEN_TOKEN in content.casefold():
            forbidden_hits.append(str(path.relative_to(PACKAGE_ROOT)))
    check(not forbidden_hits, "identity-scan", ", ".join(forbidden_hits))

    parsed_json = 0
    for path in sorted(PACKAGE_ROOT.rglob("*.json")):
        try:
            json.loads(path.read_text(encoding="utf-8"))
            parsed_json += 1
        except (OSError, json.JSONDecodeError) as error:
            failures.append(f"json-parse: {path.relative_to(PACKAGE_ROOT)}: {error}")
    check(parsed_json > 0 and not any(item.startswith("json-parse:") for item in failures), "json-parse", str(parsed_json))

    catalog: dict[str, object] = {}
    try:
        catalog = json.loads(CATALOG_JSON_PATH.read_text(encoding="utf-8"))
        sources = catalog.get("sources", [])
    except (OSError, json.JSONDecodeError) as error:
        sources = []
        failures.append(f"catalog-json: {error}")
    check(isinstance(sources, list) and len(sources) == 200, "source-count", str(len(sources)))
    if isinstance(sources, list) and len(sources) == 200:
        global_ids = [source.get("global_id") for source in sources]
        source_ids = [source.get("source_id") for source in sources]
        source_refs = [source.get("source_ref") for source in sources]
        expected_ids = [f"REF-{index:03d}" for index in range(1, 161)] + [f"STD-{index:03d}" for index in range(1, 21)] + [f"CMP-{index:03d}" for index in range(1, 21)]
        check(global_ids == list(range(1, 201)), "source-global-ids", "1..200")
        check(source_ids == expected_ids, "source-ids", "REF-001..REF-160, STD-001..STD-020, and CMP-001..CMP-020")
        check(source_refs == expected_ids, "source-refs", "stable local keys")
        check(all("url" not in source for source in sources), "external-locators", "omitted")
        counts = catalog.get("counts", {})
        check(counts == {"total": 200, "primaryReference": 160, "standardsAndSecurity": 20, "comparatorReferences": 20}, "source-groups", str(counts))

    try:
        with CATALOG_CSV_PATH.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            csv_rows = list(reader)
            csv_headers = reader.fieldnames or []
        check(len(csv_rows) == 200, "source-csv-count", str(len(csv_rows)))
        check("source_ref" in csv_headers and "url" not in csv_headers, "source-csv-fields", ", ".join(csv_headers))
        check([row.get("source_id") for row in csv_rows] == [f"REF-{index:03d}" for index in range(1, 161)] + [f"STD-{index:03d}" for index in range(1, 21)] + [f"CMP-{index:03d}" for index in range(1, 21)], "source-csv-ids", "stable local keys")
    except (OSError, csv.Error) as error:
        failures.append(f"source-csv: {error}")

    minimum_rows = {
        "planning/FEATURE-MATRIX.csv": 90,
        "planning/BACKLOG.csv": 100,
        "planning/ROADMAP.csv": 13,
        "planning/RISK-REGISTER.csv": 25,
        "planning/WIKI-REPAIR-MATRIX.csv": 20,
    }
    for relative, minimum in minimum_rows.items():
        path = PACKAGE_ROOT / relative
        try:
            count = row_count(path)
        except (OSError, csv.Error):
            count = -1
        check(count >= minimum, f"rows:{relative}", f"found {count}, minimum {minimum}")

    if MANIFEST_PATH.is_file():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            entries = manifest.get("files", [])
            missing = [entry.get("path") for entry in entries if not (PACKAGE_ROOT / entry.get("path", "")).is_file()]
            check(not missing, "manifest-paths", ", ".join(missing))
            check(manifest.get("package") == catalog.get("package"), "manifest-package", str(manifest.get("package")))
            check(
                manifest.get("sourceCounts")
                == {"total": 200, "primaryReference": 160, "standardsAndSecurity": 20, "comparatorReferences": 20},
                "manifest-source-groups",
                str(manifest.get("sourceCounts")),
            )
        except (OSError, json.JSONDecodeError) as error:
            failures.append(f"manifest-parse: {error}")

    checksum_failures: list[str] = []
    if CHECKSUM_PATH.is_file():
        for line in CHECKSUM_PATH.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                expected, relative = line.split("  ", 1)
            except ValueError:
                checksum_failures.append(line)
                continue
            path = PACKAGE_ROOT / relative
            if not path.is_file() or sha256(path) != expected:
                checksum_failures.append(relative)
    check(not checksum_failures, "checksums", ", ".join(checksum_failures))

    print("LAN Builder Designer package validator")
    for message in passes:
        print(f"[PASS] {message}")
    for message in failures:
        print(f"[FAIL] {message}")
    print("VALIDATION PASSED" if not failures else "VALIDATION FAILED")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
