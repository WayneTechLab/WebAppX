import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { HrError, identifier } from './security.mjs'

export const WEBHOOK_MAX_BYTES = 262144

// The provider guide specifies SHA256 HMAC but not its wire encoding. Hex is our
// tested mock contract; a real receiver requires a verified Demo encoding first.
export function verifyWebhookHex(rawBody, signature, verificationToken) {
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || rawBody.length > WEBHOOK_MAX_BYTES) throw new HrError('invalid-argument', 'Invalid webhook body')
  if (typeof verificationToken !== 'string' || verificationToken.length < 16) throw new HrError('failed-precondition', 'Webhook verification secret is not configured')
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) throw new HrError('permission-denied', 'Invalid webhook signature')
  const expected = createHmac('sha256', verificationToken).update(rawBody).digest()
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new HrError('permission-denied', 'Webhook signature does not match')
  return createHash('sha256').update(rawBody).digest('hex')
}

export function webhookEnvelope(rawBody, signature, verificationToken, expectedCompanyUuid, nowSeconds = Math.floor(Date.now() / 1000), existing = null) {
  identifier(expectedCompanyUuid, 'company ID')
  const bodyHash = verifyWebhookHex(rawBody, signature, verificationToken)
  let event
  try { event = JSON.parse(rawBody.toString('utf8')) } catch { throw new HrError('invalid-argument', 'Webhook body is not JSON') }
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new HrError('invalid-argument', 'Invalid webhook event')
  const eventId = identifier(event.uuid, 'event ID')
  if (event.resource_type !== 'Company' || event.resource_uuid !== expectedCompanyUuid) throw new HrError('permission-denied', 'Webhook company does not match the configured tenant')
  identifier(event.entity_uuid, 'entity ID')
  if (typeof event.event_type !== 'string' || !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*$/.test(event.event_type) || event.event_type.length > 100) throw new HrError('invalid-argument', 'Invalid event type')
  if (!Number.isSafeInteger(event.timestamp)) throw new HrError('invalid-argument', 'Invalid event timestamp')
  if (existing) {
    if (existing.eventId !== eventId || existing.bodyHash !== bodyHash) throw new HrError('already-exists', 'Event ID was reused with different content')
    return { duplicate: true, eventId }
  }
  // Four days accommodates Gusto's documented three day delivery retry window.
  if (event.timestamp > nowSeconds + 300 || event.timestamp < nowSeconds - 4 * 86400) throw new HrError('permission-denied', 'Webhook event is outside the accepted retry window')
  return {
    duplicate: false, eventId, bodyHash, companyUuid: event.resource_uuid,
    entityUuid: event.entity_uuid, entityType: typeof event.entity_type === 'string' ? event.entity_type.slice(0, 64) : '',
    eventType: event.event_type, occurredAtSeconds: event.timestamp,
    receivedAtSeconds: nowSeconds, state: 'pending-reconciliation', attempts: 0,
  }
}

export async function persistWebhook(services, args) {
  identifier(args.orgId, 'organization ID')
  // HMAC and company binding happen before reading or writing the trusted inbox.
  const candidate = webhookEnvelope(args.rawBody, args.signature, args.verificationToken, args.companyUuid, args.nowSeconds)
  return services.transaction(async inbox => {
    const existing = await inbox.get(args.orgId, candidate.eventId)
    if (existing) return webhookEnvelope(args.rawBody, args.signature, args.verificationToken, args.companyUuid, args.nowSeconds, existing)
    const { duplicate: _duplicate, ...record } = candidate
    await inbox.create(args.orgId, candidate.eventId, { ...record, orgId: args.orgId })
    return { duplicate: false, eventId: candidate.eventId, queued: true }
  })
}
