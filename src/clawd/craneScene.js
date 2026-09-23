import { PALETTE, SPRITES, bubbleWidth, easeInOut, easeOut, lerp } from './engine.js'

// The colour the painter puts on the wall (also his bucket and bristles).
export const WALL_COLOR = '#16f529'

// A crane's jib pokes in at the top-right corner. A terrified Clawd in a
// bosun's seat, a stack of planks on his head, is lowered out of it and builds
// a five-level scaffold across the whole screen, top level first. Once the
// first level stands, a painter jumps in from the left, drops a bucket and
// paints the wall section by section, taking the stairs down level by level.

const ROWS = 5
const SEGMENTS = 5
const JIB_TOP = 2 // top chord row; tie cables run up off-screen above it
const CABLE_TOP = JIB_TOP + 6 // first row under the trolley
const START_Y = CABLE_TOP - 8 // builder's body row before the cable pays out (hidden in the crane)
const BUBBLE_K = 2 // bubble pixel size in cells

// ─── Timeline (seconds from the moment the crane appears) ─────
const T = {
  jibIn: [0, 1.4],
  jibSettle: [1.4, 1.9],
  descent: [2.0, 4.4],
  bounce: [4.4, 5.2],
  scared: [5.2, 6.4],
  phew: [6.4, 7.2],
}

// Builder: one level every ROW_BUILD seconds, then the crane lowers him.
const BUILD0 = 7.5
const ROW_BUILD = 5
const ROW_LOWER = 1
const BUILD_CYCLE = ROW_BUILD + ROW_LOWER
const BUILD_END = BUILD0 + ROWS * BUILD_CYCLE - ROW_LOWER
const HOIST = [BUILD_END + 0.8, BUILD_END + 2.8] // back up to the corner to watch
const FLIGHT = 0.45 // a piece's trip from the stack to its spot

// Painter: jumps in once level 1 is done. One wall section takes 1s.
const P0 = BUILD0 + ROW_BUILD
const ENTER = 0.9
const DROP = 0.4
const DIP = 0.2
const RISE = 0.15
const PAINT = 0.65
const TURN = 0.1
const HOP = 0.35
const WALK = 0.35
const STAIRS = 0.7
const RUN = 1.0
const ROW_PAINT = SEGMENTS * (DIP + RISE + PAINT) + (SEGMENTS - 1) * (TURN + HOP)
const TRANSITION = WALK + STAIRS + RUN
const PAINT0 = P0 + ENTER + DROP
const PAINT_END = PAINT0 + ROWS * ROW_PAINT + (ROWS - 1) * TRANSITION
const TADA = [PAINT_END + 0.3, PAINT_END + 2.3]
export const CRANE_END = TADA[1]

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const seg = (s, [a, b]) => clamp01((s - a) / (b - a))
const during = (s, [a, b]) => s >= a && s < b
const easeIn = (t) => t * t * t
const runLegs = (f, every) => (Math.floor(f / every) % 2 ? 'a' : 'b')
const blinkAt = (s, phase = 0) => (s * 1000 + phase) % 3300 < 130

// ─── Layout ──────────────────────────────────────────────────
// Floors k = 1..5 split the screen into five bands; band k is the wall
// between floor k-1 (0 = top edge) and floor k. Floor 5 is the ground.
function layout(GW, GH) {
  const floors = [0]
  for (let k = 1; k <= ROWS; k++) floors.push(Math.round((k * (GH - 3)) / ROWS))
  const segX = Array.from({ length: SEGMENTS + 1 }, (_, i) => Math.round((i * GW) / SEGMENTS))
  const bays = Math.max(4, Math.round(GW / 32))
  const poles = Array.from({ length: bays + 1 }, (_, j) => Math.round(1 + (j * (GW - 4)) / bays))
  const jibVisible = Math.max(13, Math.round(GW * 0.1))
  const tipFinal = GW - jibVisible
  return {
    floors,
    segX,
    poles,
    stairX: Math.round(GW * 0.78),
    tipFinal,
    ox0: tipFinal - 5, // the seat hangs from the trolley at the tip
    builderY: (k) => floors[k] - 14,
    floorOy: (k) => floors[k] - 8,
    segOx: (i) => Math.round((segX[i] + segX[i + 1]) / 2) - 7,
  }
}

