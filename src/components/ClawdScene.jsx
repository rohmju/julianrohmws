import { useEffect, useRef, useState } from 'react'
import { createEngine } from '../clawd/engine.js'
import { CRANE_END, createCraneScene } from '../clawd/craneScene.js'
import { FPS, STORY_END, createScene } from '../clawd/scene.js'
import { prefersReducedMotion } from '../lib/motion.js'

// The crew is 89 grid cells wide (see COMPOSITION_WIDTH); leave a margin.
const MIN_COLS = 100
const MIN_ROWS = 44
const SEND_OFF_VH = 600 // scroll distance over which the whole crew jumps away
const HINT_SEGMENTS = 20
const CRANE_SCALE = 0.3 // the crane scene uses a finer grid, so everything in it draws at ~30% size
const MAX_BOOST = 0.5 // scrolling down speeds the crane scene up by at most 50%
const BOOST_HOLD = 0.35 // seconds the boost lingers after the last scroll input
const CREW_GONE = 0.995 // scroll progress at which the last Clawd is off-screen

const scrollProgress = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
}

// Same pixel mouse + arrows + segmented bar as the opening ScrollHint (see
// components/ScrollHint.jsx) — but self-contained. By the time this scene
// mounts, main.jsx has already wiped <head>, so App.css's rules are gone;
// the styles and keyframes are inlined here instead of shared.
function ScrollDownHint({ hintRef, barRef }) {
  return (
    <>
      <style>{`
        .cs-hint {
          position: fixed;
          left: 50%;
          bottom: 28px;
          transform: translateX(-50%);
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          color: #888;
          font: 8px 'Courier New', monospace;
          letter-spacing: 1px;
          text-transform: uppercase;
          text-align: center;
          pointer-events: none;
          user-select: none;
          transition: opacity 0.3s ease;
        }
        .cs-hint svg { display: block; fill: currentColor; shape-rendering: crispEdges; }
        .cs-hint-mouse { width: 18px; height: 26px; }
        .cs-hint-wheel { animation: cs-wheel 1.6s steps(1, end) infinite; }
        .cs-hint-row { display: flex; align-items: center; gap: 10px; }
        .cs-hint-arrow svg { width: 10px; height: 6px; animation: cs-bob 0.9s steps(1, end) infinite; }
        .cs-hint-bar { display: flex; gap: 2px; }
        .cs-hint-bar i { width: 6px; height: 4px; background: currentColor; opacity: 0.22; font-style: normal; }
        .cs-hint-bar i.on { opacity: 1; }
        @keyframes cs-wheel {
          0%  { transform: translateY(0); opacity: 1; }
          25% { transform: translateY(1px); }
          50% { transform: translateY(2px); }
          75% { transform: translateY(2px); opacity: 0; }
        }
        @keyframes cs-bob { 0% { transform: translateY(0); } 50% { transform: translateY(2px); } }
        @media (prefers-reduced-motion: reduce) {
          .cs-hint-wheel, .cs-hint-arrow svg { animation: none !important; }
        }
      `}</style>
      <div ref={hintRef} aria-hidden="true" className="cs-hint">
        <svg className="cs-hint-mouse" viewBox="0 0 9 13">
          <rect x="2" y="0" width="5" height="1" />
          <rect x="1" y="1" width="1" height="1" /><rect x="7" y="1" width="1" height="1" />
          <rect x="0" y="2" width="1" height="9" /><rect x="8" y="2" width="1" height="9" />
          <rect x="1" y="11" width="1" height="1" /><rect x="7" y="11" width="1" height="1" />
          <rect x="2" y="12" width="5" height="1" />
          <rect className="cs-hint-wheel" x="4" y="3" width="1" height="2" />
        </svg>
        <div className="cs-hint-row">
          <span className="cs-hint-arrow">
            <svg viewBox="0 0 5 3">
              <rect x="0" y="0" width="5" height="1" /><rect x="1" y="1" width="3" height="1" /><rect x="2" y="2" width="1" height="1" />
            </svg>
          </span>
          <span>scroll to continue</span>
          <span className="cs-hint-arrow">
            <svg viewBox="0 0 5 3">
              <rect x="0" y="0" width="5" height="1" /><rect x="1" y="1" width="3" height="1" /><rect x="2" y="2" width="1" height="1" />
            </svg>
          </span>
        </div>
        <div className="cs-hint-bar" ref={barRef}>
          {Array.from({ length: HINT_SEGMENTS }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>
    </>
  )
}

// Full-screen pixel canvas: Clawd calls in the crew on the white screen. Once
// they're assembled, scrolling sends them jumping down off the screen.
export default function ClawdScene() {
  const canvasRef = useRef(null)
  const hintRef = useRef(null)
  const barRef = useRef(null)
  const [storyDone, setStoryDone] = useState(false)
  const [craneOn, setCraneOn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const engine = createEngine(canvas.getContext('2d'))
    const scene = createScene()
    const crane = createCraneScene()
    const still = prefersReducedMotion()
    let craneGrid = false

    // Integer device pixels per cell keeps every block crisp at any zoom.
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      const w = window.innerWidth * dpr
      const h = window.innerHeight * dpr
      const base = Math.max(2, Math.floor(Math.min(w / MIN_COLS, h / MIN_ROWS)))
      const cell = craneGrid ? Math.max(1, Math.round(base * CRANE_SCALE)) : base
      const cols = Math.ceil(w / cell)
      const rows = Math.ceil(h / cell)
      canvas.width = cols * cell
      canvas.height = rows * cell
      canvas.style.width = `${canvas.width / dpr}px`
      canvas.style.height = `${canvas.height / dpr}px`
      engine.setGrid(cell, cols, rows)
    }

    // Reduced motion: skip the story and show the assembled crew, no particles.
    const drawStill = () => {
      const jump = scrollProgress()
      if (jump >= CREW_GONE) {
        if (!craneGrid) {
          craneGrid = true
          fit()
        }
        crane.render(engine, CRANE_END + 1, Math.round((CRANE_END + 1) * FPS))
        setCraneOn(true)
      } else {
        scene.render(engine, STORY_END + 0.5, Math.round((STORY_END + 0.5) * FPS), jump)
      }
    }

    let raf = 0
    let start = 0
    let lastFrame = -1
    let lastJump = -1
    let done = false
    let craneStart = null
    let craneClock = 0
    let lastTs = 0
    let boostUntil = 0 // real-time second until which scrolling keeps the boost on
    const loop = (ts) => {
      if (!start) start = ts
      const s = (ts - start) / 1000
      const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0
      lastTs = ts
      const f = Math.floor(s * FPS)
      const jump = craneStart === null ? scrollProgress() : 1
      if (craneStart === null && done && jump >= CREW_GONE) {
        craneStart = s
        craneGrid = true
        fit()
        setCraneOn(true)
      }
      if (craneStart !== null) {
        // Capped at 1.5×, however hard the user scrolls.
        craneClock += dt * (1 + (s < boostUntil ? MAX_BOOST : 0))
        const cf = Math.floor(craneClock * FPS)
        if (cf !== lastFrame) {
          lastFrame = cf
          crane.render(engine, craneClock, cf)
        }
      } else if (f !== lastFrame || jump !== lastJump) {
        lastFrame = f
        lastJump = jump
        scene.render(engine, s, f, jump)
      }
      if (!done && s >= STORY_END) {
        done = true
        setStoryDone(true)
      }
      if (hintRef.current) hintRef.current.style.opacity = jump > 0.02 ? 0 : 1
      if (barRef.current) {
        const filled = Math.floor(jump * HINT_SEGMENTS)
        const bars = barRef.current.children
        for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < filled)
      }
      raf = requestAnimationFrame(loop)
    }

    // The page is locked during the crane scene, so read scroll intent directly.
    const boost = () => {
      if (craneStart !== null) boostUntil = (performance.now() - start) / 1000 + BOOST_HOLD
    }
    const onWheel = (e) => e.deltaY > 0 && boost()
    let touchY = null
    const onTouchStart = (e) => (touchY = e.touches[0].clientY)
    const onTouchMove = (e) => {
      const y = e.touches[0].clientY
      if (touchY !== null && y < touchY) boost()
      touchY = y
    }
    const onKey = (e) => ['ArrowDown', 'PageDown', 'End', ' '].includes(e.key) && boost()

    const onResize = () => {
      fit()
      if (still) drawStill()
      else lastFrame = -1
    }

    fit()
    if (still) {
      engine.setParticles(false)
      drawStill()
      setStoryDone(true)
      window.addEventListener('scroll', drawStill, { passive: true })
    } else {
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', drawStill)
    }
  }, [])

  // The white screen starts locked; scrolling unlocks once the crew is assembled
  // and locks again when the crane arrives.
  useEffect(() => {
    if (craneOn) {
      document.body.style.overflowY = 'hidden'
      return
    }
    if (!storyDone) return
    const html = document.documentElement
    html.style.scrollbarWidth = 'none'
    document.body.style.overflowY = 'auto'
  }, [storyDone, craneOn])

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Clawd runs in and phones the crew; four Clawds in hard hats run over to help build the website. Scrolling sends them jumping down the screen one by one, and Clawd puts on a hard hat before jumping last. Then a crane lowers a frightened Clawd with a stack of planks, who builds a five-level scaffold across the screen while a second Clawd paints the wall section by section."
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          display: 'block',
          background: '#fff',
          imageRendering: 'pixelated',
        }}
      />
      {storyDone && !craneOn && (
        <>
          <ScrollDownHint hintRef={hintRef} barRef={barRef} />
          <div aria-hidden="true" style={{ height: `${SEND_OFF_VH}vh` }} />
        </>
      )}
    </>
  )
}
