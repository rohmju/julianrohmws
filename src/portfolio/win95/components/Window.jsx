import { useRef, useState } from 'react'
import { useWin95 } from '../context.js'
import Icon from '../icons.jsx'
import { screenScale } from '../scale.js'
import { CaptionGlyph } from './Glyphs.jsx'

const MIN_SIZE = { width: 180, height: 110 }
const TITLE_HEIGHT = 18
const KEEP_VISIBLE = 48 // px of a window that always stays on screen
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

// A window frame: title bar (drag to move, double-click to maximize), caption buttons and a resize
// corner. As in Windows 95 without "Show window contents while dragging", moving and resizing only
// draw an outline; the window jumps there when the button is released.
export default function Window({ win, title, icon, active, bounds, dialog = false, resizable = false, maximizable = resizable, children }) {
  const { api } = useWin95()
  const frameRef = useRef(null)
  const [outline, setOutline] = useState(null)

  // Follows one pointer drag, turning every move into an outline; `commit` gets the final one.
  const track = (event, shape, commit) => {
    event.preventDefault()
    const frame = frameRef.current
    const k = screenScale(frame)
    const box = frame.getBoundingClientRect()
    const host = frame.parentElement.getBoundingClientRect()
    const origin = { x: (box.left - host.left) / k, y: (box.top - host.top) / k, width: box.width / k, height: box.height / k }
    const start = { x: event.clientX, y: event.clientY }
    const target = event.currentTarget
    target.setPointerCapture?.(event.pointerId)
    let rect = null
    const move = (e) => {
      rect = shape(origin, (e.clientX - start.x) / k, (e.clientY - start.y) / k)
      setOutline(rect)
    }
    const end = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', end)
      target.removeEventListener('pointercancel', end)
      setOutline(null)
      if (rect) commit(rect, origin)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', end)
    target.addEventListener('pointercancel', end)
  }

  const startMove = (event) => {
    if (event.button !== 0 || win.maximized || event.target.closest('button')) return
    track(
      event,
      (o, dx, dy) => ({
        ...o,
        x: clamp(o.x + dx, KEEP_VISIBLE - o.width, bounds.width - KEEP_VISIBLE),
        y: clamp(o.y + dy, 0, bounds.height - TITLE_HEIGHT),
      }),
      (rect) => api.place(win.id, { x: rect.x, y: rect.y }),
    )
  }

  const startResize = (event) => {
    if (event.button !== 0) return
    event.stopPropagation()
    track(
      event,
      (o, dx, dy) => ({
        ...o,
        width: clamp(o.width + dx, MIN_SIZE.width, bounds.width - o.x),
        height: clamp(o.height + dy, MIN_SIZE.height, bounds.height - o.y),
      }),
      (rect, o) => api.place(win.id, { x: o.x, y: o.y, w: rect.width, h: rect.height }),
    )
  }

  let style = { zIndex: win.z }
  if (!win.maximized) {
    style = win.x == null
      ? { ...style, left: '50%', top: '45%', transform: 'translate(-50%, -50%)', width: win.w, height: win.h }
      : {
          ...style,
          left: clamp(win.x, KEEP_VISIBLE - (win.w ?? 200), bounds.width - KEEP_VISIBLE),
          top: clamp(win.y, 0, bounds.height - TITLE_HEIGHT),
          width: win.w,
          height: win.h,
        }
  }

  return (
    <>
      <section
        ref={frameRef}
        className={`w95-window ${win.props?.color ? 'is-tinted' : ''} ${active ? 'is-active' : ''} ${win.maximized ? 'is-maximized' : ''} ${dialog ? 'is-dialog' : ''}`}
        style={win.props?.color ? { ...style, '--accent': win.props.color } : style}
        role="dialog"
        aria-label={title}
        hidden={win.minimized}
        onPointerDownCapture={() => api.focus(win.id)}
        onKeyDown={(event) => {
          if (dialog && event.key === 'Escape') api.close(win.id)
        }}
      >
        <div
          className="w95-titlebar"
          onPointerDown={startMove}
          onDoubleClick={(event) => {
            if (maximizable && !event.target.closest('button')) api.toggleMaximize(win.id)
          }}
        >
          {icon && <Icon name={icon} size={16} color={win.props?.color} />}
          <span className="w95-titlebar__text">{title}</span>
          <span className="w95-titlebar__buttons">
            {!dialog && (
              <>
                <button type="button" className="w95-caption" aria-label="Minimize" onClick={() => api.minimize(win.id)}>
                  <CaptionGlyph name="minimize" />
                </button>
                <button
                  type="button"
                  className="w95-caption"
                  aria-label={win.maximized ? 'Restore' : 'Maximize'}
                  disabled={!maximizable}
                  onClick={() => api.toggleMaximize(win.id)}
                >
                  <CaptionGlyph name={win.maximized ? 'restore' : 'maximize'} />
                </button>
              </>
            )}
            <button type="button" className="w95-caption w95-caption--close" aria-label="Close" onClick={() => api.close(win.id)}>
              <CaptionGlyph name="close" />
            </button>
          </span>
        </div>
        <div className="w95-window__body">{children}</div>
        {resizable && !win.maximized && <span className="w95-window__resize" onPointerDown={startResize} aria-hidden="true" />}
      </section>
      {outline && (
        <div className="w95-outline" style={{ left: outline.x, top: outline.y, width: outline.width, height: outline.height }} aria-hidden="true" />
      )}
    </>
  )
}
