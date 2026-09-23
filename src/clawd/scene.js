import { PALETTE, SPRITES, easeInOut, easeOut, lerp } from './engine.js'

export const FPS = 30

// The builder crew: four hard-hat Clawds, one after another. The first one in
// runs the farthest (the slot next to the leader), the last one the shortest.
const CREW_STARTS = [3.4, 3.75, 4.1, 4.45]
const CREW_RUN = 1.3 // seconds from off-screen to their spot
const ARRIVALS = CREW_STARTS.map((t) => t + CREW_RUN)

// Beat sheet, in seconds from the moment the white screen appears.
const T = {
  leaderRun: [0.5, 1.5],
  leaderSkid: [1.5, 1.8],
  phoneOut: [1.9, 2.4],
  dial: [2.4, 3.0],
  call: [3.0, 4.0],
  phoneAway: [4.0, 4.3],
  finale: [ARRIVALS[3] + 0.5, ARRIVALS[3] + 1.9],
}
export const STORY_END = T.finale[1] // afterwards the crew idles in place

// After the story, scrolling sends the crew down the screen one by one, left
// to right: four builders, then the leader puts on a hard hat, then he jumps.
const JUMP_SEG = 1 / 6
const LEADER_HAT = 4
const LEADER_JUMP = 5

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const easeIn = (t) => t * t * t
const seg = (s, [a, b]) => clamp01((s - a) / (b - a))
const during = (s, [a, b]) => s >= a && s < b
const runLegs = (f, every) => (Math.floor(f / every) % 2 ? 'a' : 'b')

// Composition: the four builders in the middle, the leader to their right.
// 4 × 14 cells + 3 × 4 gaps = 68, then a 7-cell gap and the 14-cell leader.
export const COMPOSITION_WIDTH = 89

function layout(GW, GH) {
  const G = Math.floor((GW - COMPOSITION_WIDTH) / 2)
  return { y: Math.floor(GH / 2) - 2, slots: [G, G + 18, G + 36, G + 54], leaderX: G + 75 }
}

// After the story: staggered little hops and blinks, forever.
function idleBob(s, i) {
  const ph = (s + i * 0.9) % 4.2
  return ph < 0.32 ? -Math.round(Math.sin((ph / 0.32) * Math.PI)) : 0
}
const idleBlink = (s, i) => (s * 1000 + i * 770) % 3700 < 130

// Finale: a bounce that ripples across the line, left to right.
function finaleBob(s, i) {
  const w = Math.sin((s - T.finale[0]) * Math.PI * 2 * 1.3 - i * 0.55)
  return -Math.round(Math.max(0, w) * 2)
}

// Shared behaviour once someone is in place: watch the leader, then join in.
function settled(s, i, watch = 'look_right') {
  if (s >= STORY_END) return { bob: idleBob(s, i), eyes: idleBlink(s, i) ? 'blink' : 'forward' }
  if (s >= T.finale[0]) return { bob: finaleBob(s, i), eyes: 'forward' }
  return { bob: 0, eyes: idleBlink(s, i) ? 'blink' : watch }
}

