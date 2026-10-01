import { useRef, useState } from 'react'
import { useWin95 } from '../context.js'
import MenuBar from '../components/MenuBar.jsx'
import Icon from '../icons.jsx'

export const HOME = 'about:home'

// Sites that allow being shown inside a frame; most others refuse and the frame stays blank.
const search = (query) => `https://www.google.com/search?igu=1&q=${encodeURIComponent(query)}`
const SEARCH_PAGE = 'https://www.google.com/webhp?igu=1'
const wayback = (year, url) => `https://web.archive.org/web/${year}/${url}`

const FAVORITES = [
  { label: 'Microsoft (1996)', url: wayback(1996, 'http://www.microsoft.com/') },
  { label: 'Yahoo! (1996)', url: wayback(1996, 'http://www.yahoo.com/') },
  { label: 'Google (1998)', url: wayback(1998, 'http://www.google.com/') },
  { label: 'Apple (1997)', url: wayback(1997, 'http://www.apple.com/') },
  { label: 'Windows 95 - Wikipedia', url: 'https://en.wikipedia.org/wiki/Windows_95' },
]

// What the address bar makes of what was typed: a page, a web address, or a search.
export function resolveAddress(input) {
  const text = input.trim()
  if (!text || text.toLowerCase() === HOME) return HOME
  if (/^https?:\/\//i.test(text)) return text.replace(/^http:/i, 'https:')
  if (!/\s/.test(text) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(text)) return `https://${text}`
  return search(text)
}

// What a page may use: autoplay, the gamepad and so on.
const FRAME_ALLOW = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; gamepad; web-share'
const FRAME_SANDBOX =
  'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals allow-pointer-lock allow-presentation allow-downloads'

const Arrow = ({ flip }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" shapeRendering="crispEdges" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path fill="currentColor" d="M3 10l7-7v4h7v6h-7v4z" />
  </svg>
)

const TOOLBAR_GLYPHS = {
  stop: <path fill="#c00000" d="M6 2h8l4 4v8l-4 4H6l-4-4V6zM7 6l-1 1 3 3-3 3 1 1 3-3 3 3 1-1-3-3 3-3-1-1-3 3z" />,
  refresh: <path fill="currentColor" d="M10 3a7 7 0 1 0 7 7h-2.5a4.5 4.5 0 1 1-1.3-3.2L11 9h6V3l-2 2A7 7 0 0 0 10 3z" />,
  home: <path fill="currentColor" d="M10 2l8 7h-2v8h-4v-5H8v5H4V9H2z" />,
  search: <path fill="currentColor" d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm4.5 8.5l2-2 4 4-2 2z" />,
}

function ToolButton({ label, glyph, disabled, onClick }) {
  return (
    <button type="button" className="w95-browser__tool" disabled={disabled} onClick={onClick}>
      {typeof glyph === 'string' ? (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          {TOOLBAR_GLYPHS[glyph]}
        </svg>
      ) : (
        glyph
      )}
      <span>{label}</span>
    </button>
  )
}

// The start page: a search box and a few places worth visiting.
function HomePage({ onNavigate }) {
  const [query, setQuery] = useState('')
  return (
    <div className="w95-browser__home">
      <h1>Welcome to the Internet!</h1>
      <p>You are surfing with Microsoft Internet Explorer on Windows 95.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (query.trim()) onNavigate(search(query))
        }}
      >
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search the Web" placeholder="Search the Web" />
        <button type="submit">Search</button>
      </form>
      <h2>Travel back in time</h2>
      <ul>
        {FAVORITES.map((fav) => (
          <li key={fav.url}>
            <a
              href={fav.url}
              onClick={(event) => {
                event.preventDefault()
                onNavigate(fav.url)
              }}
            >
              {fav.label}
            </a>
          </li>
        ))}
      </ul>
      <hr />
      <p className="w95-browser__note">
        Many modern web sites refuse to be shown inside another page. If one stays blank, choose <b>File &rarr; Open in New Window</b>.
      </p>
    </div>
  )
}

