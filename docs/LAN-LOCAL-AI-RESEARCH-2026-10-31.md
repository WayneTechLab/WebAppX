# WebAppX local scratch AI research and adoption plan

Updated 2026-10-31. **WebAppX Scratch AI Pilot** is a separate local research
checkpoint trained from random weights and a newly trained tokenizer using
selected WebAppX source and documentation. Its model is below the requested
160 MB limit and its isolated desktop offline pipeline works. Answer quality is
not accepted: the disclosed exploratory check produced **2/10 exact matches**
and several answers confused unrelated facts. It is not the production help
assistant.

This research does not complete requirements in the
[F005/F006 LAN wave](LAN-GRAPH-API-PLAN-2026-10-31.md), change either fixed
backlog or install a model into the template. The existing bottom-left help
widget remains the intended future entry point.

## Requested app behavior

Opening help should offer immediate, clearly labeled preloaded help. A separate
explicit installation action should name the AI model and disclose measured
model, tokenizer and runtime download sizes. Opening the widget must not start
an unsolicited model download. Sign-in gates initial installation and updates;
installed offline use needs an explicit policy for the period without server
contact.

Inference must remain on the device with no cloud AI fallback. Prompts, replies,
context and summaries must stay session-private, without telemetry capture,
background replay or automatic conversation synchronization. Generic installed
model assets may persist separately from private session content. Constrained
devices retain preloaded help when they cannot run a qualified backend.

The user selected own scratch weights and a new tokenizer, using selected
WebAppX code and documentation only. No pretrained weights, pretrained tokenizer,
external corpus or downloaded teacher was used in this pilot. Software
dependencies are recorded separately from model provenance.

## Preserved pilot evidence

| Measure | Observed value |
| --- | --- |
| Source revision | `9efde6cba4622fa98e3537dc21c89ff7c4173aeb` |
| Selected source files | 165 Git blobs |
| Data split | 441,991 training tokens; 9,541 validation tokens; 46,629 reserved test tokens |
| Architecture | 4,394,880 parameters; eight decoder blocks; width 192; six attention heads |
| Tokenizer | New 4,096-token byte-level BPE; 266,968 bytes |
| Training | 600 initial updates, 1,800 continued updates, 1,000 chat-supervised updates |
| Qualified export context | 128 tokens; bounded recomputation decoder without a KV cache |
| ONNX FP32 model | 20,845,156 bytes |
| Complete staged prototype | 36,178,912 file bytes |
| Model bundle archive | 19,277,852 bytes |
| Exploratory answer quality | 2/10 exact matches; independent quality acceptance false |

Model SHA-256:
`9b5a75fa7c1f78bc39a2e51c6786d7b714bb843b2a2beab21898cdaa04155928`.
Tokenizer SHA-256:
`6f462b40f7f611cee011889ecf0cfbd4cfe6b7f29320ffb3865f15f8471af6b4`.
Data-manifest SHA-256:
`5df982adc681376863173b22ce5e72e1e7e1c3e5e92bc3ebea741beaf9a6b093`.
Quality-report SHA-256:
`507c46bbf6094ecd324bc5409d12b69f7d6ae4416abaf67556bb9589a3ebd94e`.
Experiment-receipt SHA-256:
`f957ef6a39bafb69195a34bffb147cb658f1b5b3ddfef58782e33dc40856add0`.

Eleven pipeline checks passed, including split/resumed training state equivalence
and ONNX numerical parity. Ten browser groups passed independently in isolated
Chromium and installed Chrome using CPU/WASM. The checks covered preloaded help,
model loading, tokenizer/logit parity, local generation without HTTP requests,+cached offline cold reload, session clearing, model deletion and absence of
external-origin requests/page errors. Those results belong to the separate
prototype, not the actual WebAppX widget.

The chat annotations contain twenty source-derived training examples and ten
validation phrasings of the same facts. Validation loss was observed during
training. This is not a blind or unseen-knowledge benchmark. The two successful
demo answers do not replace the weak full quality result. Pretraining and chat
losses measure different tasks and must not be compared as one score.

## Adoption checklist outside LAN acceptance

- [ ] Review annotations, source inventory, dependency licensing, checkpoint lineage and a deliberate model distribution license.
- [ ] Establish an independent held-out answer-quality gate and retain all failures before app adoption.
- [ ] Improve and evaluate only through a separately selected, provenance-preserving scratch-training run.
- [ ] Define the installation/update authentication gate and the policy for installed offline access.
- [ ] Choose a model distribution destination and verify asset manifests, hashes, updates and recovery without adding binaries to ordinary source commits.
- [ ] Integrate the named optional download into the existing help widget while preserving instant preloaded help.
- [ ] Keep complete model weights and shards below 160,000,000 bytes; disclose tokenizer/runtime/knowledge downloads and memory needs separately.
- [ ] Package and test the complete offline shell, tokenizer, runtime, model and knowledge assets, including cache eviction and origin/profile changes.
- [ ] Review worker message interfaces, local asset restrictions, renderer and telemetry exclusions; test session-private behavior end to end.
- [ ] Qualify iOS, Android, desktop operating systems, embedded WebViews, GPU backends and capable IoT browsers separately.
- [ ] Verify secure-context, single-thread/multithread and authentication-popup behavior in each supported host.
- [ ] Retain preloaded help whenever an installation, capability, integrity, inference or quality gate fails.

Model files, checkpoints, raw corpus, training environment and portable archives
remain in the separate local research workspace. The private handoff retains
their exact locations, hashes, retraining commands and original reports. No
authenticated download gate, actual widget inference, mobile/WebView/IoT/GPU
qualification or production AI release is established by this pilot.
