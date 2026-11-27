# WebAppXai in the Help desk

Open **Help** in the lower-left corner of WebAppX to use the FAQ and **Contact
support**. The optional **WebAppXai · Research pilot** runs on your device.
It matched 2 of 10 reference answers in its exploratory evaluation. Use the
curated FAQ for setup guidance.

## Chat locally

1. Choose **Sign in to load model** and sign in to the app. On a local development instance, use the emulator's **Create local account** option if needed.
2. Reopen **Help**, choose **Load model**, and wait for **Ready on this device**. The first load transfers about 36 MB.
3. Type “What is WebAppX?” and choose **Send locally**. Once loaded, the worker can finish a reply with the network disconnected.
4. Choose **Clear chat** to start over. Closing Help or signing out clears the conversation. **Delete downloaded model** removes the browser's saved model and tokenizer.

## Enable the pilot in a new app

| Component | Where it comes from |
| --- | --- |
| Browser runtime | The public template includes the runtime from WebAppXai **v0.1.0**, source commit `0526db15ec9c3f824411131a67fc141f91c3d6aa`. WebAppX resolves it from `vendor/webappxai` on install. |
| Model and tokenizer | The private Hugging Face model repo `SatoshiUNO/WebAppXai` supplies **pilot-003-chat** at `13234ff5521012ddcfda6cda14eda3850d5448d4`. |
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

## Browser verification

On November 27, 2026, Chromium displayed the FAQ at a 390 × 650 viewport,
signed in through the local Firebase emulator, and fetched the pinned model
files only after **Load model**. The served worker matched the v0.1.0 worker's
SHA-256 digest. With Chromium offline, **What is WebAppX?** returned
“WebAppX is a React, TypeScript, Vite and Firebase webapp template with SYSTEMX
guidance.”

After refresh at desktop size, WebAppX verified the previous pilot's cached
files and reused them under the full revision without downloading them again.
Signing out in another tab closed the chat and left the FAQ available.
