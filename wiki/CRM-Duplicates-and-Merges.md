# CRM Duplicates and Merges

Use `/crm/demo` → **Duplicates & merges** for account-free review of fictional
contacts and companies. Start `npm run dev:mock` and use the local origin it
prints. Use sample names and `.invalid` email addresses. The native identity
selector demonstrates access rules; it does not authenticate a real user or
activate a provider.

The [full workflow guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/CRM-DUPLICATES-AND-MERGES.md)
explains every preview section, warning, limit and recovery choice. The
[merge contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/CRM-MERGE-CONTRACT.md)
records the original WX-0369–WX-0373 criteria and exact source rules.

**Locally accepted — 2026-10-15:** all five original CRM criteria are complete.
All 68 CI stages and separate Hosting preflight passed on `4e025a3b5c21d0accef4e2e02add2c7eff54d589`.
The fresh composed lifecycle suite passed 35 groups: 20 preserved + 15 CRM,
with all 24 CRM status witnesses on runtime freeze 3. Independent review confirmed
226 total native/LAN/adoption browser groups and the complete artifact bindings.
Read the [dated QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/CRM-ADOPTION-QA-2026-10-15.md).
The earlier freeze-2 observation remains historical. Deployment count is 0.

## Review the report

**CRM duplicate candidates** compares company names after whitespace/case
normalization and contact/lead emails after outer-whitespace/case normalization.
It leaves original fields unchanged. There is no fuzzy matching or automatic
merge. Read each classification:

- **Candidate for deliberate review** is an advisory match.
- **Expected conversion link — no merge suggested** is the existing relationship
  between a converted lead and its linked contact.
- **Cross-owner match — ineligible for merge** cannot be applied as one mixed-owner
  operation.

Candidate groups and member lists have separate pages of up to 20. A
representative sees their accessible scope, without hidden rows or a hidden
workspace-wide count. Two compatible records may be selected manually even if
no advisory match is listed.

## Preview the direction and every linked record

1. Choose **Source contact** and **Retained contact**, or **Source company** and
   **Retained company**. Source is retired; retained keeps all its fields exactly.
2. Choose **Preview contact merge** or **Preview company merge**. A linked
   **Review merge selections** summary identifies invalid fields and focuses the
   first invalid control. Preview writes nothing.
3. In **Review merge fields**, check IDs, common owner, policy, proposed receipt,
   complete save size and record counts. Read **Duplicate-name warnings**.
4. Inspect **Retired and retained records**, every full before/after row in
   **Changed linked records**, and all **Unchanged linked context**. Closed
   opportunities and completed tasks are included where linked.
5. Choose **Apply contact merge** or **Apply company merge** once, then read the
   result and browser storage notice. Use **Cancel contact merge preview** or
   **Cancel company merge preview** to leave records unchanged, retain selections
   and return focus to Preview.

A contact merge moves its linked opportunities and converted leads to the
retained contact and company; linked converted-lead email follows the retained
contact. A company merge moves its linked contacts, opportunities and converted
leads to the retained company. Other fields, amounts, stages and task links stay
exact. Unconverted company-name text is not a graph edge. No contact or
opportunity is secondarily merged by a company operation.

Company warnings distinguish the selected pair's normalized name match, other
matching same-owner companies, and `pre-existing`, `new-cross-company` or `mixed`
contact-name groups. They name exact IDs and do not merge those other records.
The complete review must fit 200 distinct records; a truncated preview cannot
permit Apply.

## Authority, stale choices and drafts

Owners and sales managers may merge a compatible graph belonging to one
supported current owner. A sales representative may merge only their own graph.
Auditors can read candidates and authorized history but have no merge action.
Ownership transfers remain owner/manager-only.

Preview is one-use and expires after ten minutes. Current-source, identity,
scope or replacement changes can invalidate it. On **This CRM merge preview
expired or changed. Preview again; your selections are kept.**, inspect current
records and preview again. An old ID is never silently aliased to the retained
record or a new default.

Visited CRM tabs retain their dirty form owners while hidden. **Keep editing**
returns to the actual form; where offered, **Leave and keep draft** retains its
temporary text. **Discard and leave** clears only listed forms. Retiring a record
keeps unrelated name/email/title/amount text and displays its unavailable
selection explicitly. Accepted import, restore, Undo or Reset follows the
existing dirty/replacement rules; discarded temporary forms are not a backup.

## History, complete exports and save warnings

**Recorded CRM merge history** labels full captures **Captured at this receipt**.
Representatives receive **Captured IDs only**, recorded-owner policy and counts,
without private captures or joins to today's hidden records. A new owner does
not inherit a former owner's private history through an ID. Historical IDs grant
no current access. Legacy ordinary descriptions retain their existing policy.

Only the first successful merge captures the accepted legacy state and starts
the typed journal of later accepted commands. Reads, reports, exports and
ordinary legacy actions do not adopt it. Earlier actors, timestamps and command
facts that were never recorded stay unknown. Coherent local history is not a
signed account of real-world events.

An accepted merge can remain only in memory if browser saving fails. Read the
notice, keep the page open and use **Export workspace** before refresh. Apply is
not a save-retry button. Exports and recovery points are complete readable CRM
snapshots containing all owners, baseline, journal and private historical
captures; the current identity does not redact them. Unsaved text is excluded.

There is no ordinary unmerge. An earlier import, selected restore or Undo
replaces the whole selected CRM branch and can remove later work. Review the
replacement and independent optional required-checkpoint settings first.
**Reset CRM demo** returns CRM to the seed and clears temporary UI. The
[portal state contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATE-CONTRACT.md)
and [lifecycle guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-LIFECYCLE.md)
explain complete exports, dirty decisions and recovery boundaries.

The sample journal allows at most 100 merges, 1,000 total post-first-merge
commands and 2,000,000 characters in the full save envelope. Capacity refuses
without pruning or partial Apply; browser quota can be smaller. Valid legacy
reads can remain available when the merge feature cannot accept the workspace.

## Run local verification

```sh
npm run portals:test
npm run browser:portal-lifecycle
```

The first command runs the configured portal tests. The second is the existing
composed native lifecycle suite with fresh owned browser contexts and local
preview cleanup, including existing flows and the new CRM journeys. These
examples are verification entry points; the dated receipt above records the completed integrated gates. Provider operation, native Windows, manual screen-reader acceptance
and production deployment remain separate.

- [Template Portals](Template-Portals.md)
- [Optional Adoption Contracts](Adoption-Contracts.md)
