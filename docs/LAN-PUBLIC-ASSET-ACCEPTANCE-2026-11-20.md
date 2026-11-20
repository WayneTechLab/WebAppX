# Public asset inventory, portable export and proposal revalidation

Agent 0 accepted 15 original F011 requirements on November 20. An independent reviewer repeated the counterexamples that had kept these rows open. The integrated CLI also passed an independent seven-case replay and all 50 inventory tests.

| Original requirements | Observed result |
| --- | --- |
| LAN-01076–01080 | Asset inventory followed the effective Vite public directory when disabled, relocated or nested. Only eligible tracked assets appeared. |
| LAN-01086–01090 | Metadata export excluded private-shaped filenames and source bodies. Credential-shaped synthetic names were absent from command output and persisted metadata. |
| LAN-01091–01095 | Revalidation refused a previously selected asset after losing eligibility or changing its public URL, including when the file still existed. Read-only checks preserved the retained inventory bytes. |

An incompatible earlier v4 inventory requires a fresh complete scan. Remaining runtime and Firebase adapter findings were tracked separately at this revision.

| Evidence | SHA-256 |
| --- | --- |
| F011-fixed-decisions-a177c75.json | `eed833f4cb3a6491dac233686f9f2ad9a5be3ba9746f0f93ab48ed831be4cafa` |
| F011-fixed-metadata-a177c75.json | `96da74a7a1042b67973c4a64536c8c0d4faf767c74ad9a35c8db21e01ffe9be1` |
| F011-terminal-a177c75eb0.json | `07009baa160afaeda810004b50e0de533f65a4f5f5cb0238b708480097289460` |
| inventory-final-a177c75.tap | `440526cfbe258d01282cff2b098d1f8ee62e278bfb869ec476ce8c6819a95b02` |

```lan-completion-evidence
{"schemaVersion":1,"requirements":[{"id":"LAN-01076","definitionSha256":"4402213714da037b079f2355f9916c9a78dc743dd14251f21d345643e1a3797e","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01077","definitionSha256":"9eb8309cafab06a39b9765347fe30ecd187465f3b741d14519d515fe0238b951","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01078","definitionSha256":"0e0a769aa4fac4460e0b6ee18aca346d3203211496ead89def19fc2be90aa6ec","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01079","definitionSha256":"07d2c2ea3fe72c4fb2b1bc624682344d343bd9cc5522f80b0164d58fc69a1dcd","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01080","definitionSha256":"199ea94e9964d00fd1e7f46f1443c0f2132c853bc8ca2a66a855bbc93f566ece","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01086","definitionSha256":"1c42f56311dcb632eda9ba00054649a02ef51cb7069db1968d2879a2f736ec67","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01087","definitionSha256":"797b5c50a4898484c706aa53d37cda75c93de6def29e70402bf881f57032a7bf","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01088","definitionSha256":"310a0b2fe7934aedea1a4372c25ae18a236871f3caeaa77198fe152aa0c44187","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01089","definitionSha256":"06f372484b2206fe9b47c8f47e0e2c93f823c802339163b71b9196c2b57bec34","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01090","definitionSha256":"425cca24f04cd101237ac6e8f0fba00af563aba88118a4e67ed569e4ecf6b118","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01091","definitionSha256":"ab9853e1fe837efe5660d86c691d13b0ab0739a23717f823640273a6622fb515","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01092","definitionSha256":"fdd3be128a55e8f9cac632ee0b3338901b0030714353139c3587350dc17a042f","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01093","definitionSha256":"2603744ef43a1cbe00a4c37ba01304eff6392fec52afcfc290535b9ebb18c712","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01094","definitionSha256":"878cb229825f66aa066df48c29c72b37283275c96350f59c55fe88b63f18b940","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"},{"id":"LAN-01095","definitionSha256":"dd3ee779ec0d2cc8ea87dcbc3f11b1bf6e5fc10367e70472c95128790d286a72","sourceRevision":"a177c75eb0a36770ff2ef25d7aec3031db0ef283"}]}
```
