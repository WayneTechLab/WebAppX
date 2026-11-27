import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { authorizePilotUser, readPrivatePilotAsset } from './backend.mjs';
import { servePilotAsset } from './contracts.mjs';

const app = initializeApp();

// The local Vite gateway handles emulator sessions. This cloud endpoint accepts
// tokens from this deployment's production Firebase project only.
const dependencies = {
  authorize(token) {
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return false;
    return authorizePilotUser(getAuth(app), token);
  },
  read(name) {
    const bucketName = process.env.WEBAPPXAI_STORAGE_BUCKET;
    if (!bucketName || /[:/\s]/.test(bucketName) || process.env.STORAGE_EMULATOR_HOST ||
        process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      throw new Error('Private bucket unavailable');
    }
    return readPrivatePilotAsset(getStorage(app).bucket(bucketName), name);
  },
};

export const webappxaiModel = onRequest(
  { region: 'us-central1', memory: '256MiB', concurrency: 2, timeoutSeconds: 60 },
  (request, response) => servePilotAsset(request, response, dependencies),
);