// The pieces of level k, in build order: right to left, stairs last.
function rowPieces(L, k) {
  const list = []
  for (let j = L.poles.length - 1; j >= 0; j--) {
    list.push({ kind: 'pole', j })
    if (j > 0) list.push({ kind: 'bay', j: j - 1 })
  }
  if (k > 1) list.push({ kind: 'stair' })
  const start = BUILD0 + (k - 1) * BUILD_CYCLE
  const n = list.length
  list.forEach((piece, i) => {
    piece.land = start + FLIGHT + 0.05 + ((ROW_BUILD - FLIGHT - 0.15) * i) / Math.max(1, n - 1)
  })
  return list
}

function rowsBuilt(s) {
  let n = 0
  for (let k = 1; k <= ROWS; k++) if (s >= BUILD0 + (k - 1) * BUILD_CYCLE + ROW_BUILD - 0.1) n = k
  return n
}

// ─── Painter plan (layout-independent) ───────────────────────
function painterPlan(s) {
  if (s < P0) return null
  let t = s - P0
  if (t < ENTER) return { phase: 'enter', p: t / ENTER }
  t -= ENTER
  if (t < DROP) return { phase: 'drop', p: t / DROP }
  t -= DROP
  for (let k = 1; k <= ROWS; k++) {
    for (let i = 0; i < SEGMENTS; i++) {
      if (t < DIP) return { phase: 'dip', k, i, p: t / DIP }
      t -= DIP
      if (t < RISE) return { phase: 'rise', k, i, p: t / RISE }
      t -= RISE
      if (t < PAINT) return { phase: 'paint', k, i, p: t / PAINT }
      t -= PAINT
      if (i < SEGMENTS - 1) {
        if (t < TURN) return { phase: 'turn', k, i, p: t / TURN }
        t -= TURN
        if (t < HOP) return { phase: 'hop', k, i, p: t / HOP }
        t -= HOP
      }
    }
    if (k < ROWS) {
      if (t < WALK) return { phase: 'walk', k, p: t / WALK }
      t -= WALK
      if (t < STAIRS) return { phase: 'stairs', k, p: t / STAIRS }
      t -= STAIRS
      if (t < RUN) return { phase: 'run', k, p: t / RUN }
      t -= RUN
    }
  }
  return { phase: 'done', k: ROWS, i: SEGMENTS - 1 }
}

// How much of wall section (k, i) is painted, 0–1.
function segProgress(plan, k, i) {
  if (!plan || plan.phase === 'enter' || plan.phase === 'drop') return 0
  if (plan.phase === 'done') return 1
  if (plan.i === undefined) return k <= plan.k ? 1 : 0 // between levels
  const idx = (k - 1) * SEGMENTS + i
  const cur = (plan.k - 1) * SEGMENTS + plan.i
  if (idx !== cur) return idx < cur ? 1 : 0
  if (plan.phase === 'paint') return plan.p
  return plan.phase === 'turn' || plan.phase === 'hop' ? 1 : 0
}

