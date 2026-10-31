# F002 source access and host swarm acceptance — 2026-10-30

Agent 0 accepted exactly **LAN-00101–LAN-00200** after terminal validation of functional candidate `e1588c4ebe94b1ef5f1557641334d95aee9b8290`. This adds **100 requirements / 20 capabilities**, taking the LAN program to **200/10,000 requirements and 40/2,000 capabilities**. F001 and F002 are complete; **9,800 requirements remain TODO**. The previous 100 completion objects and their order are preserved exactly. The separate original WebAppX catalog remains **179 done / 821 remaining**.

The host swarm controller is an additional requested change. Its twenty commands and ten worker slots do not inflate the F002 acceptance count. Reusable project records remain blank, and managed release snapshots, research packages and kits retain their original fingerprints.

## Terminal verification

| Gate | Result and scope |
| --- | --- |
| Full CI | `npm run ci:all`: all **70 ordered stages passed**. All previous 68 stages remain in their original relative order. The two added stages are the swarm tests and F002 browser suite. |
| Unit/API coverage | **114 core tests** passed, including 17 source-policy tests, 15 source-policy API cases and 10 navigation helper tests. Existing source/font/history guards remain covered. |
| Swarm qualification | **32 tests** passed: the original 27 local orchestration cases plus five portable path tests. Ten actual synthetic CLI processes entered distinct worktrees before release; local Git and fake REST responses qualify the lifecycle without a paid provider account. |
| F002 browser | **20 capability groups**, 14 matching served assets and 44 browser GETs passed. All 53 implementation inputs and 648 protected source/seed files were preserved. |
| Source regression | **55 groups and seven geometry checks** passed. Fourteen served asset responses, 39 implementation inputs and 648 protected fingerprints remained exact. |
| Navigator | **16 groups** passed: four actual-app journeys, eleven DOM fixtures and one preservation group. There were 747 browser GET/HEAD requests plus four preflight GETs, no page errors/refusals and 691 unchanged protected fingerprints. |
| Hosting preflight | `npm run deploy -- hosting --preflight` passed. Its log explicitly skips changelog/commit, push and deployment; app version remains 3.4.0 and deployment count 0. |

All gates above bind the same full functional revision. CI ran from 2026-10-31T05:38:11Z to 05:52:33Z; the separate preflight finished at 05:52:54Z. These UTC times fall on **2026-10-30 in America/Los_Angeles**. Both preserved all **2,078 tracked input fingerprints**. Qualification ran on macOS arm64. Later publication metadata is checked separately and does not change the tested runtime code.

Independent read-only reviews found no unresolved P1/P2 findings in the source-policy and host-controller scopes. Unchanged reviews were retained by input hash across the test-only B repair; the three-file native path repair received a focused additional review. Agent 0 owns final acceptance.

## Accepted capability matrix

Each range contains the original behavior, boundaries, recovery, feedback and evidence requirements. The authored definitions and dependency graph were not rewritten. The dedicated browser group for each row, unit/API negative cases, operator feedback and preservation checks support the five lanes together.

| Requirement range | Accepted capability |
| --- | --- |
| LAN-00101–LAN-00105 | Browse eligible source files |
| LAN-00106–LAN-00110 | Filter source by allowed extension |
| LAN-00111–LAN-00115 | Explain source path refusals |
| LAN-00116–LAN-00120 | Resolve repository-relative source paths |
| LAN-00121–LAN-00125 | Detect linked source ancestors |
| LAN-00126–LAN-00130 | Identify supported source write kinds |
| LAN-00131–LAN-00135 | Display source size before opening |
| LAN-00136–LAN-00140 | Separate generated and authored files |
| LAN-00141–LAN-00145 | Protect runtime and backup paths |
| LAN-00146–LAN-00150 | Handle source case differences |
| LAN-00151–LAN-00155 | Retain safe selections across refresh |
| LAN-00156–LAN-00160 | Search source metadata |
| LAN-00161–LAN-00165 | Inspect source rule provenance |
| LAN-00166–LAN-00170 | Preview a path policy proposal |
| LAN-00171–LAN-00175 | Compare source access policies |
| LAN-00176–LAN-00180 | Handle unavailable source encodings |
| LAN-00181–LAN-00185 | Bound source directory traversal |
| LAN-00186–LAN-00190 | Show source access by workspace |
| LAN-00191–LAN-00195 | Remember nonsecret source navigation |
| LAN-00196–LAN-00200 | Export an eligible source inventory |

