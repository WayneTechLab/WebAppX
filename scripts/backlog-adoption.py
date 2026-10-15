#!/usr/bin/env python3
"""Reviewed, local proposal intake. No worker execution, secrets or provider I/O."""

import argparse
import copy
from contextlib import ExitStack
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
CATALOG = "docs/backlog/webappx-1000-todo.json"
LIMIT = 40
RECORD_DIRS = ("GLOBAL", "PLAN", "WORK", "MEMORY", "AGENTS", "EVENTS", "REVIEWS", "DECISIONS", "SYNC")
RECORD_FILES = ("START-HERE.md", "AGENTS.md", "CURRENT.md", "project.json", "SOURCES.json")
BOUNDARY = "Reported gates are planning observations, not verified access or execution authority. TODO intake never establishes execution readiness."


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else encoded(value).encode()).hexdigest()


def parse(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON field: " + key)
            result[key] = value
        return result
    def invalid(value):
        raise ValueError("Non-finite JSON value: " + value)
    return json.loads(data, object_pairs_hook=unique, parse_constant=invalid)


def fields(value, keys, label):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(label + " has missing or unknown fields")


def text(value, label, *, empty=False, limit=1000):
    if (not isinstance(value, str) or len(value) > limit or any(ord(c) < 32 or ord(c) == 127 for c in value)
            or (not empty and not value.strip())):
        raise ValueError(label + " must be bounded single-line text")


def names(value, label):
    if not isinstance(value, list) or len(value) > LIMIT or len(set(map(encoded, value))) != len(value):
        raise ValueError(label + " must be a bounded unique list")
    for name in value:
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_.:-]{0,79}", name):
            raise ValueError(label + " entries must be labels, never credential values")


