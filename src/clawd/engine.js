// Clawd pixel engine, ported from .claude/skills/clawd-animation/references/template.html.
// Same palette, 14×8 body, eye variants, heart, bubble, particles and easing.
// Differences: the grid is sized to the viewport instead of a fixed 720×720
// canvas, and the background is plain white (the screen left by the wipe).

export const PALETTE = {
  background: { bg: '#FFFFFF' },
  stars: { dark: '#333333', mid: '#888888', light: '#BBBBBB' },
  clawd: { body: '#CD6E58', eye: '#000000' },
  ui: { white: '#FFFFFF' },
  blush: { light: '#FAC8D8', pink: '#F06090' },
  phone: { case: '#2B2B2B', screen: '#9ED0F0', lit: '#E6F6FF' },
  signal: { wave: '#D97757' },
  hardhat: { top: '#F2C230', brim: '#C99A1A' },
  confetti: { red: '#E8505B', yellow: '#F9C74F', blue: '#4D96FF', green: '#6BCB77' },
  dust: { puff: '#D8D4CC' },
  crane: { jib: '#F2C230', lattice: '#C99A1A', trolley: '#555555', cable: '#3A3A3A', rig: '#6E6E6E', seat: '#4A4A4A', light: '#E8505B' },
  brush: { handle: '#8B5A2B', ferrule: '#BBBBBB' },
  wood: { base: '#975C3E', light: '#E0AC7C', dark: '#6E4029' },
  steel: { light: '#B5B5B5', tube: '#8A8A8A', dark: '#5E5E5E' },
  bucket: { rim: '#555555', body: '#BBBBBB' },
  poster: { paper: '#FFF8E7', back: '#E6DCC8', shade: '#BFB39A', border: '#CD6E58' },
  toolbox: { box: '#D64545', lid: '#A93636', handle: '#3A3A3A', latch: '#BBBBBB' },
  bottle: { glass: '#4E9A5B', shine: '#9ED7A5', cap: '#C99A1A' },
  screw: { head: '#9A9A9A', slot: '#444444' },
  driver: { grip: '#E8505B', shaft: '#BBBBBB' },
  sweat: { drop: '#9ED0F0' },
}

// ─── SPRITES ─────────────────────────────────────────────────

// Clawd body (14×8) — verbatim from the skill template.
export const CLAWD_BODY = {
  width: 14,
  height: 8,
  data: [
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
  ],
  anchors: {
    eyeLeft: { x: 4, y: 1 },
    eyeRight: { x: 9, y: 1 },
    hatTop: { x: 7, y: -1 },
    handLeft: { x: 0, y: 2 },
    handRight: { x: 13, y: 2 },
    sitBottom: { x: 7, y: 8 },
  },
}

export const EYES = {
  forward: { left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } },
  look_right: { left: { dx: 1, dy: 0 }, right: { dx: 1, dy: 0 } },
  look_left: { left: { dx: -1, dy: 0 }, right: { dx: -1, dy: 0 } },
  look_down: { left: { dx: 0, dy: 1 }, right: { dx: 0, dy: 1 } },
  blink: { type: 'hidden' },
}

// Run cycle: which feet (columns of the bottom row) touch the ground.
const LEGS_DOWN = { a: [3, 8], b: [5, 10] }

