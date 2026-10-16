# Proposed report-only CSP adoption — WX-0612

Prepared 2026-10-15. **Artifact design reviewed; disabled and unadopted.** Agent 0 reviewed this proposed policy after independent source/artifact review. No catalog acceptance, Hosting/configuration change, collection, receiver, rule, secret or provider setup is recorded. Historical source basis supplied by Agent 0: `42818dd7baf3d335f27c401c37d048bd842617fa`; original fingerprints are preserved in the [source-review record](evidence/adoption-contract-source-review.json). References to original drafting or proposed implementation below preserve that observation scope. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md).

## Original criterion and mapping

**WX-0612** — P1 / security / production-readiness / operator; source `firebase.json`; no dependencies; the original draft recorded TODO; current status comes from the [canonical catalog](backlog/webappx-1000-todo.json).

> For optional operator-approved adoption: Produce a report-only policy proposal listing required Firebase, SDK, image and font origins; activation remains an operator-reviewed hosting change.

The inventory below lists observed required origins and conditional candidates. The candidate header is report-only. Operator selection, exact deployment identity and runtime review remain prerequisites to activation; this file does not replace the existing enforced header.

## Source observed at the historical basis and finite inventory

`firebase.json:17–19` declares an **enforced** `Content-Security-Policy` with broad `https:`/`wss:` and inline script/style allowances. It is not the proposed narrow report-only header. Other current headers include `X-Frame-Options: DENY`. `vite.config.ts` does not apply the Hosting header to Vite responses. A Vite test alone would not prove deployed Hosting behavior.

| Surface | Actual source evidence | Proposed source/directive decision |
| --- | --- | --- |
| Native script/CSS/favicon | `index.html:5,22`, `src/main.tsx:4`; current entry and bundled assets are same-origin | `'self'` for script/style/image. No external script origin or inline script requirement found in native source. |
| Native font | `src/index.css:1–8`: package build import, blank managed font-import markers and system-font stack | No external font origin required by current source. `font-src 'self'`; do not add Google Fonts hosts by assumption. |
| Native images | Current `src/`/`public/` source inventory: same-origin favicon/assets, no HTTP image load | `img-src 'self'`. An external link or SVG namespace does not create an image request. |
| Native persistence/import/export | `src/portals/persistence.ts:19`; `DemoWorkspaceBackup.tsx:28–33`; `CombinedWorkspaceBackup.tsx:37–43,54` | Local storage/File reads introduce no origin. Blob URLs are anchor downloads, not fetches/workers/images; they justify no broad `connect-src blob: data:`, worker or image allowance. |
| Local SYSTEMX development status | `src/systemx/localStatus.ts:140`, `vite.config.ts:15–20`: same-origin `/__systemx/api/status`, server-side loopback proxy | Browser `connect-src 'self'`. The proxy's upstream LAN address is not a browser origin. DEV-only behavior is not a production dependency. |
| Selected Gusto SDK 0.56.6 local API | `GustoSdkPreview.tsx:34–59,160`; `mock-api.mjs:116–138`: `/__gusto_mock__/` same-origin base URL, DEV middleware | `connect-src 'self'`. The selected config overrides the dependency's provider default. No `api.gusto-demo.com`/`api.gusto.com` browser permission is required for this mock. |
| Selected SDK CSS | Installed SDK `dist/style.css:1`: two `data:image/svg+xml` CSS images; no external font/import/image URLs; `ThemeProvider/theme.js:83` uses system fonts | SDK profile adds `img-src data:`. No external SDK font/image origin is established. |
| SDK runtime style element | Installed `ThemeProvider/ThemeProvider.js:33–35` inserts a nonce-capable `<style>`; current provider call supplies no nonce | Strict native `style-src 'self'` may report it. Explicit SDK compatibility candidate adds inline styles temporarily; a nonce/externalization design needs separate root review and actual browser proof. |
| CSSOM/style object changes | Native `Navbar.tsx:79`, `PageSnapMenu.tsx:52`; installed SDK `ProgressBar.js:13` | CSSOM property assignment, literal style attributes and style elements need separate runtime probes. Do not infer one exception covers all. |
| PDF helper | Installed `helpers/openPdfInNewTab.js:2`; selected mock unmatched endpoints return 501 (`mock-api.mjs:108`) | Uses new-tab/blob navigation, not an iframe. No accepted PDF workflow, worker, frame or arbitrary blob permission follows. |
| Firebase initialization | `src/config/firebase.ts:21–38,62–65`: configured API key+project ID or explicit DEV emulator lane | Native unconfigured mocks require no Firebase network origin. Never derive an adopted project's hostname from the template placeholder. |
| Conditional Firebase Auth API | Current auth wrappers in `src/auth/firebaseAuth.ts:56–98`; installed `@firebase/auth/dist/esm/index-4NFEPWkC.js` contains `identitytoolkit.googleapis.com` / `securetoken.googleapis.com` | Conditional `connect-src https://identitytoolkit.googleapis.com https://securetoken.googleapis.com` only for separately selected Auth functionality. Not default native permissions. |
| Conditional popup Auth helper | Same installed Auth source: iframe path/selected-domain construction at 10488–10512; `https://apis.google.com/js/api.js` at 11314 | Conditional `script-src https://apis.google.com` and `frame-src https://EXACT_SELECTED_AUTH_DOMAIN`. Domain remains null until selected and verified; no wildcard/default substitution. Popup provider redirects are navigation, not blanket subresource permissions. |
| Firestore/Storage/Functions/Analytics | Config creates Firestore/Storage objects when enabled; bounded current app search found no Firestore query, Storage upload/download, Functions client or Analytics request | No required external request origin proven for these app features. Re-inventory exact adopted SDK requests before adding hosts; installed packages alone do not justify every Google service. |
| DEV emulators/HMR | `firebase.ts:16–20,62–65`: configurable HTTP endpoints, defaults Auth 9099/Firestore 8080/Storage 9199 on loopback; Vite uses injected styles and its selected HMR socket | Separate owned DEV policy must bind exact chosen origins/ports and socket. No production `wss:` or HTTP-emulator allowance follows. |
| Real Gusto/hosted flows | `backend.mjs:46–48` refuses provider proxy; installed API config has provider defaults overridden locally | No adopted provider browser origin or hosted-flow frame is selected. Future server proxy/API calls and hosted workflows need their own accepted flow inventory. Server requests are outside browser CSP. |

