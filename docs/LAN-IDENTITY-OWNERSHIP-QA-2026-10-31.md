# LAN F003/F004 acceptance and dashboard QA — 2026-10-31

Agent 0 accepts exactly **LAN-00201–LAN-00400**, with F003 accepted before
dependent F004. The resulting program count is **400/10,000 requirements and
80/2,000 capabilities**; **9,600 requirements remain TODO**. These 200 original
requirements cover 40 capabilities and their behavior, boundary/refusal,
recovery, feedback and evidence lanes. Definitions and the prior 200 completion
objects remain exact. The separate original WebAppX catalog remains **179 done /
821 remaining**. The [Code-OSS fork backlog](backlog/LAN-VSCODE-FORK-TODO.md)
contains **32 planned, unchecked proposals**, with no custom editor built.

The functional candidate is **`aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0`**. Later documentation/progress
publication does not alter the tested runtime implementation. Read the
[operating guide](LAN-IDENTITY-OWNERSHIP.md),
[execution plan](LAN-IDENTITY-OWNERSHIP-PLAN-2026-10-30.md),
[dashboard UX research](LAN-DASHBOARD-UX-2026-10-31.md) and
[active iteration](LAN-ACTIVE-ITERATION.md).

## Terminal verification

| Gate | Result and scope |
| --- | --- |
| Full aggregate CI | All **73 required stages**, terminal exit 0. The prior 70 remain in order; identity unit/API, identity browser and responsive layout are additive. |
| Identity and ownership | **140 unit/API tests**, including exact revision/span authority, integrity/reopen, reconciliation and generated/external/opaque refusal. |
| Existing core and swarm | **114 core tests** and **32 local swarm tests** passed inside CI. |
| New served identity browser | **40/40 capabilities**, genuine owned-fixture import/reimport/ownership/export/reopen, refusals, recovery and an explicitly confirmed fixture source promotion. |
| Responsive browser | **25/25 groups** across 1440, 1163, 900, 768 and 390px operator widths. Keyboard reach, menus, native forms, compact pin/inert state, SPA navigation, stable selection and accurate Fit/fixed widths passed. |
| Existing source regression | **55 source-flow groups plus seven geometry checks**, terminal pass on this candidate. |
| Actual-stack Navigator | **16 groups**, terminal pass on this candidate using an isolated browser against the owned local Vite bridge. |
| Hosting preflight | Separate terminal exit 0; deployment, commit and push skipped. |
| Input preservation | CI, preflight and both separate regressions each preserve **2,111 tracked fingerprints**; the original **957 protected fingerprints** remain exact. |

Independent focused reviews cover identity/reconciliation, ownership/adapter,
ordinary service/integrity flows and the responsive/preview delta. The identity
and ownership cross-reviews passed 33 and 43 focused tests respectively. The
service review exercises four ordinary flows; it is not a repository-wide
security audit or a native Windows qualification. Review input hashes are bound
to this candidate; an author's own implementation is not independent approval.

## Implementation and browser qualification

F003 supplies qualified document/page/node identities, bounded authored/fallback
matching, duplicate groups, reviewed rename/replacement and aliases, orphan and
confidence diagnostics, map comparison and `identity-v1` export/reopen. Unknown
mapping versions refuse explicitly; no unimplemented migration is inferred.
F004 supplies explicit source/document/hybrid ownership, revision-bound semantic
spans, generated provenance and read-only boundaries, claims/conflicts,
instance/definition distinctions, operation impact, coverage and diagnostics.
A literal proposal stages into the existing controlled editor; a reviewed diff
and a separate `SAVE LOCAL CHANGE` remain necessary for a source save.

The actual project Home was loaded at revision
`cf753da247db7e2a66b667510ed211d879a39b77a6c122d672a97ee609a25aa6`.
The GUI preview/accept imported **20 nodes** with **15 mapped / five partial**,
exported 48,960 bytes of bounded metadata and reopened it at the checked source
revision. Home's source remained unchanged; the five partial nodes are not
advertised as writable. A runtime selection without an explicit qualified
mapping remains unmapped. The first deliberate metadata export creates an
ignored owner-private integrity key; it exports no private key or source body.
Accepted maps are in memory and can be reopened with the same workspace/backend
key and current eligible source. This is not a cross-repository permission grant.

The actual Components sidebar's client/scroll widths now match; the original
219px client had 617px of overflow. The header menu and trigger share the right
edge, the primary workspace header measures about 56px, descriptions are behind
Help/More info, and optional workspace metadata does not grow the canvas header.
Single click preserves panels and viewport; double-click explicitly edits.
Interact uses real app links/menus. About navigation, completed status refresh
and the Home picker retain fixed 393px geometry. At the final 1,164px operator
view, native panel resizing produced **777/777**, **765/765**, fixed **393/393**
and returned Fit **765/765** for actual/displayed widths. The compact footer
keeps common shortcuts and every preset remains available in its native picker.

