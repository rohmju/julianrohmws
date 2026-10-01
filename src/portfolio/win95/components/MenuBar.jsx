import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import AccessKey from './AccessKey.jsx'
import { screenScale } from '../scale.js'
import { CheckGlyph } from './Glyphs.jsx'

// Closes a menu on a press anywhere outside `ref` and on Escape.
function useDismiss(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onClose()
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
  }, [ref, onClose, active])
}

// Moves keyboard focus to the next or previous enabled item of a menu.
export function moveFocus(menu, step) {
  const items = [...menu.querySelectorAll(':scope > button:not(:disabled), :scope > * > button:not(:disabled)')]
  const at = items.indexOf(document.activeElement)
  items[(at + step + items.length) % items.length]?.focus()
}

// A drop-down menu. Entries: { label, onSelect, disabled, checked, shortcut } or '-' (separator).
export function Menu({ items, onClose, autoFocus = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (autoFocus) ref.current?.querySelector('button:not(:disabled)')?.focus()
  }, [autoFocus])

  return (
    <div
      ref={ref}
      className="w95-menu"
      role="menu"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        moveFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1)
      }}
    >
      {items.map((item, i) =>
        item === '-' ? (
          <div key={`separator-${i}`} className="w95-separator" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked}
            className="w95-menu__item"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect?.()
            }}
          >
            <span className="w95-menu__check">{item.checked && <CheckGlyph />}</span>
            <span className="w95-menu__label">
              <AccessKey label={item.label} />
            </span>
            <span className="w95-menu__shortcut">{item.shortcut}</span>
          </button>
        ),
      )}
    </div>
  )
}

// A menu at the pointer, e.g. the desktop's right-click menu; kept inside the screen.
export function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  const [shift, setShift] = useState({ x: 0, y: 0 })
  useDismiss(ref, onClose)

  useLayoutEffect(() => {
    const menu = ref.current.getBoundingClientRect()
    const screen = ref.current.closest('.w95').getBoundingClientRect()
    const k = screenScale(ref.current)
    setShift({ x: Math.min(0, screen.right - menu.right) / k, y: Math.min(0, screen.bottom - menu.bottom) / k })
  }, [x, y])

  return (
    <div ref={ref} className="w95-context" style={{ left: x, top: y, transform: `translate(${shift.x}px, ${shift.y}px)` }}>
      <Menu items={items} onClose={onClose} />
    </div>
  )
}

// A window's menu bar. Once a menu is open, hovering another title switches to it, as in Windows.
export default function MenuBar({ menus }) {
  const [open, setOpen] = useState(null)
  const [fromKeyboard, setFromKeyboard] = useState(false)
  const ref = useRef(null)
  const close = useRef(() => setOpen(null)).current
  useDismiss(ref, close, open !== null)

  return (
    <div className="w95-menubar" role="menubar" ref={ref}>
      {menus.map((menu, i) => (
        <div key={menu.label} className="w95-menubar__entry">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            className={`w95-menubar__title ${open === i ? 'is-open' : ''}`}
            onClick={(event) => {
              setFromKeyboard(event.detail === 0)
              setOpen(open === i ? null : i)
            }}
            onPointerEnter={() => open !== null && setOpen(i)}
          >
            <AccessKey label={menu.label} />
          </button>
          {open === i && <Menu items={menu.items} onClose={() => setOpen(null)} autoFocus={fromKeyboard} />}
        </div>
      ))}
    </div>
  )
}
