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

// Three.js and the Windows 95 desktop only load when they're about to be needed.
const loadBoard = () => import('./board/BoardView.jsx')
const BoardView = lazy(loadBoard)
const loadDesktop = () => import('./win95/Win95.jsx')
const Win95 = lazy(loadDesktop)
const BOARD_FADE_MS = 800
const SCREEN_HOLD_MS = 300 // the start-up screen stays up a moment before the display switches mode
const DESKTOP_FADE_MS = 700 // the black of the switched-off desktop fades into the monitor

function deferred() {
  let resolve
  const promise = new Promise((r) => (resolve = r))
  return { promise, resolve }
}

// Start page → reveal → section → return, as one continuous shot:
//   idle      idle loop, tags floating
//   queued    a section was picked; the loop is finishing its cycle (seal ring counts down)
//   reveal    the section's reveal clip is playing (the board is being built underneath)
//   board     Projects: Three.js board faded in over the reveal's last frame
//   leaving   Projects: posters roll up, board fades into the return clip's first frame
//   desktop   Departments: Windows 95 boots on the monitor the reveal zoomed into
//   return    return clip playing, then the idle loop resumes
export default function Portfolio() {
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const coarsePointer = useMediaQuery(COARSE_POINTER)
  const [variant] = useState(pickVariant)
  const stageRef = useRef(null)
  const boardRef = useRef(null)
  const boardReady = useRef(deferred())
  const [phase, setPhase] = useState('idle')
  const [section, setSection] = useState(null)
  const [boardMounted, setBoardMounted] = useState(false)
  const [boardVisible, setBoardVisible] = useState(false)
  const [desktopMounted, setDesktopMounted] = useState(false)
  const [desktopLeaving, setDesktopLeaving] = useState(false)
  const [countdown, setCountdown] = useState(null)

  // Fetch the section code once the start page has settled.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1))
    const timer = setTimeout(() => idle(() => {
      loadBoard()
      loadDesktop()
    }), 2500)
    return () => clearTimeout(timer)
  }, [])

  // Lets the idle loop run out while the chosen tag's seal counts down the rest of the cycle.
  const queue = (next) => {
    const { progress, remaining } = stageRef.current.loopState()
    setCountdown({ from: progress, seconds: Math.max(0.05, remaining) })
    setSection(next)
    setPhase('queued')
  }

  const warmProjects = useCallback(() => {
    loadBoard()
    stageRef.current?.warmReveal('projects')
  }, [])

  const openProjects = useCallback(async () => {
    if (phase !== 'idle') return
    queue('projects')
    setBoardMounted(true)
    await stageRef.current.playReveal('projects', { onStart: () => setPhase('reveal') })
    await boardReady.current.promise
    setBoardVisible(true)
    await wait(BOARD_FADE_MS)
    stageRef.current.parkAfterReveal('projects')
    setCountdown(null)
    setPhase('board')
    await boardRef.current?.enter()
  }, [phase])

  const closeProjects = useCallback(async () => {
    if (phase !== 'board') return
    setPhase('leaving')
    await boardRef.current?.exit()
    await stageRef.current.prepareReturn('projects')
    setBoardVisible(false)
    await wait(BOARD_FADE_MS)
    setBoardMounted(false) // unmount → the board disposes every GPU resource
    boardReady.current = deferred()
    setPhase('return')
    await stageRef.current.playReturn('projects')
    setSection(null)
    setPhase('idle')
  }, [phase])

  const warmDepartments = useCallback(() => {
    loadDesktop()
    stageRef.current?.warmReveal('departments')
  }, [])

  const openDepartments = useCallback(async () => {
    if (phase !== 'idle') return
    queue('departments')
    const desktop = loadDesktop()
    await stageRef.current.playReveal('departments', { onStart: () => setPhase('reveal') })
    await Promise.all([desktop.catch(() => {}), wait(SCREEN_HOLD_MS)])
    setCountdown(null)
    setDesktopLeaving(false)
    setDesktopMounted(true) // mounts black: the display switching mode
    setPhase('desktop')
    stageRef.current.parkAfterReveal('departments')
  }, [phase])

  // The desktop calls this once the monitor has been switched off and the layer is black.
  const closeDepartments = useCallback(async () => {
    if (phase !== 'desktop') return
    setPhase('return')
    await stageRef.current.prepareReturn('departments')
    setDesktopLeaving(true)
    await wait(DESKTOP_FADE_MS)
    setDesktopMounted(false)
    await stageRef.current.playReturn('departments')
    setSection(null)
    setPhase('idle')
  }, [phase])

  const onBoardReady = useCallback(() => boardReady.current.resolve(), [])
  const startPage = phase === 'idle' || phase === 'queued'
  const queuedFor = (name) => phase === 'queued' && section === name

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

      {desktopMounted && (
        <Suspense fallback={null}>
          <Win95
            leaving={desktopLeaving}
            reducedMotion={reducedMotion}
            coarsePointer={coarsePointer}
            onShutDown={closeDepartments}
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
              pressed={queuedFor('projects')}
              progress={queuedFor('projects') && countdown ? countdown : null}
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
              pressed={queuedFor('departments')}
              progress={queuedFor('departments') && countdown ? countdown : null}
              onPointerEnter={warmDepartments}
              onFocus={warmDepartments}
              onClick={openDepartments}
            />
          </div>
        </nav>
      </div>

      <FilmOverlay />
    </div>
  )
}