## Observable source behavior and reversibility

The source browser inventories regular eligible files within named fixed rules and declared depth/entry/result budgets. Extension filters and filename/tag search cannot expand access or index bodies. File metadata shows size, rule, origin and supported write kinds. Canonical spelling, exact casing, regular-file and no-linked-ancestor checks apply to each read and write. Stable errors contain no neighboring private paths or source text.

Unsupported UTF-8/NUL and oversized content fail as a whole. Raw source writes and font writes share generated-file protection; known generated files are read-only. Classification uses recognized names and the first 4,096 header bytes and is not universal authorship proof. History retains bounded raw-byte hashes of unsupported encodings without returning decoded text.

Filtering does not delete or replace a loaded selection. Complete error-free inventory may clear an ineligible picker while retaining its loaded editor and baseline. A held older inventory cannot supersede a newer target, source load or observation. Refused reads restore the previous valid selection. Metadata refresh never rebases a source draft.

The named pages-only policy proposal reports six removed rules and their exact affected eligible paths when the inventory is complete. It applies nothing and opens no source files, including generated headers. Partial results remain explicitly qualified. Optional navigation preferences retain only eligible path/filter metadata under the checkout identity, revalidate before reuse and never open source or grant write authority automatically. Inventory download uses a finite public DTO and contains no bodies, runtime paths, tokens or credentials.

## Real WebAppX GUI proof

The actual local Home was explicitly selected and loaded through LAN. It remains 3,661 bytes at revision `cf753da247db7e2a66b667510ed211d879a39b77a6c122d672a97ee609a25aa6`; this iteration made no new Home source changes. Filters retained Home outside visible results, a traversal request was rejected before a file request, and policy review showed six removed rules and eleven affected paths with `applied:false`. Exact semantic labels for Extension and Search metadata were exercised after their accessibility repair.

The deliberate real-checkout inventory download contains **24 eligible files / 10,444 bytes**, SHA-256 `a3695c32286e59f9b9116d36d356f446d046caf6fb0ab60e56f896ce30448faa`. All **153 source/backup/temp fingerprints** stayed unchanged. The isolated F002 fixture export separately contains 26 synthetic eligible files / 11,163 bytes; its digest is recorded below. These exports have different scopes and are not interchangeable source claims.

Before refreshing the owned local stack, Firebase emulators were exported to a private directory and that same export was supplied on restart. Readiness and structural import evidence do not establish a row-by-row dataset audit. Unrelated listeners were preserved. Browser navigation/recovery opt-ins remain off after the real proof; the loaded editor is clean.

## Swarm, synchronization and delivery boundaries

Agent 0 coordinates the shared budget and is the canonical writer. X records observations; Y carries at most ten configured, isolated CLI workers; Z reviews independently; Alpha supplies a separate expiring integration lease. Read the [swarm operating contract](SYSTEMX-SWARM.md), [operational MAP](SYSTEMX-SWARM-MAP.md) and [access matrix](SYSTEMX-SWARM-ACCESS-MATRIX.md). The reusable MAP/access seeds are intentionally not adopted project records.

The controller binds task packets, provider identity, generation branches and IDE/Codex handoffs to exact revisions. Feedback and target integration invalidate checks, Z review and Alpha. Merge uses an immediate REST request with the reviewed head SHA after current checks/review/protection/base observations. It requests no deferred queue or administrator bypass. Uncertain outcomes remain pending for observation; no blind merge retry or task acceptance follows them.