The full Designer kernel, structural/style mutation, complete automatic DOM
binding, native IDE/fork installation, native Windows Git/ACL/process execution,
provider activation and production remain separate future gates. App **3.4.0**,
deployment count **0**, managed SYSTEMX **1.9.0-alpha.6**, immutable upstream
fingerprints, blank reusable records, research/checksums, kits and application
source stay preserved.

## Ten-worker execution and retained attempts

Agent 0 observed ten authenticated Codex CLI processes concurrently in distinct
owned branches/worktrees from the original baseline. All ten reached terminal
exit 0, followed by scoped integration and independent review. When child
sandbox Git metadata writes were refused, Agent 0 committed the returned scoped
work without weakening the sandbox; one worker's temporary-index deviation was
separately verified and recorded. The first provider-pin attempt correctly
refused all workers before execution after the launcher changed. These facts do
not qualify live PR approval/automatic merge, native IDE synchronization or
production. Private branch/process/review handoffs remain resumable.

All original development attempts are retained. Identity attempts exposed
namespace/allocation, export normalization, generated read-only and UI freshness
issues; layout attempts exposed sticky keyboard occlusion and the 393→391 border
width error. Harness selector/timing corrections are distinguished from product
fixes. Candidate C2's aggregate run was deliberately interrupted with exit 130
after 51 stages when the real GUI exposed a stale Fit width readout. It is not a
passing aggregate run. Candidate C3 then stopped in the legacy source-policy browser harness because its broad disclosure selector also matched nested Help summaries. A test-only direct-child selector repair retained every assertion; its isolated 20-group probe passed. Only this final candidate's terminal rerun is counted.

## Forty accepted capability ranges

| Exact range | Original capability | Evidence scope |
| --- | --- | --- |
| LAN-00201–LAN-00205 | Assign stable document identities | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00206–LAN-00210 | Assign stable page identities | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00211–LAN-00215 | Assign stable node identities | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00216–LAN-00220 | Reject duplicate node identifiers | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00221–LAN-00225 | Preserve identity across sibling reorder | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00226–LAN-00230 | Reconcile renamed source files | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00231–LAN-00235 | Distinguish replacement from modification | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00236–LAN-00240 | Resolve explicit authored identifiers | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00241–LAN-00245 | Bound fallback identity matching | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00246–LAN-00250 | Inspect identity provenance | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00251–LAN-00255 | Maintain identity aliases during migration | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00256–LAN-00260 | Reject cross-document identity confusion | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00261–LAN-00265 | Invalidate identities after workspace switches | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00266–LAN-00270 | Locate objects by durable reference | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00271–LAN-00275 | Report orphaned durable references | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00276–LAN-00280 | Compare identity maps before import | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00281–LAN-00285 | Version identity mapping rules | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00286–LAN-00290 | Preserve identities in document export | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00291–LAN-00295 | Test identity collision isolation | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00296–LAN-00300 | Explain identity confidence | Identity/reconciliation; exact unit/API and served browser evidence |
| LAN-00301–LAN-00305 | Label source-owned objects | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00306–LAN-00310 | Label document-owned artifacts | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00311–LAN-00315 | Label hybrid ownership boundaries | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00316–LAN-00320 | Expose unmapped preview elements | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00321–LAN-00325 | Inspect exact source spans | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00326–LAN-00330 | Show adapter write capabilities | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00331–LAN-00335 | Refuse ambiguous literal mappings | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00336–LAN-00340 | Detect mapping revision drift | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00341–LAN-00345 | Map shared shell elements | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00346–LAN-00350 | Map route-specific content | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00351–LAN-00355 | Inspect generated output provenance | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00356–LAN-00360 | Preview ownership changes | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00361–LAN-00365 | Detect conflicting owner claims | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00366–LAN-00370 | Separate instance and definition ownership | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00371–LAN-00375 | Track read-only source regions | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00376–LAN-00380 | Respect external component ownership | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00381–LAN-00385 | Compare mapping coverage | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00386–LAN-00390 | Explain operation impact ownership | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00391–LAN-00395 | Validate source maps after promotion | Ownership/adapter; exact unit/API and served browser evidence |
| LAN-00396–LAN-00400 | Export ownership diagnostics | Ownership/adapter; exact unit/API and served browser evidence |

## Artifact digests

Original logs, traces, input manifests, screenshots, failed attempts and review
reports are retained by the private handoff. No private host paths, tokens or
provider output are published here. GitHub source/wiki publication is qualified
separately by final remote readback; a local passing test is not a push.

