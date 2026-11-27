"""Check the tracked Excel snapshot in CI using only the Python standard library."""

import hashlib
import json
import posixpath
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile


DIRECTORY = Path(__file__).resolve().parent
BACKLOG = DIRECTORY.parents[2] / "docs" / "backlog"
X = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def cell_value(cell, strings):
    if cell.get("t") == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(X + "t"))
    value = cell.findtext(X + "v", default="")
    return strings[int(value)] if cell.get("t") == "s" else value


def check():
    catalog = (BACKLOG / "lan-10000.json").read_bytes()
    ledger = (BACKLOG / "lan-10000-progress.json").read_bytes()
    items = json.loads(catalog)["items"]
    accepted = {record["id"] for record in json.loads(ledger)["completions"]}
    expected = {
        item["id"]: "Accepted" if item["id"] in accepted else
        "Ready" if accepted.issuperset(item["dependsOn"]) else "Waiting"
        for item in items
    }
    stamps = {
        "Requirements": "Ledger SHA-256   " + hashlib.sha256(ledger).hexdigest(),
        "Criteria": "Catalog SHA-256   " + hashlib.sha256(catalog).hexdigest(),
    }
    with ZipFile(DIRECTORY / "LAN-10000-Progress.xlsx") as archive:
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {row.get("Id"): row.get("Target") for row in relationships}
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheets = {sheet.get("name"): targets[sheet.get(REL)] for sheet in workbook.iter(X + "sheet")}
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            with archive.open("xl/sharedStrings.xml") as source:
                for _, node in ET.iterparse(source):
                    if node.tag == X + "si":
                        strings.append("".join(part.text or "" for part in node.iter(X + "t")))
                        node.clear()
        for name, stamp in stamps.items():
            target = sheets[name]
            member = target.lstrip("/") if target.startswith("/") else posixpath.join("xl", target)
            seen_stamp = False
            seen_ids = set()
            with archive.open(member) as source:
                for _, row in ET.iterparse(source):
                    if row.tag != X + "row":
                        continue
                    number = int(row.get("r"))
                    if number == 3:
                        cell = row.find(f"{X}c[@r='A3']")
                        seen_stamp = cell is not None and cell_value(cell, strings) == stamp
                        if not seen_stamp:
                            raise ValueError(f"{name} has a stale source hash")
                        if name == "Criteria":
                            break
                    if number >= 5 and name == "Requirements":
                        key = row.find(f"{X}c[@r='A{number}']")
                        status = row.find(f"{X}c[@r='E{number}']")
                        if key is None and status is None:
                            row.clear()
                            continue
                        if key is None or status is None:
                            raise ValueError(f"Missing ID or status at row {number}")
                        item = cell_value(key, strings)
                        if item in seen_ids or item not in expected or cell_value(status, strings) != expected[item]:
                            raise ValueError(f"Duplicate, missing or stale requirement at row {number}")
                        seen_ids.add(item)
                    row.clear()
            if not seen_stamp or (name == "Requirements" and seen_ids != expected.keys()):
                raise ValueError(f"{name} is incomplete")
    print(f"Excel progress verified: {len(expected)} unique requirements, {len(accepted)} accepted.")


if __name__ == "__main__":
    try:
        check()
    except (OSError, BadZipFile, ValueError, KeyError, IndexError, ET.ParseError) as error:
        sys.exit(f"Excel progress check failed: {error}. See .SYSTEMX/LAN/Progress/README.md.")
