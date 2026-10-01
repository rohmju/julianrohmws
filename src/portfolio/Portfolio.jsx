import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import '@fontsource/rye/400.css'
import '@fontsource/im-fell-english/400.css'
import '@fontsource/im-fell-english/400-italic.css'
import '@fontsource/im-fell-english-sc/400.css'
import FilmOverlay from './components/FilmOverlay.jsx'
import VideoStage from './components/VideoStage.jsx'
import useMediaQuery, { COARSE_POINTER, REDUCED_MOTION } from './hooks/useMediaQuery.js'
import { pickVariant } from './lib/media.js'
import { wait } from './lib/video.js'
import './Portfolio.css'

// The Windows 95 desktop only loads when it's about to be needed.
const loadDesktop = () => import('./win95/Win95.jsx')
const Win95 = lazy(loadDesktop)
const SCREEN_HOLD_MS = 300 // the start-up screen stays up a moment before the display switches mode
const DESKTOP_FADE_MS = 700 // the black of the switched-off desktop fades into the monitor

// Start page → PC → return, as one continuous shot:
//   idle      idle loop, "Open PC" button showing
//   queued    the button was pressed; the loop is finishing its cycle (the button's bar fills)
//   reveal    the PC reveal clip is playing
//   desktop   Windows 95 boots on the monitor the reveal zoomed into
//   return    return clip playing, then the idle loop resumes
export default function Portfolio() {
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const coarsePointer = useMediaQuery(COARSE_POINTER)
  const [variant] = useState(pickVariant)
  const stageRef = useRef(null)
  const [phase, setPhase] = useState('idle')
  const [desktopMounted, setDesktopMounted] = useState(false)
  const [desktopLeaving, setDesktopLeaving] = useState(false)
  const [countdown, setCountdown] = useState(null)

  // Fetch the desktop code once the start page has settled.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1))
    const timer = setTimeout(() => idle(() => loadDesktop()), 2500)
    return () => clearTimeout(timer)
  }, [])

  const warmPc = useCallback(() => {
    loadDesktop()
    stageRef.current?.warmReveal()
  }, [])

  const openPc = useCallback(async () => {
    if (phase !== 'idle') return
    // Lets the idle loop run out while the button's bar counts down the rest of the cycle.
    const { progress, remaining } = stageRef.current.loopState()
    setCountdown({ from: progress, seconds: Math.max(0.05, remaining) })
    setPhase('queued')
    const desktop = loadDesktop()
    await stageRef.current.playReveal({ onStart: () => setPhase('reveal') })
    await Promise.all([desktop.catch(() => {}), wait(SCREEN_HOLD_MS)])
    setCountdown(null)
    setDesktopLeaving(false)
    setDesktopMounted(true) // mounts black: the display switching mode
    setPhase('desktop')
    stageRef.current.parkAfterReveal()
  }, [phase])

  // The desktop calls this once the monitor has been switched off and the layer is black.
  const closePc = useCallback(async () => {
    if (phase !== 'desktop') return
    setPhase('return')
    await stageRef.current.prepareReturn()
    setDesktopLeaving(true)
    await wait(DESKTOP_FADE_MS)
    setDesktopMounted(false)
    await stageRef.current.playReturn()
    setPhase('idle')
  }, [phase])

  const startPage = phase === 'idle' || phase === 'queued'
  const queued = phase === 'queued'

  return (
    <div className={`pf-root pf-phase-${phase} ${variant === 'portrait' ? 'is-portrait' : ''}`}>
      <VideoStage ref={stageRef} variant={variant} stillsOnly={reducedMotion} />

      {desktopMounted && (
        <Suspense fallback={null}>
          <Win95
            leaving={desktopLeaving}
            reducedMotion={reducedMotion}
            coarsePointer={coarsePointer}
            onShutDown={closePc}
          />
        </Suspense>
      )}

      <div className={`pf-start ${startPage ? '' : 'is-hidden'}`} inert={startPage ? undefined : ''}>
        <header className="pf-mark">
          <h1 className="pf-mark__name">Julian Rohm</h1>
          <p className="pf-mark__role">Portfolio</p>
        </header>

        <div className="pf-open-wrap">
          <button
            type="button"
            className={`pf-open ${queued ? 'is-pressed' : ''}`}
            aria-pressed={queued || undefined}
            onPointerEnter={warmPc}
            onFocus={warmPc}
            onClick={openPc}
          >
            <span className="pf-open__label">Open PC</span>
            {queued && countdown && (
              <span
                className="pf-open__progress"
                style={{ '--from': countdown.from, animationDuration: `${countdown.seconds}s` }}
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      <FilmOverlay />
    </div>
  )
}
