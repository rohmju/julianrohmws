import { useEffect, useReducer, useRef, useState } from 'react'
import { useShared, useWin95 } from '../context.js'
import MenuBar from '../components/MenuBar.jsx'
import mineFace from './mine.png'

const LEVELS = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
}
const LONG_PRESS_MS = 400 // touch: holding a cell flags it
const TOUCH_SLOP = 10 // px a finger may move before a press counts as scrolling

// ---------------------------------------------------------------------------------------------
// Game rules

export function neighbours(index, { rows, cols }) {
  const row = Math.floor(index / cols)
  const col = index % cols
  const out = []
  for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
      if (r !== row || c !== col) out.push(r * cols + c)
    }
  }
  return out
}

let games = 0

function newGame(level, marks) {
  const { rows, cols, mines } = LEVELS[level]
  return {
    id: ++games, // Ask Julian's hints belong to one game
    level,
    rows,
    cols,
    mines,
    marks,
    status: 'ready',
    seconds: 0,
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, count: 0, state: 'hidden' })),
  }
}

// Mines are laid on the first click, so the first cell opened is never one.
function layMines(game, safe) {
  const cells = game.cells.map((cell) => ({ ...cell }))
  for (let placed = 0; placed < game.mines; ) {
    const i = Math.floor(Math.random() * cells.length)
    if (i === safe || cells[i].mine) continue
    cells[i].mine = true
    placed++
  }
  cells.forEach((cell, i) => {
    cell.count = neighbours(i, game).filter((n) => cells[n].mine).length
  })
  return cells
}

// Opens a cell in `cells` (a fresh copy) and floods outward from every blank one.
function flood(game, cells, start) {
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()
    const cell = cells[i]
    if (cell.state === 'revealed' || cell.state === 'flagged') continue
    cell.state = 'revealed'
    if (!cell.mine && cell.count === 0) stack.push(...neighbours(i, game))
  }
}

function lose(game, cells, hit) {
  for (const cell of cells) {
    if (cell.mine && cell.state !== 'flagged') cell.state = 'revealed'
    if (!cell.mine && cell.state === 'flagged') cell.state = 'wrong'
  }
  cells[hit].exploded = true
  return { ...game, cells, status: 'lost' }
}

function settle(game, cells) {
  if (!cells.every((cell) => cell.mine || cell.state === 'revealed')) return { ...game, cells }
  return { ...game, status: 'won', cells: cells.map((cell) => (cell.mine ? { ...cell, state: 'flagged' } : cell)) }
}

const hidden = (cell) => cell.state === 'hidden' || cell.state === 'question'
const FLAG_CYCLE = { hidden: 'flagged', flagged: 'question', question: 'hidden' }

function play(game, action) {
  const over = game.status === 'won' || game.status === 'lost'
  switch (action.type) {
    case 'new':
      return newGame(action.level ?? game.level, game.marks)
    case 'marks':
      return { ...game, marks: !game.marks }
    case 'tick':
      return game.status === 'playing' ? { ...game, seconds: Math.min(999, game.seconds + 1) } : game
    case 'reveal': {
      if (over || !hidden(game.cells[action.index])) return game
      const first = game.status === 'ready'
      const cells = first ? layMines(game, action.index) : game.cells.map((cell) => ({ ...cell }))
      const next = first ? { ...game, status: 'playing', seconds: 1 } : game
      if (cells[action.index].mine) return lose(next, cells, action.index)
      flood(game, cells, action.index)
      return settle(next, cells)
    }
    // Opens every unflagged neighbour of a number once as many flags surround it.
    case 'chord': {
      const target = game.cells[action.index]
      if (game.status !== 'playing' || target.state !== 'revealed' || target.count === 0) return game
      const around = neighbours(action.index, game)
      if (around.filter((n) => game.cells[n].state === 'flagged').length !== target.count) return game
      const cells = game.cells.map((cell) => ({ ...cell }))
      for (const n of around) {
        if (!hidden(cells[n])) continue
        if (cells[n].mine) return lose(game, cells, n)
        flood(game, cells, n)
      }
      return settle(game, cells)
    }
    case 'flag': {
      const target = game.cells[action.index]
      if (over || target.state === 'revealed') return game
      let state = FLAG_CYCLE[target.state]
      if (state === 'question' && !game.marks) state = 'hidden'
      const cells = game.cells.slice()
      cells[action.index] = { ...target, state }
      return { ...game, cells }
    }
    default:
      return game
  }
}

// ---------------------------------------------------------------------------------------------
// Pixel parts: LED digits, the face, flags and mines

const SEGMENTS = {
  a: 'M3 0h7v2H3z',
  b: 'M10 2h2v8h-2z',
  c: 'M10 12h2v8h-2z',
  d: 'M3 20h7v2H3z',
  e: 'M1 12h2v8H1z',
  f: 'M1 2h2v8H1z',
  g: 'M3 10h7v2H3z',
}
const DIGITS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
}

