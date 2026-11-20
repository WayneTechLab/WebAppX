# LAN canonical graph and versioned API acceptance

Agent 0 accepted F005 (LAN-00401–LAN-00500) and then F006 (LAN-00501–LAN-00600) on November 19, 2026. The catalog validated at 500 requirements and 100 capabilities after F005, then at **600 requirements and 120 capabilities** after F006. It retains all 400 previous completion records and the original 200 definitions and dependencies. The per-family receipts link each original definition to the tested Git revision and identify the evidence for each group of five requirements.

- [F005 canonical graph acceptance](LAN-F005-ACCEPTANCE-2026-11-19.md)
- [F006 versioned API acceptance](LAN-F006-ACCEPTANCE-2026-11-19.md)

## What changed during review

The November 8 graph implementation could detect an ancestry cycle, but its error formatter discarded the path before it reached the dashboard. The same formatter obscured some graph limits and unsupported migration fields. The revised formatter preserves bounded details produced by the graph validators and redacts sensitive field names. It reports the failing endpoint and reason when a handler returns malformed data. Passing 70 unknown request fields produces 50 displayed findings and 20 omissions. The browser assertions now read these details from the displayed error panel. A run against the earlier formatter reproduced the missing-root diagnostic failure.

## Verification

| Check | Result |
| --- | --- |
| Tested implementation | `571c3301852dda7f5f2c22ad6c24ce296bd0b461` |
| Full CI | All 75 stages passed with 2,145 tracked inputs preserved. |
| Graph and API tests | 150 tests passed. Service and HTTP tests exercised all nine operations in API 1.0 and all sixteen in 1.1. |
| Graph and API browser | 40 capability groups and the dashboard journey passed. The preview retained its 700 px width. The run reported zero page errors and zero unexpected requests. |
| Source editing regression | 55 workflow checks and seven layout checks passed. The browser recorded zero page errors or unexpected requests. |
| Hosting preflight | Passed with production deployment skipped. |
| Original release and template data | All 957 protected files matched their saved fingerprints. |

## Home in the operator’s LAN session

Chrome loaded the real template Home page in the local LAN builder. The Source inspector restored the saved identity, previewed and accepted a graph with 21 nodes, downloaded its 17,693-byte JSON export and reopened the same revision. One node was opaque and four optional component references produced warnings. The export matched the previous download byte for byte. The Home source checksum before and after the session was `cf753da247db7e2a66b667510ed211d879a39b77a6c122d672a97ee609a25aa6`.

Previewing schema version 2 displayed the supported version and a recovery action. The inspector retained the previous accepted graph. In the same local session, all 16 Navigator checks passed across 895 requests with zero page errors or refused requests. All 713 protected Navigator inputs matched their original bytes.

To repeat the workflow, open the Home source in the LAN builder and accept its source identity. In **Build → Code → Graph and API contracts**, choose **Use current identity document ID** and **Preview graph import**. Review the findings, type **ACCEPT GRAPH**, and accept the revision. Export it, reopen the downloaded JSON and compare the displayed revisions. The [graph guide](LAN-CANONICAL-GRAPH.md) describes each control.

The API and graph serve the local LAN inspector. The graph export contains document metadata. A Home source edit continues to require the existing review, confirmation and save controls. Native platform and production qualifications have separate plans.

The SHA-256 digest of the graph browser report is `551901acd571140a25740d88934c1ed4a7b6bddc13dab80dbb34b42fe3cbcf5f`. The complete CI log digest is `5694e5652b28c899526437e960ae8dd24c4a939b7fed54c63be6046990789e12` and the Hosting preflight log digest is `f0d2ce9546cab2a8326f0e00440d0a207b07fc4e283f7e8ea09634ba1e33524c`.
