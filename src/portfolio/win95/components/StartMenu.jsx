import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from '../icons.jsx'
import AccessKey from './AccessKey.jsx'
import { ArrowGlyph } from './Glyphs.jsx'
import { screenScale } from '../scale.js'
import { moveFocus } from './MenuBar.jsx'

const HOVER_OPEN_MS = 180 // Windows opens a submenu after the pointer rests on its entry briefly
const TASKBAR_HEIGHT = 28

// Entries: { label, icon, onSelect, disabled, submenu: [...] } or '-' (separator).
function MenuList({ items, large = false, onClose }) {
  const [open, setOpen] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const hover = (index) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(index), HOVER_OPEN_MS)
  }

  return (
    <div
      className={`w95-start-list ${large ? 'is-large' : ''}`}
      role="menu"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        event.stopPropagation()
        moveFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1)
      }}
    >
      {items.map((item, index) =>
        item === '-' ? (
          <div key={`separator-${index}`} className="w95-separator" role="separator" />
        ) : (
          <div key={item.label} className="w95-start-entry" onPointerEnter={() => hover(item.submenu ? index : null)}>
            <button
              type="button"
              role="menuitem"
              aria-haspopup={item.submenu ? 'menu' : undefined}
              aria-expanded={item.submenu ? open === index : undefined}
              className={`w95-start-item ${open === index ? 'is-open' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                clearTimeout(timer.current)
                if (item.submenu) {
                  setOpen(open === index ? null : index)
                } else {
                  onClose()
                  item.onSelect?.()
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' && item.submenu) {
                  event.preventDefault()
                  setOpen(index)
                }
              }}
            >
              <span className="w95-start-item__icon">{item.icon && <Icon name={item.icon} size={large ? 32 : 16} />}</span>
              <span className="w95-start-item__label">
                <AccessKey label={item.label} />
              </span>
              {item.submenu && <ArrowGlyph />}
            </button>
            {item.submenu && open === index && <Submenu items={item.submenu} onClose={onClose} onBack={() => setOpen(null)} />}
          </div>
        ),
      )}
    </div>
  )
}

// A cascading submenu, shifted back inside the screen when it would run off an edge.
function Submenu({ items, onClose, onBack }) {
  const ref = useRef(null)
  const [shift, setShift] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const menu = ref.current.getBoundingClientRect()
    const screen = ref.current.closest('.w95').getBoundingClientRect()
    const k = screenScale(ref.current)
    setShift({
      x: Math.min(0, screen.right - 2 * k - menu.right) / k,
      y: Math.min(0, screen.bottom - TASKBAR_HEIGHT * k - menu.bottom) / k,
    })
  }, [])

  return (
    <div
      ref={ref}
      className="w95-submenu"
      style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft') return
        event.preventDefault()
        event.stopPropagation()
        onBack()
      }}
    >
      <MenuList items={items} onClose={onClose} />
    </div>
  )
}

export default function StartMenu({ items, onClose, autoFocus }) {
  const ref = useRef(null)

  useEffect(() => {
    const onPointerDown = (event) => {
      if (ref.current?.contains(event.target) || event.target.closest('[data-start-button]')) return
      onClose()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (autoFocus) ref.current?.querySelector('.w95-start-item')?.focus()
  }, [autoFocus])

  return (
    <div ref={ref} className="w95-start-menu">
      <div className="w95-start-menu__banner" aria-hidden="true">
        <span>
          <b>Windows</b>95
        </span>
      </div>
      <MenuList items={items} large onClose={onClose} />
    </div>
  )
}