function Led({ value }) {
  const n = Math.max(-99, Math.min(999, value))
  const text = n < 0 ? `-${String(-n).padStart(2, '0')}` : String(n).padStart(3, '0')
  return (
    <span className="w95-led" role="img" aria-label={String(value)}>
      {[...text].map((char, i) => (
        <svg key={i} width="13" height="23" viewBox="0 0 13 23" shapeRendering="crispEdges" aria-hidden="true">
          {Object.entries(SEGMENTS).map(([segment, d]) => (
            <path key={segment} d={d} fill={DIGITS[char].includes(segment) ? '#ff0000' : '#400000'} />
          ))}
        </svg>
      ))}
    </span>
  )
}

const EYES = {
  open: 'M5 5h2v2H5zM10 5h2v2h-2z',
  dead: 'M4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6zM10 4h1v1h-1zM12 4h1v1h-1zM11 5h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1z',
  cool: 'M3 5h11v1H3zM4 6h4v2H4zM9 6h4v2H9z',
}
const SMILE = 'M5 10h1v1H5zM6 11h1v1H6zM7 12h3v1H7zM10 11h1v1h-1zM11 10h1v1h-1z'
const FROWN = 'M7 11h3v1H7zM6 12h1v1H6zM10 12h1v1h-1zM5 13h1v1H5zM11 13h1v1h-1z'

function Face({ mood }) {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" shapeRendering="crispEdges" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="8" fill="#ffff00" stroke="#000" />
      <path d={mood === 'dead' ? EYES.dead : mood === 'cool' ? EYES.cool : EYES.open} />
      {mood === 'oh' ? (
        <circle cx="8.5" cy="11.5" r="1.6" fill="none" stroke="#000" />
      ) : (
        <path d={mood === 'dead' ? FROWN : SMILE} />
      )}
    </svg>
  )
}

const Flag = () => (
  <svg width="10" height="11" viewBox="0 0 10 11" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="#ff0000" d="M4 0h1v5H4zM2 1h2v3H2zM1 2h1v1H1z" />
    <path d="M5 0h1v8H5zM3 8h4v1H3zM1 9h8v2H1z" />
  </svg>
)

// "bazuki=true" in the MS-DOS Prompt swaps the bomb for a face.
const Mine = ({ crossed = false }) => {
  const bazuki = useShared('bazuki')
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" shapeRendering={bazuki ? undefined : 'crispEdges'} aria-hidden="true">
      {bazuki ? (
        <image href={mineFace} width="13" height="13" preserveAspectRatio="xMidYMid slice" />
      ) : (
        <>
          <path d="M6 0h1v13H6zM0 6h13v1H0zM2 2h1v1H2zM10 2h1v1h-1zM2 10h1v1H2zM10 10h1v1h-1z" />
          <circle cx="6.5" cy="6.5" r="4" />
          <path fill="#fff" d="M4 4h2v2H4z" />
        </>
      )}
      {crossed && <path stroke="#ff0000" strokeWidth="1.5" d="M1 1l11 11M12 1L1 12" />}
    </svg>
  )
}

function cellContent(cell) {
  if (cell.state === 'flagged') return <Flag />
  if (cell.state === 'question') return '?'
  if (cell.state === 'wrong') return <Mine crossed />
  if (cell.state !== 'revealed') return null
  if (cell.mine) return <Mine />
  return cell.count ? <b className={`w95-mines__n${cell.count}`}>{cell.count}</b> : null
}

const HINT_LABEL = { safe: 'hint: safe to open', mine: 'hint: a mine, flag it', guess: 'hint: best guess' }

function cellLabel(cell, index, cols, hint) {
  const where = `Row ${Math.floor(index / cols) + 1}, column ${(index % cols) + 1}`
  if (cell.state === 'flagged') return `${where}, flagged`
  if (cell.state === 'revealed') return `${where}, ${cell.mine ? 'mine' : cell.count || 'empty'}`
  return hint ? `${where}, covered, ${HINT_LABEL[hint]}` : `${where}, covered`
}

// ---------------------------------------------------------------------------------------------

