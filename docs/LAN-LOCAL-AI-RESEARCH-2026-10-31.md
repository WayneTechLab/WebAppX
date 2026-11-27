# WebAppXai scratch AI research and adoption plan

Updated November 27, 2026. **WebAppXai** is a scratch-trained research model
available in the WebAppX Help desk. Its October exploratory check produced **2
exact matches in 10 prompts**. Several answers mixed up unrelated facts. Use
the curated FAQ for setup guidance. The model has no independent quality
qualification.

## Load the pilot in WebAppX

1. Open **Help** in the lower-left corner. The three FAQ questions and **Contact support** work before sign-in.
2. Choose **Sign in to load model** and complete the app's normal Firebase sign-in. Reopen **Help** and choose **Load model**.
3. Wait for **Ready on this device**, enter a question and choose **Send locally**. For a short test, try “What is WebAppX?”.
4. Use **Stop** to interrupt a reply or **Clear chat** to start a new conversation. Closing Help, unloading the model or signing out clears the conversation. **Delete downloaded model** removes the browser's saved model and tokenizer.

The first load transfers approximately 20.85 MB of weights, 0.27 MB of tokenizer
data and 15 MB of browser runtime. A dedicated worker generates replies on the
device. Conversation text lives in memory. The worker's network policy blocks
outbound connections during inference. Treat the first load and sign-in as
online operations.

### Set up a local checkout

Obtain `model.onnx` and `tokenizer.json` for `pilot-003-chat` from Wayne Tech
Lab's private research package. Check their SHA-256 values against the table
and digests below. Put the two files together outside the repository and all
Vite-served directories. In the root checkout's ignored `.env.local`, set
`WEBAPPXAI_MODEL_DIR` to that directory's absolute path. Keep the assets and
the setting out of source control.

Install the app's locked npm dependencies and start its supervised local
session with `npm run dev:systemx`. Use the Vite URL printed by the supervisor.
Use a regular email/password account in the local `demo-systemx` Auth emulator.
An existing production account is separate from accounts in this emulator.
If model loading fails, check the private files, model directory and emulator
session, then retry. The FAQ remains available.

To repeat the end-to-end test, run `node scripts/browser-webappxai.mjs --origin <local-app-origin>`
from the checkout, replacing the placeholder with the loopback Vite origin.
The test uses Chromium, the private pilot files and a disposable local account.
The ordinary CI model tests run with fixtures.

### Configure a hosted installation

The checked-in Firebase Hosting configuration routes the two versioned model
URLs under `/api/webappxai/pilot-003-chat/` to the `webappxaiModel` HTTPS
function in `us-central1`. Before deploying an authorized installation,
install the locked Node 22 dependencies in `integrations/webappxai/functions`
and configure `WEBAPPXAI_STORAGE_BUCKET` for the function. Place the two unchanged
files in that private bucket under `webappxai/pilot-003-chat/`. Enforce public
access prevention on the bucket, keep the objects free of Firebase download
tokens, and grant the function's service account access to read bucket metadata
and the two objects. The function checks the signed-in user's Firebase ID token
and verifies each object's size and digest before delivery. The Git repository
contains the integration code and asset digests. Model distribution remains
private. See [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
and [Firebase Hosting integration](https://firebase.google.com/docs/hosting/functions).

## Original research requirements

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
model loading, tokenizer/logit parity, local generation without HTTP requests, cached offline cold reload, session clearing, model deletion and absence of
external-origin requests/page errors. Those October results cover the stand-alone prototype.

The chat annotations contain twenty source-derived training examples and ten
validation phrasings of the same facts. Validation loss was observed during
training. This is not a blind or unseen-knowledge benchmark. The two successful
demo answers do not replace the weak full quality result. Pretraining and chat
losses measure different tasks and must not be compared as one score.

## Private research publication

The owner selected the model name **WebAppXai** and the profile display name
**Wayne Tech Lab LLC**. A seven-file package was uploaded to a private research
repository, including the ONNX model, tokenizer, manifest, model card, full weak
quality result and a sanitized experiment receipt. The remote model SHA-256
matches the local export. Eleven local evidence path keys in the uploaded receipt
were converted to relative paths; the original receipt remains preserved.

The private destination and upload revision belong to the operator handoff. The
model is not a public release, no public distribution license was selected, and
the November WebAppX integration uses an authenticated gateway for delivery. Raw corpus, checkpoints and training environments were not
uploaded.

## Adoption checklist outside LAN acceptance

- [ ] Review annotations, source inventory, dependency licensing, checkpoint lineage and a deliberate model distribution license.
- [ ] Establish an independent held-out answer-quality gate and retain all failures before relying on the pilot for support.
- [ ] Improve and evaluate only through a separately selected, provenance-preserving scratch-training run.
- [x] Gate model loading on app sign-in and allow local generation after loading. Full offline application startup remains a separate qualification.
- [ ] Choose a model distribution destination and verify asset manifests, hashes, updates and recovery without adding binaries to ordinary source commits.
- [x] Integrate the named optional download into the existing Help desk while preserving instant preloaded help.
- [ ] Keep complete model weights and shards below 160,000,000 bytes; disclose tokenizer/runtime/knowledge downloads and memory needs separately.
- [ ] Package and test the complete offline shell, tokenizer, runtime, model and knowledge assets, including cache eviction and origin/profile changes.
- [ ] Review worker message interfaces, local asset restrictions, renderer and telemetry exclusions; test session-private behavior end to end.
- [ ] Qualify iOS, Android, desktop operating systems, embedded WebViews, GPU backends and capable IoT browsers separately.
- [ ] Verify secure-context, single-thread/multithread and authentication-popup behavior in each supported host.
- [ ] Retain preloaded help whenever an installation, capability, integrity, inference or quality gate fails.

Model files, checkpoints, raw corpus, training environment and portable archives
remain in the separate local research workspace. The private handoff retains
their exact locations, hashes, retraining commands and original reports. The November integration targets desktop CPU/WASM. Mobile, embedded and GPU qualification, independent answer-quality acceptance and production deployment remain open.
