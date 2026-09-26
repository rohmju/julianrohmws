import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import '@fontsource/rye/400.css'
import '@fontsource/im-fell-english/400.css'
import '@fontsource/im-fell-english/400-italic.css'
import '@fontsource/im-fell-english-sc/400.css'
import FilmOverlay from './components/FilmOverlay.jsx'
import PaperTag from './components/PaperTag.jsx'
import VideoStage from './components/VideoStage.jsx'
import useMediaQuery, { COARSE_POINTER, REDUCED_MOTION } from './hooks/useMediaQuery.js'
import { pickVariant } from './lib/media.js'
import { wait } from './lib/video.js'
import './Portfolio.css'

// Three.js only loads when it's about to be needed.
const loadBoard = () => import('./board/BoardView.jsx')
const BoardView = lazy(loadBoard)
const BOARD_FADE_MS = 800

function deferred() {
  let resolve
  const promise = new Promise((r) => (resolve = r))
  return { promise, resolve }
}

// Start page → reveal → Projects board → return, as one continuous shot:
//   idle      idle loop, tags floating
//   queued    "My Projects" pressed; the loop is finishing its cycle (seal ring counts down)
//   reveal    reveal clip playing; the board is being built underneath
//   board     Three.js board faded in over the reveal's last frame
//   leaving   posters roll up, board fades into the return clip's first frame
//   return    return clip playing, then the idle loop resumes
export default function Portfolio() {
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const coarsePointer = useMediaQuery(COARSE_POINTER)
  const [variant] = useState(pickVariant)
  const stageRef = useRef(null)
  const boardRef = useRef(null)
  const boardReady = useRef(deferred())
  const [phase, setPhase] = useState('idle')
  const [boardMounted, setBoardMounted] = useState(false)
  const [boardVisible, setBoardVisible] = useState(false)
  const [countdown, setCountdown] = useState(null)

  // Fetch the board code once the start page has settled.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1))
    const timer = setTimeout(() => idle(() => loadBoard()), 2500)
    return () => clearTimeout(timer)
  }, [])

  const warmProjects = useCallback(() => {
    loadBoard()
    stageRef.current?.warmReveal()
  }, [])

  const openProjects = useCallback(async () => {
    if (phase !== 'idle') return
    const { progress, remaining } = stageRef.current.loopState()
    setCountdown({ from: progress, seconds: Math.max(0.05, remaining) })
    setPhase('queued')
    setBoardMounted(true)
    await stageRef.current.playReveal({ onStart: () => setPhase('reveal') })
    await boardReady.current.promise
    setBoardVisible(true)
    await wait(BOARD_FADE_MS)
    stageRef.current.parkAfterReveal()
    setCountdown(null)
    setPhase('board')
    await boardRef.current?.enter()
  }, [phase])

  const closeProjects = useCallback(async () => {
    if (phase !== 'board') return
    setPhase('leaving')
    await boardRef.current?.exit()
    await stageRef.current.prepareReturn()
    setBoardVisible(false)
    await wait(BOARD_FADE_MS)
    setBoardMounted(false) // unmount → the board disposes every GPU resource
    boardReady.current = deferred()
    setPhase('return')
    await stageRef.current.playReturn()
    setPhase('idle')
  }, [phase])

  const onBoardReady = useCallback(() => boardReady.current.resolve(), [])
  const startPage = phase === 'idle' || phase === 'queued'

  return (
    <div className={`pf-root pf-phase-${phase} ${variant === 'portrait' ? 'is-portrait' : ''}`}>
      <VideoStage ref={stageRef} variant={variant} stillsOnly={reducedMotion} />

      {boardMounted && (
        <Suspense fallback={null}>
          <BoardView
            ref={boardRef}
            visible={boardVisible}
            variant={variant}
            reducedMotion={reducedMotion}
            coarsePointer={coarsePointer}
            onReady={onBoardReady}
            onBack={closeProjects}
          />
        </Suspense>
      )}

      <div className={`pf-start ${startPage ? '' : 'is-hidden'}`} inert={startPage ? undefined : ''}>
        <header className="pf-mark">
          <h1 className="pf-mark__name">Julian Rohm</h1>
          <p className="pf-mark__role">Portfolio</p>
        </header>

        <div className="pf-skills">
          <PaperTag size="small" label="Skills" seal="S" aria-disabled="true" title="Coming soon" />
        </div>

        <nav className="pf-choices" aria-label="Sections">
          <div className="pf-choices__left">
            <PaperTag
              label={<>My<br />Projects</>}
              aria-label="My Projects"
              className="pf-choices__projects"
              pressed={phase === 'queued'}
              progress={phase === 'queued' && countdown ? countdown : null}
              onPointerEnter={warmProjects}
              onFocus={warmProjects}
              onClick={openProjects}
            />
          </div>
          <div className="pf-choices__right">
            <PaperTag
              label={<>My<br />Departments</>}
              aria-label="My Departments"
              className="pf-choices__departments"
              aria-disabled="true"
              title="Coming soon"
            />
          </div>
        </nav>
      </div>

      <FilmOverlay />
    </div>
  )
}