// Internet Explorer: toolbar, address bar and the page, which is a real web page in a frame.
// The history only knows the addresses opened from here; links followed inside a page stay in it.
export default function Browser({ win, props }) {
  const { api } = useWin95()
  const [history, setHistory] = useState(() => ({ entries: [resolveAddress(props.url ?? HOME)], at: 0 }))
  const url = history.entries[history.at]
  const [address, setAddress] = useState(url)
  const [loading, setLoading] = useState(url !== HOME)
  const [reload, setReload] = useState(0)
  const frameRef = useRef(null)
  const go = (next) => {
    setHistory(({ entries, at }) => ({ entries: [...entries.slice(0, at + 1), next], at: at + 1 }))
    setAddress(next)
    setLoading(next !== HOME)
  }
  const step = (delta) => {
    const at = history.at + delta
    if (at < 0 || at >= history.entries.length) return
    setHistory({ ...history, at })
    setAddress(history.entries[at])
    setLoading(history.entries[at] !== HOME)
  }
  const refresh = () => {
    if (url === HOME) return
    setReload((n) => n + 1)
    setLoading(true)
  }
  const stop = () => {
    try {
      frameRef.current?.contentWindow?.stop()
    } catch {
      // A cross-origin page can't be told to stop; the indicator stops all the same.
    }
    setLoading(false)
  }
  const openOutside = () => {
    if (url !== HOME) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const menus = [
    {
      label: '&File',
      items: [
        { label: '&New Window', onSelect: () => api.open('browser', { url }) },
        { label: 'Open in New &Window', disabled: url === HOME, onSelect: openOutside },
        '-',
        { label: '&Close', onSelect: () => api.close(win.id) },
      ],
    },
    {
      label: '&View',
      items: [
        { label: '&Stop', shortcut: 'Esc', onSelect: stop },
        { label: '&Refresh', shortcut: 'F5', disabled: url === HOME, onSelect: refresh },
      ],
    },
    {
      label: '&Go',
      items: [
        { label: '&Back', disabled: history.at === 0, onSelect: () => step(-1) },
        { label: '&Forward', disabled: history.at === history.entries.length - 1, onSelect: () => step(1) },
        '-',
        { label: '&Start Page', onSelect: () => go(HOME) },
        { label: 'Search the &Web', onSelect: () => go(SEARCH_PAGE) },
      ],
    },
    {
      label: 'F&avorites',
      items: FAVORITES.map((fav) => ({ label: fav.label, onSelect: () => go(fav.url) })),
    },
    {
      label: '&Help',
      items: [{ label: '&Help Topics', onSelect: () => api.run('help') }, '-', { label: '&About Internet Explorer', onSelect: () => api.about('Internet Explorer') }],
    },
  ]

  return (
    <div
      className="w95-app w95-browser"
      onKeyDown={(event) => {
        if (event.key === 'F5') {
          event.preventDefault()
          refresh()
        } else if (event.key === 'Escape') stop()
      }}
    >
      <MenuBar menus={menus} />
      <div className="w95-browser__toolbar">
        <ToolButton label="Back" glyph={<Arrow />} disabled={history.at === 0} onClick={() => step(-1)} />
        <ToolButton label="Forward" glyph={<Arrow flip />} disabled={history.at === history.entries.length - 1} onClick={() => step(1)} />
        <ToolButton label="Stop" glyph="stop" disabled={!loading} onClick={stop} />
        <ToolButton label="Refresh" glyph="refresh" disabled={url === HOME} onClick={refresh} />
        <ToolButton label="Home" glyph="home" onClick={() => go(HOME)} />
        <ToolButton label="Search" glyph="search" onClick={() => go(SEARCH_PAGE)} />
        <span className={`w95-browser__throbber ${loading ? 'is-loading' : ''}`} aria-hidden="true">
          <Icon name="windows" size={16} />
        </span>
      </div>
      <form
        className="w95-browser__address"
        onSubmit={(event) => {
          event.preventDefault()
          go(resolveAddress(address))
        }}
      >
        <label htmlFor={`w95-address-${win.id}`}>Address</label>
        <input
          id={`w95-address-${win.id}`}
          className="w95-input"
          value={address}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setAddress(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        <button type="submit" className="w95-button w95-browser__go">
          Go
        </button>
      </form>
      <div className="w95-well w95-browser__page">
        {url === HOME ? (
          <HomePage onNavigate={go} />
        ) : (
          <iframe
            key={`${history.at}:${reload}`}
            ref={frameRef}
            src={url}
            title={url}
            sandbox={FRAME_SANDBOX}
            allow={FRAME_ALLOW}
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
          />
        )}
      </div>
      <div className="w95-statusbar">
        <span className="w95-statusbar__field">{loading ? `Opening page ${url}...` : 'Done'}</span>
        <span className="w95-statusbar__field">Internet zone</span>
      </div>
    </div>
  )
}
