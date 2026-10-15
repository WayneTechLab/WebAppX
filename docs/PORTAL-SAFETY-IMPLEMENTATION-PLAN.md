# Portal safety and recovery implementation — 2026-10-15

Status: **fourteen original local criteria accepted; integrated publication gates pending**. This assignment follows the accepted
[16-item maturity wave](PORTAL-MATURITY-QA-2026-10-15.md), under the active
[all-1,000 execution plan](WEBAPPX-EXECUTION-PLAN.md). Read-only planning examined
published starting base `950f9ba0c4e48faaa65056f504f105201838e3ec` plus the
unpublished maturity implementation. Implementation resumed from verified clean public main
`532cc4ad63d18a4fe911b0a9b18e258b85ef3416`. The earlier observation remains
historical planning context. The final acceptance below updates only canonical status/evidence and generated views; reusable task seeds remain blank.

The initial planning snapshot had 77 done / 923 remaining, including 38
dependency-ready P1 local candidates. This assignment covered twelve original
criteria plus WX-0847/WX-0860 below. All fourteen original definitions and
dependencies remain unchanged.

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

The reviewed state contract now retains the dirty CMS editor on import/restore/Undo
for explicit comparison, Reload or Reapply; accepted Reset clears it. Other
selected temporary forms and timers retain their clearing behavior. Independent
import/Reset preferences default off and remain outside portable backups. Enabled
checkpoints bind the preview and preserve rollback/uncertainty semantics.

## Supplemental implementation and existing-source acceptance reviews

- **WX-0847:** implement a real owned preview child process, retain the exact
  fork handle and PID/readiness/exit evidence, and verify isolated cleanup on
  success, startup failure, interrupted checks and interrupted cleanup. The prior
  in-process server ownership was partial evidence for the literal criterion.
- **WX-0860:** review and execute the existing populated fictional import
  rehearsal with exact preserved fingerprints; no second importer is needed.
- **WX-0656:** requires manual screen-reader evidence. Automated DOM/browser
  assertions cannot accept this item.

No provider account, production deployment or native Windows acceptance is
created by this plan. Preserve selected immutable releases, research checksums
and blank SYSTEMX context/plan/task/memory records. Record each future completion
only after its original criterion has accepted evidence.

## Current verification

The [current QA receipt](PORTAL-SAFETY-QA-2026-10-15.md) collects actual
verification and independent review. Agent 0 accepted all fourteen original local criteria after independent review
and completed model/browser/importer evidence. The catalog records **91 done /
909 remaining**, including **82 P1, 670 P2 and 157 P3**; remaining gates are
**742 local, 127 operator and 40 provider**. Full publication CI/preflight must
pass before GitHub push. The all-1,000 goal remains active.

The [next HR employment lifecycle plan](HR-LIFECYCLE-IMPLEMENTATION-PLAN.md)
assigns WX-0101–WX-0110 as proposed implementation. All ten remain TODO; its
engineering order changes none of their original dependencies.
