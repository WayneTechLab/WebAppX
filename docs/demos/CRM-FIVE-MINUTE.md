# Five-minute CRM demonstration

Demonstrate a fictional lead becoming linked company, contact and opportunity
records, then move that opportunity through two real pipeline controls. The
five-minute schedule is designed human pacing; automated execution time is not
a measurement of a person's demonstration speed. This scenario covers WX-0906.

Use a dedicated local development origin and a fresh owned browser context or
private window. Follow [Getting started](../GETTING-STARTED.md) for dependencies
and local setup. Keep another person's browser/profile and saves intact. If the
baseline below differs, close only your demonstration context and start another
fresh one; do not clear existing site data or use Reset to force a match.

The named baseline is `webappx-portal-smoke-v1`, in
[the reviewed synthetic fixture](../../tests/browser/fixtures/portal-smoke-v1.json)
with its [recorded digest](../../tests/browser/fixtures/portal-smoke-v1.sha256).
Native defaults in a fresh context equal that complete seed. Use fictional
information only. Preview roles and receipts demonstrate local behavior; no
customer email, payment, contract, provider access or production membership is
created.

After installing dependencies with `npm ci`, start the account-free server
from the repository root:

```bash
npm run dev:mock
```

Use its printed `/portals` address in the fresh owned context. The launcher
isolates provider configuration and chooses a free loopback port; stop only
the process you started when finished.

1. **0:00–0:35 — Establish the baseline as Casey Example · Owner.** Open
   `/portals`, choose **Customer relationships**, and confirm **CRM preview
   identity** is **Casey Example · Owner**. On **Dashboard**, observe **Active
   sample leads: 2**, **Open sample pipeline: $6,500.00**, **Sample won value:
   $0.00**, and **Open follow-ups: 1**. These are the two existing opportunities
   worth $2,500 and $4,000. A fresh context has no prior CRM action receipts.

2. **0:35–1:15 — Create the fictional lead.** Choose **Leads**. Enter **Lead
   name:** `Elliot Fixture`, **Lead email:** `elliot@evaluator.invalid`, and
   **Lead company:** `Fictional Evaluator Studio`. Click **Create sample lead**.
   The new card shows `lead-0001`, status **new**, and the feedback receipt
   `MOCK-CRM-0001`. The active-lead count becomes **3**; open pipeline remains
   **$6,500.00**. Return to **Leads** for the next step.

3. **1:15–2:00 — Qualify, then convert exactly once.** On Elliot's card click
   **Qualify sample lead**, producing `MOCK-CRM-0002`. In **Sample opportunity
   amount (USD)** enter `1750.25` and click **Convert sample lead**. The card
   says: **Converted once. Company company-0003, contact contact-0003 and
   opportunity opportunity-0003 are linked in the pipeline and directory.**
   Receipt `MOCK-CRM-0003` records conversion, and its conversion form disappears.
   On **Dashboard**, active leads return to **2**, open pipeline becomes
   **$8,250.25**, and open follow-ups remain **1**.

4. **2:00–2:45 — Inspect links and assign the follow-up.** In **Companies &
   contacts**, find **Fictional Evaluator Studio**, `company-0003`, Elliot's name
   and fictional email. In **Pipeline**, find **Fictional Evaluator Studio ·
   sample opportunity**, `opportunity-0003`, **discovery**, and **$1,750.25**.
   Choose **Follow-up tasks**. Set **Follow-up title** to
   `Prepare fictional evaluator proposal`; select the new opportunity in
   **Follow-up opportunity** and click **Create sample follow-up**. Its card is
   **open**, names that opportunity, and says **Assigned to Casey Example**.
   Receipt `MOCK-CRM-0004` records the linked `task-0004`; open follow-ups become
   **2**. Leave the task open for this demonstration.

5. **2:45–3:35 — Move the opportunity through the real controls.** Return to
   **Pipeline**. On the new opportunity click **Move to proposal**. Observe
   status **proposal**, receipt `MOCK-CRM-0005`, and the newly available
   **Move to negotiation** button. Click it. Observe **negotiation** and
   `MOCK-CRM-0006`. The card retains **$1,750.25**, the same company/contact and
   `opportunity-0003`. These actions change stage without creating a sale or
   changing its amount.

6. **3:35–4:20 — Check history and totals.** Choose **Activity** and find
   `MOCK-CRM-0004`, `MOCK-CRM-0005`, and `MOCK-CRM-0006`. The two movement
   descriptions are **Moved Fictional Evaluator Studio · sample opportunity to
   proposal.** and **Moved Fictional Evaluator Studio · sample opportunity to
   negotiation.** Return to **Dashboard**: **2** active leads, **$8,250.25** open
   pipeline, **$0.00** sample won value and **2** open follow-ups. **Linked account
   directory** reads **3 fictional companies · 3 contacts · 6 successful sample
   actions**. The pipeline is $6,500 + $1,750.25; movement preserves that sum.

7. **4:20–5:00 — Reload and retain review evidence.** Reload the page, return
   to **Pipeline**, and confirm the new opportunity is still **negotiation**.
   Check its links in **Companies & contacts** and the open follow-up in
   **Follow-up tasks**. From **Portal directory**, use **Export all workspaces**
   in **Combined workspace backup** to retain the complete records. The final
   CRM sequence is **7**, with six receipts; HR and CMS remain the named seed.
   Close only your demonstration context and the development process you own.

The browser proof for these exact values is:

```bash
node scripts/browser-evaluators.mjs
# Optional visible automated run:
node scripts/browser-evaluators.mjs --headed
```

It creates its own loopback Vite server and fresh browser contexts, validates the
named seed before opening them, and closes its owned resources. It compares
complete exports and saved CRM records against independently written expected
records after creation/conversion, proposal, negotiation and reload. It also
checks unchanged HR/CMS records, exact linked identifiers, activity descriptions
and dashboard values. Printed artifacts include `evaluator-crm-evidence.json`,
`evaluator-crm-movement-trace.zip`, `evaluator-crm-negotiation.png`, downloaded
workspace snapshots and the suite's `report.json`.

Related demonstrations: [HR](HR-FIVE-MINUTE.md), [CMS](CMS-FIVE-MINUTE.md),
and [single-module recovery and Undo](RECOVERY-TEN-MINUTE.md).
