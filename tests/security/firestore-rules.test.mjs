import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore, setDoc, terminate, updateDoc } from 'firebase/firestore'

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST
if (!authHost?.startsWith('127.0.0.1:') || !firestoreHost?.startsWith('127.0.0.1:')) {
  throw new Error('Rule tests require explicit loopback Auth and Firestore emulator endpoints')
}
const projectId = 'demo-systemx'
const clients = []

async function client(level) {
  const app = initializeApp({ apiKey: 'demo-key', projectId }, `rules-${level}-${Date.now()}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true })
  const account = await createUserWithEmailAndPassword(auth, `rules-${level}-${Date.now()}@example.test`, 'local-fixture-password')
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: account.user.uid, customAttributes: JSON.stringify({ level, admin: level >= 4 }) }),
  })
  assert.equal(response.status, 200)
  await account.user.getIdToken(true)
  const db = getFirestore(app)
  const [host, port] = firestoreHost.split(':')
  connectFirestoreEmulator(db, host, Number(port))
  clients.push({ app, db })
  return { db, uid: account.user.uid }
}

async function seedDocument(collection, id, fields) {
  const response = await fetch(`http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  })
  assert.equal(response.status, 200)
}

async function seedProfile(uid, level) {
  await seedDocument('users', uid, { level: { integerValue: String(level) }, displayName: { stringValue: 'Protected fixture' } })
}

after(async () => {
  for (const { app, db } of clients) { await terminate(db); await deleteApp(app) }
})

test('members keep own-profile edits and cannot write authority fields or owner registry', async () => {
  const member = await client(1)
  const profile = doc(member.db, 'users', member.uid)
  await setDoc(profile, { displayName: 'Member' })
  await updateDoc(profile, { displayName: 'Updated member' })
  assert.equal((await getDoc(profile)).data().displayName, 'Updated member')
  await seedDocument('members', 'fixture', { label: { stringValue: 'Member fixture' } })
  assert.equal((await getDoc(doc(member.db, 'members', 'fixture'))).data().label, 'Member fixture')
  for (const field of ['level', 'role', 'admin', 'subscriptionTier', 'tier', 'mfaRequired', 'securityProfile', 'claims']) {
    await assert.rejects(updateDoc(profile, { [field]: field === 'level' ? 5 : 'fixture' }), { code: 'permission-denied' })
  }
  await assert.rejects(setDoc(doc(member.db, 'adminUsers', member.uid), { level: 5, status: 'active' }), { code: 'permission-denied' })
  await assert.rejects(setDoc(profile, { level: 5 }), { code: 'permission-denied' })
  await assert.rejects(deleteDoc(profile), { code: 'permission-denied' })
})

test('staff manage ordinary profiles while protected authority changes stay backend-only', async () => {
  const staff = await client(4)
  await seedProfile(staff.uid, 4)
  const profile = doc(staff.db, 'users', staff.uid)
  await updateDoc(profile, { displayName: 'Updated staff' })
  await assert.rejects(updateDoc(profile, { level: 5 }), { code: 'permission-denied' })
  await assert.rejects(updateDoc(profile, { level: 4, role: 'owner' }), { code: 'permission-denied' })
  await assert.rejects(deleteDoc(profile), { code: 'permission-denied' })
  await assert.rejects(setDoc(doc(staff.db, 'adminUsers', staff.uid), { level: 5, status: 'active' }), { code: 'permission-denied' })
  const member = await client(1)
  await setDoc(doc(member.db, 'users', member.uid), { displayName: 'Ordinary' })
  await updateDoc(doc(staff.db, 'users', member.uid), { displayName: 'Staff edit' })
  await deleteDoc(doc(staff.db, 'users', member.uid))
})

test('owner claims retain administrator registry management', async () => {
  const owner = await client(5)
  const registry = doc(owner.db, 'adminUsers', owner.uid)
  await setDoc(registry, { level: 5, status: 'active' })
  assert.equal((await getDoc(registry)).data().level, 5)
  await updateDoc(registry, { status: 'inactive' })
  await deleteDoc(registry)
})
