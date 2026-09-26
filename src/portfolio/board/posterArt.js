// Front and back artwork of a WANTED poster, drawn onto procedural paper (see paper.js).
// All text comes from src/portfolio/data/projects.json; empty fields render as placeholders.

import { INK, RED_INK, TAU, createSheet, inkLayer, makeCanvas, printInk, tracePath } from './paper.js'

export const POSTER_ASPECT = 1.38 // height / width
export const PIN_Y = 0.045 // pin hole position, fraction of the height from the top

const DISPLAY = '"Rye", "IM Fell English SC", Georgia, serif'
const CAPS = '"IM Fell English SC", "IM Fell English", Georgia, serif'
const BODY = '"IM Fell English", Georgia, serif'

export async function loadPosterFonts() {
  if (!document.fonts?.load) return
  await Promise.all([
    document.fonts.load(`120px ${DISPLAY}`, 'WANTED?'),
    document.fonts.load(`40px ${CAPS}`, 'PROJECT'),
    document.fonts.load(`italic 30px ${BODY}`, 'Description'),
    document.fonts.load(`30px ${BODY}`, 'Description'),
  ]).catch(() => {})
}

// Sets the largest font size (up to `max`) at which `text` fits in `maxWidth`.
function fit(ctx, text, family, max, maxWidth, weight = '') {
  ctx.font = `${weight} ${max}px ${family}`
  const width = ctx.measureText(text).width
  const size = width > maxWidth ? Math.floor((max * maxWidth) / width) : max
  ctx.font = `${weight} ${size}px ${family}`
  return size
}

// Centered text with manual letter spacing (canvas letterSpacing isn't universal yet).
function spaced(ctx, text, cx, y, spacing) {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let x = cx - total / 2
  ctx.textAlign = 'left'
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y)
    x += widths[i] + spacing
  })
  ctx.textAlign = 'center'
}

// A printed rule: slightly wavering, like hand-set brass rule.
function rule(ctx, x0, x1, y, width, rng) {
  ctx.lineWidth = width
  ctx.beginPath()
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    const yy = y + (rng() - 0.5) * width * 0.35
    i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)
  }
  ctx.stroke()
}

function star(ctx, cx, cy, r, points = 5, inner = 0.45) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2
    const rr = i % 2 ? r * inner : r
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

function ornamentRule(ctx, cx, y, half, unit, rng) {
  rule(ctx, cx - half, cx - 26 * unit, y, 2.2 * unit, rng)
  rule(ctx, cx + 26 * unit, cx + half, y, 2.2 * unit, rng)
  star(ctx, cx, y, 13 * unit)
  ctx.beginPath()
  ctx.arc(cx - half - 7 * unit, y, 3.5 * unit, 0, TAU)
  ctx.arc(cx + half + 7 * unit, y, 3.5 * unit, 0, TAU)
  ctx.fill()
}

function frameRect(ctx, x, y, w, h, unit, rng) {
  rule(ctx, x, x + w, y, 5 * unit, rng)
  rule(ctx, x, x + w, y + h, 5 * unit, rng)
  ctx.lineWidth = 5 * unit
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + (rng() - 0.5) * unit, y + h)
  ctx.moveTo(x + w, y)
  ctx.lineTo(x + w + (rng() - 0.5) * unit, y + h)
  ctx.stroke()
  ctx.lineWidth = 1.6 * unit
  ctx.strokeRect(x + 11 * unit, y + 11 * unit, w - 22 * unit, h - 22 * unit)
}

function pinHole(ctx, width, height) {
  const unit = width / 1024
  const x = width / 2
  const y = height * PIN_Y
  ctx.save()
  ctx.fillStyle = 'rgba(40, 26, 12, 0.5)'
  ctx.beginPath()
  ctx.arc(x, y, 9 * unit, 0, TAU)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(x, y, 4.5 * unit, 0, TAU)
  ctx.fill()
  ctx.restore()
}