// Heart sprite (5×4)
const HEART = [
  [1, 0, 1, 0, 0],
  [1, 1, 1, 1, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
]

// Props: pixel matrix + palette map. 3 is always the white highlight.
export const SPRITES = {
  phone: {
    data: [
      [1, 1, 1, 1],
      [1, 2, 2, 1],
      [1, 2, 3, 1],
      [1, 2, 2, 1],
      [1, 2, 2, 1],
      [1, 1, 1, 1],
    ],
    map: { 1: PALETTE.phone.case, 2: PALETTE.phone.screen, 3: PALETTE.ui.white },
  },
  hardhat: {
    data: [
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 3, 1, 1, 1, 1, 1, 0],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    map: { 1: PALETTE.hardhat.top, 2: PALETTE.hardhat.brim, 3: PALETTE.ui.white },
  },
}

// ─── EASING ──────────────────────────────────────────────────
export function easeOut(t) { return 1 - Math.pow(1 - t, 3) }
export function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
export function lerp(a, b, t) { return a + (b - a) * t }

const clamp01 = (v) => Math.max(0, Math.min(1, v))

// Width of a speech bubble in bubble pixels (see drawBubble).
export const bubbleWidth = (text) => Math.ceil(text.length / 2) + 2

// ─── ENGINE ──────────────────────────────────────────────────
export function createEngine(ctx) {
  let PX = 20
  let GW = 36
  let GH = 36
  let offX = 0 // whole-scene horizontal offset, for screen shake
  let particles = []
  let particlesOn = true

  function setGrid(px, gw, gh) {
    PX = px
    GW = gw
    GH = gh
  }

  function px(gx, gy, col) {
    ctx.fillStyle = col
    ctx.fillRect(Math.round(gx + offX) * PX, Math.round(gy) * PX, PX, PX)
  }

  function rect(gx, gy, w, h, col) {
    ctx.fillStyle = col
    ctx.fillRect(Math.round(gx + offX) * PX, Math.round(gy) * PX, Math.round(w) * PX, Math.round(h) * PX)
  }

  function withAlpha(alpha, draw) {
    ctx.globalAlpha = clamp01(alpha)
    draw()
    ctx.globalAlpha = 1
  }

  function drawBg() {
    ctx.fillStyle = PALETTE.background.bg
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  function drawClawd(ox, oy, opts = {}) {
    const eyeVariant = opts.eyes || 'forward'
    const legs = opts.legs || 'stand'
    const x = Math.round(ox)
    const y = Math.round(oy)

    for (let r = 0; r < CLAWD_BODY.height; r++) {
      for (let c = 0; c < CLAWD_BODY.width; c++) {
        if (CLAWD_BODY.data[r][c] !== 1) continue
        if (legs === 'none' && r >= CLAWD_BODY.height - 2) continue // sitting flat, legs tucked
        if (r === CLAWD_BODY.height - 1 && legs !== 'stand' && legs !== 'none' && !LEGS_DOWN[legs].includes(c)) continue
        px(x + c, y + r, PALETTE.clawd.body)
      }
    }

    const ev = EYES[eyeVariant]
    if (ev && ev.type !== 'hidden') {
      const el = CLAWD_BODY.anchors.eyeLeft
      const er = CLAWD_BODY.anchors.eyeRight
      px(x + el.x + ev.left.dx, y + el.y + ev.left.dy, PALETTE.clawd.eye)
      px(x + er.x + ev.right.dx, y + er.y + ev.right.dy, PALETTE.clawd.eye)
    }
  }

  function drawSprite(sprite, sx, sy, overrides = null, alpha = 1) {
    const map = overrides ? { ...sprite.map, ...overrides } : sprite.map
    const x = Math.round(sx)
    const y = Math.round(sy)
    withAlpha(alpha, () => {
      sprite.data.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v && map[v]) px(x + c, y + r, map[v])
        }),
      )
    })
  }

  // Blush from the clawd-kiss reference: two pink cheeks under the eyes.
  function drawBlush(ox, oy, alpha) {
    if (alpha <= 0) return
    withAlpha(alpha, () => {
      px(Math.round(ox) + 3, Math.round(oy) + 2, PALETTE.blush.light)
      px(Math.round(ox) + 10, Math.round(oy) + 2, PALETTE.blush.light)
    })
  }

  function drawHeart(hx, hy, col) {
    for (let r = 0; r < HEART.length; r++) {
      for (let c = 0; c < HEART[r].length; c++) {
        if (HEART[r][c] === 1) px(Math.round(hx) + c - 1, Math.round(hy) + r, col)
      }
    }
  }

  // Speech bubble from the skill template, with the tail on either side.
  // `k` draws each bubble pixel as k×k cells, so text stays readable on fine grids.
  function drawBubble(bx, by, text, tail = 'left', k = 1) {
    const x0 = Math.round(bx)
    const y0 = Math.round(by)
    const tw = bubbleWidth(text)
    const dot = (x, y, col) => rect(x0 + x * k, y0 + y * k, k, k, col)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < tw; x++) {
        const corner = (y === 0 || y === 2) && (x === 0 || x === tw - 1)
        if (corner) continue
        const edge = y === 0 || y === 2 || x === 0 || x === tw - 1
        dot(x, y, edge ? PALETTE.stars.mid : PALETTE.ui.white)
      }
    }
    dot(tail === 'left' ? 1 : tw - 2, 3, PALETTE.stars.mid)
    ctx.fillStyle = PALETTE.stars.dark
    ctx.font = `bold ${Math.round(PX * k * 0.75)}px 'Courier New', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, (x0 + offX + (tw * k) / 2) * PX, (y0 + 1.5 * k) * PX)
  }

  // Draw only rows at or below `row` (things lowered out of the crane).
  function clipBelow(row, draw) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, row * PX, ctx.canvas.width, ctx.canvas.height)
    ctx.clip()
    draw()
    ctx.restore()
  }

  // ─── PARTICLES ───────────────────────────────────────────────
  // Same model as the template; optional overrides for velocity, gravity, decay.
  function addParticle(x, y, col, o = {}) {
    if (!particlesOn) return
    particles.push({
      x,
      y,
      vx: o.vx ?? (Math.random() - 0.5) * 0.8,
      vy: o.vy ?? -Math.random() * 0.8 - 0.3,
      g: o.g ?? 0.04,
      decay: o.decay ?? 0.02,
      life: 1.0,
      col,
    })
  }

  function tickParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += p.g
      p.life -= p.decay
      if (p.life <= 0) {
        particles.splice(i, 1)
        continue
      }
      if (p.life > 0.15) px(Math.round(p.x), Math.round(p.y), p.col)
    }
  }

  return {
    setGrid,
    grid: () => ({ PX, GW, GH }),
    setOffset: (dx) => { offX = dx },
    setParticles: (on) => { particlesOn = on; if (!on) particles = [] },
    px,
    rect,
    pxa: (gx, gy, col, alpha) => withAlpha(alpha, () => px(gx, gy, col)),
    drawBg,
    drawClawd,
    drawSprite,
    drawBlush,
    drawHeart,
    drawBubble,
    clipBelow,
    addParticle,
    tickParticles,
  }
}
