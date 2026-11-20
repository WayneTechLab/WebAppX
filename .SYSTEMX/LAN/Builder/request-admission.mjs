import { performance } from 'node:perf_hooks'

// One bucket for the entire loopback LAN process, shared across tabs and both
// LAN origins. Static assets and the inexpensive transport inspection routes and health do
// not consume it. A full bucket admits a burst of 256 API requests, then
// replenishes continuously at 64 per second. At most 16 can be in flight.
export const requestAdmissionLimits = Object.freeze({
  maxInFlight: 16,
  burst: 256,
  refillPerSecond: 64,
})

const freeReads = new Set(['/api/health', '/api/transport/diagnostics', '/api/transport/limits', '/api/transport/policy'])
const scope = 'local-session'

/**
 * Call admit once, after protocol and access checks and before reading a body
 * or dispatching. Call complete(response) when the handler settles. A slot is
 * held until BOTH that point and response finish/close, in either order.
 * A refusal never starts work. Its Retry-After is a delay before another
 * attempt can be made, not a promise that a concurrency slot will be free.
 */
export function createRequestAdmission({ now = () => performance.now() } = {}) {
  const { maxInFlight, burst, refillPerSecond } = requestAdmissionLimits
  const active = new WeakMap()
  let tokens = burst
  let lastRefill = now()
  let inFlight = 0

  function refill() {
    const time = now()
    if (time > lastRefill) {
      tokens = Math.min(burst, tokens + (time - lastRefill) * refillPerSecond / 1000)
      lastRefill = time
    }
  }

  function releaseIfSettled(response, slot) {
    if (slot.workDone && slot.transportDone && active.delete(response)) inFlight--
  }

  return {
    complete(response) {
      const slot = active.get(response)
      if (!slot) return
      slot.workDone = true
      releaseIfSettled(response, slot)
    },

    snapshot() {
      refill()
      return { schemaVersion: 1, scope, ...requestAdmissionLimits, inFlight, availableTokens: Math.floor(tokens) }
    },

    admit(pathname, response) {
      if (!pathname.startsWith('/api/') || freeReads.has(pathname) || active.has(response)) return null
      refill()
      if (inFlight >= maxInFlight) {
        return {
          code: 'REQUEST_CONCURRENCY_LIMIT', scope, retryAfterSeconds: 1,
          error: 'The local LAN session is at its in-flight limit. Wait for a request to finish before retrying.',
        }
      }
      if (tokens < 1) {
        return {
          code: 'REQUEST_RATE_LIMIT', scope, retryAfterSeconds: Math.ceil((1 - tokens) / refillPerSecond),
          error: 'The local LAN session reached its request rate limit. Wait before retrying.',
        }
      }

      tokens--
      inFlight++
      const slot = { workDone: false, transportDone: Boolean(response.writableFinished || response.destroyed) }
      active.set(response, slot)
      function transportEnded() {
        response.off('finish', transportEnded)
        response.off('close', transportEnded)
        slot.transportDone = true
        releaseIfSettled(response, slot)
      }
      if (!slot.transportDone) {
        response.once('finish', transportEnded)
        response.once('close', transportEnded)
      }
      return null
    },
  }
}
