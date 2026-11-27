# WebAppXai scratch AI research and adoption plan

Updated November 27, 2026. **WebAppXai pilot-004-docs** continues the project's
own scratch-trained model for questions about the WebAppX template. On a fresh
32-question comparison it answered **3/32 (9.4%)** correctly. Pilot 003
answered **1/32** on the same questions. Use the curated FAQ and project
documentation for setup, backup and other operational decisions.

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

## Releases used by this template

| Owner | Responsibility | Selected release |
| --- | --- | --- |
| Wayne Tech Lab's private WebAppXai source repository | Training, evaluation, the browser worker and its Vite integration | `@waynetechlab/webappxai` **v0.1.0**, Git commit `0526db15ec9c3f824411131a67fc141f91c3d6aa` |
| Private Hugging Face model repository | Versioned ONNX weights, tokenizer, model card and evaluation | `SatoshiUNO/WebAppXai` **pilot-004-docs**, Git commit `3d067dd52560f34b5001779bc7104416025a72ff` |
| Public WebAppX template | Firebase sign-in, authenticated downloads, the cache, Help desk and FAQ | Ships the reviewed runtime under `vendor/webappxai` and selects the model in `src/webappxai/model-pin.json` |

A clean public checkout uses `npm ci` and `npm run build`. npm resolves the
runtime from the checkout and its dependencies from the public registry.
The default build and FAQ work without access to either private repository.
The host's model pin and the gateway's release manifest identify the two active
files by size and SHA-256. The browser and gateway verify the assets before use.

### Enable chat locally

From a machine with access to the private model repository, choose a directory
outside the checkout and every Vite-served directory. Set `MODEL_DIR` to its
absolute path and run the following command using your local Hugging Face
session. Existing copies that match both digests below also work.

```sh
hf download SatoshiUNO/WebAppXai model.onnx tokenizer.json --revision 3d067dd52560f34b5001779bc7104416025a72ff --local-dir "$MODEL_DIR"
```

In the root checkout's ignored `.env.local`, set `WEBAPPXAI_MODEL_DIR` to
that directory's absolute path. This is a server setting. A browser signs in
to WebAppX and retrieves the files from its own origin. Keep operator
credentials out of browser configuration.

Run `npm run dev:systemx` and open the printed Vite URL. On the login page,
create or use an email/password account in the local `demo-systemx` Auth
emulator. Reopen Help and load the model. If loading fails, check the local Auth
session and model directory, then compare both files with the pilot-004 digests below. The FAQ remains
available while you do this.

To repeat the integrated browser check, run `node scripts/browser-webappxai.mjs --origin <local-app-origin>`
from the checkout, replacing the placeholder with the loopback Vite origin.
For the cache-upgrade test, append `--old-assets-dir "$PREVIOUS_MODEL_DIR"`
with the real pilot-003 pair outside the checkout. The browser check authenticates
disposable emulator users, tests the pinned answer offline, verifies the active
files and tests cache reuse after refresh and isolation between users. The
ordinary CI model tests run with fixtures.

### Configure a hosted installation

Firebase Hosting routes the authenticated model requests to the
`webappxaiModel` HTTPS function in `us-central1`. Before an authorized
deployment, install the locked Node 22 dependencies in
`integrations/webappxai/functions` and set the function's
`WEBAPPXAI_STORAGE_BUCKET`. Place the two verified files in the following
private bucket locations.

```text
webappxai/3d067dd52560f34b5001779bc7104416025a72ff/model.onnx
webappxai/3d067dd52560f34b5001779bc7104416025a72ff/tokenizer.json
```