export function createScene() {
  const fired = new Set()
  // True exactly once, the first frame `cond` holds — frame-skip safe.
  const once = (key, cond = true) => {
    if (!cond || fired.has(key)) return false
    fired.add(key)
    return true
  }

  function dust(E, x, y, n = 6, spread = 3) {
    for (let i = 0; i < n; i++) {
      E.addParticle(x + (Math.random() - 0.5) * spread, y, PALETTE.dust.puff, {
        vy: -Math.random() * 0.5 - 0.1,
        decay: 0.05,
      })
    }
  }

  // Crouch, hop, then drop off the bottom of the screen. Scroll-driven, so it
  // runs backwards too; the crouch dust re-arms once they're back in place.
  function jumpFor(k, n, x) {
    const lp = seg(k.jump, [n * JUMP_SEG, (n + 1) * JUMP_SEG])
    const key = `jump-${n}`
    if (lp <= 0) {
      fired.delete(key)
      return null
    }
    if (lp >= 1) return { gone: true }
    if (lp < 0.2) {
      if (once(key)) dust(k.E, x + 7, k.y + 7, 5, 4)
      return { dy: 1, eyes: 'forward' }
    }
    if (lp < 0.4) return { dy: Math.round(lerp(1, -5, easeOut((lp - 0.2) / 0.2))), eyes: 'forward' }
    const dy = lerp(-5, k.GH - k.y + 4, easeIn((lp - 0.4) / 0.6))
    if (Math.random() < 0.5) {
      k.E.addParticle(x + 7 + (Math.random() - 0.5) * 4, k.y + dy, PALETTE.dust.puff, {
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2,
        g: 0.01,
        decay: 0.06,
      })
    }
    return { dy: Math.round(dy), eyes: 'look_down' }
  }

  // The leader pulls a hard hat out with his left hand and swings it onto his head.
  function putOnHat(k, x, hp) {
    const { E, y } = k
    if (hp < 0.7) fired.delete('hat-land')
    if (hp < 0.7) {
      const p = easeInOut(hp / 0.7)
      return {
        x: lerp(x - 6, x + 2, p),
        y: lerp(y + 3, y - 3, p) - Math.sin(p * Math.PI) * 5,
        alpha: clamp01(hp / 0.15),
        eyes: hp < 0.3 ? 'look_left' : 'forward',
        bob: 0,
      }
    }
    if (once('hat-land')) dust(E, x + 7, y - 3, 6, 8)
    return { x: x + 2, y: y - 3, alpha: 1, eyes: hp < 0.85 ? 'blink' : 'forward', bob: hp < 0.8 ? 1 : 0 }
  }

  // Signal waves "(((" growing leftwards out of the phone, toward the crew.
  function drawSignal(E, x, cy, f) {
    const lit = Math.floor(f / 4) % 4
    for (let k = 0; k < 3 && k <= lit; k++) {
      const wx = x - k * 2
      const h = k + 1
      E.px(wx, cy - h, PALETTE.signal.wave)
      E.px(wx, cy + h, PALETTE.signal.wave)
      for (let yy = cy - h + 1; yy <= cy + h - 1; yy++) E.px(wx - 1, yy, PALETTE.signal.wave)
    }
  }

  // ─── Cast ────────────────────────────────────────────────────

  // Leader: runs in from the right, skids, pulls out a phone and calls the crew.
  // The phone is in his left hand, so the call goes out toward them.
  function leader(k, x0, i) {
    const { E, s, f, y, GW } = k
    if (s < T.leaderRun[0]) return null
    let x = x0
    let bob = 0
    let eyes = 'look_left'
    let legs = 'stand'
    let phoneY = null
    let phoneAlpha = 1
    let lit = false
    let hat = null

    if (s < T.leaderRun[1]) {
      const p = seg(s, T.leaderRun)
      x = lerp(GW + 2, x0 - 1, easeOut(p))
      legs = runLegs(f, p < 0.7 ? 2 : 3)
      bob = legs === 'a' ? -1 : 0
    } else if (s < T.leaderSkid[1]) {
      x = lerp(x0 - 1, x0, easeInOut(seg(s, T.leaderSkid)))
      eyes = 'forward'
      if (once('leader-skid')) dust(E, x + 3, y + 7, 8, 4)
    } else if (s < T.phoneOut[0]) {
      eyes = 'forward'
    } else if (s < T.phoneOut[1]) {
      const p = easeOut(seg(s, T.phoneOut))
      phoneY = lerp(y + 4, y - 1, p)
      phoneAlpha = p
    } else if (s < T.dial[1]) {
      phoneY = y - 1
      lit = f % 8 < 6
      eyes = 'look_down'
    } else if (s < T.call[1]) {
      const p = seg(s, T.call)
      phoneY = y - 1
      lit = true
      bob = p > 0.25 ? -Math.round(Math.abs(Math.sin(p * Math.PI * 5))) : 0
      drawSignal(E, x - 6, phoneY + bob + 2, f)
    } else if (s < T.phoneAway[1]) {
      const p = easeInOut(seg(s, T.phoneAway))
      phoneY = lerp(y - 1, y + 4, p)
      phoneAlpha = 1 - p
    } else if (s < T.finale[0]) {
      eyes = idleBlink(s, i) ? 'blink' : 'look_left'
      bob = ARRIVALS.some((t) => s >= t && s < t + 0.25) ? -1 : 0 // a little hop per arrival
    } else {
      ;({ bob, eyes } = settled(s, i))
      if (s >= STORY_END && s % 7 < 3.5 && eyes !== 'blink') eyes = 'look_left'
      const hp = seg(k.jump, [LEADER_HAT * JUMP_SEG, (LEADER_HAT + 1) * JUMP_SEG])
      if (hp > 0) {
        hat = putOnHat(k, x, hp)
        ;({ bob, eyes } = hat)
      }
      const j = jumpFor(k, LEADER_JUMP, x)
      if (j) {
        if (j.gone) return null
        ;({ dy: bob, eyes } = j)
      }
    }

    E.drawClawd(x, y + bob, { eyes, legs })
    if (phoneY !== null) {
      const screen = lit ? { 2: PALETTE.phone.lit } : null
      E.drawSprite(SPRITES.phone, x - 4, phoneY + bob, screen, phoneAlpha)
    }
    if (hat) E.drawSprite(SPRITES.hardhat, hat.x, hat.y + (hat.y === y - 3 ? bob : 0), null, hat.alpha)
    return { x, y: y + bob }
  }

  // Builder: heavy jog in from the left, hard hat bouncing a beat behind the
  // body, then a stomp into place that kicks up dust and shakes the screen.
  function builder(k, x0, i, start) {
    const { E, s, f, y } = k
    if (s < start) return null
    const arrive = start + CREW_RUN
    let x = x0
    let bob = 0
    let eyes = 'look_right'
    let legs = 'stand'
    let hatLag = 0

    if (s < arrive) {
      const p = (s - start) / CREW_RUN
      x = lerp(-18, x0, 1 - (1 - p) * (1 - p))
      legs = runLegs(f + i, 3) // offset so the crew isn't stepping in lockstep
      bob = legs === 'a' ? -1 : 0
      hatLag = bob ? 1 : 0
    } else {
      if (once(`stomp-${i}`)) {
        dust(E, x + 1, y + 7, 6, 3)
        dust(E, x + 12, y + 7, 6, 3)
      }
      ;({ bob, eyes } = settled(s, i))
      const j = jumpFor(k, i, x)
      if (j) {
        if (j.gone) return null
        ;({ dy: bob, eyes } = j)
      }
    }

    E.drawClawd(x, y + bob, { eyes, legs })
    E.drawSprite(SPRITES.hardhat, x + 2, y - 3 + bob + hatLag)
    return { x, y: y + bob }
  }

  // ─── Frame ───────────────────────────────────────────────────

  // `jump` is the scroll progress (0–1) through the send-off; it only counts
  // once the story has finished.
  function render(E, s, f, jump = 0) {
    const { GW, GH } = E.grid()
    const { y, slots, leaderX } = layout(GW, GH)
    const k = { E, s, f, y, GW, GH, jump: s >= STORY_END ? jump : 0 }

    // Every stomp shakes the screen for a few frames.
    const shaking = ARRIVALS.some((t) => during(s, [t, t + 0.1]))
    E.setOffset(shaking ? (f % 2 ? 1 : -1) : 0)
    E.drawBg()

    // Builder n (in order of arrival) takes slot 3 - n; `i` is the slot index,
    // so the finale ripple runs left to right.
    const cast = [
      ...CREW_STARTS.map((start, n) => builder(k, slots[3 - n], 3 - n, start)),
      leader(k, leaderX, 4),
    ]

    E.tickParticles()

    // Finale: blush.
    if (during(s, T.finale)) {
      const blush = seg(s, [T.finale[0], T.finale[0] + 0.4]) * (1 - seg(s, [STORY_END - 0.4, STORY_END]))
      const byPosition = cast.filter(Boolean).sort((a, b) => a.x - b.x)
      byPosition.forEach((c) => {
        E.drawBlush(c.x, c.y, blush * 0.85)
      })
    }

  }

  return { render }
}
