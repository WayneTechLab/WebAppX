import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { authorizePilotUser, readPrivatePilotAsset } from '../backend.mjs';
import { PILOT_ASSETS, PILOT_REVISION, PREVIOUS_REVISION, releaseForRevision } from '../contracts.mjs';

const name = 'tokenizer.json';
const bytes = PILOT_ASSETS[name].bytes;

function bucketFixture({ prevention = 'enforced', metadata = {}, size = bytes, chunks = [Buffer.alloc(size)], readError, pinnedMetadataError, revision = PILOT_REVISION } = {}) {
  const requests = [];
  const bucket = {
    getMetadata: async () => [{ iamConfiguration: { publicAccessPrevention: prevention } }],
    file(path, options) {
      requests.push({ path, options });
      return {
        getMetadata: async () => {
          if (pinnedMetadataError && path === `webappxai/${revision}/${name}`) throw pinnedMetadataError;
          return [{ size: String(size), generation: '40', ...metadata }];
        },
        createReadStream(range) {
          requests.at(-1).range = range;
          if (readError) throw readError;
          return Readable.from(chunks);
        },
      };
    },
  };
  return { bucket, requests };
}

test('accepts a named user after Firebase verifies revocation', async () => {
  const auth = { async verifyIdToken(token, checkRevoked) {
    assert.equal(token, 'example');
    assert.equal(checkRevoked, true);
    return { uid: 'member', firebase: { sign_in_provider: 'password' } };
  } };
  assert.equal(await authorizePilotUser(auth, 'example'), true);
});

test('rejects revoked IDs, anonymous accounts, malformed claims and other tenants', async () => {
  for (const claims of [
    undefined, {}, { uid: 'member' }, { uid: '', firebase: { sign_in_provider: 'password' } },
    { uid: 'member', firebase: { sign_in_provider: 'anonymous' } },
    { uid: 'member', firebase: { sign_in_provider: 'password', tenant: 'different' } },
  ]) {
    assert.equal(await authorizePilotUser({ verifyIdToken: async () => claims }, 'example'), false);
  }
  const revoked = { verifyIdToken: async () => { throw new Error('auth/id-token-revoked'); } };
  assert.equal(await authorizePilotUser(revoked, 'example'), false);
});

test('uses the inspected object generation and reads a bounded range', async () => {
  const content = Buffer.alloc(bytes, 0x41);
  const { bucket, requests } = bucketFixture({ chunks: [content.subarray(0, 32), content.subarray(32)] });
  assert.deepEqual(await readPrivatePilotAsset(bucket, name), content);
  const path = `webappxai/${PILOT_REVISION}/tokenizer.json`;
  assert.deepEqual(requests, [
    { path, options: undefined },
    { path, options: { generation: 40 }, range: { start: 0, end: bytes, decompress: false, validation: false } },
  ]);
});

test('only the original Hub revision can fall back to the original object location on 404', async () => {
  const originalPath = `webappxai/pilot-003-chat/${name}`;
  const options = { revision: PREVIOUS_REVISION, size: releaseForRevision(PREVIOUS_REVISION).assets[name].bytes };
  const { bucket, requests } = bucketFixture({ ...options, pinnedMetadataError: { code: 404 } });
  assert.equal((await readPrivatePilotAsset(bucket, name, PREVIOUS_REVISION)).length, options.size);
  assert.deepEqual(requests.map(call => call.path), [
    `webappxai/${PREVIOUS_REVISION}/${name}`, originalPath, originalPath,
  ]);
  assert.deepEqual(requests.at(-1).options, { generation: 40 });
  for (const code of [403, 503]) {
    const blocked = bucketFixture({ ...options, pinnedMetadataError: { code } });
    await assert.rejects(readPrivatePilotAsset(blocked.bucket, name, PREVIOUS_REVISION), error => error.code === code);
    assert.equal(blocked.requests.length, 1);
  }
  if (PILOT_REVISION !== PREVIOUS_REVISION) {
    const missing = bucketFixture({ pinnedMetadataError: { code: 404 } });
    await assert.rejects(readPrivatePilotAsset(missing.bucket, name), error => error.code === 404);
    assert.deepEqual(missing.requests.map(call => call.path), [`webappxai/${PILOT_REVISION}/${name}`]);
  }
});

test('unlisted names and buckets without confirmed public access prevention are refused', async () => {
  const { bucket, requests } = bucketFixture({ prevention: 'inherited' });
  for (const asset of [name, '__proto__', '../tokenizer.json', 'pilot-004/model.onnx']) {
    await assert.rejects(readPrivatePilotAsset(bucket, asset));
  }
  await assert.rejects(readPrivatePilotAsset(bucket, name, '../other'), /Unknown release/);
  assert.equal(requests.length, 0);
});

test('metadata size, identity encoding, public ACLs, download tokens and precise generations are checked before reading', async () => {
  for (const metadata of [
    { size: String(bytes + 1) }, { contentEncoding: 'gzip' }, { generation: '9007199254740993' },
    { generation: undefined }, { generation: '4e1' }, { metadata: { firebaseStorageDownloadTokens: 'fixture' } },
    { acl: [{ entity: 'allUsers' }] }, { acl: [{ entity: 'allAuthenticatedUsers' }] },
  ]) {
    const { bucket, requests } = bucketFixture({ metadata });
    await assert.rejects(readPrivatePilotAsset(bucket, name));
    assert.equal(requests.length, 1);
  }
});

test('short streams, overlong streams and disappeared generations fail without returning partial content', async () => {
  for (const fixture of [
    { chunks: [Buffer.alloc(bytes - 1)] }, { chunks: [Buffer.alloc(bytes), Buffer.alloc(1)] },
    { readError: new Error('generation gone') },
  ]) {
    const { bucket, requests } = bucketFixture(fixture);
    await assert.rejects(readPrivatePilotAsset(bucket, name));
    assert.equal(requests.length, 2);
  }
});