Enforce public access prevention on the bucket, keep Firebase download tokens
off the objects, and grant the function's service account access to read
bucket metadata and the two objects. The client requests
`/api/webappxai/3d067dd52560f34b5001779bc7104416025a72ff/<filename>`.
The function checks the Firebase ID token and both the size and digest of
each requested object. See [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
and [Firebase Hosting integration](https://firebase.google.com/docs/hosting/functions).

### Upgrade or roll back

Pilot 003 used model commit `13234ff5521012ddcfda6cda14eda3850d5448d4`.
Clients pinned to that commit or its original `pilot-003-chat` URL can still
request the previous pair from the authenticated gateway. Keep its verified
objects in the private bucket while those clients are supported. Local operators
can supply its directory separately in `WEBAPPXAI_PREVIOUS_MODEL_DIR`.

For pilot 004, supply the new verified pair in `WEBAPPXAI_MODEL_DIR` for local
use or stage it at the full pilot-004 commit paths above for an authorized hosted
installation. The next signed-in **Load model** fetches and verifies the new
pair. The cache uses the project, environment, user ID, active revision and
both digests. The previous files are replaced only after both active assets
verify. To roll back, restore the previous app pin and matching gateway release
configuration together and supply the verified previous objects.

## Pilot 004 training and evaluation

The project continued its pilot-003 checkpoint on public WebAppX commit
`c0e74114d3607f8c57702cd976e8b52c6b8e05c5`. The Markdown inventory comprised
50 files. A 600-update training phase used the 44 training documents. A further
4,800 updates used 385 assistant-authored training questions covering 55 intents
grounded in 16 public guides. The 55 development questions used alternate
phrasings of those intents. Training used no user chats.

| Active file | Bytes | SHA-256 |
| --- | ---: | --- |
| model.onnx | 20,845,156 | `e491024a6815639c143fa647f236c809bd4b0b6a1285b420f15fbf0ae9e58d95` |
| tokenizer.json | 266,968 | `6f462b40f7f611cee011889ecf0cfbd4cfe6b7f29320ffb3865f15f8471af6b4` |

The independent evaluation used 32 fresh assistant-authored questions, eight
per topic. Two AI judges independently graded the anonymized replies against a
fixed two-fact rubric. A correct answer had to include both facts without a
material error. Both models used the same single-turn offline Chromium worker
with greedy decoding, a 128-token context and a 48-token reply limit.

| Help desk topic | Pilot 003 | Pilot 004 |
| --- | ---: | ---: |
| Setup and navigation | 0/8 | 0/8 |
| Local AI, sign-in and privacy | 0/8 | 1/8 |
| Account-free portal demos | 1/8 | 2/8 |
| Backup and recovery | 0/8 | 0/8 |
| **Total** | **1/32** | **3/32** |

Both pilots answered one question correctly. Pilot 004 alone answered two
correctly. Both missed the other 29. This small evaluation covers documented
product questions. Human support performance and production readiness remain
unverified.

### Verified WebAppX Help desk integration

On November 27, 2026, all 12 integrated Chromium checks passed with pilot 004
at the pinned revision above. An email/password user signed in through the
local Auth emulator. **Load model** replaced real pilot-003 cache entries,
verified both active file digests and started the pinned v0.1.0 worker. With
the network disconnected, “What is WebAppX?” returned “WebAppX is a React,
TypeScript, Vite and Firebase webapp template with SYSTEMX guidance.”
The browser recorded zero network requests during generation.

After refresh, the same account loaded its verified cache with zero further
private downloads. A second account fetched both files anew. Cross-tab sign-out
removed chat access and left the FAQ available. The check also covered the
signed-out asset routes, the 390 × 650 Help panel and browser errors.

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

## Historical pilot 003 evidence

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

## Historical pilot 003 research publication

The owner selected the model name **WebAppXai** and the profile display name
**Wayne Tech Lab LLC**. A seven-file package was uploaded to a private research
repository, including the ONNX model, tokenizer, manifest, model card, full weak
quality result and a sanitized experiment receipt. The remote model SHA-256
matches the local export. Eleven local evidence path keys in the uploaded receipt
were converted to relative paths; the original receipt remains preserved.

The pilot-003 model commit was `13234ff5521012ddcfda6cda14eda3850d5448d4`. Distribution of the weights remains private.
WebAppX uses its authenticated gateway for delivery. The original research
workspace retains the raw corpus, training checkpoints and training environment.

## Adoption checklist outside LAN acceptance

- [ ] Review annotations, source inventory, dependency licensing, checkpoint lineage and a deliberate model distribution license.
- [x] Evaluate both pilots on an independently authored set of 32 questions and retain all scored replies. Pilot 004 achieved 3/32. Reliable operational support remains a separate acceptance decision.
- [x] Continue the project's own model lineage on a pinned WebAppX documentation corpus, freeze the selected candidate and compare it with its parent.
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