PR and intended-target readbacks precede Agent 0 acceptance. Closure retains branches/worktrees by default. Optional retirement first preserves a verified private, regular, unlinked Git bundle within 128 MiB, refuses local ignored/untracked data, and uses expected-head deletion/readback. The next wave needs a fresh base and closed prior generations.

This is a stepwise controller, not an installed background scheduler. Role evidence is an operator assertion, not authenticated independent identity. Trusted same-user CLIs are not an OS sandbox. Native Windows provider/check execution remains refused; Windows drive/UNC path logic and actual macOS no-link behavior have tests, while native Windows Git/ACL/process operation remains unqualified. Detached descendants and controller-crash recovery require manual ownership audit. Actual authenticated AI-provider sessions, live GitHub PR merges, permissions changes and production deployment were not performed.

## Retained attempts and historical evidence

Candidate A (`ce22c253`) stopped its source regression after nine groups because the old harness attempted Save while a different target was selected. The stronger UI correctly disabled Save. The test-only repair asserts disabled Save, zero POSTs and retained draft/base/approval; failed cross-target reads restore the previous valid selection. A later 54-group provisional attempt needed the normal eligible-inventory refresh after an external file restoration. Both failures remain distinct from final C passes.

Candidate A and B CI runs were intentionally interrupted before terminal acceptance for the harness and then the confirmed native-path repair. Only their observed owned process groups were interrupted; those processes exited and the existing app stayed live. Candidate B browser passes remain valid earlier-revision evidence. The initial synthetic GitHub fixture syntax error and path-link fixture correction are retained with their successful reruns. Only final C is counted here.

The optional historical documentation-freshness preview refused the linked checkout and then refused an incomplete broad historical comparison at its bounded report limit. No guard was loosened and no new retain decision was fabricated. The original 116 decision records, historical guide/receipt bytes and mapping remain unchanged. The current source-policy/swarm guides and this candidate-bound report provide the new evidence; historical browser receipts are not recertified.

## Artifact digests

Original reports, input manifests, traces, screenshots, terminal logs, independent reviews, failed attempts, publication readbacks and the private resume record are retained by the local handoff. No private host paths, session tokens or raw provider output are published here.

| Artifact | SHA-256 |
| --- | --- |
| `source/result.json` | `5c5155a6dcb0cb7157060dc1a8ec529df55a5e537c5ef84d29fd953b4d9996e4` |
| `source/manifest.json` | `bf64233ccccafd194efa2966e476577fd2a4ced21383586bca7867dd168ddec1` |
| `source/trace.zip` | `c600de1837c48cb35dfafb86e919857ee7a31b937ecec80941e064fc41261053` |
| `navigator/result.json` | `6908a4fb570f069255487fae540172b8bfd9e29be1c02df1996f3c0abffc81d3` |
| `navigator/trace.zip` | `f8efec1f3f31fd178ad6912cd3399b4343e35b15f1b2ee18bfe5bfec7243cc29` |
| `navigator/execution-receipt.json` | `00f67501674cddfd281134f41bcc1b60016e859ba46aee35d132a1e49939fd94` |
| `policy/result.json` | `bb33371f06565a13249c64a867228751214359765bd7ad3537af8982acad413a` |
| `policy/manifest.json` | `6b952ec55b67c3ed020e6ab1b377450d6702e811bc47ea168d8c059e0f100216` |
| `policy/trace.zip` | `78f01169712e85793d931c5676defd1b1573e0cac73ba75f9b4af82abd72bfff` |
| `full-ci.log` | `65d5e72c251c90df060daef7f5c15c22f740886631e1bf534c8a65663aa47918` |
| `hosting-preflight.log` | `bd4554fe43309c16f770f5c53ff0b728e48e07905ff6f54a6efd9f2bd9455b74` |

