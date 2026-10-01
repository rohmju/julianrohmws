import { neighbours } from './Minesweeper.jsx'

// Turns a Minesweeper game into text for Ask Julian: the board as the player sees it plus what can be
// deduced from it for certain. Language models are poor at mine arithmetic, so the logic happens here
// and the chatbot only explains it. Hidden mines are never read; the player's flags are trusted.

const MAX_LISTED = 8
const SYMBOL = { hidden: '#', question: '?', flagged: 'F' }

const where = (i, cols) => `row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}`
const covered = (cell) => cell.state === 'hidden' || cell.state === 'question'

// Repeats two rules until nothing new follows:
//   one number   its missing mines equal its covered neighbours → all mines; no mines missing → all safe
//   two numbers  one's covered neighbours lie within the other's → the difference holds the rest
// Returns Map(index → { mine, reason }), or { conflict } when a number has too many flags around it.
function deduce(game) {
  const { cells, cols } = game
  const known = new Map()
  const isMine = (i) => cells[i].state === 'flagged' || known.get(i)?.mine === true
  const label = (i) => `the ${cells[i].count} at ${where(i, cols)}`

  const numbers = cells.flatMap((cell, i) => (cell.state === 'revealed' && !cell.mine && cell.count ? [i] : []))
  const constraints = () =>
    numbers
      .map((at) => {
        const around = neighbours(at, game)
        const open = around.filter((n) => covered(cells[n]) && !known.has(n))
        return { at, open, missing: cells[at].count - around.filter(isMine).length }
      })
      .filter((c) => c.open.length || c.missing !== 0)

  const settle = (indices, mine, reason) => {
    let changed = false
    for (const i of indices) {
      if (known.has(i)) continue
      known.set(i, { mine, reason })
      changed = true
    }
    return changed
  }

  for (let changed = true; changed; ) {
    changed = false
    const list = constraints()
    const conflict = list.find((c) => c.missing < 0 || c.missing > c.open.length)
    if (conflict) return { conflict: `${label(conflict.at)} doesn't fit the flags around it, so a flag nearby is probably wrong.` }

    for (const { at, open, missing } of list) {
      if (!open.length) continue
      if (missing === 0) changed = settle(open, false, `${label(at)} already has all its mines next to it`) || changed
      else if (missing === open.length) changed = settle(open, true, `${label(at)} has exactly ${missing} covered square(s) left around it`) || changed
    }
    if (changed) continue

    for (const a of list) {
      if (!a.open.length) continue
      for (const b of list) {
        if (a === b || b.open.length <= a.open.length || !a.open.every((i) => b.open.includes(i))) continue
        const rest = b.open.filter((i) => !a.open.includes(i))
        const left = b.missing - a.missing
        const reason = `${label(a.at)} needs ${a.missing} mine(s) among squares that ${label(b.at)} also touches, which needs ${b.missing}`
        if (left === 0) changed = settle(rest, false, reason) || changed
        else if (left === rest.length) changed = settle(rest, true, reason) || changed
      }
    }
  }
  return { known, frontier: constraints() }
}

// With no certain move: a rough chance of a mine for each covered square, lowest first.
function risks(game, known, frontier) {
  const { cells } = game
  const chance = new Map()
  for (const { open, missing } of frontier) {
    for (const i of open) chance.set(i, Math.max(chance.get(i) ?? 0, missing / open.length))
  }
  const unknown = cells.flatMap((cell, i) => (covered(cell) && !known.has(i) ? [i] : []))
  const flagged = cells.filter((cell) => cell.state === 'flagged').length
  const minesKnown = [...known.values()].filter((k) => k.mine).length
  const elsewhere = unknown.filter((i) => !chance.has(i))
  const average = Math.max(0, game.mines - flagged - minesKnown) / Math.max(1, unknown.length)
  for (const i of elsewhere) chance.set(i, average)
  return [...chance].sort((a, b) => a[1] - b[1])
}