def selected_tools():
    installation = parse((ROOT / ".SYSTEMX/INSTALLATION.json").read_bytes())
    version = installation["activeVersion"]
    if not isinstance(version, str) or not re.fullmatch(r"[0-9A-Za-z.+-]+", version):
        raise ValueError("Invalid selected SYSTEMX release")
    defaults = ROOT / ".SYSTEMX/.systemx/releases" / version
    spec = importlib.util.spec_from_file_location("systemx", defaults / "scripts/systemx.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["systemx"] = module
    exec(compile((defaults / "scripts/systemx.py").read_bytes(), str(spec.origin), "exec"), module.__dict__)
    return module, defaults


TOOLS, DEFAULTS = selected_tools()
MEMORY = TOOLS.project_memory
WORKSPACES = TOOLS.project_workspaces


def committed_catalog(revision):
    """Resolve a local commit and prove the currently reviewed bytes belong to it."""
    text(revision, "Catalog revision", limit=200)
    def git(arguments):
        result = subprocess.run(["git", "-C", str(ROOT), *arguments], capture_output=True, check=False)
        if result.returncode:
            raise ValueError("Catalog provenance requires an available local commit and catalog; no fetch is performed")
        return result.stdout
    resolved = git(["rev-parse", "--verify", "--end-of-options", revision + "^{commit}"]).decode().strip()
    if not re.fullmatch(r"[0-9a-f]{40}", resolved):
        raise ValueError("Catalog revision did not resolve to a full commit")
    data = git(["show", resolved + ":" + CATALOG])
    if data != (ROOT / CATALOG).read_bytes():
        raise ValueError("Current catalog bytes differ from the selected committed catalog; review and commit before intake")
    catalog = parse(data)
    return catalog, {"revision": resolved, "catalogSha256": digest(data), "provenance": "verified-local-commit"}


def validate_selection(selection):
    fields(selection, ("schemaVersion", "tasks", "dependencies", "gates"), "Adoption selection")
    if type(selection["schemaVersion"]) is not int or selection["schemaVersion"] != 1:
        raise ValueError("Selection schemaVersion must be integer 1")
    if not isinstance(selection["tasks"], list) or not 1 <= len(selection["tasks"]) <= LIMIT:
        raise ValueError("Explicitly select 1 to 40 proposals")
    ids = []
    for task in selection["tasks"]:
        fields(task, ("proposalId", "owner", "scope", "nextAction"), "Task selection")
        if not isinstance(task["proposalId"], str) or not re.fullmatch(r"WX-[0-9]{4}", task["proposalId"]):
            raise ValueError("Use WX-0001-style proposal IDs")
        ids.append(task["proposalId"])
        text(task["owner"], "Owner", limit=80)
        text(task["nextAction"], "Next action", empty=True)
        if not isinstance(task["scope"], list) or len(task["scope"]) > LIMIT:
            raise ValueError("Task scope must be a bounded list")
        for scope in task["scope"]:
            text(scope, "Task scope", limit=240)
    if len(ids) != len(set(ids)):
        raise ValueError("Selected proposal IDs must be unique")
    if not isinstance(selection["dependencies"], list) or len(selection["dependencies"]) > LIMIT:
        raise ValueError("Existing dependency mappings must be a bounded list")
    mapped = set()
    for entry in selection["dependencies"]:
        fields(entry, ("proposalId", "taskId", "reviewedBy", "reference"), "Reviewed dependency mapping")
        if (not isinstance(entry["proposalId"], str) or not re.fullmatch(r"WX-[0-9]{4}", entry["proposalId"])
                or not isinstance(entry["taskId"], str) or not re.fullmatch(r"TASK-[0-9]{3,}", entry["taskId"])
                or entry["reviewedBy"] not in ("agent.0", "user")):
            raise ValueError("Dependencies require a WX proposal, existing TASK and reviewedBy agent.0 or user")
        text(entry["reference"], "Dependency review reference", limit=500)
        if entry["proposalId"] in mapped or entry["proposalId"] in ids:
            raise ValueError("A proposal must have exactly one selected or existing TASK mapping")
        mapped.add(entry["proposalId"])
    if not isinstance(selection["gates"], list) or len(selection["gates"]) > LIMIT:
        raise ValueError("Gate constraints must be a bounded list")
    seen = set()
    for gate in selection["gates"]:
        validate_gate(gate)
        if gate["proposalId"] not in ids or gate["proposalId"] in seen:
            raise ValueError("Gates must name unique selected proposals")
        seen.add(gate["proposalId"])


def validate_gate(gate):
    fields(gate, ("proposalId", "criterionSha256", "action", "target", "requirements", "observations"), "Gate constraint")
    text(gate["proposalId"], "Gate proposal", limit=7)
    if not isinstance(gate["criterionSha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", gate["criterionSha256"]):
        raise ValueError("Gate constraints require the reviewed criterion SHA256")
    text(gate["action"], "Intended action", limit=240)
    text(gate["target"], "Action target", limit=240)
    dimensions = ("credentials", "operatorAuthorization", "localPrerequisites")
    fields(gate["requirements"], dimensions, "Gate requirements")
    fields(gate["observations"], dimensions, "Gate observations")
    for name in dimensions:
        requirement = gate["requirements"][name]
        fields(requirement, ("reviewed", "required"), name + " requirement")
        if type(requirement["reviewed"]) is not bool:
            raise ValueError("Requirement review must be explicit")
        if name == "operatorAuthorization":
            if type(requirement["required"]) is not bool:
                raise ValueError("Operator authorization requirement must be boolean")
            observation = gate["observations"][name]
            fields(observation, ("state", "action", "target", "by", "reference"), "Authorization observation")
            if observation["state"] not in ("authorized", "denied", "unknown"):
                raise ValueError("Invalid authorization observation")
            for key in ("action", "target", "by", "reference"):
                text(observation[key], "Authorization " + key, empty=observation["state"] == "unknown", limit=500)
        else:
            names(requirement["required"], name + " requirements")
            observations = gate["observations"][name]
            if not isinstance(observations, list) or len(observations) > LIMIT:
                raise ValueError("Observations must be bounded lists")
            observed = set()
            for observation in observations:
                fields(observation, ("name", "state", "reference"), name + " observation")
                names([observation["name"]], "Observation name")
                states = ("available", "unavailable", "unknown") if name == "credentials" else ("met", "unmet", "unknown")
                if observation["state"] not in states or observation["name"] in observed:
                    raise ValueError("Invalid or duplicate gate observation")
                text(observation["reference"], "Observation reference", empty=observation["state"] == "unknown", limit=500)
                observed.add(observation["name"])


def assess_gates(proposal, gate=None, dependencies=None):
    if gate and gate["criterionSha256"] != digest(proposal["acceptance"]):
        raise ValueError("Gate constraints refer to a changed acceptance criterion")
    dependencies = dependencies or []
    result = {"proposalId": proposal["id"], "criterionSha256": digest(proposal["acceptance"]),
              "sourceGate": proposal["gate"], "action": gate["action"] if gate else None,
              "target": gate["target"] if gate else None, "dimensions": {}, "dependencies": dependencies,
              "dependencyReadiness": "blocked" if any(row["status"] != "done" for row in dependencies) else "recorded_ready"}
    for name in ("credentials", "operatorAuthorization", "localPrerequisites"):
        requirement = gate["requirements"][name] if gate else None
        observation = gate["observations"][name] if gate else None
        state, reason = "unknown", "Requirements have not been reviewed"
        if requirement and requirement["reviewed"]:
            if not requirement["required"]:
                state, reason = "not_required", "Reviewed as not required for this action and target"
            elif name == "operatorAuthorization":
                if observation["action"] != gate["action"] or observation["target"] != gate["target"]:
                    state, reason = "unknown", "Authorization does not match the selected action and target"
                else:
                    state = {"authorized": "reported_ready", "denied": "blocked", "unknown": "unknown"}[observation["state"]]
                    reason = "Reported authorization for the selected action and target"
            else:
                observations = {row["name"]: row["state"] for row in observation}
                states = [observations.get(item, "unknown") for item in requirement["required"]]
                bad = "unavailable" if name == "credentials" else "unmet"
                state = "blocked" if bad in states else "unknown" if "unknown" in states else "reported_ready"
                reason = "Reported observations for every reviewed requirement; no secret values or access probes"
        result["dimensions"][name] = {"state": state, "reason": reason, "requirement": requirement, "observation": observation}
    states = [row["state"] for row in result["dimensions"].values()]
    result["executionReadiness"] = ("blocked" if "blocked" in states or result["dependencyReadiness"] == "blocked"
                                    else "unknown" if "unknown" in states else "reported_ready")
    return result


def target_scope(target, app, project=None, root=False):
    raw = Path(os.path.abspath(Path(target).expanduser()))
    resolved = raw.resolve(strict=True)
    if raw != resolved:
        raise ValueError("Select a real target path; aliases and symlink paths are refused")
    if (resolved == ROOT or resolved.is_relative_to(ROOT) or resolved.samefile(ROOT) or
            any(parent.samefile(ROOT) for parent in resolved.parents) or
            any(part.casefold() in (".systemx", ".systemxp") for part in resolved.parts)):
        raise ValueError("Target must be an adopted app outside the reusable source and managed paths")
    TOOLS.inspect_layout(resolved, required=True)
    outer = resolved / ".SYSTEMX"
    workspaces = WORKSPACES.Workspaces(outer, DEFAULTS)
    selection = workspaces.select(project, root=root)
    name, records, _ = selection
    config = MEMORY.read_json(records, "project.json")
    TOOLS.validate_config(config)
    text(app, "Selected app identity", limit=80)
    if config["project"]["name"] != app or app.casefold() == "webappx" or not app.strip():
        raise ValueError("Explicit app identity must match the configured adopted app and differ from WebAppX")
    if project is not None and app != project:
        raise ValueError("Selected app identity must match the exact registered child name")
    workspaces.validate_scope(selection)
    return workspaces, selection


def record_fingerprint(workspaces, selection):
    _, records, _ = selection
    hashes = {}
    def safe(name):
        return workspaces.safe((records / name).relative_to(workspaces.root).as_posix(), missing=True)
    def traversal_error(error):
        raise ValueError("Cannot fingerprint project records: " + str(error)) from error
    for name in RECORD_FILES:
        path = safe(name)
        if path.exists():
            if not path.is_file():
                raise ValueError("Expected a regular project record: " + name)
            hashes[name] = digest(path.read_bytes())
    for name in RECORD_DIRS:
        directory = safe(name)
        if not directory.exists():
            continue
        for parent, dirs, files in os.walk(directory, followlinks=False, onerror=traversal_error):
            entries = dirs + files
            if len({item.casefold() for item in entries}) != len(entries):
                raise ValueError("Case-conflicting project records")
            for entry in entries:
                path = Path(parent) / entry
                relative = path.relative_to(records).as_posix()
                checked = safe(relative)
                if checked.is_file():
                    hashes[relative] = digest(checked.read_bytes())
                elif not checked.is_dir():
                    raise ValueError("Project records must be regular files or directories")
    # The registry and root identity are independently bound for child scopes.
    hashes["@outer/Projects/REGISTRY.json"] = digest(workspaces.safe("Projects/REGISTRY.json").read_bytes())
    hashes["@outer/project.json"] = digest(workspaces.safe("project.json").read_bytes())
    hashes["@defaults/installation"] = digest((ROOT / ".SYSTEMX/INSTALLATION.json").read_bytes())
    return digest(hashes)


def build_plan(target, app, selection, catalog, source, *, project=None, root=False, stamp=None):
    """Pure preview over supplied catalog facts; CLI supplies verified committed facts."""
    validate_selection(selection)
    fields(source, ("revision", "catalogSha256", "provenance"), "Catalog provenance")
    if (not isinstance(source["revision"], str) or not re.fullmatch(r"[0-9a-f]{40}", source["revision"])
            or not isinstance(source["catalogSha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", source["catalogSha256"])
            or source["provenance"] not in ("verified-local-commit", "fixture-captured-facts")):
        raise ValueError("Missing valid catalog provenance")
    if not isinstance(catalog, dict) or not isinstance(catalog.get("items"), list):
        raise ValueError("Missing catalog items")
    proposals = {item["id"]: item for item in catalog["items"]}
    if len(proposals) != len(catalog["items"]):
        raise ValueError("Duplicate catalog proposal")
    workspaces, chosen = target_scope(target, app, project, root)
    _, records, _ = chosen
    ledger, registry = MEMORY.load(records)
    candidate = copy.deepcopy(ledger)
    stamp = stamp or MEMORY.now()
    MEMORY.timestamp(stamp)
    next_number = max((int(task["id"].split("-")[1]) for task in ledger["tasks"]), default=0) + 1
    mappings = {entry["proposalId"]: "TASK-{:03d}".format(next_number + i) for i, entry in enumerate(selection["tasks"])}
    existing = {task["id"]: task for task in ledger["tasks"]}
    for row in selection["dependencies"]:
        if row["taskId"] not in existing:
            raise ValueError("Reviewed dependency mapping names an unknown existing TASK")
        if row["proposalId"] not in proposals:
            raise ValueError("Reviewed dependency mapping names an unknown proposal")
        mappings[row["proposalId"]] = row["taskId"]
    used_external = set()
    tasks, mapping, assessments = [], [], []
    gates = {gate["proposalId"]: gate for gate in selection["gates"]}
    for entry in selection["tasks"]:
        proposal_id = entry["proposalId"]
        if proposal_id not in proposals:
            raise ValueError("Unknown selected proposal: " + proposal_id)
        proposal = proposals[proposal_id]
        marker = "Backlog adoption " + proposal_id + ";"
        if any(event["note"].startswith(marker) for task in ledger["tasks"] for event in task["history"]):
            raise ValueError("Proposal has already been adopted in this scope: " + proposal_id)
        dependencies = []
        for dependency in proposal["dependsOn"]:
            if dependency not in mappings:
                raise ValueError(proposal_id + " requires a selected or explicitly reviewed existing TASK mapping for " + dependency)
            dependencies.append(mappings[dependency])
            if dependency not in {row["proposalId"] for row in selection["tasks"]}:
                used_external.add(dependency)
        task = {"id": mappings[proposal_id], "title": proposal["title"], "owner": entry["owner"],
                "status": "todo", "milestone": "", "scope": entry["scope"], "acceptance": [proposal["acceptance"]],
                "dependsOn": dependencies, "nextAction": entry["nextAction"], "blocker": "", "evidence": [],
                "reviewedBy": "", "createdAt": stamp, "updatedAt": stamp, "history": []}
        note = marker + " revision=" + source["revision"] + "; catalogSha256=" + source["catalogSha256"]
        task["history"].append(MEMORY.event(task, note))
        tasks.append(task)
        candidate["tasks"].append(task)
        mapping.append({"proposalId": proposal_id, "taskId": task["id"], "owner": task["owner"], "dependsOn": dependencies})
        dependency_states = [{"taskId": task_id, "status": existing[task_id]["status"] if task_id in existing else "todo"}
                             for task_id in dependencies]
        assessments.append(assess_gates(proposal, gates.get(proposal_id), dependency_states))
    if used_external != {row["proposalId"] for row in selection["dependencies"]}:
        raise ValueError("Existing dependency mappings must be used by the selected batch")
    MEMORY.validate_records(records, candidate, registry)
    MEMORY.validate_focus_candidate(records, candidate, MEMORY.load_focus(records, ledger))
    # Pre-render every derived view before any apply mutation.
    MEMORY.render_views(candidate, records)
    MEMORY.render_current(candidate, MEMORY.load_focus(records, ledger))
    plan = {"schemaVersion": 1, "kind": "webappx-backlog-adoption-plan", "createdAt": stamp,
            "source": source, "target": {"directory": str(workspaces.root.parent), "app": app,
            "scope": chosen[0], "records": records.relative_to(workspaces.root.parent).as_posix(),
            "fingerprint": record_fingerprint(workspaces, chosen)}, "selection": copy.deepcopy(selection),
            "mapping": mapping, "tasks": tasks, "gateAssessments": assessments,
            "intake": {"executionAuthorized": False, "requiresExplicitIntakeAction": True}, "boundary": BOUNDARY}
    plan["planSha256"] = digest(plan)
    return plan


def apply_plan(target, app, plan, catalog, source, *, project=None, root=False, authorize_intake=False):
    if not authorize_intake:
        raise ValueError("Apply requires --authorize-intake for this selected adopted scope; this records TODO intake only")
    fields(plan, ("schemaVersion", "kind", "createdAt", "source", "target", "selection", "mapping", "tasks",
                  "gateAssessments", "intake", "boundary", "planSha256"), "Reviewed adoption plan")
    if plan["source"] != source:
        raise ValueError("Stale catalog provenance; create and review a new preview")
    if source["provenance"] != "verified-local-commit" and source["provenance"] != "fixture-captured-facts":
        raise ValueError("Apply requires committed catalog provenance")
    workspaces, chosen = target_scope(target, app, project, root)
    records = chosen[1]
    with ExitStack() as locks:
        # Registry writers coordinate on the outer root; child task writers use
        # the selected scope. Acquire both in a stable outer-to-child order.
        if records != workspaces.root:
            locks.enter_context(MEMORY.coordination_lock(workspaces.root))
        locks.enter_context(MEMORY.coordination_lock(records))
        # Reload scope selection, registry, identity and every record after locking.
        rebuilt = build_plan(target, app, plan["selection"], catalog, source, project=project, root=root, stamp=plan["createdAt"])
        if rebuilt != plan:
            raise ValueError("Stale or changed adoption plan; create and review a new preview")
        ledger, registry = MEMORY.load(records)
        candidate = copy.deepcopy(ledger)
        candidate["tasks"].extend(copy.deepcopy(plan["tasks"]))
        MEMORY.validate_records(records, candidate, registry)
        MEMORY.save_ledger(records, candidate, registry)
    return {"schemaVersion": 1, "kind": "webappx-backlog-adoption-result", "applied": True,
            "planSha256": plan["planSha256"], "target": plan["target"], "mapping": plan["mapping"],
            "boundary": BOUNDARY}


def read_input(path):
    file = Path(path)
    if not file.is_file() or file.stat().st_size > 2 * 1024 * 1024:
        raise ValueError("Input must be an existing JSON file of at most 2 MiB")
    return parse(file.read_bytes())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("preview", "apply"))
    parser.add_argument("--target", required=True)
    parser.add_argument("--app", required=True, help="Exact configured adopted app identity")
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--root", action="store_true")
    scope.add_argument("--project", help="Exact registered child name")
    parser.add_argument("--catalog-revision", required=True, help="Explicit locally available committed catalog revision")
    parser.add_argument("--selection")
    parser.add_argument("--plan")
    parser.add_argument("--authorize-intake", action="store_true")
    args = parser.parse_args(argv)
    if args.mode == "preview" and (not args.selection or args.plan or args.authorize_intake):
        parser.error("preview requires --selection and does not accept --plan or --authorize-intake")
    if args.mode == "apply" and (not args.plan or args.selection):
        parser.error("apply requires --plan and does not accept --selection")
    catalog, source = committed_catalog(args.catalog_revision)
    options = {"project": args.project, "root": args.root}
    if args.mode == "preview":
        result = build_plan(args.target, args.app, read_input(args.selection), catalog, source, **options)
    else:
        result = apply_plan(args.target, args.app, read_input(args.plan), catalog, source,
                            authorize_intake=args.authorize_intake, **options)
    print(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False))


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError) as error:
        print("Backlog adoption refused: " + str(error), file=sys.stderr)
        raise SystemExit(1)
