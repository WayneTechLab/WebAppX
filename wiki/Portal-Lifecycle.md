# Portal Lifecycle Workflows

**Implemented source guide; integrated verification and acceptance are pending.**
This page covers the account-free HR employment, CMS release and CRM ownership
controls currently being integrated. A forthcoming QA receipt will record actual
execution when available. This guide does not establish production or provider
acceptance.

Start `npm run dev:mock`, open its printed local origin and visit `/portals`.
Use fictional information. Saved records belong to the current browser profile
and scheme/hostname/port. Preview role selectors demonstrate local access rules;
they do not authenticate a person or change real account permissions.

The [full lifecycle guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-LIFECYCLE.md)
contains the complete field names, refusal behavior and saved-state boundaries.

## HR employment and directory history

Open `/hr/demo/admin/employees`, choose Employer owner or HR admin in
**Synthetic management role**, and find **Employment lifecycle**. The
**Organization** route also contains these controls. Employee profile pages link
back through **Employment lifecycle and transfers**.

1. Choose **Employment simulation date**. **Use simulation date** → **Confirm
   simulation date** saves an explicitly reviewed date. Effective dates must be
   on or before it and follow the accepted instance timeline. There is no clock
   scheduler; unknown legacy start dates remain unknown.
2. In **Captured onboarding template versions**, choose **Onboarding template
   version**. **Preview template selection** → **Confirm template selection**
   applies `sample-v1` or `sample-v2` to subsequent hires/rehires. Version 2 adds
   fictional access/security guidance. Existing captured checklists and receipts
   retain their version.
3. Choose **Lifecycle employee**. Use **Preview sample transfer** to review the
   old/proposed department, manager, effective date and affected direct-report
   scopes before **Confirm sample transfer**. Self-management and reporting
   cycles refuse with the affected employee IDs.
4. For leave, return or termination, choose **Employment transition**, enter
   **Transition effective date** and **Sample transition reason**, then **Preview
   employment transition**. Use its specific confirmation only after reviewing
   the prior state and proposed change. Employment leave is separate from
   vacation/sick requests.
5. After a fictional termination, enter the rehire fields and **Compare fictional
   rehire**. The comparison distinguishes retained employee identity/history from
   a new employment instance and incomplete captured checklist. The new start
   must follow the prior end date. **Confirm fictional rehire** creates that
   instance; the prior onboarding receipt stays archived on the prior instance.

Changing managers on transfer or rehire requires acknowledgement of the
employee's unfinished performance review first. Keeping the old manager leaves
that cycle workable. A manager's current reports must be reassigned before that
manager can be terminated.

Termination creates fictional asset, access and handover captures plus pending
work in **People tasks**. The historical capture remains assigned while the
existing task can later be completed. No real asset or external account is
changed. Rehire retains leave balances, fictional hourly rates and benefit
elections; it does not infer compensation cadence. Submitted payroll and consumed
time retain their frozen values.

On the relevant profile, **Directory corrections and history** lets employees
and managers propose their own fictional `.invalid` work-email correction.
**Preview correction request** → **Confirm correction request preview** records
a pending request without changing the directory email. Owner/HR uses
**Correction outcome**, **Correction outcome reason** and **Simulation date**,
then **Preview correction outcome** → **Confirm correction outcome preview**.
Acceptance saves the change and outcome together; rejection preserves the email.
A newer edit or employment instance makes an old acceptance stale.

Owner/HR also has **Direct directory email edit**. Ordinary **Save sample
profile** retains its existing permissions and records meaningful accepted email
changes too. **Saved directory change history** displays old/new values, actor
preview and local change sequence. It is a sample history, not authenticated
audit evidence.

## CMS local release bundles

At `/cms/demo`, use **Alex · author** and **Riley · reviewer** to prepare at least
two separately approved current entries. Choose **Pat · publisher**, then:

1. Enter **Release name**, select **Approved release entries** and **Prepare
   release draft**. This saves approved and previous-publication snapshots while
   keeping current publications unchanged.
2. Choose **Preview release _name_**. Read captured approval, route, previous
   frozen publication and current draft in **CMS release activation preview**.
3. When **Ready to activate**, choose **Confirm activate release**. All included
   frozen publications update together in one accepted CMS state. **Cancel
   release activation** leaves the saved draft bundle and publications intact.

Stale content, approvals or previous publication snapshots block activation.
Duplicate reserved routes also refuse. Changed workspace/identity facts require
**Refresh release preview**; edited members need a fresh approved release.
Activated bundles cannot be replayed. A stale draft bundle can remain a valid
historical capture for save/import inspection. Local activation publishes no
external website.

## CRM ownership

At `/crm/demo`, select an owner or sales manager in **CRM preview identity** and
open **Ownership**.

- **Reassign an unconverted lead**: choose **Lead to reassign** and **New lead
  assignee**, then **Preview lead assignment** → **Confirm lead assignment**.
  Only that new/qualified lead moves.
- **Transfer a sample account**: choose **Account to transfer** and **New account
  owner**, then **Preview account transfer**. Review **Complete affected record
  list** before **Confirm account transfer**. The company, linked contacts,
  converted leads, opportunities and follow-up tasks move together, including
  closed/completed records.

Only the complete valid CRM graph can be reviewed and accepted. Actor, selection
and current source are checked again; stale or conflicting changes refuse as a
whole. The review limit is 200 records, with no partial-transfer fallback.
Unconverted leads with matching company-name text have no account link and stay
separate. Historical activity keeps its original ownership/text; the new receipt
records both fictional assignees. Sales representatives and auditors cannot use
ownership changes. No customer notification or external email is sent.

## Preserve saved and temporary work

Legacy saves remain readable without eagerly adding optional extensions or
inventing dates. Previews write no workspace record. Preparation, confirmation
and accepted ordinary saves have their explicitly described durable effects.

**Restore points & Undo** inspection includes the new HR instance/checklist/
archive/correction/assignment collections, CMS release captures and CRM ownership
receipt links. Bounded metadata hides email values, reasons, bodies and amounts;
complete hidden values still participate in differences. Imports and selected
restore validate the complete file before replacement. Selected portals are
replaced as whole workspaces; unchecked portals retain their saved bytes.

Keep/Discard decisions protect registered temporary forms. Failed actions retain
input; successful accepted actions rebase their own form. Refresh loses unsaved
values and volatile previews. If persistence is unavailable, keep the page open
and export accepted in-memory records before refreshing.

Read [Portal Safety and Recovery](Portal-Safety-and-Recovery.md), the
[state contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATE-CONTRACT.md)
and [recovery glossary](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WORKSPACE-RECOVERY-GLOSSARY.md)
for replacement, checkpoint and retained CMS editor choices. These native
workflows execute no real payroll, change no provider resources and establish
no production authentication or server authorization.
