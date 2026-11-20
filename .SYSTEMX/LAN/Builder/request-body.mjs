import { performance } from 'node:perf_hooks'
import { StringDecoder } from 'node:string_decoder'

export const requestBodyLimits = Object.freeze({
  maxBytes: 3_000_000,
  maxTextUnits: 1_000_000,
  timeoutMs: 15_000,
})

const failures = {
  REQUEST_BODY_TOO_LARGE: [400, 'Request body exceeds local builder limit', false, true],
  REQUEST_BODY_INVALID_JSON: [400, 'Request body must be valid JSON', false, false],
  REQUEST_BODY_INCOMPLETE: [400, 'Request body was not received completely', true, true],
  REQUEST_BODY_TIMEOUT: [408, 'Request body was not received before the local deadline', true, true],
}

export class RequestBodyError extends Error {
  constructor(code) {
    const [statusCode, message, retryable, closeConnection] = failures[code]
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.retryable = retryable
    this.closeConnection = closeConnection
  }
}

// Receive raw IncomingMessage bytes. The caller closes the HTTP connection after
// sending an early refusal so unread bytes cannot be reused for another request.
export function readRequestBody(request, { timeoutMs = requestBodyLimits.timeoutMs } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new RangeError('Use a positive, bounded request read timeout in milliseconds.')
  }
  const deadline = performance.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8')
    let body = ''
    let bytes = 0
    let declaredBytes
    let timer

    function cleanup() {
      clearTimeout(timer)
      request.off('data', onData)
      request.off('end', onEnd)
      request.off('aborted', onInterrupted)
      request.off('close', onInterrupted)
      request.off('error', onInterrupted)
      body = ''
    }

    function fail(code) {
      const error = new RequestBodyError(code)
      cleanup()
      if (error.closeConnection) request.pause()
      reject(error)
    }

    function onInterrupted() {
      fail('REQUEST_BODY_INCOMPLETE')
    }

    function onTimer() {
      const remaining = deadline - performance.now()
      if (remaining <= 0) fail('REQUEST_BODY_TIMEOUT')
      else timer = setTimeout(onTimer, Math.ceil(remaining))
    }

    function append(text) {
      if (body.length + text.length > requestBodyLimits.maxTextUnits) {
        fail('REQUEST_BODY_TOO_LARGE')
        return false
      }
      body += text
      return true
    }

    function onData(chunk) {
      if (performance.now() >= deadline) return fail('REQUEST_BODY_TIMEOUT')
      // An already-decoded or object-mode stream cannot establish the wire size.
      if (!(chunk instanceof Uint8Array)) return onInterrupted()
      bytes += chunk.byteLength
      if (bytes > requestBodyLimits.maxBytes) return fail('REQUEST_BODY_TOO_LARGE')
      if (declaredBytes !== undefined && bytes > declaredBytes) return onInterrupted()
      append(decoder.write(chunk))
    }

    function onEnd() {
      if (performance.now() >= deadline) return fail('REQUEST_BODY_TIMEOUT')
      if (request.complete === false || (declaredBytes !== undefined && bytes !== declaredBytes)) return onInterrupted()
      if (!append(decoder.end())) return
      let value
      try { value = body ? JSON.parse(body) : {} }
      catch { return fail('REQUEST_BODY_INVALID_JSON') }
      cleanup()
      resolve(value)
    }

    if (request.destroyed || request.aborted || request.readableEnded || request.readableEncoding) return onInterrupted()
    const declared = request.headers?.['content-length']
    if (declared !== undefined) {
      if (typeof declared !== 'string' || !/^\d+$/.test(declared)) return onInterrupted()
      declaredBytes = Number(declared)
      if (declaredBytes > requestBodyLimits.maxBytes) return fail('REQUEST_BODY_TOO_LARGE')
    }
    timer = setTimeout(onTimer, timeoutMs)
    request.once('end', onEnd)
    request.once('aborted', onInterrupted)
    request.once('close', onInterrupted)
    request.once('error', onInterrupted)
    request.on('data', onData)
  })
}
