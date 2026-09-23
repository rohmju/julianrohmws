import { PALETTE, SPRITES, bubbleWidth, easeInOut, easeOut, lerp } from './engine.js'

// The colour the painter puts on the wall (also his bucket and bristles).
export const WALL_COLOR = '#F9C74F'

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

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const seg = (s, [a, b]) => clamp01((s - a) / (b - a))

// ─── Poster job (after the scaffold) ─────────────────────────
// The crane drives off, comes back with a rolled-up poster and a helper on
// the builder's head, and the two of them screw it to the top-left corner.
// The picture on the poster (served from /public). Swap the file to change it.
export const POSTER_IMAGE = `${import.meta.env?.BASE_URL ?? '/'}selfie.png`

let posterImage = null
function posterPicture() {
  if (!posterImage && typeof Image !== 'undefined') {
    posterImage = new Image()
    posterImage.src = POSTER_IMAGE
  }
  return posterImage?.complete && posterImage.naturalWidth ? posterImage : null
}

const CROOK = (14 * Math.PI) / 180 // how far it swings after the first screw
const ROLLED = 0.55 // how much of it is unrolled until the bottom gets pulled down
const DOG_EAR = 7 // size of the curled corner after the third screw
const P = {
  hoist: [BUILD_END + 0.5, BUILD_END + 2.0],
  exit: [BUILD_END + 2.0, BUILD_END + 3.5],
  back: [BUILD_END + 4.5, BUILD_END + 7.5],
  hopOff: [BUILD_END + 7.6, BUILD_END + 8.4],
  rise: [BUILD_END + 8.4, BUILD_END + 9.2],
  unroll: [BUILD_END + 9.2, BUILD_END + 10.0],
}

// Screws go top-left, top-right, bottom-right, bottom-left.
const STEPS = []
let cursor = P.unroll[1]
const step = (name, d, extra = {}) => {
  STEPS.push({ name, a: cursor, b: cursor + d, ...extra })
  cursor += d
}
const screwStep = (c) => {
  step('hand', 0.6, { c })
  step('screw', 0.8, { c })
}
screwStep(0)
step('release', 0.8)
step('move', 1.2, { from: 0, to: 1 })
step('lift', 0.5)
screwStep(1)
step('move', 0.8, { from: 1, to: 2 })
step('pull', 0.6)
screwStep(2)
step('move', 1.2, { from: 2, to: 3 })
step('flatten', 0.4)
screwStep(3)
cursor += 0.2
step('come', 1.0) // hops off the seat onto the top level
step('toss', 0.8)
step('clink', 0.8)
step('sip', 1.5)
step('ahh', 1.7)
const DRINK_END = cursor

// After the drinks: a third Clawd drops out of the sky between the two,
// knocks them over and back, and they pick themselves up.
const CRASH = {
  fall: [DRINK_END + 0.5, DRINK_END + 1.3],
  down: [DRINK_END + 1.3, DRINK_END + 2.6],
  up: [DRINK_END + 2.6, DRINK_END + 3.1],
}
const PUSH = 5 // cells each of them gets shoved back

// Shared knock-down state for the crane Clawd and the helper.
function knockAt(s) {
  if (s < CRASH.down[0]) return null
  if (s < CRASH.down[1]) {
    const push = Math.round(PUSH * easeOut(seg(s, [CRASH.down[0], CRASH.down[0] + 0.3])))
    return { push, drop: 2, legs: 'none', dizzy: true }
  }
  if (s < CRASH.up[1]) {
    const p = seg(s, CRASH.up)
    return { push: PUSH, drop: Math.round(2 * (1 - p)) - (p > 0.6 && p < 0.9 ? 1 : 0), legs: p < 0.5 ? 'none' : 'stand' }
  }
  return { push: PUSH, drop: 0, legs: 'stand' }
}
const find = (name) => STEPS.find((st) => st.name === name)

