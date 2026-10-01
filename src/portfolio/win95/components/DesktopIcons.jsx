import { useRef, useState } from 'react'
import { CELL, GRID_INSET } from '../desktopGrid.js'
import { screenScale } from '../scale.js'
import DesktopIcon from './DesktopIcon.jsx'

const DRAG_THRESHOLD = 5 // px a press has to travel before it becomes a drag

// The icons on the desktop, each in its grid cell. Dragging one carries it along with the
// pointer; on release it snaps to the nearest free cell (onMove gets the cell it was dropped on).
export default function DesktopIcons({ nodes, cells, selected, onSelect, onOpen, onMove }) {
  const [drag, setDrag] = useState(null) // { id, dx, dy }
  const justDragged = useRef(false)

  const startDrag = (event, node) => {
    if (event.button !== 0) return
    const start = { x: event.clientX, y: event.clientY }
    const k = screenScale(event.currentTarget)
    let offset = null
    const move = (e) => {
      const dx = (e.clientX - start.x) / k
      const dy = (e.clientY - start.y) / k
      if (!offset && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      offset = { dx, dy }
      setDrag({ id: node.id, dx, dy })
    }
    const end = (e) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (!offset) return
      // The click that follows the release must not select or open anything.
      justDragged.current = true
      setTimeout(() => (justDragged.current = false))
      setDrag(null)
      if (e.type === 'pointercancel') return
      const cell = cells[node.id]
      onMove(node.id, { col: cell.col + Math.round(offset.dx / CELL), row: cell.row + Math.round(offset.dy / CELL) })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <div className="w95-desktop__icons">
      {nodes.map((node, order) => {
        const cell = cells[node.id]
        const dragging = drag?.id === node.id
        return (
          <div
            key={node.id}
            className={`w95-desktop__slot ${dragging ? 'is-dragging' : ''}`}
            style={{
              left: GRID_INSET + cell.col * CELL,
              top: GRID_INSET + cell.row * CELL,
              transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
            }}
            onPointerDown={(event) => startDrag(event, node)}
            onClickCapture={(event) => {
              if (!justDragged.current) return
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <DesktopIcon node={node} selected={selected === node.id} onSelect={onSelect} onOpen={onOpen} style={{ '--order': order }} />
          </div>
        )
      })}
    </div>
  )
}
