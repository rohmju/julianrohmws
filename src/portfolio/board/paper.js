// Procedural aged paper for the WANTED posters: torn outline, mottled fibre, stains, foxing,
// burnt edges and fold creases, plus a matching height map for the normal map.
// Canvas 2D only (no ctx.filter, which Safari lacks); blur comes from drawing small and scaling up.

export const TAU = Math.PI * 2

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function tracePath(ctx, points, scale = 1) {
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)))
  ctx.closePath()
}

// Ragged outline: each edge wanders inward with a damped random walk, plus the odd tear and a
// chance of a torn-off corner.
function tornOutline(w, h, rng) {
  const unit = w / 1024
  const points = []
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const length = Math.hypot(x1 - x0, y1 - y0)
    const steps = Math.ceil(length / (4 * unit))
    const bites = []
    if (rng() < 0.55) bites.push({ at: 0.15 + rng() * 0.7, width: 0.02 + rng() * 0.05, depth: (10 + rng() * 26) * unit })
    let walk = 0
    let velocity = 0
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      velocity = (velocity + (rng() - 0.5) * 0.9) * 0.82
      walk = (walk + velocity) * 0.97
      let d = (7 + Math.abs(walk) * 2.2 + rng() * 2.6) * unit
      for (const b of bites) {
        const k = 1 - Math.abs(t - b.at) / b.width
        if (k > 0) d += b.depth * k * k * (0.75 + 0.25 * rng())
      }
      points.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d])
    }
  }
  edge(0, 0, w, 0, 0, 1)
  edge(w, 0, w, h, -1, 0)
  edge(w, h, 0, h, 0, -1)
  edge(0, h, 0, 0, 1, 0)

  // Torn-off corners: push points behind a jagged diagonal.
  const corners = [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [w, h, -1, -1],
    [0, h, 1, -1],
  ]
  for (const [cx, cy, sx, sy] of corners) {
    if (rng() > 0.4) continue
    const reach = (40 + rng() * 70) * unit
    for (const p of points) {
      const u = (p[0] - cx) * sx
      const v = (p[1] - cy) * sy
      const limit = reach + (rng() - 0.5) * 9 * unit
      if (u + v < limit) {
        const push = (limit - (u + v)) / 2
        p[0] += sx * push
        p[1] += sy * push
      }
    }
  }
  return points
}

// Bilinear-upscaled random field: large cells give soft mottling, tiny cells give grain.
function noise(ctx, w, h, rng, cell, alpha, mode, lo = 0, hi = 255, warm = true) {
  const sw = Math.ceil(w / cell) + 2
  const sh = Math.ceil(h / cell) + 2
  const small = makeCanvas(sw, sh)
  const sctx = small.getContext('2d')
  const image = sctx.createImageData(sw, sh)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = lo + rng() * (hi - lo)
    image.data[i] = v
    image.data[i + 1] = warm ? v * 0.96 : v
    image.data[i + 2] = warm ? v * 0.86 : v
    image.data[i + 3] = 255
  }
  sctx.putImageData(image, 0, 0)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = mode
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, -cell, -cell, sw * cell, sh * cell)
  ctx.restore()
}

function blob(ctx, cx, cy, radius, rng, wobble = 0.35) {
  const n = 28
  const phase = rng() * TAU
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU
    const r = radius * (1 + wobble * (Math.sin(a * 3 + phase) * 0.5 + Math.sin(a * 7 + phase * 2) * 0.3 + (rng() - 0.5) * 0.3))
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r * 0.85
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.closePath()
}

function stains(ctx, w, h, rng) {
  const unit = w / 1024
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  const count = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < count; i++) {
    const cx = rng() * w
    const cy = rng() * h
    const r = (40 + rng() * 150) * unit
    // Water mark: faint fill with a darker tide line.
    blob(ctx, cx, cy, r, rng)
    ctx.fillStyle = `rgba(150, 110, 60, ${0.05 + rng() * 0.07})`
    ctx.fill()
    ctx.lineWidth = (1.5 + rng() * 3) * unit
    ctx.strokeStyle = `rgba(110, 72, 34, ${0.12 + rng() * 0.14})`
    ctx.stroke()
  }
  if (rng() < 0.6) {
    // Coffee-cup ring, never quite closed.
    const cx = w * (0.2 + rng() * 0.6)
    const cy = h * (0.25 + rng() * 0.6)
    const r = (55 + rng() * 40) * unit
    const start = rng() * TAU
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.arc(cx + k * unit, cy - k * unit, r - k * 2 * unit, start, start + TAU * (0.7 + rng() * 0.25))
      ctx.lineWidth = (2 + rng() * 4) * unit
      ctx.strokeStyle = `rgba(105, 62, 26, ${0.08 + rng() * 0.1})`
      ctx.stroke()
    }
  }
  ctx.restore()
}