// The current step with its progress; 'idle' once everything is done.
function stepAt(s) {
  if (s < P.unroll[1]) return null
  const st = STEPS.find((x) => s >= x.a && s < x.b)
  if (st) return { ...st, p: (s - st.a) / (st.b - st.a) }
  return s >= DRINK_END ? { name: 'idle', p: 0 } : { name: 'wait', p: 0 }
}

// Poster state at time s, independent of screen size.
function posterAt(s) {
  if (s < P.unroll[0]) return null
  const release = find('release')
  const lift = find('lift')
  const pull = find('pull')
  const flatten = find('flatten')
  const within = (x) => seg(s, [x.a, x.b])
  let visible = ROLLED
  if (s < P.unroll[1]) visible = ROLLED * seg(s, P.unroll)
  else if (s >= pull.a) visible = lerp(ROLLED, 1, easeInOut(within(pull)))
  let theta = 0
  if (s >= release.a && s < lift.a) {
    const p = within(release)
    theta = CROOK * (1 - Math.exp(-4 * p) * Math.cos(p * 9))
  } else if (s >= lift.a) theta = CROOK * (1 - easeInOut(within(lift)))
  let dogEar = 0
  if (s >= pull.a) dogEar = Math.round(DOG_EAR * (1 - within(flatten)))
  const fixed = STEPS.filter((x) => x.name === 'screw' && s >= x.b).map((x) => x.c)
  return { visible, theta, dogEar, fixed }
}

// The poster as a W×H grid of colours: a border, and the picture scaled to
// cover the inside (cropped to fit), one cell per pixel.
function posterBitmap(W, H, img) {
  const { paper, border } = PALETTE.poster
  const bmp = Array.from({ length: H }, (_, v) =>
    Array.from({ length: W }, (_, u) => (u === 0 || v === 0 || u === W - 1 || v === H - 1 ? border : paper)),
  )
  if (!img) return bmp
  const w = W - 2
  const h = H - 2
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  const data = g.getImageData(0, 0, w, h).data
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++) {
      const i = (v * w + u) * 4
      if (data[i + 3] > 127) bmp[v + 1][u + 1] = `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`
    }
  }
  return bmp
}

// Screen position of screw c (on the level poster), 2 cells in from each corner.
function screwXY(L, c) {
  const { PX, PT, W, H } = L.poster
  const u = c === 0 || c === 3 ? 2 : W - 3
  const v = c === 0 || c === 1 ? 2 : H - 3
  return { sx: PX + u, sy: PT + v }
}