| Artifact | SHA-256 |
| --- | --- |
| `full-ci.log` | `1590bd2f0bd3f0179275dc31f3e5589e2a3d87d30ce8ff43740731e949fea42f` |
| `hosting-preflight.log` | `c5963f3904125a0e8f26622604cc78b271627e2ddc1ee4d8164fda37f85ecbf9` |
| `identity/result.json` | `0e1f42f0885579a7c49bba538d380a928f5f966fc3fcc4f8c3a32ad552120ac8` |
| `layout/result.json` | `7751dc5a7a42a6abef6a71f19930f7cdf776ffee23eafe979e961e83c3d47853` |
| `source/result.json` | `b3f04ffd5541094253ea96e0c012f095b965a05504d54e1fdbce44814125ac0c` |
| `navigator/result.json` | `a6fde4e5035d0e71154813e9b205a9f1e4a1b57aa77cce8b08fde68b25908b59` |
| `identity/trace.zip` | `1cd40a403aa2f099691e4faf660dcd8a09b98f48f35cc91420dd2bec09ceae09` |
| `layout/input-manifest.json` | `1f9445ebd077795186fdec338f02351253d9da32d2aa55ae354e9e4d8f406428` |
| `source/manifest.json` | `f071523a18e1b17c09509a58888d6e36bc38d5307affc827baaabed5f1961dbe` |
| `navigator/trace.zip` | `591719d26f0301096e0e98d9550db6669cde44067fba0cd75a183a3abd73c91b` |
| `review/identity-crossreview.md` | `c12873e922fb8e2bf27af072a3f702771edaa3331254f56d713abbdfc1fdc321` |
| `review/ownership-adapter-crossreview.md` | `e1a67fb5e3d0ea34e451c4159a5f7c52dab0192a202eb70922cb7cd1c24947b4` |
| `review/service-functional-crossreview.md` | `6bd153d6979fb56afd82a158fc54c515b05d575a5a365c589bba13d36771f9b1` |
| `review/layout-functional-crossreview.md` | `03afff56c66f774ec5780f9653603b41bfcfa153a22515f6707ec6d8d57f7c50` |

## Exact completion bindings