function boardText({ rows, cols, cells, status }) {
  const show = (cell) => {
    if (status === 'lost' && cell.exploded) return 'X'
    if (cell.state === 'revealed') return cell.mine ? '*' : cell.count ? String(cell.count) : '.'
    if (cell.state === 'wrong') return 'W'
    return SYMBOL[cell.state]
  }
  const header = `      ${Array.from({ length: cols }, (_, c) => String(c + 1).padStart(3)).join('')}`
  const lines = Array.from({ length: rows }, (_, r) => {
    const row = cells.slice(r * cols, (r + 1) * cols).map((cell) => show(cell).padStart(3))
    return `Row ${String(r + 1).padStart(2)}${row.join('')}`
  })
  return [header, ...lines].join('\n')
}

// Ask Julian ends a hint with tags such as [[safe 3,5]], [[mine 2,7]] or [[guess 1,1]] (row, column).
// Returns the reply without them, plus the squares to blink on the board: { game, cells: { index: kind } }.
// A tag only counts if the board backs it up, so a slip of the model never points at a mine.
const HINT_TAG = /\[\[\s*(safe|mine|guess)\s+(\d+)\s*,\s*(\d+)\s*\]\]/gi

export function readHints(text, game) {
  const tags = []
  const clean = text
    .replace(HINT_TAG, (_, kind, row, col) => {
      tags.push({ kind: kind.toLowerCase(), row: Number(row) - 1, col: Number(col) - 1 })
      return ''
    })
    .replace(/(\S)[ \t]{2,}/g, '$1 ')
    .replace(/[ \t]+$/gm, '')
    .trim()
  if (!game || !tags.length || (game.status !== 'playing' && game.status !== 'ready')) return { text: clean, hint: null }

  // Before the first click every square is safe; afterwards safe and mine must follow for certain.
  const known = game.status === 'playing' ? (deduce(game).known ?? new Map()) : null
  const fits = (kind, i) => kind === 'guess' || (known ? known.get(i)?.mine === (kind === 'mine') : kind === 'safe')
  const cells = {}
  for (const { kind, row, col } of tags) {
    if (row < 0 || row >= game.rows || col < 0 || col >= game.cols) continue
    const i = row * game.cols + col
    if (covered(game.cells[i]) && fits(kind, i)) cells[i] = kind
  }
  return { text: clean, hint: Object.keys(cells).length ? { game: game.id, cells } : null }
}

export function describeMinesweeper(game) {
  const { level, rows, cols, mines, cells, status, seconds } = game
  const flags = cells.filter((cell) => cell.state === 'flagged').length
  const out = [
    `Level: ${level} (${rows} rows × ${cols} columns, ${mines} mines). Mine counter: ${mines - flags}. Time: ${seconds} s.`,
    'Legend: # covered, F flag, ? question mark, . opened and empty, 1-8 mines next to that square.',
  ]

  if (status === 'ready') {
    out.push('Status: a new game, nothing opened yet. The first square opened is never a mine, so any square is safe; corners often open a big area.')
    return out.join('\n')
  }
  if (status === 'won') return [...out, 'Status: won! Every safe square is open.'].join('\n')
  if (status === 'lost') {
    out.push('Status: lost, a mine went off (X). * marks the other mines, W a wrong flag. Press F2 or the face for a new game.')
    return [...out, '', boardText(game)].join('\n')
  }

  out.push('Status: in progress.', '', boardText(game), '', 'SOLVER ANALYSIS (exact, assuming the flags are right)')
  const result = deduce(game)
  if (result.conflict) return [...out, result.conflict].join('\n')

  const list = (entries) =>
    entries
      .slice(0, MAX_LISTED)
      .map(([i, { reason }]) => `- ${where(i, cols)}: ${reason}`)
      .join('\n')
  const safe = [...result.known].filter(([, k]) => !k.mine)
  const mined = [...result.known].filter(([, k]) => k.mine)
  if (safe.length) out.push(`Certainly safe to open (${safe.length}):`, list(safe))
  if (mined.length) out.push(`Certainly mines, not flagged yet (${mined.length}):`, list(mined))
  if (!safe.length && !mined.length) {
    const [best] = risks(game, result.known, result.frontier)
    out.push('No square is certain from here; the player has to guess.')
    if (best) out.push(`Lowest-risk square (rough estimate): ${where(best[0], cols)}, about ${Math.round(best[1] * 100)}% chance of a mine.`)
  }
  return out.join('\n')
}
