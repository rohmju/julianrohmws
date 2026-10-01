import { systemPrompt } from './_context.js'

// POST /api/chat — the Ask Julian chatbot on the Windows 95 desktop. A thin proxy to the Gemini API
// so the key stays on the server. In development vite.config.js serves this same handler.
//
//   request   { messages: [{ role: 'user' | 'model', text }], minesweeper?: string }
//   response  { text } or { error }
//
// GEMINI_API_KEY is the (free tier) key from https://aistudio.google.com/apikey. GEMINI_MODEL
// optionally overrides the models, comma separated; each one is tried in turn while the previous one
// is out of free quota, unavailable or unknown.

// Flash-Lite first: it answers in 1-3 s (the bigger models take 6-12 s) and the Minesweeper logic
// is done by the solver anyway.
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.5-flash')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean)
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const MAX_TURNS = 20 // messages of history sent along
const MAX_CHARS = 2000 // per message
const MAX_BOARD_CHARS = 6000 // the Minesweeper board and its analysis
const MAX_BODY = 100_000
const TIMEOUT_MS = 25_000
const RETRYABLE = new Set([404, 429, 500, 503])

const send = (res, status, data) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

// Vercel parses JSON bodies; Vite's dev server hands over the raw stream.
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > MAX_BODY) throw new Error('Body too large')
  }
  return raw ? JSON.parse(raw) : {}
}

function toContents(messages) {
  const contents = (Array.isArray(messages) ? messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_CHARS) }] }))
  // Gemini wants the conversation to open with the user (the greeting is the client's own).
  while (contents[0]?.role === 'model') contents.shift()
  return contents
}

async function generate(model, payload, key) {
  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { status: response.status, error: data.error?.message ?? response.statusText }
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text)
    .join('')
    .trim()
  if (text) return { text }
  const blocked = data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY'
  return { text: blocked ? "Sorry, I can't help with that one." : 'Hmm, I drew a blank. Could you ask that again?' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return send(res, 405, { error: 'Method not allowed' })
  }
  const key = process.env.GEMINI_API_KEY
  if (!key) return send(res, 503, { error: 'Ask Julian is not set up yet: the server has no GEMINI_API_KEY.' })

  let body
  try {
    body = await readBody(req)
  } catch {
    return send(res, 400, { error: 'Bad request' })
  }
  const contents = toContents(body?.messages)
  if (contents.at(-1)?.role !== 'user') return send(res, 400, { error: 'Bad request' })
  const board = typeof body.minesweeper === 'string' ? body.minesweeper.slice(0, MAX_BOARD_CHARS) : null

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt(board) }] },
    contents,
    // Low thinking keeps replies to a few seconds instead of ~10-30 s; chat answers don't need more.
    generationConfig: { temperature: 0.6, thinkingConfig: { thinkingLevel: 'low' } },
  }
  const { thinkingConfig, ...withoutThinking } = payload.generationConfig

  let last = { status: 502, error: 'No model available' }
  for (const model of MODELS) {
    try {
      last = await generate(model, payload, key)
      // A model that can't set its thinking level gets the request again without it.
      if (last.status === 400 && /thinking/i.test(last.error)) last = await generate(model, { ...payload, generationConfig: withoutThinking }, key)
    } catch (error) {
      last = { status: 504, error: error.name === 'TimeoutError' ? 'Gemini took too long to answer' : error.message }
    }
    if (last.text) return send(res, 200, { text: last.text })
    if (!RETRYABLE.has(last.status)) break
  }
  console.error('[api/chat] Gemini failed:', last.status, last.error)
  if (last.status === 429) return send(res, 429, { error: 'Ask Julian has used up its free quota for now. Please try again in a minute.' })
  return send(res, 502, { error: 'Ask Julian could not reach its brain. Please try again.' })
}