export function createCraneScene() {
  const fired = new Set()
  const once = (key, cond = true) => {
    if (!cond || fired.has(key)) return false
    fired.add(key)
    return true
  }

  function dust(E, x, y, n = 5, spread = 4) {
    for (let i = 0; i < n; i++) {
      E.addParticle(x + (Math.random() - 0.5) * spread, y, PALETTE.dust.puff, {
        vy: -Math.random() * 0.5 - 0.1,
        g: 0.02,
        decay: 0.05,
      })
    }
  }

  function line(E, x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) E.px(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), col)
  }

  // ─── Crane ───────────────────────────────────────────────────
  const ZIGZAG = [3, 2, 1, 1, 2, 3] // diagonal row (below the top chord) per column in a bay
  function drawJib(E, tipX, GW, f) {
    const { jib, lattice, trolley, rig, light } = PALETTE.crane
    const y0 = JIB_TOP
    // dark outline so the boom still reads once the wall behind it is painted
    E.rect(tipX - 1, y0 - 1, GW - tipX + 1, 7, PALETTE.steel.dark)
    for (let i = 0; i < 12; i++) E.px(tipX + 2 + i, y0 - 2 - Math.floor(i / 4), rig)
    E.rect(tipX, y0 + 1, GW - tipX, 3, PALETTE.ui.white)
    for (let x = Math.max(0, tipX); x < GW; x++) {
      E.px(x, y0, jib)
      E.px(x, y0 + 4, jib)
      E.px(x, y0 + ZIGZAG[(x - tipX) % 6], lattice)
    }
    for (let y = y0; y <= y0 + 4; y++) E.px(tipX, y, jib)
    if (f % 30 < 18) E.px(tipX, y0 - 2, light)
    E.rect(tipX, y0 + 5, 4, 1, trolley)
  }

  function drawCable(E, x0, y0, x1, y1) {
    if (y1 < y0) return
    const steps = Math.max(1, y1 - y0)
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(lerp(x0, x1, i / steps))
      E.rect(x, y0 + i, 2, 1, PALETTE.crane.cable)
    }
  }

  // Bosun's seat hung from a hook above the plank stack.
  function drawRig(E, ox, oy, hookY) {
    const { cable, rig, seat } = PALETTE.crane
    E.rect(ox + 5, hookY, 4, 2, cable)
    E.rect(ox + 2, hookY + 2, 10, 1, rig)
    E.rect(ox + 2, hookY + 2, 1, oy + 6 - hookY - 2, rig)
    E.rect(ox + 11, hookY + 2, 1, oy + 6 - hookY - 2, rig)
    E.rect(ox + 1, oy + 6, 12, 1, seat)
  }

  // The wood he carries: one plank per level still to build, stacked on his head.
  const STACK_OFFSET = [0, 1, -1, 1, 0]
  function drawStack(E, ox, oy, planks) {
    const { base, light, dark } = PALETTE.wood
    for (let i = 0; i < planks; i++) {
      const x = ox - 1 + STACK_OFFSET[i % STACK_OFFSET.length]
      const y = oy - 1 - i
      E.rect(x, y, 16, 1, base)
      E.px(x, y, dark)
      E.px(x + 15, y, dark)
      E.rect(x + 2 + ((i * 5) % 9), y, 2, 1, light)
    }
  }

  // ─── Scaffold ────────────────────────────────────────────────
  function drawPiece(E, L, k, piece) {
    const { floors, poles } = L
    const top = floors[k - 1]
    const y = floors[k]
    if (piece.kind === 'pole') {
      const x = poles[piece.j]
      E.rect(x, top, 1, y - top + 3, PALETTE.steel.light)
      E.rect(x + 1, top, 1, y - top + 3, PALETTE.steel.dark)
    } else if (piece.kind === 'bay') {
      const x0 = poles[piece.j]
      const w = poles[piece.j + 1] - x0 + 2
      const { base, light, dark } = PALETTE.wood
      E.rect(x0, y, w, 3, base)
      E.rect(x0, y, 1, 3, dark)
      E.rect(x0 + 3 + ((piece.j * 7 + k * 3) % Math.max(1, w - 8)), y + 1, 3, 1, light)
      E.rect(x0, y - 7, w, 1, PALETTE.steel.tube) // guard rail
      if (piece.j % 2 === 0) line(E, x0 + 2, y - 1, x0 + w - 3, top + 1, PALETTE.steel.dark) // brace
    } else {
      // stairs from floor k-1 down-left to floor k
      const h = y - top
      const sx = L.stairX
      line(E, sx + 1, top + 1, sx - h + 1, y, PALETTE.wood.dark) // stringer
      for (let yy = top + 2; yy < y; yy += 3) E.rect(sx - (yy - top) - 2, yy, 4, 1, PALETTE.wood.base)
      line(E, sx + 1, top - 6, sx - h + 1, y - 7, PALETTE.steel.tube) // hand rail
    }
  }

  function pieceTarget(L, k, piece) {
    const top = L.floors[k - 1]
    const y = L.floors[k]
    if (piece.kind === 'pole') return { x: L.poles[piece.j], y: (top + y) / 2 }
    if (piece.kind === 'bay') return { x: (L.poles[piece.j] + L.poles[piece.j + 1]) / 2, y }
    return { x: L.stairX - (y - top) / 2, y: (top + y) / 2 }
  }

  function drawScaffold(E, L, s, from) {
    for (let k = 1; k <= ROWS; k++) {
      if (s < BUILD0 + (k - 1) * BUILD_CYCLE) break
      rowPieces(L, k).forEach((piece, i) => {
        if (s >= piece.land) {
          drawPiece(E, L, k, piece)
          const t = pieceTarget(L, k, piece)
          if (once(`land-${k}-${i}`, s < piece.land + 0.2)) dust(E, t.x, t.y, 3, 3)
        } else if (s >= piece.land - FLIGHT) {
          // in the air, arcing from the stack to its spot
          const p = (s - (piece.land - FLIGHT)) / FLIGHT
          const t = pieceTarget(L, k, piece)
          const x = lerp(from.x, t.x, p)
          const y = lerp(from.y, t.y, p) - Math.sin(p * Math.PI) * (8 + Math.abs(t.x - from.x) * 0.12)
          if (piece.kind === 'pole') E.rect(x, y - 2, 1, 5, PALETTE.steel.tube)
          else E.rect(x - 2, y, 5, 1, PALETTE.wood.base)
        }
      })
    }
  }

  // ─── Paint ───────────────────────────────────────────────────
  // Finished sections are solid; the one in progress fills in 3-row brush
  // strokes, top to bottom, sweeping alternately left and right.
  function drawWall(E, L, plan) {
    for (let k = 1; k <= ROWS; k++) {
      const top = L.floors[k - 1]
      const h = L.floors[k] - top
      for (let i = 0; i < SEGMENTS; i++) {
        const p = segProgress(plan, k, i)
        if (p <= 0) continue
        const x0 = L.segX[i]
        const w = L.segX[i + 1] - x0
        if (p >= 1) {
          E.rect(x0, top, w, h, WALL_COLOR)
          continue
        }
        const n = Math.ceil(h / 3)
        const done = Math.floor(p * n)
        E.rect(x0, top, w, Math.min(h, done * 3), WALL_COLOR)
        const len = Math.round((p * n - done) * w)
        const sy = top + done * 3
        const sh = Math.min(3, top + h - sy)
        if (len > 0 && sh > 0) {
          const sx = done % 2 === 0 ? x0 : x0 + w - len
          E.rect(sx, sy, len, sh, WALL_COLOR)
          if (Math.random() < 0.6) {
            const fx = done % 2 === 0 ? sx + len : sx
            E.addParticle(fx, sy + 1, WALL_COLOR, { vy: -0.2, g: 0.03, decay: 0.08 })
          }
        }
      }
    }
  }

  // ─── Painter ─────────────────────────────────────────────────
  function drawBucket(E, x, y) {
    const { rim, body } = PALETTE.bucket
    E.rect(x, y, 5, 1, rim)
    E.rect(x + 1, y, 3, 1, WALL_COLOR)
    E.rect(x, y + 1, 5, 1, body)
    E.rect(x + 1, y + 2, 3, 1, WALL_COLOR)
    E.rect(x + 1, y + 3, 3, 1, body)
  }

  // Brush in the right claw; bristles up, or down into the bucket.
  function drawBrush(E, ox, oy, dipping) {
    E.rect(ox + 14, oy + 1, 1, 3, PALETTE.brush.handle)
    if (dipping) {
      E.rect(ox + 14, oy + 4, 2, 1, PALETTE.brush.ferrule)
      E.rect(ox + 14, oy + 5, 2, 2, WALL_COLOR)
    } else {
      E.rect(ox + 14, oy, 2, 1, PALETTE.brush.ferrule)
      E.rect(ox + 14, oy - 2, 2, 2, WALL_COLOR)
    }
  }

  function painterPose(E, L, plan, s, f) {
    const pose = { eyes: 'forward', legs: 'stand', dipping: false, carry: false, blush: 0, bubble: null }
    const { phase, k, i, p } = plan
    if (phase === 'enter') {
      pose.ox = Math.round(lerp(-18, L.segOx(0), p))
      pose.oy = Math.round(lerp(L.floorOy(1) - 6, L.floorOy(1), p) - Math.sin(p * Math.PI) * 18)
      pose.eyes = 'look_right'
      pose.legs = runLegs(f, 2)
      pose.carry = true
      return pose
    }
    if (phase === 'drop') {
      pose.ox = L.segOx(0)
      pose.oy = L.floorOy(1)
      pose.eyes = 'look_down'
      if (once('enter-land')) dust(E, pose.ox + 7, L.floors[1], 6, 6)
      const by = L.floors[1] - 4
      pose.bucketY = Math.round(lerp(pose.oy - 3, by, easeIn(p)))
      if (once('bucket-drop', p > 0.95)) dust(E, pose.ox + 15, L.floors[1], 4, 4)
      return pose
    }
    if (phase === 'done') {
      pose.ox = L.segOx(SEGMENTS - 1)
      pose.oy = L.floorOy(ROWS)
      if (during(s, TADA)) {
        const q = seg(s, TADA)
        pose.oy -= Math.round(Math.abs(Math.sin(q * Math.PI * 3)) * 5)
        pose.blush = clamp01(q / 0.2) * 0.85
        pose.bubble = 'ta-da!'
        pose.eyes = q < 0.1 ? 'blink' : 'forward'
      } else {
        pose.blush = s >= TADA[1] ? 0.5 : 0
        pose.eyes = blinkAt(s, 900) ? 'blink' : 'forward'
      }
      return pose
    }
    if (phase === 'walk' || phase === 'stairs' || phase === 'run') {
      const h = L.floors[k + 1] - L.floors[k]
      pose.carry = true
      pose.legs = runLegs(f, 2)
      if (phase === 'walk') {
        pose.ox = Math.round(lerp(L.segOx(SEGMENTS - 1), L.stairX - 7, p))
        pose.oy = L.floorOy(k)
        pose.eyes = 'look_left'
      } else if (phase === 'stairs') {
        pose.ox = Math.round(lerp(L.stairX, L.stairX - h, p)) - 7
        pose.oy = Math.round(lerp(L.floors[k], L.floors[k + 1], p)) - 8
        pose.eyes = 'look_down'
      } else {
        pose.ox = Math.round(lerp(L.stairX - h - 7, L.segOx(0), easeInOut(p)))
        pose.oy = L.floorOy(k + 1)
        pose.eyes = 'look_left'
      }
      return pose
    }

    const floorOy = L.floorOy(k)
    const top = L.floors[k - 1]
    pose.ox = L.segOx(i)
    pose.oy = floorOy
    if (phase === 'dip') {
      pose.oy = floorOy + 1
      pose.dipping = true
      pose.eyes = 'look_down'
      if (once(`dip-${k}-${i}`, p > 0.5)) {
        for (let n = 0; n < 4; n++) E.addParticle(pose.ox + 15, L.floors[k] - 5, WALL_COLOR, { decay: 0.07 })
      }
    } else if (phase === 'rise') {
      pose.oy = Math.round(lerp(floorOy, top + 3, easeOut(p)))
      pose.legs = 'a'
    } else if (phase === 'paint') {
      const brushY = top + p * (L.floors[k] - top)
      pose.oy = Math.min(floorOy, Math.round(brushY + 3))
      pose.legs = pose.oy < floorOy ? 'b' : 'stand'
    } else if (phase === 'turn') {
      pose.eyes = 'look_right'
    } else if (phase === 'hop') {
      pose.ox = Math.round(lerp(L.segOx(i), L.segOx(i + 1), easeInOut(p)))
      pose.oy = Math.round(floorOy - Math.sin(p * Math.PI) * 10)
      pose.eyes = 'look_right'
      pose.legs = 'a'
      pose.carry = true
      if (once(`hop-${k}-${i}`, p > 0.95)) dust(E, pose.ox + 7, L.floors[k], 4, 5)
    }
    return pose
  }

  function drawPainter(E, L, s, f) {
    const plan = painterPlan(s)
    if (!plan) return null
    const pose = painterPose(E, L, plan, s, f)
    const { ox, oy } = pose
    if (pose.carry) {
      E.drawClawd(ox, oy, { eyes: pose.eyes, legs: pose.legs })
      E.drawSprite(SPRITES.hardhat, ox + 2, oy - 3)
      drawBrush(E, ox, oy, false)
      drawBucket(E, ox + 13, oy + 3)
    } else {
      const by = pose.bucketY ?? L.floors[plan.k ?? 1] - 4
      if (!pose.dipping) drawBucket(E, ox + 13, by)
      E.drawClawd(ox, oy, { eyes: pose.eyes, legs: pose.legs })
      E.drawSprite(SPRITES.hardhat, ox + 2, oy - 3)
      drawBrush(E, ox, oy, pose.dipping)
      if (pose.dipping) drawBucket(E, ox + 13, by) // bristles disappear into the bucket
    }
    if (pose.blush) E.drawBlush(ox, oy, pose.blush)
    if (once('tada', !!pose.bubble)) {
      for (let n = 0; n < 20; n++) {
        const col = n % 2 ? WALL_COLOR : PALETTE.confetti.blue
        E.addParticle(ox + Math.random() * 14, oy - 4 + Math.random() * 6, col, { decay: 0.025 })
      }
    }
    return pose
  }

  // ─── Builder ─────────────────────────────────────────────────
  function builderRow(L, s) {
    if (s < T.descent[0]) return START_Y
    if (s < T.descent[1]) return Math.round(lerp(START_Y, L.builderY(1), easeOut(seg(s, T.descent))))
    if (s < T.bounce[1]) {
      const p = seg(s, T.bounce)
      return L.builderY(1) + Math.round(Math.sin(p * Math.PI * 2.5) * 2 * (1 - p))
    }
    if (s < BUILD0) return L.builderY(1)
    if (s < BUILD_END) {
      const t = s - BUILD0
      const k = Math.floor(t / BUILD_CYCLE)
      const w = t - k * BUILD_CYCLE
      if (w < ROW_BUILD) return L.builderY(k + 1)
      return Math.round(lerp(L.builderY(k + 1), L.builderY(k + 2), easeInOut((w - ROW_BUILD) / ROW_LOWER)))
    }
    return Math.round(lerp(L.builderY(ROWS), L.builderY(1), easeInOut(seg(s, HOIST))))
  }

  function sweat(E, ox, oy) {
    const left = Math.random() < 0.5
    E.addParticle(ox + (left ? 2 : 11), oy - 1, PALETTE.sweat.drop, {
      vx: (left ? -1 : 1) * (0.15 + Math.random() * 0.2),
      vy: -0.35,
      g: 0.05,
      decay: 0.05,
    })
  }

  function drawBuilder(E, L, s, f, tipX) {
    if (s < T.descent[0]) return null
    const row = builderRow(L, s)
    let eyes = 'look_left'
    let legs = 'stand'
    let shake = 0
    let bubble = null
    let bob = 0
    let blush = 0

    if (s < T.bounce[1]) {
      // scared stiff on the way down
      eyes = 'look_down'
      legs = runLegs(f, s < T.descent[1] ? 2 : 3)
      shake = f % 4 < 2 ? 1 : 0
      if (f % 5 === 0) sweat(E, L.ox0, row)
      if (s >= T.descent[0] + 1.2) bubble = '!!'
    } else if (s < T.scared[1]) {
      const p = seg(s, T.scared)
      shake = p < 0.6 && f % 4 < 2 ? 1 : 0
      eyes = p < 0.35 ? 'look_down' : p < 0.6 ? 'look_left' : p < 0.8 ? 'look_right' : 'forward'
      if (p < 0.5 && f % 8 === 0) sweat(E, L.ox0, row)
    } else if (s < T.phew[1]) {
      eyes = seg(s, T.phew) < 0.4 ? 'blink' : 'forward'
      bubble = 'phew'
    } else if (s < BUILD_END) {
      const w = (s - BUILD0) % BUILD_CYCLE
      if (s >= BUILD0 && w < ROW_BUILD) bob = (w * 4.5) % 1 < 0.3 ? -1 : 0 // a heave per throw
      eyes = blinkAt(s) ? 'blink' : 'look_left'
    } else {
      eyes = blinkAt(s) ? 'blink' : 'look_left'
      if (s >= TADA[0]) blush = s >= TADA[1] ? 0.5 : seg(s, TADA) * 0.85
    }

    const ox = L.ox0 + shake
    const oy = row + bob
    const planks = ROWS - rowsBuilt(s)
    const hookY = oy - Math.max(planks, 1) - 3
    E.clipBelow(CABLE_TOP, () => {
      drawCable(E, tipX + 1, CABLE_TOP, ox + 6, hookY - 1)
      drawRig(E, ox, oy, hookY)
      E.drawClawd(ox, oy, { eyes, legs })
      drawStack(E, ox, oy, planks)
      if (blush) E.drawBlush(ox, oy, blush)
    })
    return { ox, oy, planks, bubble }
  }

  // ─── Frame ───────────────────────────────────────────────────
  function render(E, s, f) {
    const { GW, GH } = E.grid()
    const L = layout(GW, GH)
    E.setOffset(0)
    E.drawBg()

    let tipX = Math.round(lerp(GW + 1, L.tipFinal, easeOut(seg(s, T.jibIn))))
    if (during(s, T.jibSettle)) {
      const p = seg(s, T.jibSettle)
      tipX += Math.round(Math.sin(p * Math.PI * 3) * (1 - p) * 1.5)
    }

    drawWall(E, L, painterPlan(s))
    const stackTop = { x: L.ox0 + 7, y: builderRow(L, s) - (ROWS - rowsBuilt(s)) - 1 }
    drawScaffold(E, L, s, stackTop)
    const painter = drawPainter(E, L, s, f)
    const builder = drawBuilder(E, L, s, f, tipX)
    drawJib(E, tipX, GW, f)
    E.tickParticles()

    if (builder?.bubble) {
      const w = bubbleWidth(builder.bubble) * BUBBLE_K
      E.drawBubble(builder.ox - w - 2, Math.max(CABLE_TOP, builder.oy - builder.planks - 8), builder.bubble, 'right', BUBBLE_K)
    }
    if (painter?.bubble) {
      const w = bubbleWidth(painter.bubble) * BUBBLE_K
      E.drawBubble(painter.ox - w - 1, painter.oy - 12, painter.bubble, 'right', BUBBLE_K)
    }
  }

  return { render }
}
