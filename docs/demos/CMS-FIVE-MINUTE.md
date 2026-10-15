# CMS demo: separate review and frozen publication

Present one fictional article from an author's draft through a separate review
and simulated publication, then change the draft while its public sample stays
frozen. The suggested pacing is designed for a five-minute presentation after
setup; no human completion time is claimed. The CMS identities are preview
controls. Publication creates a local in-app projection and receipt; it grants
no real account permissions and publishes nothing to a website or provider.

## Prepare a fresh demo

From the repository root, install dependencies once with `npm ci`, then start
the account-free local server:

```bash
npm run dev:mock
```

Open the printed `/portals` URL in a new temporary browser profile or an isolated
browser context owned by this demo. Use a fresh context for this script even if
you have already run the HR or CRM demo. A new tab can inherit a profile's saves.
Preserve existing profiles, saves and listeners; if the baseline differs, choose
another isolated context instead of clearing site data or resetting user work.

The reviewed starting data is
[`webappx-portal-smoke-v1`](../../tests/browser/fixtures/portal-smoke-v1.json), with
its [recorded digest](../../tests/browser/fixtures/portal-smoke-v1.sha256). Native
defaults match that seed. The fixture is a source reference, not a backup import
file. On **Portal directory**, expect **Choose a portal.** and **Browser save:
Ready** for each portal. Keep the same address and context through the script.

## Run the presentation

1. **0:00–0:30 · Presenter → Alex · author.** Open **Content management**.
   Keep **Alex · author** (`cms-author`) in **CMS preview identity**. In
   **Editorial collection**, select **A fictional team update** if it is not
   already selected. **Selected content** identifies `cms-article-001`,
   `articles` and **current draft revision 1** with status **draft**. The
   **CMS metrics** are **Drafts 1**, **Awaiting review 0**, **Approved revisions
   0**, **Published samples 1**. **Published sample preview** contains the
   seeded **Welcome to the sample studio**, with **published revision 1** and
   `SEED-CMS-PUBLICATION`; the selected draft is absent there.

2. **0:30–1:15 · Alex saves revision 2.** In **Selected content**, fill
   **Content title**, **Content slug** and **Plain-text content** with the exact
   revision 2 values below. Use the edit form, above **Create sample content**.
   Activate **Save draft revision**. Expect **current draft revision 2**, status
   **draft**, and `MOCK-CMS-0001` in the success message and **CMS session
   activity** with **Saved draft revision; previous approval invalidated**.
   Alex has no **Approve revision 2** control. Metrics remain **1 / 0 / 0 / 1**
   in the order shown in step 1, and the public preview still contains only
   the welcome page.

3. **1:15–2:00 · Alex requests review; Pat checks the gate.** Activate
   **Request review**. Expect `MOCK-CMS-0002`, **Requested review**, and selected
   status **in review**. Metrics become **0 / 1 / 0 / 1**. Select **Pat ·
   publisher** (`cms-publisher`) in **CMS preview identity** and observe that
   **Simulate publication** is disabled. Changing the identity creates no
   activity receipt. The article needs a separate review before publication.

4. **2:00–2:40 · Riley approves the exact revision.** Select **Riley ·
   reviewer** (`cms-reviewer`). Read the revision 2 title, slug and body, then
   activate **Approve revision 2**. Expect status **approved** and
   `Revision 2 approved by the separate reviewer · MOCK-CMS-0003`.
   **CMS session activity** records **Approved exact draft revision**, revision
   **2**, actor `cms-reviewer`. Metrics become **0 / 0 / 1 / 1**. The article
   remains absent from **Published sample preview** until Pat publishes it.

5. **2:40–3:30 · Pat freezes the approved article.** Select **Pat · publisher**
   and activate the now-enabled **Simulate publication**. Expect
   `MOCK-CMS-0004`, **Simulated publication**, and selected status **published**.
   Metrics become **0 / 0 / 0 / 2**. **Published sample preview** now contains
   exactly two public samples: the original welcome page and **Fictional editorial
   lifecycle release**. The new article shows
   `articles / fictional-editorial-release · published revision 2`, the exact
   revision 2 body below, and `MOCK-CMS-0004`. The public article consists of
   that path/revision, title, body and publication receipt; draft text,
   reviewer feedback and author details stay outside this projection.

6. **3:30–4:25 · Alex writes a later private draft.** Select **Alex · author**.
   In the edit form for `cms-article-001`, enter the revision 3 values below,
   then activate **Save draft revision**. Expect **current draft revision 3**,
   status **draft**, `MOCK-CMS-0005`, and
   `The published sample is still revision 2. This draft has not replaced it.`
   The previous approval is invalidated. Metrics become **1 / 0 / 0 / 2**.
   **Published sample preview** must still show the revision 2 title, slug,
   body and `MOCK-CMS-0004`; none of the revision 3 text appears there.

7. **4:25–5:00 · Presenter verifies persistence and the next gate.** Reload.
   The selected edit form still holds the revision 3 values, while the public
   article still shows the exact revision 2 snapshot and `MOCK-CMS-0004`.
   Select **Pat · publisher** again. **Simulate publication** is disabled
   because revision 3 has no current approval. **CMS session activity** has
   exactly five new receipts, `MOCK-CMS-0001` through `MOCK-CMS-0005`; switching
   identity and reloading add none. Return to **Portal directory** and use
   **Export all workspaces** if a fictional JSON handoff is needed. A complete
   backup includes editorial drafts as well as published snapshots; it has a
   broader scope than **Published sample preview**.

Use these exact form values to keep the demonstration aligned with the browser
contract. The revision 3 content is private to the fictional editorial workflow;
the account-free workspace and its complete backup are not a confidentiality
boundary for people sharing a browser profile.

| Edit field | Revision 2: approve and publish | Revision 3: save as draft |
| --- | --- | --- |
| Content title | Fictional editorial lifecycle release | Fictional editorial lifecycle next draft |
| Content slug | fictional-editorial-release | fictional-editorial-next-draft |
| Plain-text content | This approved fictional article is the exact public sample retained while its later draft changes. | This later fictional draft is private to the editorial workspace and must never replace the approved public sample. |

## Rehearsal evidence and cleanup

Run the local evaluator from the repository root after installing the matching
Chromium binary with `npm run browser:install`:

```bash
node scripts/browser-evaluators.mjs
```

The CMS contract lives in
[the editorial browser lifecycle](../../tests/browser/cms-crm-lifecycles.mjs).
It starts from the named seed in a fresh context, checks each complete exported
state, observes the disabled publication gates, and compares every rendered
public field before and after the later edit and reload. A passing report is
local browser evidence; it does not measure a human's presentation time or
establish network publication or provider acceptance. Keep the runner's actual
report and artifact location with any rehearsal result.

Close only the demo-owned context and stop only the `dev:mock` process you
started with Ctrl+C. Preserve existing profiles, saves and other servers. For
background, read the [portal guide](../TEMPLATE-PORTALS.md),
[state contract](../PORTAL-STATE-CONTRACT.md),
[capability matrix](../PORTAL-CAPABILITIES.md) and
[HR five-minute demo](HR-FIVE-MINUTE.md).
