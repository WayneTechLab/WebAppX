"""Adoption acceptance against real selected SYSTEMX records in temporary apps."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("backlog_adoption_test", ROOT / "scripts/backlog-adoption.py")
adoption = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adoption)
memory = adoption.MEMORY
workspaces = adoption.WORKSPACES
STAMP = "2026-10-15T12:00:00.000000Z"


class Adoption(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="webappx-adoption-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.app = self.base / "adopted-app"
        self.app.mkdir()
        self.records = self.app / ".SYSTEMX"
        shutil.copytree(adoption.DEFAULTS / "templates/project", self.records)
        (self.records / "Projects").mkdir()
        self.write("Projects/REGISTRY.json", {"schemaVersion": 1, "projects": []})
        config = memory.read_json(self.records, "project.json")
        config["project"] = {"name": "Example App", "description": "Temporary adopted acceptance fixture"}
        config["commands"]["build"] = ["node", "fixture-build.mjs"]
        self.write("project.json", config)
        (self.records / "GLOBAL/CONTEXT.md").write_text("# Adopted context\nPreserve this exact scope.\n")
        (self.records / "PLAN/MASTER-PLAN.md").write_text("# Adopted plan\n| M-001 | Existing milestone |\n")
        (self.records / "MEMORY/PROJECT.md").write_text("# Verified memory\nAn adopted fact.\n")
        memory.refresh(self.records, memory.read_json(self.records, "WORK/TASKS.json"))
        self.catalog = {"items": [
            {"id": "WX-0001", "title": "Previously accepted source proposal", "acceptance": "Verify this separately in the adopted app.",
             "status": "done", "gate": "provider", "dependsOn": [], "completion": {"evidence": "source-evidence-never-copy"}},
            {"id": "WX-0002", "title": "Dependent proposal", "acceptance": "Keep every dependency in the adopted ledger.",
             "status": "todo", "gate": "operator", "dependsOn": ["WX-0001"]},
            {"id": "WX-0003", "title": "Local proposal", "acceptance": "An independent criterion for local work.",
             "status": "todo", "gate": "local", "dependsOn": []},
        ]}
        self.source = {"revision": "a" * 40, "catalogSha256": adoption.digest(self.catalog), "provenance": "fixture-captured-facts"}

    def write(self, relative, value):
        (self.records / relative).write_text(json.dumps(value, indent=2) + "\n")

    def selection(self, *ids):
        return {"schemaVersion": 1, "tasks": [{"proposalId": id, "owner": "agent.0", "scope": ["src/"],
                "nextAction": "Review the adopted acceptance criterion"} for id in ids], "dependencies": [], "gates": []}

    def preview(self, selection=None, **options):
        return adoption.build_plan(self.app, "Example App", selection or self.selection("WX-0001"), self.catalog,
                                   self.source, root=True, stamp=STAMP, **options)

    def apply(self, plan, **options):
        return adoption.apply_plan(self.app, "Example App", plan, self.catalog, self.source,
                                   root=True, authorize_intake=True, **options)

    def snapshot(self, records=None):
        records = records or self.records
        return {path.relative_to(records).as_posix(): path.read_bytes() for path in records.rglob("*")
                if path.is_file() and "state" not in path.relative_to(records).parts}

    def existing_task(self):
        ledger, registry = memory.load(self.records)
        task = {"id": "TASK-007", "title": "Retain existing accepted task", "owner": "agent.0", "status": "todo",
                "milestone": "M-001", "scope": ["existing/"], "acceptance": ["Keep existing acceptance"], "dependsOn": [],
                "nextAction": "Existing next action", "blocker": "", "evidence": [], "reviewedBy": "",
                "createdAt": STAMP, "updatedAt": STAMP, "history": []}
        task["history"] = [memory.event(task, "Existing accepted intake")]
        ledger["tasks"].append(task)
        memory.save_ledger(self.records, ledger, registry)
        return copy.deepcopy(task)

    def gate(self, id="WX-0001"):
        proposal = next(row for row in self.catalog["items"] if row["id"] == id)
        return {"proposalId": id, "criterionSha256": adoption.digest(proposal["acceptance"]),
                "action": "review-provider-contract", "target": "example-development-account",
                "requirements": {"credentials": {"reviewed": True, "required": ["provider-account"]},
                    "operatorAuthorization": {"reviewed": True, "required": True},
                    "localPrerequisites": {"reviewed": True, "required": ["node-baseline"]}},
                "observations": {"credentials": [{"name": "provider-account", "state": "available", "reference": "operator report"}],
                    "operatorAuthorization": {"state": "authorized", "action": "review-provider-contract",
                        "target": "example-development-account", "by": "user", "reference": "authorized fixture action"},
                    "localPrerequisites": [{"name": "node-baseline", "state": "met", "reference": "local version receipt"}]}}

    def test_preview_is_read_only_and_source_done_becomes_unaccepted_todo(self):
        before = self.snapshot()
        plan = self.preview()
        self.assertEqual(before, self.snapshot())
        task = plan["tasks"][0]
        self.assertEqual(set(task), memory.TASK_FIELDS)
        self.assertEqual((task["id"], task["status"], task["evidence"], task["reviewedBy"]), ("TASK-001", "todo", [], ""))
        self.assertNotIn("source-evidence-never-copy", json.dumps(plan))
        self.assertFalse((self.records / "state").exists())
        self.assertEqual(plan["gateAssessments"][0]["executionReadiness"], "unknown")

    def test_full_batch_applies_once_and_preserves_existing_records_roles_and_commands(self):
        existing = self.existing_task()
        registry = memory.read_json(self.records, "AGENTS/REGISTRY.json")
        worker = self.records / "AGENTS/agent.1"
        worker.mkdir()
        (worker / "MEMORY.md").write_text("# Existing worker memory\n")
        registry["agents"].append({"id": "agent.1", "role": "test", "memory": "AGENTS/agent.1/MEMORY.md"})
        self.write("AGENTS/REGISTRY.json", registry)
        selected = self.selection("WX-0001", "WX-0002")
        selected["tasks"][1]["owner"] = "agent.1"
        plan = self.preview(selected)
        before = self.snapshot()
        result = self.apply(plan)
        ledger, _ = memory.load(self.records)
        self.assertTrue(result["applied"])
        self.assertEqual(ledger["tasks"][0], existing)
        self.assertEqual([task["id"] for task in ledger["tasks"]], ["TASK-007", "TASK-008", "TASK-009"])
        self.assertEqual(ledger["tasks"][2]["dependsOn"], ["TASK-008"])
        memory.validate_work(self.records)
        after = self.snapshot()
        mutable = {"WORK/TASKS.json", "CURRENT.md", *("WORK/" + name for name in memory.VIEWS.values())}
        self.assertEqual({key: value for key, value in before.items() if key not in mutable},
                         {key: value for key, value in after.items() if key not in mutable})
        with self.assertRaisesRegex(ValueError, "already been adopted"):
            self.apply(plan)
        self.assertEqual(len(memory.load(self.records)[0]["tasks"]), 3)

    def test_done_source_dependency_still_requires_mapping(self):
        with self.assertRaisesRegex(ValueError, "mapping for WX-0001"):
            self.preview(self.selection("WX-0002"))
        self.assertEqual(memory.load(self.records)[0]["tasks"], [])
        self.existing_task()
        selected = self.selection("WX-0002")
        selected["dependencies"] = [{"proposalId": "WX-0001", "taskId": "TASK-007", "reviewedBy": "user", "reference": "Reviewed target equivalence"}]
        plan = self.preview(selected)
        self.assertEqual(plan["tasks"][0]["dependsOn"], ["TASK-007"])
        self.apply(plan)
        self.assertEqual(memory.load(self.records)[0]["tasks"][-1]["dependsOn"], ["TASK-007"])

    def test_invalid_later_owner_does_not_partially_apply(self):
        selected = self.selection("WX-0001", "WX-0003")
        selected["tasks"][1]["owner"] = "agent.99"
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "unknown owner"):
            self.preview(selected)
        self.assertEqual(before, self.snapshot())

    def test_existing_dependency_mappings_are_reviewed_and_used(self):
        for mapping in [
            {"proposalId": "WX-0001", "taskId": "TASK-404", "reviewedBy": "user", "reference": "review"},
            {"proposalId": "WX-0001", "taskId": "TASK-007", "reviewedBy": "agent.1", "reference": "review"},
            {"proposalId": "WX-0001", "taskId": "TASK-007", "reviewedBy": "user", "reference": ""},
        ]:
            selected = self.selection("WX-0002")
            selected["dependencies"] = [mapping]
            with self.subTest(mapping=mapping), self.assertRaises(ValueError):
                self.preview(selected)
        self.existing_task()
        selected = self.selection("WX-0003")
        selected["dependencies"] = [{"proposalId": "WX-0001", "taskId": "TASK-007", "reviewedBy": "user", "reference": "review"}]
        with self.assertRaisesRegex(ValueError, "must be used"):
            self.preview(selected)

    def test_stale_record_registry_identity_and_catalog_plans_are_refused(self):
        for path in ("GLOBAL/CONTEXT.md", "MEMORY/PROJECT.md", "PLAN/MASTER-PLAN.md", "AGENTS/agent.0/MEMORY.md"):
            with self.subTest(path=path):
                plan = self.preview()
                file = self.records / path
                original = file.read_bytes()
                file.write_bytes(original + b"\nConcurrent record change\n")
                before = self.snapshot()
                with self.assertRaisesRegex(ValueError, "Stale or changed"):
                    self.apply(plan)
                self.assertEqual(before, self.snapshot())
                file.write_bytes(original)
        plan = self.preview()
        registry = self.records / "Projects/REGISTRY.json"
        original = registry.read_bytes()
        # A valid registry edit changes the fingerprint even if the root task
        # selection and task numbering have not changed.
        registry.write_bytes(original + b"\n")
        with self.assertRaisesRegex(ValueError, "Stale or changed"):
            self.apply(plan)
        registry.write_bytes(original)
        plan = self.preview()
        config = memory.read_json(self.records, "project.json")
        config["project"]["name"] = "Renamed App"
        self.write("project.json", config)
        with self.assertRaisesRegex(ValueError, "identity"):
            self.apply(plan)
        config["project"]["name"] = "Example App"
        self.write("project.json", config)
        plan = self.preview()
        self.existing_task()
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "Stale or changed"):
            self.apply(plan)
        self.assertEqual(before, self.snapshot())
        source = {**self.source, "catalogSha256": "b" * 64}
        with self.assertRaisesRegex(ValueError, "Stale catalog"):
            adoption.apply_plan(self.app, "Example App", plan, self.catalog, source, root=True, authorize_intake=True)

    def test_tampered_task_or_gate_plan_and_changed_criterion_are_refused(self):
        for key in ("tasks", "gateAssessments"):
            plan = self.preview()
            plan[key][0]["unexpected"] = "tampered"
            before = self.snapshot()
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "Stale or changed"):
                self.apply(plan)
            self.assertEqual(before, self.snapshot())
        selected = self.selection("WX-0001")
        selected["gates"] = [self.gate()]
        selected["gates"][0]["criterionSha256"] = "c" * 64
        with self.assertRaisesRegex(ValueError, "changed acceptance"):
            self.preview(selected)

    def test_unreadable_nested_memory_refuses_preview_and_stale_apply(self):
        restricted = self.records / "MEMORY/restricted"
        restricted.mkdir()
        record = restricted / "record.md"
        record.write_text("Original adopted memory\n")
        plan = self.preview()
        ledger_before = (self.records / "WORK/TASKS.json").read_bytes()
        mode = restricted.stat().st_mode
        try:
            restricted.chmod(0)
            try:
                list(restricted.iterdir())
            except PermissionError:
                pass
            else:
                self.skipTest("Current account can still read directories with permissions removed")
            with self.assertRaisesRegex(ValueError, "Cannot fingerprint project records"):
                self.preview()
            restricted.chmod(mode)
            record.write_text("Changed memory that must not disappear from the fingerprint\n")
            restricted.chmod(0)
            with self.assertRaisesRegex(ValueError, "Cannot fingerprint project records"):
                self.apply(plan)
            self.assertEqual((self.records / "WORK/TASKS.json").read_bytes(), ledger_before)
        finally:
            restricted.chmod(mode)

    def test_apply_requires_deliberate_intake_and_matching_app_and_scope(self):
        plan = self.preview()
        with self.assertRaisesRegex(ValueError, "authorize-intake"):
            adoption.apply_plan(self.app, "Example App", plan, self.catalog, self.source, root=True)
        with self.assertRaisesRegex(ValueError, "identity"):
            adoption.target_scope(self.app, "Other App", root=True)
        with self.assertRaisesRegex(ValueError, "exactly one scope"):
            adoption.target_scope(self.app, "Example App")
        other = self.base / "other-app"
        shutil.copytree(self.app, other)
        with self.assertRaisesRegex(ValueError, "Stale or changed"):
            adoption.apply_plan(other, "Example App", plan, self.catalog, self.source, root=True, authorize_intake=True)

    def test_source_aliases_managed_subpaths_and_hard_links_are_refused(self):
        with self.assertRaisesRegex(ValueError, "outside the reusable"):
            adoption.target_scope(ROOT, "Renamed source", root=True)
        alias = self.base / "source-alias"
        try:
            alias.symlink_to(ROOT, target_is_directory=True)
        except OSError:
            self.skipTest("Symbolic links are unavailable on this platform")
        with self.assertRaisesRegex(ValueError, "aliases"):
            adoption.target_scope(alias, "Renamed source", root=True)
        with self.assertRaisesRegex(ValueError, "managed paths"):
            adoption.target_scope(self.records, "Example App", root=True)
        file = self.records / "WORK/TODO.md"
        original = self.records / "WORK/TODO-copy.md"
        file.rename(original)
        try:
            file.hardlink_to(original)
        except OSError:
            self.skipTest("Hard links are unavailable on this platform")
        with self.assertRaisesRegex(ValueError, "hard links"):
            self.preview()

    def test_symlink_record_and_case_conflicts_are_refused_before_mutation(self):
        target = self.records / "CURRENT.md"
        original = target.read_bytes()
        target.unlink()
        actual = self.base / "outside-current.md"
        actual.write_bytes(original)
        try:
            target.symlink_to(actual)
        except OSError:
            self.skipTest("Symbolic links are unavailable on this platform")
        with self.assertRaises(ValueError):
            self.preview()

    def test_registered_child_is_explicit_and_outer_records_are_preserved(self):
        workspace = workspaces.Workspaces(self.records, adoption.DEFAULTS)
        workspace.add("Child App", kind="software", description="Temporary child fixture", apply=True)
        before = self.snapshot()
        plan = adoption.build_plan(self.app, "Child App", self.selection("WX-0003"), self.catalog, self.source,
                                   project="Child App", stamp=STAMP)
        self.assertEqual(before, self.snapshot())
        self.assertEqual(plan["target"]["records"], ".SYSTEMX/Projects/Child App/.SYSTEMXP")
        adoption.apply_plan(self.app, "Child App", plan, self.catalog, self.source, project="Child App", authorize_intake=True)
        child = self.records / "Projects/Child App/.SYSTEMXP"
        self.assertEqual(len(memory.load(child)[0]["tasks"]), 1)
        self.assertEqual(memory.load(self.records)[0]["tasks"], [])
        after = self.snapshot()
        prefix = "Projects/Child App/.SYSTEMXP/"
        self.assertEqual({k: v for k, v in before.items() if not k.startswith(prefix)},
                         {k: v for k, v in after.items() if not k.startswith(prefix)})
        with self.assertRaisesRegex(ValueError, "Unknown project"):
            adoption.target_scope(self.app, "Child App", project="child app")

    def test_coarse_labels_and_todo_never_infer_any_gate_dimension(self):
        for proposal in self.catalog["items"]:
            report = adoption.assess_gates(proposal)
            self.assertEqual(report["executionReadiness"], "unknown")
            self.assertEqual({row["state"] for row in report["dimensions"].values()}, {"unknown"})

    def test_requirements_and_observations_are_independent_and_intake_can_be_blocked(self):
        selected = self.selection("WX-0001")
        gate = self.gate()
        gate["requirements"]["credentials"]["reviewed"] = False
        selected["gates"] = [gate]
        report = self.preview(selected)["gateAssessments"][0]
        self.assertEqual(report["dimensions"]["credentials"]["state"], "unknown")
        self.assertEqual(report["dimensions"]["operatorAuthorization"]["state"], "reported_ready")
        gate["requirements"]["credentials"]["reviewed"] = True
        gate["observations"]["credentials"][0]["state"] = "unavailable"
        plan = self.preview(selected)
        self.assertEqual(plan["gateAssessments"][0]["executionReadiness"], "blocked")
        self.apply(plan)
        self.assertEqual(memory.load(self.records)[0]["tasks"][0]["status"], "todo")

    def test_authorization_must_match_action_and_target_and_missing_observations_stay_unknown(self):
        selected = self.selection("WX-0001")
        gate = self.gate()
        selected["gates"] = [gate]
        for key in ("action", "target"):
            original = gate["observations"]["operatorAuthorization"][key]
            gate["observations"]["operatorAuthorization"][key] = "different"
            report = self.preview(selected)["gateAssessments"][0]
            self.assertEqual(report["dimensions"]["operatorAuthorization"]["state"], "unknown")
            gate["observations"]["operatorAuthorization"][key] = original
        gate["observations"]["credentials"] = []
        gate["observations"]["localPrerequisites"][0]["state"] = "unmet"
        report = self.preview(selected)["gateAssessments"][0]
        self.assertEqual(report["dimensions"]["credentials"]["state"], "unknown")
        self.assertEqual(report["dimensions"]["localPrerequisites"]["state"], "blocked")

    def test_unfinished_target_dependencies_block_otherwise_reported_ready_gates(self):
        selected = self.selection("WX-0001", "WX-0002")
        selected["gates"] = [self.gate("WX-0001"), self.gate("WX-0002")]
        reports = self.preview(selected)["gateAssessments"]
        self.assertEqual(reports[0]["executionReadiness"], "reported_ready")
        self.assertEqual({row["state"] for row in reports[1]["dimensions"].values()}, {"reported_ready"})
        self.assertEqual(reports[1]["dependencies"], [{"taskId": "TASK-001", "status": "todo"}])
        self.assertEqual(reports[1]["executionReadiness"], "blocked")

    def test_reviewed_local_action_can_require_no_credentials_or_operator_authorization(self):
        selected = self.selection("WX-0001")
        gate = self.gate()
        gate["requirements"]["credentials"]["required"] = []
        gate["requirements"]["operatorAuthorization"]["required"] = False
        selected["gates"] = [gate]
        report = self.preview(selected)["gateAssessments"][0]
        self.assertEqual(report["dimensions"]["credentials"]["state"], "not_required")
        self.assertEqual(report["dimensions"]["operatorAuthorization"]["state"], "not_required")
        self.assertEqual(report["executionReadiness"], "reported_ready")

    def test_secret_value_fields_are_rejected_and_duplicate_json_is_not_silently_replaced(self):
        selected = self.selection("WX-0001")
        gate = self.gate()
        gate["observations"]["credentials"][0]["value"] = "must never be read"
        selected["gates"] = [gate]
        with self.assertRaisesRegex(ValueError, "unknown fields"):
            self.preview(selected)
        with self.assertRaisesRegex(ValueError, "Duplicate JSON"):
            adoption.parse('{"tasks": [], "tasks": ["different"]}')

    def test_explicit_batch_limit_duplicates_and_cycles_fail_without_writes(self):
        for selected in [self.selection(), self.selection(*(["WX-0001"] * 41)), self.selection("WX-0001", "WX-0001")]:
            before = self.snapshot()
            with self.assertRaises(ValueError):
                self.preview(selected)
            self.assertEqual(before, self.snapshot())
        self.catalog["items"][0]["dependsOn"] = ["WX-0002"]
        with self.assertRaisesRegex(ValueError, "cycle"):
            self.preview(self.selection("WX-0001", "WX-0002"))

    def test_contention_does_not_break_another_writers_lock(self):
        plan = self.preview()
        lock = self.records / "state/coordination.lock"
        with memory.coordination_lock(self.records):
            owner = (lock / "owner.json").read_bytes()
            with self.assertRaisesRegex(ValueError, "writer is busy"):
                self.apply(plan)
            self.assertEqual((lock / "owner.json").read_bytes(), owner)
        self.assertEqual(memory.load(self.records)[0]["tasks"], [])

    def test_local_commit_provenance_is_resolved_and_must_match_current_bytes(self):
        data = (ROOT / adoption.CATALOG).read_bytes()
        responses = [subprocess.CompletedProcess([], 0, b"d" * 40 + b"\n", b""),
                     subprocess.CompletedProcess([], 0, data, b"")]
        with patch.object(adoption.subprocess, "run", side_effect=responses) as run:
            catalog, source = adoption.committed_catalog("reviewed-ref")
        self.assertEqual(catalog, adoption.parse(data))
        self.assertEqual(source["revision"], "d" * 40)
        self.assertEqual(source["catalogSha256"], adoption.digest(data))
        self.assertEqual(run.call_args_list[0].args[0][-4:], ["rev-parse", "--verify", "--end-of-options", "reviewed-ref^{commit}"])
        with patch.object(adoption.subprocess, "run", side_effect=[responses[0], subprocess.CompletedProcess([], 0, b"different", b"")]):
            with self.assertRaisesRegex(ValueError, "differ"):
                adoption.committed_catalog("reviewed-ref")
        with patch.object(adoption.subprocess, "run", return_value=subprocess.CompletedProcess([], 128, b"", b"missing")):
            with self.assertRaisesRegex(ValueError, "available local commit"):
                adoption.committed_catalog("missing")

    def test_reusable_source_ledger_remains_blank(self):
        self.assertEqual(adoption.parse((ROOT / ".SYSTEMX/WORK/TASKS.json").read_bytes()), {"schemaVersion": 1, "tasks": []})

    def test_spawned_cli_proves_committed_catalog_preview_apply_and_error_paths(self):
        # The only Git mutations in this test create its owned temporary source
        # fixture. The actual workspace and every actual adopted app are untouched.
        source = self.base / "committed-source"
        (source / "scripts").mkdir(parents=True)
        (source / "docs/backlog").mkdir(parents=True)
        shutil.copy2(ROOT / "scripts/backlog-adoption.py", source / "scripts/backlog-adoption.py")
        version = adoption.DEFAULTS.name
        selected = source / ".SYSTEMX/.systemx/releases" / version
        (selected / "scripts").mkdir(parents=True)
        for path in (adoption.DEFAULTS / "scripts").glob("*.py"):
            shutil.copy2(path, selected / "scripts" / path.name)
        for name in ("systemx_paths.py", "versions.py"):
            shutil.copy2(adoption.DEFAULTS / name, selected / name)
        (source / ".SYSTEMX/INSTALLATION.json").write_text(json.dumps({"activeVersion": version}))
        data = json.dumps(self.catalog, indent=2) + "\n"
        (source / adoption.CATALOG).write_text(data)
        for arguments in (["init", "--quiet"], ["add", adoption.CATALOG],
                          ["-c", "user.name=Adoption Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "Committed catalog fixture"]):
            subprocess.run(["git", "-C", str(source), *arguments], check=True, capture_output=True)
        selection_file = self.base / "selection.json"
        plan_file = self.base / "plan.json"
        selection_file.write_text(json.dumps(self.selection("WX-0001", "WX-0002")))
        common = ["--target", str(self.app), "--app", "Example App", "--root", "--catalog-revision", "HEAD"]
        def cli(mode, extra):
            return subprocess.run([sys.executable, "-B", str(source / "scripts/backlog-adoption.py"), mode, *common, *extra],
                                  capture_output=True, text=True, check=False)
        before = self.snapshot()
        result = cli("preview", ["--selection", str(selection_file)])
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)
        self.assertEqual(plan["source"]["provenance"], "verified-local-commit")
        self.assertEqual(plan["source"]["catalogSha256"], adoption.digest(data.encode()))
        self.assertEqual(before, self.snapshot())
        plan_file.write_text(result.stdout)
        refused = cli("apply", ["--plan", str(plan_file)])
        self.assertEqual(refused.returncode, 1)
        self.assertIn("authorize-intake", refused.stderr)
        self.assertEqual(before, self.snapshot())
        applied = cli("apply", ["--plan", str(plan_file), "--authorize-intake"])
        self.assertEqual(applied.returncode, 0, applied.stderr)
        self.assertTrue(json.loads(applied.stdout)["applied"])
        self.assertEqual([row["id"] for row in memory.load(self.records)[0]["tasks"]], ["TASK-001", "TASK-002"])
        repeated = cli("apply", ["--plan", str(plan_file), "--authorize-intake"])
        self.assertEqual(repeated.returncode, 1)
        self.assertIn("already been adopted", repeated.stderr)
        (source / adoption.CATALOG).write_text(data + "\n")
        stale = cli("preview", ["--selection", str(selection_file)])
        self.assertEqual(stale.returncode, 1)
        self.assertIn("differ", stale.stderr)


if __name__ == "__main__":
    unittest.main()