export default function Minesweeper({ win, active }) {
  const { api, coarsePointer } = useWin95()
  const [game, dispatch] = useReducer(play, undefined, () => newGame('beginner', true))
  // The cell held down, which draws pressed (with its neighbours when chording).
  const [pressed, setPressed] = useState(null)
  const touch = useRef(null)

  // Ask Julian reads the game to give hints (it only ever looks at what the player can see), and its
  // hints blink on the board until the square is opened or flagged.
  useEffect(() => api.share('minesweeper', game), [api, game])
  useEffect(() => () => api.share('minesweeper', null), [api])
  const hint = useShared('minesweeper-hint')
  const hintAt = (i) => (hint?.game === game.id && hidden(game.cells[i]) ? hint.cells[i] : undefined)

  useEffect(() => {
    if (game.status !== 'playing') return
    const timer = setInterval(() => dispatch({ type: 'tick' }), 1000)
    return () => clearInterval(timer)
  }, [game.status])

  useEffect(() => {
    if (!active) return
    const onKey = (event) => {
      if (event.key !== 'F2') return
      event.preventDefault()
      dispatch({ type: 'new' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const over = game.status === 'won' || game.status === 'lost'
  const cellAt = (event) => {
    const cell = event.target.closest?.('[data-cell]')
    return cell ? Number(cell.dataset.cell) : null
  }

  // Mouse: left opens, right flags, both (or the middle button) chord.
  const onMouseDown = (event) => {
    const index = cellAt(event)
    if (index === null || over) return
    if (event.button === 2) {
      if (event.buttons & 1) setPressed({ index, chord: true })
      else dispatch({ type: 'flag', index })
    } else if (event.button === 1) {
      event.preventDefault()
      setPressed({ index, chord: true })
    } else if (event.button === 0) {
      setPressed({ index, chord: (event.buttons & 2) !== 0 })
    }
  }
  const onMouseOver = (event) => {
    const index = cellAt(event)
    if (pressed && index !== null && index !== pressed.index) setPressed({ ...pressed, index })
  }
  const onMouseUp = () => {
    if (!pressed) return
    dispatch({ type: pressed.chord ? 'chord' : 'reveal', index: pressed.index })
    setPressed(null)
  }

  // Touch: a tap opens (or chords on a number), a long press flags.
  const onPointerDown = (event) => {
    if (event.pointerType !== 'touch') return
    event.preventDefault() // no emulated mouse events after the touch
    const index = cellAt(event)
    if (index === null || over) return
    const chord = game.cells[index].state === 'revealed'
    setPressed({ index, chord })
    touch.current = {
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        touch.current = null
        setPressed(null)
        dispatch({ type: 'flag', index })
        navigator.vibrate?.(15)
      }, LONG_PRESS_MS),
    }
  }
  const cancelTouch = () => {
    if (touch.current) clearTimeout(touch.current.timer)
    touch.current = null
    setPressed(null)
  }
  const onPointerMove = (event) => {
    if (touch.current && Math.hypot(event.clientX - touch.current.x, event.clientY - touch.current.y) > TOUCH_SLOP) cancelTouch()
  }
  const onPointerUp = (event) => {
    if (event.pointerType !== 'touch' || !touch.current) return
    clearTimeout(touch.current.timer)
    touch.current = null
    onMouseUp()
  }

  const down = new Set()
  if (pressed) {
    const area = pressed.chord ? [pressed.index, ...neighbours(pressed.index, game)] : [pressed.index]
    for (const i of area) if (hidden(game.cells[i])) down.add(i)
  }
  const flags = game.cells.filter((cell) => cell.state === 'flagged').length
  const mood = game.status === 'lost' ? 'dead' : game.status === 'won' ? 'cool' : pressed ? 'oh' : 'smile'
  const level = (label, value) => ({ label, checked: game.level === value, onSelect: () => dispatch({ type: 'new', level: value }) })

  const menus = [
    {
      label: '&Game',
      items: [
        { label: '&New', shortcut: 'F2', onSelect: () => dispatch({ type: 'new' }) },
        '-',
        level('&Beginner', 'beginner'),
        level('&Intermediate', 'intermediate'),
        level('&Expert', 'expert'),
        '-',
        { label: '&Marks (?)', checked: game.marks, onSelect: () => dispatch({ type: 'marks' }) },
        '-',
        { label: 'E&xit', onSelect: () => api.close(win.id) },
      ],
    },
    {
      label: '&Help',
      items: [{ label: '&About Minesweeper...', onSelect: () => api.about('Minesweeper') }],
    },
  ]

  return (
    <div className="w95-app w95-mines" style={{ '--cell': coarsePointer ? '24px' : '16px' }}>
      <MenuBar menus={menus} />
      <div className="w95-mines__frame">
        <div className="w95-mines__head">
          <Led value={game.mines - flags} />
          <button type="button" className="w95-mines__face" aria-label="New game" onClick={() => dispatch({ type: 'new' })}>
            <Face mood={mood} />
          </button>
          <Led value={game.seconds} />
        </div>
        <div className="w95-mines__scroll">
          <div
            className="w95-mines__board"
            style={{ '--cols': game.cols }}
            role="grid"
            aria-label="Minefield"
            onMouseDown={onMouseDown}
            onMouseOver={onMouseOver}
            onMouseUp={onMouseUp}
            onMouseLeave={() => setPressed(null)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelTouch}
            onContextMenu={(event) => event.preventDefault()}
          >
            {game.cells.map((cell, i) => {
              const hinted = hintAt(i)
              return (
                <span
                  key={i}
                  data-cell={i}
                  role="gridcell"
                  aria-label={cellLabel(cell, i, game.cols, hinted)}
                  className={`w95-mines__cell is-${down.has(i) ? 'down' : cell.state} ${cell.exploded ? 'is-exploded' : ''} ${hinted ? `is-hint is-hint-${hinted}` : ''}`}
                >
                  {cellContent(cell)}
                </span>
              )
            })}
          </div>
        </div>
      </div>
      <p className="w95-sr" aria-live="polite">
        {game.status === 'won' ? 'You won!' : game.status === 'lost' ? 'Boom. You hit a mine.' : ''}
      </p>
    </div>
  )
}
