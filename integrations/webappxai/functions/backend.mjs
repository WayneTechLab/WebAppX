import { PILOT_ASSETS, PILOT_REVISION } from './contracts.mjs';

export async function authorizePilotUser(auth, token) {
  try {
    const claims = await auth.verifyIdToken(token, true);
    const provider = claims.firebase?.sign_in_provider;
    return typeof claims.uid === 'string' && claims.uid.length > 0 &&
      typeof provider === 'string' && provider.length > 0 &&
      provider !== 'anonymous' && claims.firebase?.tenant === undefined;
  } catch {
    return false;
  }
}

export async function readPrivatePilotAsset(bucket, name) {
  if (!Object.hasOwn(PILOT_ASSETS, name)) throw new Error('Unknown asset');
  const [policy] = await bucket.getMetadata();
  if (policy.iamConfiguration?.publicAccessPrevention !== 'enforced') {
    throw new Error('Private bucket policy required');
  }

  const path = `webappxai/${PILOT_REVISION}/${name}`;
  const [metadata] = await bucket.file(path).getMetadata();
  const size = PILOT_ASSETS[name].bytes;
  // The Storage client converts a generation to Number internally.
  const generation = Number(metadata.generation);
  if (!Number.isSafeInteger(generation) || generation <= 0 ||
      String(generation) !== metadata.generation || metadata.size !== String(size) ||
      (metadata.contentEncoding && metadata.contentEncoding !== 'identity') ||
      Object.keys(metadata.metadata ?? {}).some(key => key.toLowerCase() === 'firebasestoragedownloadtokens') ||
      metadata.acl?.some(({ entity }) => entity === 'allUsers' || entity === 'allAuthenticatedUsers')) {
    throw new Error('Unexpected object metadata');
  }

  const stream = bucket.file(path, { generation }).createReadStream({
    start: 0, end: size, decompress: false, validation: false,
  });
  const data = Buffer.allocUnsafe(size);
  let offset = 0;
  for await (const chunk of stream) {
    if (chunk.length > size - offset) throw new Error('Object exceeds expected size');
    offset += chunk.copy(data, offset);
  }
  if (offset !== size) throw new Error('Incomplete object');
  return data; // The shared HTTP handler verifies SHA-256 before writing any bytes.
}