function foxing(ctx, w, h, rng) {
  const unit = w / 1024
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  const clusters = 3 + Math.floor(rng() * 4)
  for (let c = 0; c < clusters; c++) {
    const cx = rng() * w
    const cy = rng() * h
    const spots = 6 + Math.floor(rng() * 18)
    for (let i = 0; i < spots; i++) {
      const x = cx + (rng() - 0.5) * 120 * unit
      const y = cy + (rng() - 0.5) * 120 * unit
      const r = (1 + rng() * 5) * unit
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(120, 70, 30, ${0.25 + rng() * 0.35})`)
      g.addColorStop(1, 'rgba(120, 70, 30, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }
  ctx.restore()
}

function fibres(ctx, w, h, rng) {
  const unit = w / 1024
  ctx.save()
  ctx.lineCap = 'round'
  for (let i = 0; i < 900; i++) {
    const x = rng() * w
    const y = rng() * h
    const a = rng() * TAU
    const len = (3 + rng() * 14) * unit
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len)
    ctx.lineWidth = (0.5 + rng() * 0.8) * unit
    ctx.strokeStyle = rng() < 0.6 ? 'rgba(90, 64, 34, 0.09)' : 'rgba(255, 246, 220, 0.12)'
    ctx.stroke()
  }
  ctx.restore()
}

// Darkening that follows the torn edge: the outline is stroked small and scaled up for softness.
function edgeBurn(ctx, w, h, outline) {
  for (const [div, width, alpha] of [[10, 60, 0.55], [5, 16, 0.5]]) {
    const small = makeCanvas(Math.ceil(w / div), Math.ceil(h / div))
    const sctx = small.getContext('2d')
    tracePath(sctx, outline, 1 / div)
    sctx.lineWidth = width / div
    sctx.strokeStyle = '#4a2f14'
    sctx.stroke()
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = alpha
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(small, 0, 0, w, h)
    ctx.restore()
  }
}

// Folds (the poster was once folded in quarters) and a few random wrinkles.
function makeCreases(w, h, rng) {
  const lines = []
  const wander = (x, y, angle, length, steps, jitter) => {
    const pts = [[x, y]]
    for (let i = 1; i <= steps; i++) {
      angle += (rng() - 0.5) * jitter
      x += Math.cos(angle) * (length / steps)
      y += Math.sin(angle) * (length / steps)
      pts.push([x, y])
    }
    return pts
  }
  const fx = w * (0.47 + rng() * 0.06)
  lines.push({ pts: wander(fx, -10, Math.PI / 2 + (rng() - 0.5) * 0.02, h + 20, 24, 0.012), strength: 1, ridge: rng() < 0.5 })
  const fy = h * (rng() < 0.5 ? 0.5 : 0.34) + (rng() - 0.5) * h * 0.04
  lines.push({ pts: wander(-10, fy, (rng() - 0.5) * 0.02, w + 20, 24, 0.012), strength: 0.85, ridge: rng() < 0.5 })
  const wrinkles = 4 + Math.floor(rng() * 6)
  for (let i = 0; i < wrinkles; i++) {
    const len = w * (0.08 + rng() * 0.3)
    lines.push({ pts: wander(rng() * w, rng() * h, rng() * TAU, len, 10, 0.5), strength: 0.35 + rng() * 0.4, ridge: rng() < 0.5 })
  }
  return lines
}

function strokeLine(ctx, pts, dx = 0, dy = 0) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)))
  ctx.stroke()
}

function creaseShading(ctx, w, creases) {
  const unit = w / 1024
  ctx.save()
  ctx.lineJoin = 'round'
  for (const c of creases) {
    // Dirt settles into folds…
    ctx.globalCompositeOperation = 'multiply'
    ctx.lineWidth = 7 * unit * c.strength
    ctx.strokeStyle = `rgba(110, 80, 45, ${0.07 * c.strength})`
    strokeLine(ctx, c.pts)
    // …and the paper catches light on one side of the crease and shadows on the other.
    ctx.lineWidth = 1.3 * unit
    ctx.strokeStyle = `rgba(70, 45, 20, ${0.2 * c.strength})`
    strokeLine(ctx, c.pts, c.ridge ? 1 * unit : -1 * unit, 0.6 * unit)
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = `rgba(255, 245, 225, ${0.14 * c.strength})`
    strokeLine(ctx, c.pts, c.ridge ? -1 * unit : 1 * unit, -0.6 * unit)
  }
  ctx.restore()
}

// A sheet of paper (no ink yet): albedo with transparent torn edges, and a height map.
export function createSheet({ width, height, seed }) {
  const rng = mulberry32(seed)
  const outline = tornOutline(width, height, rng)
  const creases = makeCreases(width, height, rng)

  const albedo = makeCanvas(width, height)
  const ctx = albedo.getContext('2d')
  ctx.save()
  tracePath(ctx, outline)
  ctx.clip()
  const base = ctx.createRadialGradient(width * 0.5, height * 0.42, width * 0.08, width * 0.5, height * 0.5, width * 0.95)
  base.addColorStop(0, '#d9c6a0')
  base.addColorStop(0.55, '#c9b089')
  base.addColorStop(1, '#a58860')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)
  noise(ctx, width, height, rng, width / 5, 0.22, 'multiply', 150, 255)
  noise(ctx, width, height, rng, width / 16, 0.2, 'soft-light')
  noise(ctx, width, height, rng, width / 60, 0.12, 'multiply', 170, 255)
  noise(ctx, width, height, rng, 2.4, 0.12, 'soft-light', 0, 255, false)
  fibres(ctx, width, height, rng)
  stains(ctx, width, height, rng)
  foxing(ctx, width, height, rng)
  creaseShading(ctx, width, creases)
  edgeBurn(ctx, width, height, outline)
  ctx.restore()

  // Height map at half resolution: grain plus soft fold ridges/valleys.
  const hw = Math.round(width / 2)
  const hh = Math.round(height / 2)
  const heightMap = makeCanvas(hw, hh)
  const hctx = heightMap.getContext('2d')
  hctx.fillStyle = 'rgb(128,128,128)'
  hctx.fillRect(0, 0, hw, hh)
  noise(hctx, hw, hh, rng, hw / 30, 0.25, 'source-over', 100, 156, false)
  noise(hctx, hw, hh, rng, 1.6, 0.35, 'source-over', 96, 160, false)
  const scaled = creases.map((c) => ({ ...c, pts: c.pts.map(([x, y]) => [x / 2, y / 2]) }))
  for (const c of scaled) {
    for (const [lw, a] of [[9, 0.12], [3, 0.3]]) {
      hctx.lineWidth = lw * c.strength * (hw / 512)
      hctx.strokeStyle = c.ridge ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
      strokeLine(hctx, c.pts)
    }
  }

  return { width, height, outline, albedo, heightMap, rng, seed }
}

// Tangent-space normal map (OpenGL convention, +Y up) from a greyscale height canvas.
export function normalMapFrom(heightCanvas, strength = 2.2) {
  const { width: w, height: h } = heightCanvas
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data
  const out = makeCanvas(w, h)
  const octx = out.getContext('2d')
  const image = octx.createImageData(w, h)
  const at = (x, y) => src[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const nx = -dx
      const ny = dy
      const len = Math.hypot(nx, ny, 1)
      const i = (y * w + x) * 4
      image.data[i] = (nx / len * 0.5 + 0.5) * 255
      image.data[i + 1] = (ny / len * 0.5 + 0.5) * 255
      image.data[i + 2] = (1 / len * 0.5 + 0.5) * 255
      image.data[i + 3] = 255
    }
  }
  octx.putImageData(image, 0, 0)
  return out
}

// Ink printed on its own layer, then worn: speckles and patches erased before it is multiplied
// onto the paper, like old letterpress on rough stock. `wear` scales the damage (the backs carry
// readable body text, so they get less).
export function inkLayer(width, height, rng, draw, wear = 1) {
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = INK
  ctx.strokeStyle = INK
  draw(ctx)
  const unit = width / 1024
  ctx.globalCompositeOperation = 'destination-out'
  const specks = Math.round(((width * height) / 700) * wear)
  for (let i = 0; i < specks; i++) {
    ctx.globalAlpha = 0.25 + rng() * 0.75
    ctx.beginPath()
    ctx.arc(rng() * width, rng() * height, (0.4 + rng() * 1.5) * unit, 0, TAU)
    ctx.fill()
  }
  for (let i = 0; i < Math.round(14 * wear); i++) {
    ctx.globalAlpha = 0.12 + rng() * 0.22
    blob(ctx, rng() * width, rng() * height, (12 + rng() * 45) * unit, rng, 0.5)
    ctx.fill()
  }
  noise(ctx, width, height, rng, 3, 0.35 * wear, 'destination-out', 0, 255, false)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

// Multiplies an ink layer onto paper, with a faint offset second impression for ink spread.
export function printInk(ctx, ink, outline, alpha = 0.93) {
  ctx.save()
  tracePath(ctx, outline)
  ctx.clip()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = alpha
  ctx.drawImage(ink, 0, 0)
  ctx.globalAlpha = alpha * 0.22
  ctx.drawImage(ink, 0.8, 0.6)
  ctx.restore()
}

export const INK = '#211810'
export const RED_INK = '#7d2219'
