import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/motion.js'

const SEGMENTS = 20

const PixelMouse = () => (
  <svg className="hint-mouse" viewBox="0 0 9 13" aria-hidden="true">
    <rect x="2" y="0" width="5" height="1" />
    <rect x="1" y="1" width="1" height="1" /><rect x="7" y="1" width="1" height="1" />
    <rect x="0" y="2" width="1" height="9" /><rect x="8" y="2" width="1" height="9" />
    <rect x="1" y="11" width="1" height="1" /><rect x="7" y="11" width="1" height="1" />
    <rect x="2" y="12" width="5" height="1" />
    <rect className="hint-wheel" x="4" y="3" width="1" height="2" />
  </svg>
)

// ▼ while scrolling; ▶ / ◀ pointing at the label once ready.
const PixelArrow = ({ side }) => (
  <span className="hint-arrow" aria-hidden="true">
    <svg className="down" viewBox="0 0 5 3">
      <rect x="0" y="0" width="5" height="1" /><rect x="1" y="1" width="3" height="1" /><rect x="2" y="2" width="1" height="1" />
    </svg>
    <svg className="side" viewBox="0 0 3 5">
      {side === 'left' ? (
        <><rect x="0" y="0" width="1" height="5" /><rect x="1" y="1" width="1" height="3" /><rect x="2" y="2" width="1" height="1" /></>
      ) : (
        <><rect x="2" y="0" width="1" height="5" /><rect x="1" y="1" width="1" height="3" /><rect x="0" y="2" width="1" height="1" /></>
      )}
    </svg>
  </span>
)

// 8-bit style scroll prompt with a segmented progress bar.
// Bump `nudge` to make it hop (e.g. when someone tries to send too early).
export default function ScrollHint({ progress, ready, nudge }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!nudge || prefersReducedMotion()) return
    ref.current?.animate(
      [
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(-4px)', opacity: 1 },
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(-2px)', opacity: 1 },
        { transform: 'translateY(0)' },
      ],
      { duration: 420, easing: 'steps(5, end)' },
    )
  }, [nudge])

  const filled = Math.floor(progress * SEGMENTS)

  return (
    <div ref={ref} className="hint" data-state={ready ? 'ready' : 'scroll'}>
      <PixelMouse />
      <div className="hint-row">
        <PixelArrow side="left" />
        <span className="hint-label" id="hint-label" aria-live="polite">
          {ready ? 'Press enter' : 'Scroll down for the best experience'}
        </span>
        <PixelArrow side="right" />
      </div>
      <div className="hint-bar" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <i key={i} className={i < filled ? 'on' : undefined} />
        ))}
      </div>
    </div>
  )
}
