import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import projectsData from '../data/projects.json'
import PaperTag from '../components/PaperTag.jsx'
import { createBoard } from './createBoard.js'

const { projects } = projectsData

// React shell around the Three.js board: owns its lifetime (created on mount, fully disposed on
// unmount) and renders the DOM parts — Back tag, control hints, hold ring, keyboard controls.
const BoardView = forwardRef(function BoardView({ visible, variant, reducedMotion, coarsePointer, onReady, onBack }, ref) {
  const hostRef = useRef(null)
  const apiRef = useRef(null)
  const ringRef = useRef(null)
  const [status, setStatus] = useState({ mode: 'busy', side: 'front', index: null, pans: false, hasLink: false })
  const [nudge, setNudge] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const ui = {
      state: (next) => !cancelled && setStatus(next),
      // Called every frame while a press is held, so it writes to the DOM directly.
      hold: (hold) => {
        const ring = ringRef.current
        if (!ring) return
        if (!hold) {
          ring.dataset.visible = 'false'
          return
        }
        ring.dataset.visible = 'true'
        ring.dataset.mode = hold.mode
        ring.style.transform = `translate3d(${hold.x}px, ${hold.y}px, 0)`
        ring.style.setProperty('--progress', hold.progress.toFixed(3))
      },
      nudge: () => !cancelled && setNudge((n) => n + 1),
    }
    createBoard({ container: hostRef.current, projects, variant, reducedMotion, ui })
      .then((api) => {
        if (cancelled) return api.dispose()
        apiRef.current = api
        onReady?.()
      })
      .catch((error) => {
        console.error('Board failed to start', error)
        if (!cancelled) {
          setFailed(true)
          onReady?.()
        }
      })
    return () => {
      cancelled = true
      apiRef.current?.dispose()
      apiRef.current = null
    }
    // The board is created once per visit; later prop changes don't rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    enter: () => apiRef.current?.enter() ?? Promise.resolve(),
    exit: () => apiRef.current?.exit() ?? Promise.resolve(),
  }), [])

  useEffect(() => {
    if (status.mode !== 'inspect') return
    const onKey = (event) => {
      if (event.key === 'Escape') apiRef.current?.hangBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status.mode])

  const tap = coarsePointer ? 'Tap' : 'Click'
  const hints = status.mode === 'inspect'
    ? [`${tap} to flip`, 'Hold to hang back']
    : ['Hold a poster to inspect', status.pans && (coarsePointer ? 'Swipe to browse' : 'Drag to browse')]
  const inspected = status.index !== null ? projects[status.index] : null

  return (
    <div className={`pf-board ${visible ? 'is-visible' : ''} is-${status.mode}`}>
      <div className="pf-board__host" ref={hostRef} />

      <div className="pf-board__frame" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      <PaperTag
        className="pf-back"
        size="small"
        label="Back"
        seal="arrow"
        onClick={onBack}
        disabled={status.mode !== 'board'}
        aria-label="Back to the start page"
      />

      {!failed && (
        <p key={nudge} className={`pf-hint ${nudge ? 'is-nudged' : ''} ${status.mode === 'busy' ? 'is-hidden' : ''}`} aria-live="polite">
          {hints.filter(Boolean).map((hint, i) => (
            <span key={hint}>
              {i > 0 && <span className="pf-hint__star" aria-hidden="true">✦</span>}
              {hint}
            </span>
          ))}
        </p>
      )}

      {failed && (
        <p className="pf-board__failed">This board needs WebGL, which isn’t available on this device.</p>
      )}

      <div className="pf-hold" ref={ringRef} data-visible="false" aria-hidden="true">
        <svg viewBox="0 0 80 80">
          <circle className="pf-hold__track" cx="40" cy="40" r="30" />
          <circle className="pf-hold__fill" cx="40" cy="40" r="30" pathLength="1" />
        </svg>
        <span className="pf-hold__label pf-hold__label--inspect">Inspect</span>
        <span className="pf-hold__label pf-hold__label--back">Hang back</span>
      </div>

      {/* Keyboard and screen-reader controls for the canvas. */}
      <div className="pf-sr-only">
        {status.mode === 'board' &&
          projects.map((project, index) => (
            <button key={project.id} type="button" onClick={() => apiRef.current?.inspect(index)}>
              Inspect poster: {project.title}
            </button>
          ))}
        {status.mode === 'inspect' && inspected && (
          <>
            <p>
              Inspecting {inspected.title}, {status.side === 'front' ? 'front' : 'back'} side.
              {status.side === 'back' && inspected.description ? ` ${inspected.description}` : ''}
            </p>
            <button type="button" onClick={() => apiRef.current?.flip()} autoFocus>
              Flip poster
            </button>
            {status.side === 'back' && inspected.link?.url && (
              <a href={inspected.link.url} target="_blank" rel="noopener noreferrer">
                {inspected.link.label || 'Visit project'}
              </a>
            )}
            <button type="button" onClick={() => apiRef.current?.hangBack()}>
              Hang poster back
            </button>
          </>
        )}
      </div>
    </div>
  )
})

export default BoardView