Installed dependency observations are tied to the actual local pinned source, not claims of future vendor behavior. The inventory is static and bounded; transitive bundle paths and reachable request chains still require an owned runtime review. Firebase's [redirect guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices) confirms that Auth helper hosting/domain selection depends on deployment and flow; it does not select a domain for this template.

## Inert configuration and candidate headers

```json
{
  "enabled": false,
  "hostingProject": null,
  "hostingSite": null,
  "documentOrigin": null,
  "selectedProfile": null,
  "firebaseAuthDomain": null,
  "providerProgram": null,
  "reportCollector": null,
  "operatorApprovalReference": null
}
```

For a future built **native-only** review, proposed header name and value are:

```text
Content-Security-Policy-Report-Only:
default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'none'; worker-src 'none'; manifest-src 'self'; media-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
```

The separately selected **local SDK compatibility** report candidate changes only `style-src` to `'self' 'unsafe-inline'` and `img-src` to `'self' data:` for the observed runtime style/CSS icons. This is an explicit limited compatibility recommendation for review, not evidence that inline styles are ideal or that all SDK paths work. No script inline/eval allowance, remote font/image host or blob fetch/worker permission is added. The SDK mock remains DEV-only until a separately approved hosting/adapter decision; this proposal does not imply it works on deployed static Hosting.

Optional Firebase/Auth, emulator and provider additions are **unselected**. Materialize a complete candidate from exact selected functionality, domain and observed request chain; do not paste placeholder domains into a deployable header. Keep production and development profiles separate. Review exact built script/style requests and CSP support in the selected browser before enforcing anything.

