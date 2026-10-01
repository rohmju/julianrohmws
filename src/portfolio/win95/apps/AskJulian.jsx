import { useEffect, useRef, useState } from 'react'
import { useShared, useWin95 } from '../context.js'
import MenuBar from '../components/MenuBar.jsx'
import { describeMinesweeper, readHints } from './minesweeperHints.js'

const GREETING = {
  role: 'model',
  text: "Hi! I'm Ask Julian. Ask me anything about Julian: his departments, skills and projects. Or anything else. Got Minesweeper open? I can give you hints.",
}
const SUGGESTIONS = ['What are Julian’s skills?', 'Which departments has he worked in?', 'Give me a Minesweeper hint']

// Gemini sometimes answers in Markdown; the window shows plain text.
const plain = (text) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ')

const minesweeperOpen = (game) => Boolean(game)

// A chat program backed by Gemini (via /api/chat). It knows about Julian from the server and, when
// Minesweeper runs on the desktop, sees the board the player sees.
export default function AskJulian({ win, active }) {
  const { api } = useWin95()
  const [messages, setMessages] = useState([GREETING])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const playing = useShared('minesweeper', minesweeperOpen)
  const logRef = useRef(null)
  const inputRef = useRef(null)
  const request = useRef(null)

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, busy])
  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true })
  }, [active, busy])

  const send = async (text) => {
    const question = text.trim()
    if (!question || busy) return
    const history = [...messages, { role: 'user', text: question }]
    setMessages(history)
    setDraft('')
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const game = api.peek('minesweeper')
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, minesweeper: game ? describeMinesweeper(game) : undefined }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.text) throw new Error(data.error ?? 'Ask Julian could not be reached. Please try again.')
      // Checked against the board as it is now, which may have moved on while Gemini was thinking.
      const { text: answer, hint } = readHints(data.text, api.peek('minesweeper'))
      if (hint) api.share('minesweeper-hint', hint)
      setMessages([...history, { role: 'model', text: plain(answer) }])
    } catch (error) {
      if (error.name === 'AbortError') return
      // The question goes back into the box, ready to send again.
      setMessages(messages)
      setDraft(question)
      api.message({ title: 'Ask Julian', icon: 'error', text: error.message })
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }

  const clear = () => {
    request.current?.abort()
    request.current = null
    setBusy(false)
    api.share('minesweeper-hint', null)
    setMessages([GREETING])
    setDraft('')
  }

  const menus = [
    {
      label: '&File',
      items: [{ label: '&New Conversation', onSelect: clear }, '-', { label: 'E&xit', onSelect: () => api.close(win.id) }],
    },
    {
      label: '&Help',
      items: [{ label: '&About Ask Julian', onSelect: () => api.about('Ask Julian') }],
    },
  ]

  return (
    <div className="w95-app w95-chat">
      <MenuBar menus={menus} />
      <div className="w95-well">
        <div className="w95-chat__log" ref={logRef} role="log" aria-live="polite" aria-busy={busy}>
          {messages.map((message, i) => (
            <p key={i} className={`w95-chat__message is-${message.role}`}>
              <b>{message.role === 'user' ? 'You' : 'Ask Julian'}:</b> {message.text}
            </p>
          ))}
          {busy && <p className="w95-chat__typing">Ask Julian is typing…</p>}
          {messages.length === 1 && !busy && (
            <div className="w95-chat__suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className="w95-button" onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <form
        className="w95-chat__compose"
        onSubmit={(event) => {
          event.preventDefault()
          send(draft)
        }}
      >
        <textarea
          ref={inputRef}
          className="w95-input w95-chat__input"
          value={draft}
          rows={2}
          maxLength={2000}
          placeholder="Type a message…"
          aria-label="Message to Ask Julian"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            send(draft)
          }}
        />
        <button type="submit" className="w95-button is-default" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
      <div className="w95-statusbar">
        <span className="w95-statusbar__field">{busy ? 'Thinking…' : 'Ready'}</span>
        <span className="w95-statusbar__field">Minesweeper: {playing ? 'connected' : 'not running'}</span>
      </div>
    </div>
  )
}
