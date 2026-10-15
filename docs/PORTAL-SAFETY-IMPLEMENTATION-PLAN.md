# Next portal safety and recovery batch — 2026-10-15

Status: **planned, unaccepted**. This assignment follows the accepted
[16-item maturity wave](PORTAL-MATURITY-QA-2026-10-15.md), under the active
[all-1,000 execution plan](WEBAPPX-EXECUTION-PLAN.md). Read-only planning examined
published starting base `950f9ba0c4e48faaa65056f504f105201838e3ec` plus the
unpublished maturity implementation. Recheck the eventual published source
before implementation. This plan changes no catalog status or reusable task seed.

The current catalog has 77 done / 923 remaining, including 38 dependency-ready
P1 local candidates at this planning snapshot. These twelve are all TODO, P1
and local-gated; their original definitions/dependencies remain authoritative.

## Original criteria and implementation ownership

| Lane | IDs | Required outcome |
| --- | --- | --- |
| Navigation and CMS drafts | WX-0059, WX-0285 | Leaving a dirty portal offers Keep editing/Discard without intercepting completed saves. A restored CMS revision presents a comparison and explicit reload/reapply choice for unsaved text. Serialize shared provider/editor changes with the recovery lane. |
| Optional checkpoints | WX-0455, WX-0456 | Separately opt into a required destination capture before individual import and a previewed capture before Reset. Preserve documented default behavior. Capture failure refuses enabled replacement, preserving current records and saves. |
| Domain differences | WX-0459, WX-0460 | First verify the existing comparison engine with explicit CMS revision/publication and CRM company/contact/lead-stage/opportunity cases. Add narrowly scoped metadata only if the original criteria need it. Use one engine. |
| Browser quality | WX-0655, WX-0720, WX-0722 | Audit ambiguous visible control names/actions with hidden mounted portals, inventory status meaning in monochrome, and exercise the actual x-large preference across forms/restore/Undo at narrow widths. Keep screen-reader acceptance separate. |
| Recovery guidance and drill | WX-0756, WX-0757, WX-0775 | Ordered damaged-history recovery, a worked uncertain-rollback example, and an executed fictional failure drill for bad import, unavailable storage, failed restore and portable-backup recovery with exact outcomes. |

Agent 0 owns shared integration, package/CI wiring, source bindings, acceptance
and Git publication. Domain lanes own only assigned files; one owner at a time
may change the shared provider, CMS editor or persistence hooks. Browser owners
report product defects to those owners. Documentation has one author with
serialized integration links and contract changes.

## Evidence sequence

1. Read the exact catalog criteria. Compare existing implementation before adding
   another behavior. Verify CMS and CRM differences using independent literals.
2. Test enabled and default import/Reset modes, required checkpoint failures,
   stale-history refusal, exact save-byte preservation and unrelated modules.
3. Exercise real Keep/Discard, save-success navigation, stale CMS comparison and
   explicit reload/reapply using owned browser contexts and real downloads.
4. Audit visible accessible names and repeated record actions; include a negative
   fixture proving ambiguity is detected. Use the real text setting and retain
   monochrome/status evidence with a complete inventory and scope limits.
5. Run the failure drill in isolated fictional contexts. Clearly distinguish
   current memory, saved workspace slots and history. Fault injection is a
   controlled test boundary, not an observation of a browser privacy setting.
6. Review complete expected exports/raw saves, run affected regressions, then
   the required full CI/Hosting preflight/drift/template gates before publishing.

The current state contract intentionally clears selected temporary UI on restore.
WX-0285 requires deliberate design and an updated reviewed contract; do not
silently invalidate existing remount/recovery assertions. New opt-in preferences
must have explicit storage scope and portable-backup inclusion rules. Required
capture plus replacement must retain the existing rollback/uncertainty contract.

## Separate existing-source acceptance reviews

- **WX-0847:** inspect whether the owned browser runner's real resource handles,
  lifecycle and retained reports meet its exact process-handle criterion.
- **WX-0860:** review existing populated fictional import rehearsal and retained
  fingerprints before building another rehearsal.
- **WX-0656:** requires manual screen-reader evidence. Automated DOM/browser
  assertions cannot accept this item.

No provider account, production deployment or native Windows acceptance is
created by this plan. Preserve selected immutable releases, research checksums
and blank SYSTEMX context/plan/task/memory records. Record each future completion
only after its original criterion has accepted evidence.