The W3C [CSP report-only header specification](https://www.w3.org/TR/CSP3/#csp-report-only-header) defines monitoring rather than enforcement. An additional report-only header does not remove or loosen the existing enforced policy. Firebase [Hosting custom headers](https://firebase.google.com/docs/hosting/full-config#headers) are an explicit Hosting configuration operation; no such operation is performed here. Do not switch the enforced header to report-only to avoid a broken workflow.

## Reporting privacy and collection

No `report-to`, `Reporting-Endpoints`, `report-uri` or collector URL is selected in the candidates. Thus this proposal configures no remote report transport. A future opt-in collector requires its own operator-selected same-origin endpoint, access/rate/size controls, owner and finite retention before receiving data. Proposed review defaults are maximum 8 KiB per report, 100 accepted reports/minute per adopted site, seven-day logical retention and no raw request logging; all are local recommendations subject to root review.

Allow only directive/disposition, approved revision/profile, route template, blocked origin/category and coarse time. Strip query/fragment, user identifiers, arbitrary page paths, source snippets and raw report body. Keep `report-sample` disabled. CSP reports can be attacker-controlled or contain sensitive URL data; receiver failures must not widen policy, block the app or silently create an unlimited queue. The W3C [CSP security/privacy discussion](https://www.w3.org/TR/CSP3/) is part of that future review. No collector was built or used.

## Literal fictional allow/report test contract

Tests below describe future owned fixtures. Set document origin to `https://app.fixture.invalid` in the fixture only. An allow/report label is the **proposed policy match**, never a claim of actual blocking: report-only violations remain subject to the separately present enforced policy.

| ID | Literal request/operation | Native candidate | SDK compatibility candidate |
| --- | --- | --- | --- |
| CP-01 | Script `https://app.fixture.invalid/assets/app.js` | Allow | Allow |
| CP-02 | Script `https://unapproved.fixture.invalid/inject.js` | Report `script-src` violation | Same |
| CP-03 | Literal inline script `window.FICTIONAL_PROBE=1` | Report; do not infer execution blocked by report-only | Same |
| CP-04 | Image `https://app.fixture.invalid/favicon.svg` | Allow | Allow |
| CP-05 | CSS icon `data:image/svg+xml,...` | Report image violation | Allow for observed SDK icons |
| CP-06 | Font/image from `https://unapproved.fixture.invalid` | Report corresponding violation | Same |
| CP-07 | Fetch `/__gusto_mock__/__session` | Allow origin; route availability remains a separate DEV-adapter result | Same |
| CP-08 | Fetch `https://api.gusto-demo.com/v1/...` | Report connect violation; no provider call in native fixture | Same |
| CP-09 | Observed SDK theme `<style>` without nonce | Expect report; verify actual browser case | Inline-style allowance, with exact runtime witness required |
| CP-10 | Frame `https://unapproved.fixture.invalid/embed` | Report frame violation | Same |
| CP-11 | Anchor download of a locally generated JSON blob | Test actual download independently; do not invent connect/image/worker request | Same |
| CP-12 | Selected Auth API/iframe under a separate exact Auth profile | Only explicitly selected observed origins match; wrong auth domain reports | Native/SDK profiles alone still report |
| CP-13 | DEV `http://127.0.0.1:9099` or selected HMR socket | Not added to production proposal; separate exact DEV fixture | Same |
| CP-14 | Report containing `/employee/private?token=FICTIONAL_SECRET` | No collector by default; proposed projection strips path/query and marker before persistence/logging | Same |

Future proof must inspect actual response headers on the named owned built/Hosting-equivalent response, monitor violations and test native save/export/import/restore, selected SDK styling/icons, optional Auth popup/iframe and any accepted external assets. It must distinguish report-only diagnostics, existing enforcement, route failure and network failure. Policy widening requires a source/request rationale; suppressing all reports is not acceptance.

## Review decisions and remaining adoption inputs

Resolved recommendations: narrow native baseline; separate explicit SDK style/data-image compatibility; no assumed Google Fonts, remote images, broad Google/Gusto hosts or blob workers; no report collector by default; preserve current enforcement. Unselected inputs remain exact Hosting site/origin, optional Firebase/Auth flow/domain, provider/hosted workflow, reporting owner/destination/retention and browser matrix. Agent 0 has reviewed the artifact design; a downstream operator must separately choose and approve the actual adoption values. Actual Hosting activation, collection, provider and enforcement tests remain separate authorized work. No backlog item is accepted by this draft.
