# WebAppXai in the Help desk

Open **Help** in the lower-left corner of WebAppX to use the FAQ and **Contact
support**. The optional **WebAppXai · Research pilot** runs on your device.
On 32 independent Help desk questions, pilot 004 answered **3/32 (9.4%)**
correctly. The previous pilot answered **1/32** on the same questions. Use the
curated FAQ and project documentation for setup and operational guidance.

## Chat locally

1. Choose **Sign in to load model** and sign in to the app. On a local development instance, use the emulator's **Create local account** option if needed.
2. Reopen **Help**, choose **Load model**, and wait for **Ready on this device**. The first load transfers about 36 MB.
3. Type “What is WebAppX?” and choose **Send locally**. Once loaded, the worker can finish a reply with the network disconnected.
4. Choose **Clear chat** to start over. Closing Help or signing out clears the conversation. **Delete downloaded model** removes the browser's saved model and tokenizer.

## Enable the pilot in a new app

| Component | Where it comes from |
| --- | --- |
| Browser runtime | The public template includes the runtime from WebAppXai **v0.1.0**, source commit `0526db15ec9c3f824411131a67fc141f91c3d6aa`. WebAppX resolves it from `vendor/webappxai` on install. |
| Model and tokenizer | The private Hugging Face model repo `SatoshiUNO/WebAppXai` supplies **pilot-004-docs** at `3d067dd52560f34b5001779bc7104416025a72ff`. |
| Access and chat | WebAppX owns Firebase sign-in, verified downloads, the browser cache, conversation state and the FAQ. The WebAppXai source repo owns the library, training and evaluation. |

A public clone builds with `npm ci` and `npm run build` using the public npm
registry. To enable local chat, an authorized operator places `model.onnx`
and `tokenizer.json` from the exact model revision together outside the
checkout and every Vite-served directory. Set `WEBAPPXAI_MODEL_DIR` in the
checkout's ignored `.env.local` to that directory's absolute path. Start
`npm run dev:systemx`, open the printed app URL, then follow the chat steps.
WebAppX checks both file sizes and SHA-256 values.

For hosted installations, upgrades or rollbacks, follow the [model download,
SHA-256 values, private bucket paths and release procedure](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-LOCAL-AI-RESEARCH-2026-10-31.md).

## What the pilot answered correctly

| Help desk topic | Pilot 003 | Pilot 004 |
| --- | ---: | ---: |
| Setup and navigation | 0/8 | 0/8 |
| Local AI, sign-in and privacy | 0/8 | 1/8 |
| Account-free portal demos | 1/8 | 2/8 |
| Backup and recovery | 0/8 | 0/8 |

Two AI judges independently scored anonymized, single-turn replies from the same
offline Chromium worker. Each question required two documented facts and no
material error. Both models missed 29 of the 32 questions. You can try the
documented smoke prompt, “What is WebAppX?”, to check that the model runs.

## Upgrading from pilot 003

Sign in, reopen **Help** and choose **Load model** while online. The host checks
each downloaded file against the active revision's byte count and SHA-256 digest.
The cache belongs to the signed-in account and is identified by the revision and
both file digests. Refreshing can reuse the verified pair for that account. A
different account must load its own pair. Closing Help clears your conversation.

## Verified pilot 004 behavior

On November 27, 2026, all 12 checks passed in the WebAppX Help desk using
Chromium and the local Firebase Auth emulator. The signed-out FAQ worked at a
390 × 650 viewport. Signing in and choosing **Load model** replaced the account's
real cached pilot-003 files with the digest-verified pilot-004 files.

With Chromium offline, “What is WebAppX?” returned “WebAppX is a React,
TypeScript, Vite and Firebase webapp template with SYSTEMX guidance.” Generation
made zero network requests. A refresh started an empty conversation and reused
the same account's cache with zero private downloads. A second account fetched
both files again. Signing out in another tab closed chat and kept the FAQ available.

## Earlier browser verification for pilot 003

With pilot 003 on November 27, 2026, Chromium displayed the FAQ at a 390 × 650 viewport,
signed in through the local Firebase emulator, and fetched the pinned model
files only after **Load model**. The served worker matched the v0.1.0 worker's
SHA-256 digest. With Chromium offline, **What is WebAppX?** returned
“WebAppX is a React, TypeScript, Vite and Firebase webapp template with SYSTEMX
guidance.”

That release could migrate the same pilot-003 files from its original cache key
to its full-revision key without a second download.
Signing out in another tab closed the chat and left the FAQ available.