```lan-completion-evidence
{
  "schemaVersion": 1,
  "requirements": [
    {
      "id": "LAN-00201",
      "definitionSha256": "24668c82054fa7ac7207e877736620cc152d32b36968383e21253d1d3cbd56de",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00202",
      "definitionSha256": "4406d30ee46c6be78052516e89176e4ed3b10d991d120c962c90de82c94d13bd",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00203",
      "definitionSha256": "64f771098d3095a1f9307f3f674b4e2b14d732dae8c52ad1e870dc63701d394a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00204",
      "definitionSha256": "fa6309e55c6969f83592e48f3b1d3aed44ea9582a520fd960aa6289d0ae061ac",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00205",
      "definitionSha256": "1e68d5ac055e9cbcec685b70994125f960990ece9bb538a0dba9061f7f20e232",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00206",
      "definitionSha256": "3aadbb928b9661706f3264898edd5432f76b47d9a42f358f089967647b31fb6b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00207",
      "definitionSha256": "1b7823cb151685dcad2bb82bdf14ba6152b7db20554b1519e51b838194eeed9d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00208",
      "definitionSha256": "bbaac2e062933e5fbd5968cc3d43bc60101ab914ea07382bca801986a0a7b134",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00209",
      "definitionSha256": "5fdb16554fde1dc8b92707375674fcf965a45471456c0a364f961bad9bfde51a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00210",
      "definitionSha256": "aa13a7c4f57ab9afb83fc90f7f9d449b06cd96e058465a099b1a62fd4f26a014",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00211",
      "definitionSha256": "23ca71e630e5da350796a34e85face1afcb6e6e43e116cdcb990030d0985ea68",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00212",
      "definitionSha256": "f292bb2400315704dfcfa17143b45d754f9b04e59158ae9f8fdb41995802e8da",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00213",
      "definitionSha256": "1eaf48030132f593c19ce671040ebb9cdca0ea60fcd01a5b2c48f7c5d2cb7ae0",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00214",
      "definitionSha256": "91709dc897ed65e0c2be5d8794796dd37351271c30441f6de988acec45f3cb56",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00215",
      "definitionSha256": "6109b990eecd57100b12bc9c457c37383386d7eca76f865fa950a72a7c77b18e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00216",
      "definitionSha256": "844262892cf5d05e4434ac2a1c46eeedc4209399b05468fba450d93030433b9b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00217",
      "definitionSha256": "09c72d2a7642696948525c660c56a433df9c401e53a413cbe45abca75929c445",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00218",
      "definitionSha256": "de4ff5f7eeb855abab308a77ee9a1c5890066ea7cb85861b7562580382cf58ca",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00219",
      "definitionSha256": "f56297f0f54e648ebe5b97bda810a9ecabd970bd1445c17d6cea85da5c6a4197",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00220",
      "definitionSha256": "18366917a5ff3b060bb0a13d64fd9d11980c1ed8946f4d3a6197a6e2940133db",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00221",
      "definitionSha256": "fee642991e629164be5ec995f9e8e881b4972b31e43029d6041d0b352119936a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00222",
      "definitionSha256": "99a2789c8aa5f419d3a95e3ae1be7f376c92267bfb09d371ddbe43f9f1c8555a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00223",
      "definitionSha256": "811354ed217181dc4fabb82abea7eefc26f8c3ff1afcb304975b6b0a0064875e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00224",
      "definitionSha256": "2bfcef4f09cd20a37af7727b41fadd54bd3f020c1c9a0a814eb8b20add78f937",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00225",
      "definitionSha256": "52f82abeb3b3ca114244b7822402b0ce6b17d663cd7be8e0cd19809c7f09dc88",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00226",
      "definitionSha256": "8ce2a1804de2306a1df13030f336e2b4af0f1ecb5829cf8f6f025f4f570eb446",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00227",
      "definitionSha256": "ad3b95234541c2acbce40557dd7369202b4ea333f09e790788e5cafddc86ddd7",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00228",
      "definitionSha256": "dc09f433295307b603e8daf3a7b5516d37cb25224aca12f4ac763b0be2baba25",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00229",
      "definitionSha256": "5a4295be644cd265ae13a36007ba3f5c86d13e74d611ff57691cec5c8a1de2c6",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00230",
      "definitionSha256": "3407d42ce922e709a9c672ee6551dd87946e899d6e237c6af00d11b1eb26fbaa",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00231",
      "definitionSha256": "00e8964da35f0d91fdaeaa17af4bffb89c518cbbd5b3ed62bed7d66f95b352cc",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00232",
      "definitionSha256": "f029baf43eda72232dd333e1dd24d4fd106cb993d66ba342bf98bbc711c735da",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00233",
      "definitionSha256": "a0d69e9c47621458dbc262c2006f5917babbfa64a0f16855184047bcfca8b89b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00234",
      "definitionSha256": "a0bbdd902cbf457de47ddbacdfec5d0ee32e5de50c372e2b4739089b7f33e752",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00235",
      "definitionSha256": "5fbd3b82eb804f7146784af2a0f4b47b1547df87031f1d6e0c89b7f0b37970ad",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00236",
      "definitionSha256": "cd117342aff623744ef2d49977b8e84068825eba11d251c0c80a182c2d75b151",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00237",
      "definitionSha256": "4cecb8a847bf36d3c63db930765900615a2a81e86b8effbed0c1437339b2529f",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00238",
      "definitionSha256": "86fbd4a19ad266d7f9e6bb9fe31df3f6db5f640140b8a6fc3f742c9a4a7f8244",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00239",
      "definitionSha256": "6086d2ef8c6c28f9d40421c58f53c0cb87e6a522c0759bb3f0e824cfa3bc04f6",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00240",
      "definitionSha256": "039031bf2966d19f5588acf0c6f2abbe596d45c95ec4fbc37617d18075c14733",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00241",
      "definitionSha256": "0719bbc65f3d3f6c7c8b57db27ae2bff1d94355834150f5879279ad984eadb78",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00242",
      "definitionSha256": "575da2edfaf408755bc56855a58a309e35d44356eb24068cde9cad0f7486565c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00243",
      "definitionSha256": "7502dd6b3dfb2ed4717040fd6176a13ce7027337ba70c5ea64f9b29f556b9d9d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00244",
      "definitionSha256": "3ff1f501fa0db22aad5f967afc2d1f4b48df3e9e85d01bf0d37877a4626edf2e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00245",
      "definitionSha256": "5caeaf58c60d188038e31ffa6cce502eb7ecdea67c06f639d0f67a4aaa0a3f88",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00246",
      "definitionSha256": "38288b956b592a71d53a7824928324336ba5e264c19d4b1064757fc709cd8734",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00247",
      "definitionSha256": "0d40d191d61995510c1a12d2825a2befe9d71418b8458cc7c543be36458d0d7b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00248",
      "definitionSha256": "c44cad6d5ebfdbe3fdafb656eb99dbbf2125348a60ddb91ce2a4e47dc1b078d3",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00249",
      "definitionSha256": "140853fab2852da7fcf218573f8277c991d1d5dfbd9e37b86d25c536d24b8413",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00250",
      "definitionSha256": "93a4c7da048d66870fb1593cbadc7779ef4c5884cff52a7e68780091798911d6",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00251",
      "definitionSha256": "fbd03c5263b5a39e4d29f66dccf845fd224aea6f9231eea2b207c6fd1d29be9b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00252",
      "definitionSha256": "a702043c48ebf0f43941b68fbf7209fe20252c293ed3f8158aa9a9d9ea7e8372",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00253",
      "definitionSha256": "7aded88043b9e5acbc7d861b26c42ef48488e06444e42170be35ed7d2630127b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00254",
      "definitionSha256": "7dc61c0a656cb990524f44688e5442d6ab5770a85a6fd886cbb349dd0369d9d5",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00255",
      "definitionSha256": "aeda4213696c8e41029e8438e829bba338f664da676c5906b89e33618cc93253",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00256",
      "definitionSha256": "c213c54f818d2520da5a88dfee109d14eb7d44347819e61fe3ddeb382f97d7ec",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00257",
      "definitionSha256": "6c8a0147b9aa0ce3ecfcb88831cbc42ad427ba864163c5928198aede4e61d84e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00258",
      "definitionSha256": "a2715e689823751531acfe7a0826d070eaa255c72b6dc8e4f0f123d319ccfcce",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00259",
      "definitionSha256": "75aabd5a17cbf28f1f10c98ac963eeb7387ee18f9caee344adc79b05d76faeaf",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00260",
      "definitionSha256": "8742cf790ac0ddb58e89b951d6829f496bdb000585a340c886e7aeb66394b32d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00261",
      "definitionSha256": "a53bd8a8fba176a747485e8f0a59ee6140263fde13c7a46a73fb948987fb3db9",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00262",
      "definitionSha256": "7ae0ffd05ed6d18daeccc94e5da38b1ca6715b3921ff90c5d461d5614819e743",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00263",
      "definitionSha256": "56077e3bfeb29078636a1db7ed5ca6730cac92c2268f4fdaf9816686f4a2267a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00264",
      "definitionSha256": "67e60ad5289432ed0fb2fe8ea6d45ca7e6d3ad5edcc242c617ea6903b9c7e5fc",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00265",
      "definitionSha256": "eb6cbd5efa7c1c6887c2aa4a5749cea50e4b83ea23e444c35406f977427ef986",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00266",
      "definitionSha256": "0ff60feb09e5ed7dc4400d94810c9d3d94da22813246d27e12bd4d6808e27c99",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00267",
      "definitionSha256": "20c6e45bdd7a62f3ffd36834febccaac97b3d15796260439c5cc3d5796d4cd50",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00268",
      "definitionSha256": "dbf85d3068795f016a0871d4897204c2f600c0507ecfc744451bfc85efa66c5e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00269",
      "definitionSha256": "cf177f4b26399817b668b2274fdfe83875a9d1acc8a2e8c5da3c011e82f6354a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00270",
      "definitionSha256": "ac6eb2c4cf2382917886790634196bd79aa0d44e1932848ac9594c160bb3b52e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00271",
      "definitionSha256": "6217b0a724458e5317333271d3ad33bcf33ac9796d73a22507dc77576d98e58d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00272",
      "definitionSha256": "e6c3a09f4de5783c07f1a629dca45e57553f7ad297aa029eabc95d6e9d890809",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00273",
      "definitionSha256": "3329b36d0fbb29eb8b31c2d92a2b0621bf3bdc065395d8a84c6f5bbf96fbeba3",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00274",
      "definitionSha256": "d69ca640a223256821ce2511c30936142347afc29c46bc4232351978fe20bd8b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00275",
      "definitionSha256": "23fbf3ae3d578bb59499ebf1629d72d1b4ac5561dd52a94b480cc143a2542cf4",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00276",
      "definitionSha256": "99da680096e0c686508878e05c35f946789835b1960e0968ba0737bc1ba78c4d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00277",
      "definitionSha256": "20c1ccb1f47d90cad08857dbf887158920a1abcaebb82e753b9ba56c9d66c774",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00278",
      "definitionSha256": "2f9448b5b229d20b5c641067775b6fe1a55d67446e831d43461d8ec5cadaf3aa",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00279",
      "definitionSha256": "6253f83cf0589160750cfd940e1b2089bb54170ebea1a1eaeb950daa0b61c47c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00280",
      "definitionSha256": "70d603cbaf0653f8e4b358a850b13947fa290dcfa515eefbaee210e87d4168cb",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00281",
      "definitionSha256": "da1565c228eac452869ec1be3ac53873608ca466438e3399fb4a0f6781d76d3a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00282",
      "definitionSha256": "b1f65d8a7190c32d7fce005d2272970ec01bda490a20feffb71b3ed26f45651d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00283",
      "definitionSha256": "0d8fa17380cff05584db63569529f8755087fba6a71f729d43569a04a86543c6",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00284",
      "definitionSha256": "06fe8c2762eafc726a2f78f2a66ee2ae990fa31fae7c382a403eca6e9763c0be",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00285",
      "definitionSha256": "dcd120c5310d15b26a5a319e6955dc36cd3587a41bf471b6d90c5e4eb58b6698",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00286",
      "definitionSha256": "0bd61cd7020cd47cf68a2a673638da5e8392264fbd211a9485b8bf952cb1b6f4",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00287",
      "definitionSha256": "8900793944b0fb585447f740ff9e0843455c0e9d2727f4e295cc6ffb43e65e7a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00288",
      "definitionSha256": "7b575d47feef722ee4ab9659134e8bd93ca6844dff3cef855939d500b05c5470",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00289",
      "definitionSha256": "420533b7842d9dfa32f7d3146c12e50178e7e53208ebf39067da0859c5da9805",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00290",
      "definitionSha256": "957243bb52bd2197fb6481af90dd003e083980da33d15b18a6c4ab03d5449dbb",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00291",
      "definitionSha256": "3d7ddde4070fb0bae105d8ce8d180ca2b9c1fcc8d9a4ae664de5619ad56e8849",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00292",
      "definitionSha256": "b397b8a0a7f93c3e4a5d225a7b92510f617c15ab35b84e9f85e536ef7c4c052b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00293",
      "definitionSha256": "0c1b91604cc5f75d178d04d7c84a24512f20fa8cb85bfcdaead505f3b55c5880",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00294",
      "definitionSha256": "4b36fdce52ad9c273d28f38dbd0fb8e7d79b8385c0fef1341c0e77e368296f4b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00295",
      "definitionSha256": "1e8fb2956ab4ed80c244060aad70e3215524d376cc055a7455389d895a1b2eeb",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00296",
      "definitionSha256": "2283ef800444f565a575fc92af6dfba940909accc14443e4a0d40c68afe3122e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00297",
      "definitionSha256": "3e8a097a3b19f355f8ca3700d6f53b8c165459aaee93a26b732f5bc99578f546",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00298",
      "definitionSha256": "9f5791ba7d961268f9ef01a8f33133c32a763c6f63b17cb01507d5bec0b99d5f",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00299",
      "definitionSha256": "035ae87b9593f7566e7ffe34f35d27fbf0977f2c2afc07cd4b5c848c3355c252",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00300",
      "definitionSha256": "0313f759010ecbaf4e5e03c82a4f7c5cc0bdb8d9a5752e04b9dc971506955137",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00301",
      "definitionSha256": "a3e7a4d56bba2298c04d6bf155bc152969d0ad9b90a4e4c6861f959f3adf06a2",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00302",
      "definitionSha256": "e22dd7aa223c2a94b1ffef1f1345dc90d4c219173a5736b888097f9373941f30",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00303",
      "definitionSha256": "a692d4d7befafec445b8dce56c5cfb7bbf01aae3f94bde90569b038499600ef7",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00304",
      "definitionSha256": "791b08574998b20cb0490005711afa9b49eb541c01f17017474c105b12baff5f",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00305",
      "definitionSha256": "065fb6eba22751ef2a11dc6a80b8fafbd8fbf9430d1d8ccacf6041fc653c4c17",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00306",
      "definitionSha256": "bab76ff982e370627c31d03d46f288f344b53164ba8dc7b633a587f13a37b35e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00307",
      "definitionSha256": "c78b7e82cedd2031a14c2015d74bb426c538cbcc016fb11fc7d5c6a155edbb12",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00308",
      "definitionSha256": "3238238384102d9fc4ce9b726a94c6c193ba12d51248a9be813c3e924e878da0",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00309",
      "definitionSha256": "e71653c92151549ff1938941eac62aaf408ce80093d5e5805e6853f83459853f",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00310",
      "definitionSha256": "4df61d8318c91189726cdf5f440c6c9933a6dad21865cc9c727438a1109e78f7",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00311",
      "definitionSha256": "511709390d45aa8ca680fe061b0d62ccf174fd6376bea88b6ae096a69d0b94eb",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00312",
      "definitionSha256": "310f0e92cfb4874682e29b21d3268927e360ffee7368e1039c33940b39d38b86",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00313",
      "definitionSha256": "7d7166c1da113f7d473d73c3e46dbf65e953ef99a2996546673ac41d3a928bce",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00314",
      "definitionSha256": "13cee63fecf7d92aab029dc903086f0761548a135fcc4f4314cf011cfbc6942b",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00315",
      "definitionSha256": "d06c308dbbe1aa3c22e6ad095307954a1b66710bbbe937a2bc413750d234d077",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00316",
      "definitionSha256": "1da4a775ad2919b34f30bbc91f3ec41e4f4c483ec429bbd5196151c412b322a7",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00317",
      "definitionSha256": "526da8a1a85ead71828129f8a67d7f21b00981010c3ba9b2951861108f735d74",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00318",
      "definitionSha256": "112ea39cbca0aaa62e98ba55a9bcea06a78dd77067dd92da534d70f0b550d38c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00319",
      "definitionSha256": "079542f51f377abf244c3c0c3042bdc97bc872fbcc583b08881a7dbdc2babab7",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00320",
      "definitionSha256": "3b601a525fdd23d61fd0106798a4057a191676dafdfb60dae33d2d25e7d75d4c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00321",
      "definitionSha256": "7194da9f0a95140c95db005698fcac7da25c69ffdb3671414460f0c74a12c44d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00322",
      "definitionSha256": "f43256249baa32c3ff058ca6b33e8c5b7713a5c285593eb1ccf3b2a240a050be",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00323",
      "definitionSha256": "9b09fe16c057d9c13eeefe8998eaa35625f4e38210e9c4f58fd8060c3f7d1b96",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00324",
      "definitionSha256": "51c6823b1915b761bc5a2e53d6588fc6902b21350f4989bb3731b732ac18e1e5",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00325",
      "definitionSha256": "6c1e88c1a811a8038aebe5dead221a6ff368285aced38ed5ee4648e573f8899a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00326",
      "definitionSha256": "bb8e05dc9eba74cddbf9f83dafb9acc11b312fe8f4ad3a2053013f4eefbb70ec",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00327",
      "definitionSha256": "52cf5b36b6575fc35f19ff69e19ea299156a085cac9d19c9502fd45dd84f6ac0",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00328",
      "definitionSha256": "909f317edd931fc86cbae08122017374eeacbd9d6dec69d05fe9bc5c6ca3d435",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00329",
      "definitionSha256": "038ae30e2444a63968d9d423e996daed80849d225b8f1fc63b9804df7117e00f",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00330",
      "definitionSha256": "d64fe541aad188278cd1d82a1fa8f5eaf5bef023164d8ed1f53b1b39a1268944",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00331",
      "definitionSha256": "4aacf1e9daf41070caeef80ba801b1c8e797d2ab11a620204863435db2a6bb14",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00332",
      "definitionSha256": "1015012aee0160b43f6145fa713de840b4548028ae248d45bbb36d1ef428567a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00333",
      "definitionSha256": "919959719f95b8d82b75903f8c0f2ff2df5100a5a84b5c6eb73572ca13f24cc4",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00334",
      "definitionSha256": "e80b09696ea18abe172154d179fa2436d2c43e04190a5a3649899b7781d00846",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00335",
      "definitionSha256": "a36aa2fb1a26c7c40c007c79a5a929a117e0c11beb09633749ecff64d27b61b5",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00336",
      "definitionSha256": "b17a4187b2f5081df9a18fab3f4d180692832b69401b86505416294b57e735b6",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00337",
      "definitionSha256": "529313014ab59589c5ef3e48b4b5161ef6d832c0df404c42dd48761b84281a01",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00338",
      "definitionSha256": "5afab2547c1df15e2467c9828dbdcf78d33bf550366517bd888f1888568ac375",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00339",
      "definitionSha256": "a16369e6d78fe2fe68d2d4e29c8186bf88b4481c22c87d2aefc55efc71a6df16",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00340",
      "definitionSha256": "87bd8a16e510de3fd118b388233d0e8b8c7ba14c799cdeaa7322c76f60daca49",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00341",
      "definitionSha256": "aa6a8b00792659e03dc698d42011b8102de408fb81b33f132769678ddbfe770c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00342",
      "definitionSha256": "f67f87d50ef8195e9aa53f29a97b9bda77512e57254ea7aceab2fed5785dcb9f",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00343",
      "definitionSha256": "e579e0a225720792b1837c6dfc1a487c01b6e23a90257db2bb079a5a1d7fc11a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00344",
      "definitionSha256": "3a35e5ab903e7c606b89f9da41e424539a2abed616ce9c1c3d36e3bf69762619",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00345",
      "definitionSha256": "39a85d155dfabb04e51adf7686a8c45a1c9daf15dc696c1e1b3b2797210057b8",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00346",
      "definitionSha256": "0797a200a7859203d131db3ffb8a9ced440ac2365228a090e68b634703e974ad",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00347",
      "definitionSha256": "e6997f1fd85996000b5091c073daa27d44b99779e978c382f127269c45c0c0a3",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00348",
      "definitionSha256": "1e77d8696cf99c0c291ab034da80a18aef050bf09066bc2a6c544cccd7aa769c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00349",
      "definitionSha256": "cf73899aac6390bd0a8bf04914d3c4f7de91b7b9312334b89116a9d2c23a6551",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00350",
      "definitionSha256": "fe8c2a6363fdf97f15cdf737ee0bb373cc3cbac5bf2ca529563447981dd8d101",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00351",
      "definitionSha256": "09c85e981fa3f54a7a6eca66b0eaa1ee43d19611a4bb954fd12987484c3208df",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00352",
      "definitionSha256": "60d66b66724fa183696f12fc8d7759e1e94cb8e3477bcf2f378d90bac9714f71",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00353",
      "definitionSha256": "a08aced33af0ab8d8632f89a831d92f5f766d59c7cd13a850b8846f433dc9ee8",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00354",
      "definitionSha256": "48e875945289b1433416632d02cc14c2115ab5a8a4ca67e67d00b06cbcb93c6c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00355",
      "definitionSha256": "5f648c0a2f89a7d6aafdeeb9b9da97de548d50adbb04311edbccfeb6d0ce6749",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00356",
      "definitionSha256": "483deda13be3b8df669ac1e15bd64e5ce4473b3e3a835e0cb819ab1916df635a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00357",
      "definitionSha256": "527e85b430acd019641b1530b1d759d5ec8c74d8170b9ed58c3bffb1a6f6e320",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00358",
      "definitionSha256": "41e7dd27b64aa4287df88afa351501b337d0a13aaffbdc47e14b118ac8d06400",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00359",
      "definitionSha256": "8dd0a771747a6f88fd849ef92fcf2128b6c2b3bc7b9e0851c8099ed9e65e35f4",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00360",
      "definitionSha256": "0da6b2c5515c27f72cfda4c3ab0ce82b1ed0f2072befe3573be42702ca8672f9",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00361",
      "definitionSha256": "4b959fbf75267bcd7faf9a296eef2dd5d5eceba00c220b4fa99586604ce8e147",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00362",
      "definitionSha256": "77296ee1953ffecc195a9d176ea2fa6c85bc56d4670e604841b993bae0eb4cca",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00363",
      "definitionSha256": "aca58679bc92ad92e5c175300e4bd7b69d80c239740c3974e9d1bfc857eb2a01",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00364",
      "definitionSha256": "24bbc719c4a64299303dfb43be4c0ea4f0361a4f245d8455fe8d0282aeb89cbf",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00365",
      "definitionSha256": "e7d366aa1eb18e4e3f9145bc35c05a95b6aa33b2a87f13b920100a7a6b2fe488",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00366",
      "definitionSha256": "8a85ba37281a77a8e6f1c66906e524820622bee7552a7c113436d775b949f606",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00367",
      "definitionSha256": "db7090827f36b43960b7daf6db1f496b1726a5ae61f74bba832bb813c1228643",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00368",
      "definitionSha256": "fa315f97e831c39c2cfcad429fc1eb4739e3cc2fc4f7a6817193022e9995ef6d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00369",
      "definitionSha256": "b308a1bb2a1701cb72e2e33bb289d9eacf7649519733d1ace9f9e36670c75c0a",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00370",
      "definitionSha256": "70752c852bf6db28bb3dc75828468579c4c3dee8a8be87d1b30f9efc995420e3",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00371",
      "definitionSha256": "921c442a9b85a76e38d5258f64d59051c4ad4ef563f7f535647279a026c8dad2",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00372",
      "definitionSha256": "34decc45ea725d51a16d215988e9c4bcd4fa6e692a3a272bd5d5e420298610b6",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00373",
      "definitionSha256": "105ed47de3ea982a8e318e124ce9df60df40a347ca00ae551c8a13ad18b21170",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00374",
      "definitionSha256": "d5433f5c9c8fd7c38353258ccaee7c7a2e968e8070e405a823e6725fafcf8607",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00375",
      "definitionSha256": "e44ad51979c96ae8da78d1580435ae41c780c7ee390c8080ff38d25e722dbf39",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00376",
      "definitionSha256": "dee0d584185e5ad6b5bda608fa6aeb2651f6bbb163d62860df0453b4d45c8078",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00377",
      "definitionSha256": "55491d413421c526a33bb84d3231f7c2bc5b5763f11f1ad53af3e473e8348a65",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00378",
      "definitionSha256": "edf77065a5355665d44cbf4c24d5adbb5f93924dadb322de8670016cef9b283c",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00379",
      "definitionSha256": "d83e7509297b3bb2b60596a11c4c4a05318484928c75650ddc4aeded5ab79e0e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00380",
      "definitionSha256": "fa10a010d959670774c2e51f78b8c32559b6c65f900c3cf175b2fd36ae75d044",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00381",
      "definitionSha256": "fc6d8f81ce53a1539d9e6227c388fcaa8ad8b3610cdb5bba3423201178dc2b5f",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00382",
      "definitionSha256": "9ca153e8eb1cea804ce6a5a2b48b3f4710d2498797b168c67a40a2aa095c4b14",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00383",
      "definitionSha256": "eea4b8ae9f179fa482b3e068976507b7aa473bffd708ba10e534027ebd307f43",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00384",
      "definitionSha256": "d0e98f8aeeef1cc45c3c6e1244f23523d4efa9403d0a7d7aedf681417009af58",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00385",
      "definitionSha256": "41728e6d993eb8adc1304f01a28344179b7d607c28dccb3ebe71a59869c81cf9",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00386",
      "definitionSha256": "fadecdf16ed4cd6c51044f7b580732784d6875b8292235e5eb635f60603974e1",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00387",
      "definitionSha256": "2a40f025ee2939afb08d3ef3eb9d7f43a790e87790e8c05c08ec01fc8feb46b5",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00388",
      "definitionSha256": "175604d54e3497d6d6394e70d86cbe60c2123831f6e519625c5c2f9831b6d4c2",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00389",
      "definitionSha256": "50ae92babef5552a37598ca4e1873fa4e27ee2586f647a114aced34641f62213",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00390",
      "definitionSha256": "3707f6d3b13db2f6898ad4fbc951826638789a27b9b20198a490fa5ad14c0c12",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00391",
      "definitionSha256": "fb1b77648ee5e2825e5e55db9ab1508ca454f322e264fad867571d6fd1cf79ce",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00392",
      "definitionSha256": "d7eb19b212d3059c253004d837ae8c351a677b23b26041ed8633c636e08c0de5",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00393",
      "definitionSha256": "ecbec76f8ab7b0ad1ba8418fc433c3b49f805734f969d03af40d7e0e4565ce94",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00394",
      "definitionSha256": "3bdf4c290b03c6ec2c8419a73135e0ca843cc5277c3f30c69fe0b83f06c0b49d",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00395",
      "definitionSha256": "be19beb04d296023d9d8790ddea422ab038f3dc7dd628202447659d91db27b01",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00396",
      "definitionSha256": "b053bfedfe48fb712c75fc87bda9b16b412446186ef8a43351f0f3be1292e576",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00397",
      "definitionSha256": "c1500906ff369878cce9ccaf2c46dd0d55f32029c8e9e9b9ff2016ac618c662e",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00398",
      "definitionSha256": "50f4dfea7bf285947f6881a4a4fab4e4fa73816650e7ba520fac408534bd3142",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00399",
      "definitionSha256": "9ffa58521dc062ae6e68dfc929d2d20a910adaa8cf6fa0746ad937aa950817ce",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    },
    {
      "id": "LAN-00400",
      "definitionSha256": "127753a71ddeb8637c26af7dfe540860685270cf5d583a4e9c8cfb305b557d13",
      "sourceRevision": "aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0"
    }
  ]
}
```