async function loadImage(src) {
  if (!src) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Sepia-toned, contrast-lifted photo, cover-fitted into the image frame.
function engraving(img, w, h) {
  const canvas = makeCanvas(Math.round(w), Math.round(h))
  const ctx = canvas.getContext('2d')
  const scale = Math.max(w / img.width, h / img.height)
  ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = data.data
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
    const c = Math.min(1, Math.max(0, (l - 0.5) * 1.25 + 0.55))
    d[i] = 255 * Math.pow(c, 0.95)
    d[i + 1] = 235 * Math.pow(c, 1.02)
    d[i + 2] = 200 * Math.pow(c, 1.12)
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

// Front: WANTED · image · title · number. Returns the paper sheet too, for the back.
export async function drawPosterFront(project, index, { width, seed }) {
  const height = Math.round(width * POSTER_ASPECT)
  const sheet = createSheet({ width, height, seed })
  const { rng } = sheet
  const unit = width / 1024
  const cx = width / 2
  const margin = width * 0.075
  const image = await loadImage(project.image)

  const frame = { x: margin * 1.35, y: height * 0.235, w: width - margin * 2.7, h: height * 0.395 }

  const ink = inkLayer(width, height, rng, (ctx) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'

    // Border: heavy rule with a hairline inside it.
    ctx.lineWidth = 6 * unit
    ctx.strokeRect(margin * 0.55, margin * 0.55 + height * 0.02, width - margin * 1.1, height - margin * 1.1 - height * 0.02)
    ctx.lineWidth = 1.6 * unit
    ctx.strokeRect(margin * 0.55 + 12 * unit, margin * 0.55 + height * 0.02 + 12 * unit, width - margin * 1.1 - 24 * unit, height - margin * 1.1 - height * 0.02 - 24 * unit)

    fit(ctx, 'WANTED', DISPLAY, 230 * unit, width - margin * 2.3)
    ctx.fillText('WANTED', cx, height * 0.182)
    ornamentRule(ctx, cx, height * 0.208, width * 0.3, unit, rng)

    frameRect(ctx, frame.x, frame.y, frame.w, frame.h, unit, rng)
    if (project.mystery) {
      ctx.font = `${Math.round(frame.h * 0.82)}px ${DISPLAY}`
      ctx.fillText('?', cx, frame.y + frame.h * 0.84)
    } else if (!image) {
      // Placeholder: engraver's cross-hatching with a label knocked out of it.
      ctx.save()
      ctx.beginPath()
      ctx.rect(frame.x + 16 * unit, frame.y + 16 * unit, frame.w - 32 * unit, frame.h - 32 * unit)
      ctx.clip()
      ctx.lineWidth = 1.3 * unit
      ctx.globalAlpha = 0.28
      for (let d = -frame.h; d < frame.w; d += 11 * unit) {
        ctx.beginPath()
        ctx.moveTo(frame.x + d, frame.y + frame.h)
        ctx.lineTo(frame.x + d + frame.h, frame.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillRect(cx - 190 * unit, frame.y + frame.h / 2 - 34 * unit, 380 * unit, 68 * unit)
      ctx.globalCompositeOperation = 'source-over'
      ctx.font = `${34 * unit}px ${CAPS}`
      spaced(ctx, 'IMAGE TO COME', cx, frame.y + frame.h / 2 + 11 * unit, 5 * unit)
      ctx.restore()
    }

    const title = project.title.toUpperCase()
    fit(ctx, title, CAPS, 118 * unit, width - margin * 2.6)
    ctx.fillText(title, cx, height * 0.735)
    ornamentRule(ctx, cx, height * 0.77, width * 0.24, unit, rng)

    ctx.font = `${30 * unit}px ${CAPS}`
    spaced(ctx, `PROJECT  No. ${index + 1}`, cx, height * 0.832, 6 * unit)
    for (let i = -1; i <= 1; i++) star(ctx, cx + i * 42 * unit, height * 0.875, 9 * unit)
  })

  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sheet.albedo, 0, 0)
  if (image && !project.mystery) {
    ctx.save()
    tracePath(ctx, sheet.outline)
    ctx.clip()
    ctx.globalCompositeOperation = 'multiply'
    const inset = 16 * unit
    ctx.drawImage(engraving(image, frame.w - inset * 2, frame.h - inset * 2), frame.x + inset, frame.y + inset)
    ctx.restore()
  }
  printInk(ctx, ink, sheet.outline)
  pinHole(ctx, width, height)

  return { canvas, sheet, ink }
}

function wrap(ctx, text, maxWidth) {
  const lines = []
  for (const paragraph of text.split(/\n+/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

// Back: same sheet seen from behind. The texture is drawn mirrored because the back face samples
// the same UVs from the other side; the paper and the front's show-through line up physically.
// Returns the link button rectangle in viewer-space pixels for hit testing.
export function drawPosterBack(project, index, front) {
  const { sheet, ink: frontInk } = front
  const { width, height, rng } = sheet
  const unit = width / 1024
  const cx = width / 2
  const margin = width * 0.1
  const hasUrl = Boolean(project.link?.url)

  const content = makeCanvas(width, height)
  const c = content.getContext('2d')
  c.fillStyle = INK
  c.strokeStyle = INK
  c.textAlign = 'center'
  c.textBaseline = 'alphabetic'

  const title = project.title.toUpperCase()
  fit(c, title, CAPS, 84 * unit, width - margin * 2)
  c.fillText(title, cx, height * 0.13)
  ornamentRule(c, cx, height * 0.158, width * 0.28, unit, rng)

  const label = (text, y) => {
    c.font = `${27 * unit}px ${CAPS}`
    c.textAlign = 'left'
    const x = margin
    let xx = x
    for (const ch of text) {
      c.fillText(ch, xx, y)
      xx += c.measureText(ch).width + 5 * unit
    }
    c.lineWidth = 1.4 * unit
    c.beginPath()
    c.moveTo(xx + 10 * unit, y - 9 * unit)
    c.lineTo(width - margin, y - 9 * unit)
    c.stroke()
    c.textAlign = 'center'
  }

  // Description
  label('DESCRIPTION', height * 0.23)
  c.textAlign = 'left'
  const lineHeight = 44 * unit
  if (project.description) {
    c.font = `${31 * unit}px ${BODY}`
    wrap(c, project.description, width - margin * 2).slice(0, 8).forEach((line, i) => {
      c.fillText(line, margin, height * 0.275 + i * lineHeight)
    })
  } else {
    c.save()
    c.globalAlpha = 0.5
    c.font = `italic ${30 * unit}px ${BODY}`
    c.fillText('Description to be written.', margin, height * 0.275)
    c.globalAlpha = 0.28
    c.lineWidth = 1.2 * unit
    c.setLineDash([2 * unit, 7 * unit])
    for (let i = 1; i < 6; i++) {
      const y = height * 0.275 + i * lineHeight
      c.beginPath()
      c.moveTo(margin, y)
      c.lineTo(width - margin - (i === 5 ? width * 0.3 : 0), y)
      c.stroke()
    }
    c.restore()
  }
  c.textAlign = 'center'

  // Tech stack: stamped boxes.
  label('TECH STACK', height * 0.575)
  const chips = project.techStack?.length ? project.techStack : [null, null, null, null]
  c.font = `${27 * unit}px ${CAPS}`
  let x = margin
  let y = height * 0.605
  const chipH = 50 * unit
  for (const chip of chips) {
    const text = chip ? String(chip).toUpperCase() : ''
    const w = chip ? c.measureText(text).width + 36 * unit : 150 * unit
    if (x + w > width - margin) {
      x = margin
      y += chipH + 14 * unit
    }
    if (y > height * 0.72) break
    c.save()
    c.lineWidth = 2 * unit
    if (!chip) {
      c.globalAlpha = 0.35
      c.setLineDash([6 * unit, 5 * unit])
    }
    c.strokeRect(x, y, w, chipH)
    if (chip) c.fillText(text, x + w / 2, y + chipH / 2 + 9 * unit)
    c.restore()
    x += w + 14 * unit
  }

  // Link button: a stamped double box.
  const button = { x: width * 0.2, y: height * 0.765, w: width * 0.6, h: 96 * unit }
  c.save()
  c.globalAlpha = hasUrl ? 1 : 0.42
  c.lineWidth = 5 * unit
  c.strokeRect(button.x, button.y, button.w, button.h)
  c.lineWidth = 1.5 * unit
  c.strokeRect(button.x + 9 * unit, button.y + 9 * unit, button.w - 18 * unit, button.h - 18 * unit)
  const buttonText = `${(project.link?.label || 'Visit project').toUpperCase()}  →`
  fit(c, buttonText, CAPS, 36 * unit, button.w - 60 * unit)
  c.fillText(buttonText, cx, button.y + button.h / 2 + 12 * unit)
  c.restore()
  if (!hasUrl) {
    c.save()
    c.globalAlpha = 0.5
    c.font = `italic ${25 * unit}px ${BODY}`
    c.fillText('Link coming soon', cx, button.y + button.h + 38 * unit)
    c.restore()
  }

  // Red registry stamp.
  c.save()
  c.translate(width - margin * 1.35, height * 0.9)
  c.rotate(-0.22)
  c.strokeStyle = RED_INK
  c.fillStyle = RED_INK
  c.lineWidth = 4 * unit
  c.beginPath()
  c.arc(0, 0, 62 * unit, 0, TAU)
  c.stroke()
  c.lineWidth = 1.5 * unit
  c.beginPath()
  c.arc(0, 0, 52 * unit, 0, TAU)
  c.stroke()
  c.font = `${22 * unit}px ${CAPS}`
  c.fillText('ON FILE', 0, -12 * unit)
  c.font = `${38 * unit}px ${DISPLAY}`
  c.fillText(`${index + 1}`, 0, 30 * unit)
  c.restore()

  const worn = inkLayer(width, height, rng, (ctx) => ctx.drawImage(content, 0, 0), 0.4)

  // Compose in texture space: paper and show-through as-is, the readable content mirrored.
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sheet.albedo, 0, 0)
  ctx.save()
  tracePath(ctx, sheet.outline)
  ctx.clip()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.fillStyle = 'rgba(255, 244, 222, 0.35)' // the verso is less sun-darkened
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
  printInk(ctx, frontInk, sheet.outline, 0.07) // front print showing through the paper
  const mirrored = makeCanvas(width, height)
  const m = mirrored.getContext('2d')
  m.translate(width, 0)
  m.scale(-1, 1)
  m.drawImage(worn, 0, 0)
  printInk(ctx, mirrored, sheet.outline, 0.97)
  pinHole(ctx, width, height)

  return { canvas, button: hasUrl ? button : null }
}

// Soft silhouette of the torn sheet, used as the poster's contact shadow.
export function drawShadow(sheet, pad = 0.14) {
  const size = 256
  const aspect = sheet.height / sheet.width
  const w = size
  const h = Math.round(size * aspect)
  // Same relative padding on every side: the sheet fills the middle (1 - 2·pad) of the texture.
  const px = w * pad
  const py = h * pad
  const small = makeCanvas(Math.round(w / 6), Math.round(h / 6))
  const s = small.getContext('2d')
  const scale = (w - px * 2) / sheet.width / 6
  s.translate(px / 6, py / 6)
  tracePath(s, sheet.outline, scale)
  s.fillStyle = '#000'
  s.fill()
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, w, h)
  // Second pass for a smoother falloff.
  const again = makeCanvas(Math.round(w / 3), Math.round(h / 3))
  again.getContext('2d').drawImage(canvas, 0, 0, again.width, again.height)
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(again, 0, 0, w, h)
  return { canvas, pad }
}