The isolated F002 metadata export SHA-256 is `a3d49988368baafa2f1d25da06c2b292eaa6c05b7ad3106651284f15fbd7c18c`. The normal inspector measured 336 px outside and 335 px client/scroll width; the source-browser content measured 289 px client/scroll width.

GitHub source/wiki publication and final remote revisions are recorded separately in the final handoff and WebAppX Space. Git publication does not deploy or activate providers. The structural Designer kernel, complete portal route mapping/data binding, and the remaining 9,800 requirements are still future work.

## Exact completion bindings

```lan-completion-evidence
{
  "schemaVersion": 1,
  "requirements": [
    {
      "id": "LAN-00101",
      "definitionSha256": "8614350cde962112aa0a1b980df510829aead81a1806964bb9fe98cd282c0a79",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00102",
      "definitionSha256": "1b96f13c720d28892a7a7462e7d3917c4c4c06a1dca7441cec6fcf047aa9c0c5",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00103",
      "definitionSha256": "9cb84a9131c410b118dfe94dddea414559c1053b136ea83807c6e6d89a64a988",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00104",
      "definitionSha256": "1c7455f42d16632edd1a9324e5418a7329e7db171c1c40aa700aa8fc97545854",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00105",
      "definitionSha256": "886bab55608f91950f2f82d09468ab1cd2c1830ffd51926d65498f60821e7d2f",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00106",
      "definitionSha256": "2a68faa565fbcea23ae702e4b86c4033e3f1032663890ebdb2cec79c0764bdda",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00107",
      "definitionSha256": "412028816212bad2d22fb0b8ad6cc026a2dd70c708f673e0714b0bc307532ddf",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00108",
      "definitionSha256": "843d74e6a53da82a4cef4a1412648a475973f70518393a9e94b5b0178cb61c33",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00109",
      "definitionSha256": "c3b0ba04a2c8f3265cb4fbbf2e3f1dd06d1934462f8d5afcd11ee79ab37f8fef",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00110",
      "definitionSha256": "7d638f905905e81c11b8d1e052fc4cd060aedd062b219280ccfc74f8dfcf4f9e",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00111",
      "definitionSha256": "6e00fdb096ec784551d814da9e85e092b8ec6706322ac83dda87b5a2b4b23633",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00112",
      "definitionSha256": "a3dbde84d6ba4b0fce1df72fda13baae4ba151b54e48ebd92de0ef4d7a488409",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00113",
      "definitionSha256": "0c160a5ac6b3ad328b2aa48c355a7363de40e236d05665c5e1f641f32100e2b7",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00114",
      "definitionSha256": "f3a5d309ffa1e899f65b89f495d59e6c404e5ecf13bccad1d1fed7aef8024d73",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00115",
      "definitionSha256": "e3f6d1263c33812daebc3cdcf3be83b2c7feebdf6d70c8b3fe02e237da7ef327",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00116",
      "definitionSha256": "3de78180b8945c6f45fee7b9e204286b22cb4a4dd6812b58a7ec598077eb9928",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00117",
      "definitionSha256": "dc99445655e3b8388268b52d1ba75cf13a190ec7fc0578c9e711cfaec7304eac",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00118",
      "definitionSha256": "b4c9772d0190732e6a6ed6875961389c0ad1a5d0f834145909c3c7659d2b584c",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00119",
      "definitionSha256": "5a4cea10c1a2b20a7dc6a5ac50a9b60cb14e40a8e5255c19e77367f196e3825d",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00120",
      "definitionSha256": "6535944e108c4d866f763234f8a07df3bf8e287ec7fe815485b6d15789ba21fe",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00121",
      "definitionSha256": "2c8882c4d0dfe881c7a0f5984dc0bf9501dc6e1ebaa16c27db562608b79a0763",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00122",
      "definitionSha256": "dd9c0f71a33fcc905699d4f5fb11ea4bf4d134e734459d6ddcc12cae55174cde",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00123",
      "definitionSha256": "1c989eb0bddd9314d325305a447d889d18ce263bc65ca16def511a39a7abf268",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00124",
      "definitionSha256": "f1481096bc72c6144915f5dcba66ba38ee2d6a5cbae0d9e2f2f4b62b487a63b7",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00125",
      "definitionSha256": "279e4f01477b9c5123ceedfc094e2d174d7679fe12e1424a3f140e7bf7c25311",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00126",
      "definitionSha256": "45f05c53da9f45d7428025d5db173353de9d77f2143eb10c00452ec97e2d3431",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00127",
      "definitionSha256": "647bf817f7f55bee545205d24cc37a9bb3704b8469be4ea2db520505d908cdef",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00128",
      "definitionSha256": "3a8f40c51e2614c1a9d759feef9cacbbf4f14c0188def9b30eb172c525c1d565",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00129",
      "definitionSha256": "c8248482c818402ccc4765af49dadcc1fd0a99e027c296f88cb92ae15c692332",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00130",
      "definitionSha256": "b02f04159575c38b1f12e189f48e8bb9b074147eef8db7f55b17b865ba18b754",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00131",
      "definitionSha256": "142567a3bf7bb7cce485797b4ca5d2db20a15287d57780c56d574d510f4ce75b",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00132",
      "definitionSha256": "66b57a414cd8a8c4c384be8c7ec5fe927231c49b267feec157be4f8d75c49f28",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00133",
      "definitionSha256": "05d62f71db28789c2d3e6a2986a66cd5ebe1d9d65f8c5c8c359fc579849f11ec",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00134",
      "definitionSha256": "7c3b5a40243296c2e78ff64b07615866efc10510342122ca2d70f426649baaa5",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00135",
      "definitionSha256": "66879a1e63a4b21630bb6987d9d6bf03dcdc61dca2e05d8fab80ac97206e5d81",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00136",
      "definitionSha256": "b03283dca40a996df71ce81219f21ed4616d26e2d91611e45bbbdc5b49afaab0",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00137",
      "definitionSha256": "e4f9f60596dfd9094db8f2140654f549ee7aeefa54c7d828ef9ec6808a2f27ff",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00138",
      "definitionSha256": "c09cd94dc96b66f7acc878784da6f15af0155180c42ef3266fc5c7bd132decda",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00139",
      "definitionSha256": "6f7675f6a6e814727913918d3df9af79c7c845f94ba37f61cd00910d3fdd0739",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00140",
      "definitionSha256": "bfdb26cf1375cdbeb836c2862499c26dbdc6ef3c7a06412589d0e5d618be6ce6",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00141",
      "definitionSha256": "f4d578564123a6b63892c0022c2f7372f789a8fa4563740005de8c6ad246ed8d",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00142",
      "definitionSha256": "fa2542adca0823854529fe0d068d09e8bc3359a0085eeb4a09107451e9583751",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00143",
      "definitionSha256": "f1fd34c1547d952d2ab8d86aae81abf2446880cfef9f93ae8f8c22dfff9db31b",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00144",
      "definitionSha256": "accb0dc5933d25d7e3f1a75ad6f0a0cbb00cd3b1126de099b890c4ec8415d073",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00145",
      "definitionSha256": "c72d0260844accb0a8c56aa56abef1c20e8244794b07f913709ec45041bb4b9f",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00146",
      "definitionSha256": "5a52ed4434fb13f3a18e32445edae8cd9438adb49ef3bb095419bc4e31feb5fb",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00147",
      "definitionSha256": "d4c162ca45fdfaf6cdeb609a8b88acd94301b3868004a3a4c49807e6967befac",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00148",
      "definitionSha256": "ea118e90e2a2faac5940f7f7b0b343176fbff97e415b527e64f6cbc38f1ad8ee",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00149",
      "definitionSha256": "731578a5fbab9287ebdb3637cd558e690c9485b8662c13421fa89be16625b93f",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00150",
      "definitionSha256": "ac47fe6f0f84a48b8991473b7f49cdaeca00ed7a20fa6255b585dcab084341f7",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00151",
      "definitionSha256": "8271aab110b2e2857ae622c4384557b7eebf64b676b8f38ef98d28ff858c89b2",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00152",
      "definitionSha256": "120d9b125a1aee24ea7df90523561d8ba675b85978fa1d3e24d882205c1509f3",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00153",
      "definitionSha256": "80b8bd3ef959803f64f7a7c8c5666ef92bfada8df3ad1ab68a24608f585a74db",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00154",
      "definitionSha256": "752e965e74459811bcf812ec0eaffae8042c7ec83a6f84c8ff74c8544223011c",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00155",
      "definitionSha256": "d1d73827bf40c9201997cebc6d63b2de04f118d0131a692762b116f056ea4c2c",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00156",
      "definitionSha256": "9bf81b5d58e61e654428646e31858009de0cca1549f586569cb1a502fab5c97d",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00157",
      "definitionSha256": "b1a47729dfa32e634bfbfcda34234250a447315136dbd9cc156e4544629f84c2",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00158",
      "definitionSha256": "3a38b4f4c2a528dc871c01c48ef8e4b65a18e1f7ca9a8e17e9c43d04cb9a9ae0",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00159",
      "definitionSha256": "105a39e647b2d9354ba905b0658a7b759758fbf4471d09a468a7cd4bb5f5cccf",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00160",
      "definitionSha256": "527c150ee38c390860d57a723f277f8d6457178f22522acca2ff67191a1e5954",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00161",
      "definitionSha256": "3413fd2b2197e829b9d77d3b69844444bc1d92895d9a3ad9b9a554651991d386",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00162",
      "definitionSha256": "d2c2cf3519ad372d0b427e692c767804595a0df2c1678b5833661ca6a9e518c6",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00163",
      "definitionSha256": "a43098e546c4b448880d2db09d2cd7c24eb87ac206132a4bba9511e9aceed86f",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00164",
      "definitionSha256": "97abb668c867922f1b108fcdc3d2472ccb691727e56bf1a4272570661639bbcc",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00165",
      "definitionSha256": "64cfae96ae05659bafab616dc101e4427cd240eba3286f50c01352ccb87ea44a",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00166",
      "definitionSha256": "ff50ad08b142ee072571a8b401da480498fd83d1ee218161195c583677841a13",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00167",
      "definitionSha256": "d7ec80a3104652999678052437edce4c73784fb65f816a3361fa30e984111b21",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00168",
      "definitionSha256": "a0b58146e1f0a49090fdac87971d809efc67084e9c9e926c832ceb9ec3950edb",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00169",
      "definitionSha256": "8b9ec908299abd2421ee49fefbb5e5dbcfa118c3f505f7431d642c319ea7284e",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00170",
      "definitionSha256": "76dac031596531ec129fd544b9f1891c86e360810946533193ac36cbb2b7fb1c",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00171",
      "definitionSha256": "cbf37e6168a247aa1b656e4fa94051d1a4d916d94f0196f867330209aab1a75f",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00172",
      "definitionSha256": "2c39db1494b0eab6f66440967987cbe86860e66df02b49821406c42ce158b700",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00173",
      "definitionSha256": "5016303f65e79c852619ebdef922971080454cec1a2102076b5ac8ba85e40bf6",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00174",
      "definitionSha256": "eb463bedd616e2cb024d887b2037514451ee57bce4114e4561d69efe2e03bfc7",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00175",
      "definitionSha256": "aa6c42bddc71f7effb05f65761d369e382eefe83c0a9b9cf9ac3e6a9b8ccc2ca",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00176",
      "definitionSha256": "7f32a328b7e8b3891d46adf91c83a3e2fb1fb27dabca5a510fb2c411e750674a",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00177",
      "definitionSha256": "48732218c43a305c544bf8e9bf00af311deed2c5bb6e45d5c01ac8c2e3022fc6",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00178",
      "definitionSha256": "b327b6a1a6e773ce65130e012da4fadec044355454a48edccc88825ebfbd569b",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00179",
      "definitionSha256": "445f164ec98a97507b186693955b449820116eeacebdec51c19521cc8a952fdc",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00180",
      "definitionSha256": "5b557943313c139666d73cce5c8e5a0acd1b104ddbfe0a1e0353e8082fe63345",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00181",
      "definitionSha256": "038a9369c0fd0701daf0fedc6629e97f58dccddb06b11319ee7597c73b04186f",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00182",
      "definitionSha256": "d11b023486830e8fd9c5ead496d88cbb37833d9153fc5a3179539e6c0e475674",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00183",
      "definitionSha256": "859c97fcf873fd79521b4f1b177a8edf9428b800d7b9fe111b24854393c1973f",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00184",
      "definitionSha256": "332a837d0b87e7ae970309c8fdf824f4dc760d05501181bde3c5adfe037ae024",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00185",
      "definitionSha256": "c6afb4c0b539a2a8f7acc5f54caf09b5aaabb3dd21cb75f0545475aebc30d19a",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00186",
      "definitionSha256": "7e6cff546f7d035e63e1d8696ba1661353461c0de5c4e5f48f68470406cfe3b9",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00187",
      "definitionSha256": "6e6c1dd2caea526a73776630dee375a6368125b3b929a3246fc84358f9f86151",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00188",
      "definitionSha256": "03a2e2e3df25e818ee7c15f2a5aa7fa96e7fd88dbc51112c1e19a848c3553263",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00189",
      "definitionSha256": "dff7960d91d53c4850752f791d2ea22fd9754e6e6282ff3dfd63af5df4c5514c",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00190",
      "definitionSha256": "4f0734f26ddd2bc2c30f81b67a05602e5f8b25130bee973c78a5a252baee0c22",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00191",
      "definitionSha256": "dfcc8cfa6af48e6bae4c84ad3172315a4a23d2f9495f0429aa882f1bfd6cc8dd",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00192",
      "definitionSha256": "7e06e15bd530a87264f42309fd7a24d33937352862eba6bb7af1228ecf13a8bc",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00193",
      "definitionSha256": "519e46574eda0ad4e3ffa0a13ec551c118d1b16a0d7df17ed1a65e24ef5d38cc",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00194",
      "definitionSha256": "794ec53560ae5fbad08ffc7a20031df8b5b455f9b3fd4897eadb9efd959ab2b6",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00195",
      "definitionSha256": "33325228371c13c69f6a6a63d49c844ab9a76f5ac27ee9386ac24ee593cf06fd",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00196",
      "definitionSha256": "1baf5e3d41c794c090e7ec3de36962e41747f8b4fa7ba9af5723d85be3907770",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00197",
      "definitionSha256": "6b5a73d4f3cb8c7c8270d69924e71702816e1bbf92a67dd5bb133b0b7e42a190",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00198",
      "definitionSha256": "60968f8c0fc23c2decf8acb76bbe1ac21fa2a98c44737968211a583afd741a2a",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00199",
      "definitionSha256": "0e1aae4e6f1b90301ae120b41a2af38733acb2b6dabb2146bb39072ae87de9a1",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    },
    {
      "id": "LAN-00200",
      "definitionSha256": "73925bdef5e92ac6678495150bea5619d79489bd6659b5240720b3f72d07aff1",
      "sourceRevision": "e1588c4ebe94b1ef5f1557641334d95aee9b8290"
    }
  ]
}
```
