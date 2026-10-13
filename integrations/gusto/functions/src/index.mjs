import { randomUUID } from 'node:crypto'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { createHrBackend } from './backend.mjs'
import { HrError, identifier } from './security.mjs'
import { persistWebhook } from './webhooks.mjs'

if (!getApps().length) initializeApp()
const db = getFirestore()
const webhookToken = defineSecret('GUSTO_WEBHOOK_VERIFICATION_TOKEN')
const options = { region: 'us-central1', maxInstances: 2, timeoutSeconds: 30, enforceAppCheck: true }

function config() { return { mode: process.env.GUSTO_MODE ?? 'disabled' } }
function orgRef(orgId) { return db.collection('organizations').doc(identifier(orgId, 'organization ID')) }

const services = {
  async getMembership(orgId, uid) {
    identifier(uid, 'user ID')
    const snapshot = await orgRef(orgId).collection('hr_memberships').doc(uid).get()
    return snapshot.exists ? snapshot.data() : null
  },
  async getTimeOffPolicy(orgId, policyId) {
    const snapshot = await orgRef(orgId).collection('hr_time_off_policies').doc(identifier(policyId)).get()
    return snapshot.exists ? snapshot.data() : null
  },
  async createTimeOff(orgId, requestId, record) {
    const org = orgRef(orgId)
    return db.runTransaction(async transaction => {
      const policy = await transaction.get(org.collection('hr_time_off_policies').doc(record.policyId))
      if (!policy.exists || policy.data().orgId !== orgId || policy.data().status !== 'active') throw new HrError('invalid-argument', 'The time off policy is not active')
      transaction.create(org.collection('hr_time_off_requests').doc(requestId), {
        ...record, startAt: Timestamp.fromDate(new Date(record.startAt)), endAt: Timestamp.fromDate(new Date(record.endAt)), createdAt: FieldValue.serverTimestamp(),
      })
      transaction.create(org.collection('hr_audit_events').doc(requestId), {
        orgId, actorUid: record.firebaseUid, action: 'time-off.requested', resourceId: requestId,
        result: 'accepted', mode: 'mock', createdAt: FieldValue.serverTimestamp(),
      })
    })
  },
}

function callable(action, allowed = ['orgId']) {
  return onCall(options, async request => {
    try {
      if (!request.auth?.uid) throw new HrError('unauthenticated', 'A verified Firebase identity is required')
      if (!request.data || typeof request.data !== 'object' || Array.isArray(request.data) || Object.keys(request.data).some(key => !allowed.includes(key))) {
        throw new HrError('invalid-argument', 'Unexpected HR request fields')
      }
      const backend = createHrBackend(services, config())
      return await action(backend, request.auth.uid, request.data)
    } catch (error) {
      if (error instanceof HrError) throw new HttpsError(error.code, error.message)
      // Never echo provider bodies, secret values or Firebase internal errors.
      throw new HttpsError('internal', 'HR operation failed')
    }
  })
}

export const gustoIntegrationStatus = callable((backend, uid, data) => backend.status(uid, data.orgId))
export const gustoReadDirectory = callable((backend, uid, data) => backend.directory(uid, data.orgId))
export const gustoRequestTimeOff = callable((backend, uid, data) => backend.requestTimeOff(uid, data.orgId, data.request, randomUUID()), ['orgId', 'request'])
export const gustoProxy = callable((backend, uid, data) => backend.proxy(uid, data.orgId), ['orgId', 'method', 'path'])

export const gustoWebhook = onRequest({ region: 'us-central1', maxInstances: 2, timeoutSeconds: 10, cors: false, secrets: [webhookToken] }, async (request, response) => {
  try {
    const mode = config().mode
    if (!['demo', 'production'].includes(mode) || process.env.GUSTO_WEBHOOK_HEX_VERIFIED !== 'true' || process.env.GUSTO_WEBHOOK_APPROVED !== 'true') {
      response.status(503).json({ code: 'not-configured', message: 'Webhook ingestion is not configured' }); return
    }
    if (request.method !== 'POST') { response.status(405).end(); return }
    const orgId = identifier(process.env.GUSTO_WEBHOOK_ORG_ID, 'organization ID')
    const connection = (await orgRef(orgId).collection('integrations').doc('gusto').get()).data()
    if (!connection || connection.orgId !== orgId || connection.mode !== mode || connection.status !== `${mode}-accepted`) {
      throw new HrError('failed-precondition', 'A reviewed provider company mapping is required')
    }
    identifier(connection.gustoCompanyUuid, 'company ID')
    const signature = request.get('X-Gusto-Signature')
    const result = await persistWebhook({
      transaction: callback => db.runTransaction(transaction => callback({
        async get(tenant, id) {
          const snapshot = await transaction.get(orgRef(tenant).collection('hr_webhook_inbox').doc(id))
          return snapshot.exists ? snapshot.data() : null
        },
        async create(tenant, id, record) { transaction.create(orgRef(tenant).collection('hr_webhook_inbox').doc(id), record) },
      })),
    }, { orgId, companyUuid: connection.gustoCompanyUuid, rawBody: request.rawBody, signature, verificationToken: webhookToken.value() })
    // The inbox is the durable work queue. No provider GET, payroll write, or
    // projection occurs here; an accepted reconciliation worker is a later gate.
    response.status(202).json({ accepted: true, duplicate: result.duplicate })
  } catch (error) {
    const status = error instanceof HrError && error.code === 'permission-denied' ? 403 : error instanceof HrError && error.code === 'invalid-argument' ? 400 : 503
    response.status(status).json({ code: status === 503 ? 'not-configured' : 'rejected', message: 'Webhook was not accepted' })
  }
})