export const CRANE_END = Math.max(TADA[1], CRASH.up[1])

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
  // Portrait (3:4), hanging over the top two levels.
  const PT = CABLE_TOP + 4
  const PH = Math.max(20, Math.min(80, floors[2] - 4 - PT))
  const PW = Math.max(16, Math.min(60, Math.round(PH * 0.75)))
  const poster = { PX: 16, PT, W: PW, H: PH }
  return {
    GW,
    poster,
    helperX: poster.PX + PW + 20, // where the helper stands on the top level
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
  posterPicture() // start loading now, it's needed ~45s in
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
    if (tipX >= GW) return // driven off-screen
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

  // ─── Builder (the Clawd on the crane) ────────────────────────
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
    return L.builderY(ROWS)
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

  const basePose = () => ({
    eyes: 'look_left',
    legs: 'stand',
    shake: 0,
    bubble: null,
    blush: 0,
    planks: 0,
    stackH: 1,
    rider: false,
    roll: false,
    bottle: null,
    clink: 0,
    driver: null,
  })

  // Descent and scaffold building.
  function buildPose(E, L, s, f) {
    const pose = basePose()
    const row = builderRow(L, s)
    let bob = 0
    if (s < T.bounce[1]) {
      pose.eyes = 'look_down' // scared stiff on the way down
      pose.legs = runLegs(f, s < T.descent[1] ? 2 : 3)
      pose.shake = f % 4 < 2 ? 1 : 0
      if (f % 5 === 0) sweat(E, L.ox0, row)
      if (s >= T.descent[0] + 1.2) pose.bubble = '!!'
    } else if (s < T.scared[1]) {
      const p = seg(s, T.scared)
      pose.shake = p < 0.6 && f % 4 < 2 ? 1 : 0
      pose.eyes = p < 0.35 ? 'look_down' : p < 0.6 ? 'look_left' : p < 0.8 ? 'look_right' : 'forward'
      if (p < 0.5 && f % 8 === 0) sweat(E, L.ox0, row)
    } else if (s < T.phew[1]) {
      pose.eyes = seg(s, T.phew) < 0.4 ? 'blink' : 'forward'
      pose.bubble = 'phew'
    } else {
      const w = (s - BUILD0) % BUILD_CYCLE
      if (s >= BUILD0 && w < ROW_BUILD) bob = (w * 4.5) % 1 < 0.3 ? -1 : 0 // a heave per throw
      pose.eyes = blinkAt(s) ? 'blink' : 'look_left'
    }
    pose.ox = L.ox0 + pose.shake
    pose.oy = row + bob
    pose.planks = ROWS - rowsBuilt(s)
    pose.stackH = Math.max(pose.planks, 1)
    return pose
  }

  // Where the crane Clawd hangs to work on screw corner c.
  function cornerSpot(L, c) {
    const { sx, sy } = screwXY(L, c)
    const left = c === 0 || c === 3
    return { ox: left ? sx - 14 : sx + 1, oy: sy - 2, sx, sy, left }
  }

  function drinkSpot(L) {
    return { ox: L.helperX - 18, oy: L.floorOy(1) }
  }

  // Fetching the poster, mounting it, and the drink afterwards.
  function posterPose(L, s) {
    const pose = basePose()
    const tl = cornerSpot(L, 0)
    if (s < P.exit[0]) {
      pose.ox = L.ox0
      pose.oy = Math.round(lerp(L.builderY(ROWS), L.builderY(1), easeInOut(seg(s, P.hoist))))
      pose.eyes = blinkAt(s) ? 'blink' : 'forward'
      return pose
    }
    if (s < P.back[0]) {
      pose.ox = Math.round(lerp(L.ox0, L.GW + 15, easeIn(seg(s, P.exit))))
      pose.oy = L.builderY(1)
      pose.eyes = 'look_right'
      return pose
    }
    if (s < P.hopOff[0]) {
      pose.ox = Math.round(lerp(L.GW + 15, tl.ox, easeOut(seg(s, P.back))))
      pose.oy = L.builderY(1)
      pose.rider = true
      pose.roll = true
      pose.stackH = 11
      return pose
    }
    if (s < P.unroll[0]) {
      pose.ox = tl.ox
      pose.oy = s < P.rise[0] ? L.builderY(1) : Math.round(lerp(L.builderY(1), tl.oy, easeInOut(seg(s, P.rise))))
      pose.roll = true
      pose.eyes = 'look_right'
      return pose
    }

    const st = stepAt(s)
    const { W, H, PT } = L.poster
    const crookDrop = Math.round((W - 5) * Math.sin(CROOK))
    const rollY = PT + Math.round(ROLLED * H)
    const at = (c) => cornerSpot(L, c)
    const facing = (c) => (at(c).left ? 'look_right' : 'look_left')
    const drink = drinkSpot(L)
    const name = st ? st.name : 'unroll'

    if (name === 'unroll') {
      Object.assign(pose, { ox: tl.ox, oy: tl.oy, eyes: 'look_down' })
    } else if (name === 'hand' || name === 'screw') {
      const a = at(st.c)
      Object.assign(pose, { ox: a.ox, oy: a.oy, eyes: name === 'hand' && st.p < 0.4 ? 'look_right' : facing(st.c) })
      if (name === 'screw') pose.driver = st.c
    } else if (name === 'release') {
      Object.assign(pose, { ox: tl.ox, oy: tl.oy, eyes: st.p < 0.5 ? 'look_right' : 'blink' })
    } else if (name === 'move') {
      const a = at(st.from)
      const b = at(st.to)
      const by = st.to === 1 ? b.oy + crookDrop : st.to === 2 ? rollY - 2 : b.oy
      const p = easeInOut(st.p)
      pose.ox = Math.round(lerp(a.ox, b.ox, p))
      pose.oy = Math.round(lerp(st.from === 2 ? a.oy : a.oy, by, p))
      pose.eyes = facing(st.to)
    } else if (name === 'lift') {
      const b = at(1)
      Object.assign(pose, { ox: b.ox, oy: Math.round(b.oy + crookDrop * (1 - easeInOut(st.p))), eyes: facing(1) })
    } else if (name === 'pull') {
      const b = at(2)
      Object.assign(pose, { ox: b.ox, oy: Math.round(lerp(rollY - 2, b.oy, easeInOut(st.p))), eyes: 'look_down' })
    } else if (name === 'flatten') {
      Object.assign(pose, { ox: at(3).ox, oy: at(3).oy, eyes: facing(3) })
    } else if (name === 'come') {
      const a = at(3)
      pose.ox = Math.round(lerp(a.ox, drink.ox, easeInOut(st.p)))
      pose.oy = Math.round(lerp(a.oy, drink.oy, st.p) - Math.sin(st.p * Math.PI) * 10)
      pose.legs = 'a'
      pose.eyes = 'look_right'
    } else {
      // toss / clink / sip / ahh / idle — sitting next to the helper
      Object.assign(pose, drink)
      pose.eyes = blinkAt(s, 400) ? 'blink' : 'look_right'
      if (name === 'toss') pose.bottle = st.p >= 1 ? 'up' : null
      else if (name === 'clink') {
        pose.bottle = 'up'
        pose.clink = st.p > 0.3 && st.p < 0.7 ? 1 : 0
      } else if (name === 'sip') {
        pose.bottle = 'sip'
        pose.eyes = 'blink'
      } else if (name === 'ahh') {
        pose.bottle = 'up'
        pose.blush = seg(st.p, [0, 0.3]) * 0.85
        pose.bubble = 'ahh~'
        pose.eyes = 'forward'
      } else if (name === 'idle') {
        const sipping = (s - DRINK_END) % 5 < 0.8
        pose.bottle = sipping ? 'sip' : 'up'
        if (sipping) pose.eyes = 'blink'
        pose.blush = 0.5
        knockOver(pose, s, -1)
      }
    }
    if (s >= find('come').a) {
      // off the crane: the empty seat waits, then the crane drives off to the right
      const a = at(3)
      const p = easeIn(seg(s, [find('come').b, find('come').b + 1.8]))
      pose.onFoot = true
      pose.rig = { ox: Math.round(lerp(a.ox, L.GW + 20, p)), oy: Math.round(lerp(a.oy, L.builderY(1), p)) }
    }
    return pose
  }

  // Shoved back (dir -1 = left) and knocked flat by the newcomer's landing.
  function knockOver(pose, s, dir) {
    const k = knockAt(s)
    if (!k) return
    pose.push = k.push * dir
    pose.ox += pose.push
    pose.oy += k.drop
    pose.legs = k.legs
    if (k.dizzy) {
      pose.dizzy = true
      pose.eyes = (s * 1000) % 500 < 250 ? 'blink' : 'look_down'
      if (pose.bottle === 'sip') pose.bottle = 'up'
    } else if (s < CRASH.up[1]) pose.eyes = 'forward'
  }

  // The new Clawd who rode in on the crane Clawd's head: jumps onto the top
  // level with the toolbox and hands up the screws (and later the drinks).
  function helperPose(E, L, s) {
    if (s < P.hopOff[0]) return null
    const spot = { ox: L.helperX, oy: L.floorOy(1) }
    const pose = { ...spot, eyes: 'look_left', legs: 'stand', carry: false, bottle: null, bubble: null, blush: 0 }
    if (s < P.hopOff[1]) {
      const p = seg(s, P.hopOff)
      const from = cornerSpot(L, 0)
      pose.ox = Math.round(lerp(from.ox, spot.ox, easeInOut(p)))
      pose.oy = Math.round(lerp(L.builderY(1) - 8, spot.oy, p) - Math.sin(p * Math.PI) * 10)
      pose.carry = true
      pose.legs = 'a'
      pose.eyes = 'look_right'
      return pose
    }
    if (once('helper-land')) dust(E, spot.ox + 7, L.floors[1], 6, 6)
    const st = stepAt(s)
    const name = st ? st.name : 'wait'
    pose.eyes = blinkAt(s, 1500) ? 'blink' : 'look_left'
    if ((name === 'hand' && st.p < 0.4) || (name === 'toss' && st.p < 0.3)) {
      pose.oy += 1 // rummaging in the toolbox
      pose.eyes = 'look_right'
    }
    if (name === 'toss') pose.bottle = st.p >= 0.3 ? 'up' : null
    else if (name === 'clink') {
      pose.bottle = 'up'
      pose.bubble = 'prost!'
    } else if (name === 'sip') {
      pose.bottle = 'sip'
      pose.eyes = 'blink'
    } else if (name === 'ahh') {
      pose.bottle = 'up'
      pose.blush = seg(st.p, [0, 0.3]) * 0.85
      pose.eyes = 'forward'
    } else if (name === 'idle') {
      const sipping = (s - DRINK_END + 2.5) % 5 < 0.8
      pose.bottle = sipping ? 'sip' : 'up'
      if (sipping) pose.eyes = 'blink'
      pose.blush = 0.5
      knockOver(pose, s, 1)
    }
    return pose
  }

  // The third Clawd: falls out of the sky and lands right between the two.
  function newcomerPose(E, L, s) {
    if (s < CRASH.fall[0]) return null
    const x = L.helperX - 9
    const floorOy = L.floorOy(1)
    const pose = { ox: x, oy: floorOy, eyes: 'forward', legs: 'stand', bubble: null }
    if (s < CRASH.fall[1]) {
      const p = seg(s, CRASH.fall)
      pose.oy = Math.round(lerp(-16, floorOy, easeIn(p)))
      pose.legs = (s * 1000) % 140 < 70 ? 'a' : 'b'
      pose.eyes = 'look_down'
      pose.shadow = Math.round(lerp(2, 12, p))
      return pose
    }
    if (once('crash')) {
      dust(E, x + 1, L.floors[1], 10, 6)
      dust(E, x + 12, L.floors[1], 10, 6)
      for (let n = 0; n < 10; n++) E.addParticle(x + 7, L.floors[1] - 2, PALETTE.dust.puff, { vx: (n % 2 ? 1 : -1) * (0.6 + Math.random() * 0.6), vy: -0.3, decay: 0.04 })
    }
    const t = s - CRASH.down[0]
    if (t < 0.12) {
      pose.oy += 1 // squash on landing
      pose.legs = 'none'
    }
    if (s < CRASH.up[1]) {
      pose.eyes = t < 0.3 ? 'blink' : Math.floor(t / 0.4) % 2 ? 'look_right' : 'look_left'
      if (t >= 0.3) pose.bubble = 'oops'
    } else pose.eyes = blinkAt(s, 2200) ? 'blink' : 'forward'
    return pose
  }

  function drawNewcomer(E, L, pose) {
    if (!pose) return
    if (pose.shadow) E.rect(pose.ox + 7 - pose.shadow / 2, L.floors[1] - 1, pose.shadow, 1, PALETTE.steel.dark)
    E.drawClawd(pose.ox, pose.oy, { eyes: pose.eyes, legs: pose.legs })
  }

  // Two little stars circling over a knocked-out head.
  function drawDizzy(E, ox, oy, s) {
    for (let n = 0; n < 2; n++) {
      const a = s * 8 + n * Math.PI
      E.px(ox + 7 + Math.round(Math.cos(a) * 5), oy - 2 + Math.round(Math.sin(a)), PALETTE.confetti.yellow)
    }
  }

  // ─── Props for the poster job ────────────────────────────────
  function drawToolbox(E, x, y) {
    const { box, lid, handle, latch } = PALETTE.toolbox
    E.rect(x + 2, y, 2, 1, handle)
    E.rect(x, y + 1, 6, 1, lid)
    E.rect(x, y + 2, 6, 2, box)
    E.rect(x + 2, y + 2, 2, 1, latch)
  }

  // Bottle held upright in a claw (2×5), or tipped up to drink (4×2, neck to the face).
  function drawBottle(E, x, y, sip, neckRight) {
    const { glass, shine, cap } = PALETTE.bottle
    if (!sip) {
      E.rect(x, y, 2, 1, cap)
      E.rect(x, y + 1, 2, 4, glass)
      E.px(x + 1, y + 2, shine)
      return
    }
    E.rect(x - 1, y, 4, 2, glass)
    E.px(x, y, shine)
    E.px(neckRight ? x + 3 : x - 2, y, cap)
  }

  function drawScrew(E, x, y, spin) {
    E.rect(x - 1, y - 1, 3, 3, PALETTE.screw.head)
    const slot = PALETTE.screw.slot
    if (spin % 2 === 0) {
      E.rect(x - 1, y, 3, 1, slot)
      E.rect(x, y - 1, 1, 3, slot)
    } else {
      for (const [dx, dy] of [[-1, -1], [1, 1], [0, 0], [1, -1], [-1, 1]]) E.px(x + dx, y + dy, slot)
    }
  }

  // Rolled-up poster carried in the claw.
  function drawRoll(E, x, y, w) {
    const { paper, back, shade } = PALETTE.poster
    E.rect(x, y, w, 1, paper)
    E.rect(x, y + 1, w, 1, back)
    E.rect(x, y + 2, w, 1, shade)
    E.rect(x, y, 1, 3, shade)
    E.rect(x + w - 1, y, 1, 3, shade)
  }

  // The poster on the wall: partly rolled, crooked, or with a curled corner.
  const bitmaps = new Map()
  function drawPoster(E, L, ps) {
    if (!ps) return
    const { PX, PT, W, H } = L.poster
    const img = posterPicture()
    const key = `${W}x${H}:${img ? 'img' : 'blank'}`
    if (!bitmaps.has(key)) bitmaps.set(key, posterBitmap(W, H, img))
    const bmp = bitmaps.get(key)
    const { paper, back, shade } = PALETTE.poster
    const roll = [paper, back, shade]
    const hv = Math.round(ps.visible * H)
    const rollH = hv < H ? 3 : 0
    const D = ps.dogEar
    const texel = (u, v) => {
      if (u < 0 || u >= W || v < 0) return null
      if (v >= hv) return v < hv + rollH ? roll[v - hv] : null
      if (D > 0) {
        const yb = H - 1 - v
        const d = u + yb
        if (d < D) return null // folded away
        if (d < 2 * D && u <= D && yb <= D) return d === D ? shade : back // the curled-over flap
      }
      return bmp[v][u]
    }
    if (Math.abs(ps.theta) < 0.001) {
      for (let v = 0; v < hv + rollH; v++) {
        for (let u = 0; u < W; u++) {
          const c = texel(u, v)
          if (c) E.px(PX + u, PT + v, c)
        }
      }
    } else {
      // hanging from the top-left screw: rotate about it, sampling back into the poster
      const px0 = PX + 2
      const py0 = PT + 2
      const cos = Math.cos(ps.theta)
      const sin = Math.sin(ps.theta)
      const R = Math.ceil(Math.hypot(W, H)) + 2
      for (let y = py0 - 3; y < py0 + R; y++) {
        for (let x = px0 - R; x < px0 + R; x++) {
          const dx = x - px0
          const dy = y - py0
          const c = texel(Math.round(cos * dx + sin * dy) + 2, Math.round(-sin * dx + cos * dy) + 2)
          if (c) E.px(x, y, c)
        }
      }
    }
    ps.fixed.forEach((c) => {
      const { sx, sy } = screwXY(L, c)
      drawScrew(E, sx, sy, 0)
    })
  }

  // Screws and bottles in the air, from the toolbox up to the crane Clawd.
  function drawThrows(E, L, s, f) {
    const st = stepAt(s)
    if (!st) return
    const from = { x: L.helperX + 17, y: L.floors[1] - 5 }
    const arc = (to, p) => ({
      x: lerp(from.x, to.x, p),
      y: lerp(from.y, to.y, p) - Math.sin(p * Math.PI) * (6 + Math.abs(to.x - from.x) * 0.15),
    })
    if (st.name === 'hand' && st.p >= 0.4) {
      const { sx, sy } = screwXY(L, st.c)
      const q = arc({ x: sx, y: sy }, (st.p - 0.4) / 0.6)
      E.rect(q.x, q.y, 1, 2, PALETTE.screw.head)
    } else if (st.name === 'screw') {
      const { sx, sy } = screwXY(L, st.c)
      drawScrew(E, sx, sy, Math.floor(f / 3))
      if (f % 4 === 0) E.addParticle(sx, sy, PALETTE.confetti.yellow, { decay: 0.08 })
    } else if (st.name === 'toss' && st.p >= 0.3 && st.p < 1) {
      const d = drinkSpot(L)
      const q = arc({ x: d.ox + 13, y: d.oy - 1 }, (st.p - 0.3) / 0.7)
      drawBottle(E, Math.round(q.x), Math.round(q.y), false)
    } else if (st.name === 'clink' && once('clink', st.p > 0.4)) {
      const d = drinkSpot(L)
      for (let n = 0; n < 8; n++) {
        E.addParticle(d.ox + 16, d.oy - 1, n % 2 ? PALETTE.ui.white : PALETTE.confetti.yellow, { decay: 0.05 })
      }
    }
  }

  function drawBuilder(E, L, pose, tipX) {
    if (pose.onFoot) {
      const r = pose.rig
      if (r.ox < L.GW + 15) {
        E.clipBelow(CABLE_TOP, () => {
          drawCable(E, tipX + 1, CABLE_TOP, r.ox + 6, r.oy - 5)
          drawRig(E, r.ox, r.oy, r.oy - 4)
        })
      }
      const { ox, oy } = pose
      E.drawClawd(ox, oy, { eyes: pose.eyes, legs: pose.legs })
      if (pose.bottle === 'up') drawBottle(E, ox + 13 + pose.clink, oy - 1, false)
      if (pose.bottle === 'sip') drawBottle(E, ox + 11, oy + 1, true, false)
      if (pose.blush) E.drawBlush(ox, oy, pose.blush)
      return
    }
    const { ox, oy } = pose
    const hookY = oy - pose.stackH - 3
    E.clipBelow(CABLE_TOP, () => {
      drawCable(E, tipX + 1, CABLE_TOP, ox + 6, hookY - 1)
      drawRig(E, ox, oy, hookY)
      E.drawClawd(ox, oy, { eyes: pose.eyes, legs: pose.legs })
      drawStack(E, ox, oy, pose.planks)
      if (pose.rider) {
        // the new Clawd, riding on his head with the toolbox
        E.drawClawd(ox, oy - 8, { eyes: 'look_left' })
        E.drawSprite(SPRITES.hardhat, ox + 2, oy - 11)
        drawToolbox(E, ox + 13, oy - 6)
      }
      if (pose.roll) drawRoll(E, ox + 12, oy, L.poster.W)
      if (pose.driver !== null) {
        const { sx, sy, left } = cornerSpot(L, pose.driver)
        E.px(left ? sx - 2 : sx + 2, sy, PALETTE.driver.grip)
        E.px(left ? sx - 1 : sx + 1, sy, PALETTE.driver.shaft)
      }
      if (pose.bottle === 'up') drawBottle(E, ox + 13 + pose.clink, oy - 1, false)
      if (pose.bottle === 'sip') drawBottle(E, ox + 11, oy + 1, true, false)
      if (pose.blush) E.drawBlush(ox, oy, pose.blush)
    })
  }

  function drawHelper(E, L, pose) {
    if (!pose) return
    const { ox, oy } = pose
    if (pose.carry) drawToolbox(E, ox + 13, oy + 2)
    else drawToolbox(E, L.helperX + 15 + (pose.push || 0), L.floors[1] - 4) // shoved along with him
    E.drawClawd(ox, oy, { eyes: pose.eyes, legs: pose.legs })
    E.drawSprite(SPRITES.hardhat, ox + 2, oy - 3)
    if (pose.bottle === 'up') drawBottle(E, ox - 2, oy - 1, false)
    if (pose.bottle === 'sip') drawBottle(E, ox + 1, oy + 1, true, true)
    if (pose.blush) E.drawBlush(ox, oy, pose.blush)
  }

  // ─── Frame ───────────────────────────────────────────────────
  function render(E, s, f) {
    const { GW, GH } = E.grid()
    const L = layout(GW, GH)
    E.setOffset(0)
    E.drawBg()
    if (during(s, [CRASH.down[0], CRASH.down[0] + 0.25])) E.setOffset(f % 2 ? 1 : -1) // the landing shakes the screen

    const builder = s < T.descent[0] ? null : s < BUILD_END ? buildPose(E, L, s, f) : posterPose(L, s)
    let tipX = Math.round(lerp(GW + 1, L.tipFinal, easeOut(seg(s, T.jibIn))))
    if (during(s, T.jibSettle)) {
      const p = seg(s, T.jibSettle)
      tipX += Math.round(Math.sin(p * Math.PI * 3) * (1 - p) * 1.5)
    }
    if (s >= P.exit[0]) tipX = (builder.onFoot ? builder.rig.ox : builder.ox) + 5 // the crane carries the seat around now; a shove just swings it

    drawWall(E, L, painterPlan(s))
    const stackTop = { x: L.ox0 + 7, y: builderRow(L, s) - (ROWS - rowsBuilt(s)) - 1 }
    drawScaffold(E, L, s, stackTop)
    drawPoster(E, L, posterAt(s))
    const painter = drawPainter(E, L, s, f)
    const helper = helperPose(E, L, s)
    const newcomer = newcomerPose(E, L, s)
    drawHelper(E, L, helper)
    if (builder) drawBuilder(E, L, builder, tipX)
    drawNewcomer(E, L, newcomer)
    for (const who of [builder, helper]) if (who?.dizzy) drawDizzy(E, who.ox, who.oy, s)
    drawThrows(E, L, s, f)
    drawJib(E, tipX, GW, f)
    E.tickParticles()

    // Speech bubbles: beside the builder on his way down, centred over the
    // pair's heads at the poster, beside the painter.
    const above = (who) => {
      const w = bubbleWidth(who.bubble) * BUBBLE_K
      E.drawBubble(who.ox + 7 - Math.floor(w / 2), who.oy - 12, who.bubble, 'left', BUBBLE_K)
    }
    if (builder?.bubble) {
      if (s >= BUILD_END) above(builder)
      else {
        const w = bubbleWidth(builder.bubble) * BUBBLE_K
        E.drawBubble(builder.ox - w - 2, Math.max(CABLE_TOP, builder.oy - builder.stackH - 8), builder.bubble, 'right', BUBBLE_K)
      }
    }
    if (helper?.bubble) above(helper)
    if (newcomer?.bubble) above(newcomer)
    if (painter?.bubble) {
      const w = bubbleWidth(painter.bubble) * BUBBLE_K
      E.drawBubble(painter.ox - w - 1, painter.oy - 12, painter.bubble, 'right', BUBBLE_K)
    }
  }

  return { render }
}
