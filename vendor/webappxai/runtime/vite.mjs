import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ort = dirname(require.resolve('onnxruntime-web/wasm'))
const tokenizers = dirname(require.resolve('@huggingface/tokenizers'))
const root = dirname(fileURLToPath(import.meta.url))
const prefix = '/webappxai/'
const files = new Map([
  ['worker.js', join(root, 'worker.js')],
  ['WebAppX-LICENSE.txt', join(root, 'licenses', 'WebAppX-LICENSE.txt')],
  ['ONNX-Runtime-LICENSE.txt', join(root, 'licenses', 'ONNX-Runtime-LICENSE.txt')],
  ['ONNX-Runtime-ThirdPartyNotices.txt', join(root, 'licenses', 'ONNX-Runtime-ThirdPartyNotices.txt')],
  ['runtime/ort.wasm.bundle.min.mjs', join(ort, 'ort.wasm.bundle.min.mjs')],
  ['runtime/ort-wasm-simd-threaded.mjs', join(ort, 'ort-wasm-simd-threaded.mjs')],
  ['runtime/ort-wasm-simd-threaded.wasm', join(ort, 'ort-wasm-simd-threaded.wasm')],
  ['runtime/tokenizers.mjs', join(tokenizers, 'tokenizers.mjs')],
  ['runtime/tokenizers-LICENSE.txt', join(tokenizers, '..', 'LICENSE')],
])

export const workerCsp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'"

function workerHeaders(request, response, next) {
  if (request.url?.split('?')[0] === prefix + 'worker.js') {
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
          if (file) response.setHeader('Allow', 'GET, HEAD')
          return response.end()
        }
        const mime = name.endsWith('.wasm') ? 'application/wasm'
          : name.endsWith('.txt') ? 'text/plain' : 'text/javascript'
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
        this.emitFile({ type: 'asset', fileName: 'webappxai/' + name, source: await readFile(path) })
      }
    },
  }
}
