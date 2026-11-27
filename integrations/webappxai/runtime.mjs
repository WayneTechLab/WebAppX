import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const ort = dirname(require.resolve('onnxruntime-web/wasm'))
const tokenizers = dirname(require.resolve('@huggingface/tokenizers'))
// onnxruntime-web omits license files. public/webappxai includes the unmodified
// LICENSE and ThirdPartyNotices.txt from Microsoft's matching onnxruntime 1.31.1 release.
const files = new Map([
  ['ort.wasm.bundle.min.mjs', join(ort, 'ort.wasm.bundle.min.mjs')],
  ['ort-wasm-simd-threaded.mjs', join(ort, 'ort-wasm-simd-threaded.mjs')],
  ['ort-wasm-simd-threaded.wasm', join(ort, 'ort-wasm-simd-threaded.wasm')],
  ['tokenizers.mjs', join(tokenizers, 'tokenizers.mjs')],
  ['tokenizers-LICENSE.txt', join(tokenizers, '..', 'LICENSE')],
])

const workerCsp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'"
const prefix = '/webappxai/runtime/'

function workerHeaders(request, response, next) {
  if (request.url?.split('?')[0] === '/webappxai/worker.js') {
    response.setHeader('Content-Security-Policy', workerCsp)
  }
  next()
}

export function webappxaiRuntimePlugin() {
  return {
    name: 'webappxai-local-runtime',
    configureServer(server) {
      server.middlewares.use(workerHeaders)
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0]
        if (!path?.startsWith(prefix)) return next()
        const name = path.slice(prefix.length)
        const file = files.get(name)
        if (!file || !['GET', 'HEAD'].includes(request.method)) {
          response.statusCode = file ? 405 : 404
          response.end()
          return
        }
        const mime = name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.wasm') ? 'application/wasm' : 'text/plain'
        response.setHeader('Content-Type', mime)
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader('Cache-Control', 'no-cache')
        if (request.method === 'HEAD') return response.end()
        createReadStream(file).on('error', next).pipe(response)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(workerHeaders)
    },
    async generateBundle() {
      for (const [name, path] of files) {
        this.emitFile({ type: 'asset', fileName: 'webappxai/runtime/' + name, source: await readFile(path) })
      }
    },
  }
}
