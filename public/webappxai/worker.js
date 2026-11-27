// Pilot 003 uses a 128-token inference window and greedy decoding.
const contextTokens = 128
const maxReplyTokens = 48
const systemPrompt = '<|system|>You are WebAppX AI. Give a short answer about this template.<|end|>'

let runtime
let session
let tokenizer
let busy = false
let stopped = false

async function load({ model, tokenizer: tokenizerSpec, wasm }) {
  if (!(model instanceof ArrayBuffer) || !(wasm instanceof ArrayBuffer) || !tokenizerSpec?.model) {
    throw new Error('The research pilot files are incomplete.')
  }

  const [ort, { Tokenizer }] = await Promise.all([
    import('./runtime/ort.wasm.bundle.min.mjs'),
    import('./runtime/tokenizers.mjs'),
  ])
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmBinary = wasm
  const decoder = new Tokenizer(tokenizerSpec, {
    model_max_length: contextTokens,
    unk_token: '<|unk|>',
    pad_token: '<|pad|>',
    eos_token: '<|end|>',
  })
  const loaded = await ort.InferenceSession.create(new Uint8Array(model), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
  runtime = ort
  session = loaded
  tokenizer = decoder
}

async function nextToken(ids) {
  const context = ids.slice(-contextTokens)
  const input = new runtime.Tensor('int64', BigInt64Array.from(context, BigInt), [1, context.length])
  let outputs
  try {
    outputs = await session.run({ input_ids: input })
    const logits = outputs.logits
    const vocabulary = logits.dims[2]
    const offset = (context.length - 1) * vocabulary
    let best = 0
    for (let i = 1; i < vocabulary; i++) {
      if (logits.data[offset + i] > logits.data[offset + best]) best = i
    }
    return best
  } finally {
    for (const output of Object.values(outputs ?? {})) output.dispose()
    input.dispose()
  }
}

async function generate(messages) {
  if (!Array.isArray(messages) || messages.at(-1)?.role !== 'user') {
    throw new Error('Enter a question for the research pilot.')
  }
  const turns = messages.slice(-8).map(({ role, content }) => {
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      throw new Error('Invalid chat history.')
    }
    return '<|' + role + '|>' + content.slice(-4096) + '<|end|>'
  })
  const ids = tokenizer.encode(systemPrompt + turns.join('') + '<|assistant|>').ids
  const generated = []
  let text = ''
  stopped = false
  while (!stopped && generated.length < maxReplyTokens) {
    const token = await nextToken(ids)
    // The trained tokenizer defines <|eos|> as 1 and <|end|> as 5.
    if (stopped || token === 1 || token === 5) break
    generated.push(token)
    ids.push(token)
    text = tokenizer.decode(generated, { skip_special_tokens: true })
    self.postMessage({ type: 'chunk', text })
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  self.postMessage({ type: 'done', text, stopped })
}

self.onmessage = async ({ data }) => {
  if (data.type === 'stop') {
    stopped = true
    return
  }
  if (busy) return
  busy = true
  try {
    if (data.type === 'load') {
      if (!session) await load(data)
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'generate' && session) {
      await generate(data.messages)
    } else {
      throw new Error('Load the research pilot first.')
    }
  } catch {
    self.postMessage({
      type: 'error',
      message: data.type === 'load'
        ? 'The browser could not start the local research model. Reload the model to retry.'
        : 'The local model could not complete this reply.',
    })
  } finally {
    busy = false
  }
}
