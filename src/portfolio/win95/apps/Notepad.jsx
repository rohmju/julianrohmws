import { useRef, useState } from 'react'
import { useWin95 } from '../context.js'
import MenuBar from '../components/MenuBar.jsx'

// What Notepad's Time/Date (F5) inserts, e.g. "3:41 PM 9/30/2026".
const timeDate = () => {
  const now = new Date()
  return `${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ${now.toLocaleDateString('en-US')}`
}

// Notepad with a department file (or an empty page). Edits are allowed and, as there's no disk to
// save to, simply forgotten when the window closes.
export default function Notepad({ win, props }) {
  const { api } = useWin95()
  const [text, setText] = useState(props.text ?? '')
  const [wrap, setWrap] = useState(true)
  const ref = useRef(null)

  // Replaces the selection, as typing would.
  const replaceSelection = (value) => {
    const area = ref.current
    area.focus()
    area.setRangeText(value, area.selectionStart, area.selectionEnd, 'end')
    setText(area.value)
  }
  const selection = () => {
    const area = ref.current
    return area.value.slice(area.selectionStart, area.selectionEnd)
  }
  const copy = () => navigator.clipboard?.writeText(selection()).catch(() => {})

  const menus = [
    {
      label: '&File',
      items: [
        { label: '&New', onSelect: () => setText('') },
        { label: '&Open...', disabled: true },
        { label: '&Save', disabled: true },
        { label: 'Save &As...', disabled: true },
        '-',
        { label: 'Page Se&tup...', disabled: true },
        { label: '&Print', disabled: true },
        '-',
        { label: 'E&xit', onSelect: () => api.close(win.id) },
      ],
    },
    {
      label: '&Edit',
      items: [
        { label: '&Undo', shortcut: 'Ctrl+Z', disabled: true },
        '-',
        {
          label: 'Cu&t',
          shortcut: 'Ctrl+X',
          onSelect: () => {
            copy()
            replaceSelection('')
          },
        },
        { label: '&Copy', shortcut: 'Ctrl+C', onSelect: copy },
        { label: '&Paste', shortcut: 'Ctrl+V', onSelect: () => navigator.clipboard?.readText().then(replaceSelection).catch(() => {}) },
        { label: 'De&lete', shortcut: 'Del', onSelect: () => replaceSelection('') },
        '-',
        {
          label: 'Select &All',
          onSelect: () => {
            ref.current.focus()
            ref.current.select()
          },
        },
        { label: 'Time/&Date', shortcut: 'F5', onSelect: () => replaceSelection(timeDate()) },
        '-',
        { label: '&Word Wrap', checked: wrap, onSelect: () => setWrap((on) => !on) },
      ],
    },
    {
      label: '&Search',
      items: [
        { label: '&Find...', disabled: true },
        { label: 'Find &Next', shortcut: 'F3', disabled: true },
      ],
    },
    {
      label: '&Help',
      items: [{ label: '&Help Topics', onSelect: () => api.run('help') }, '-', { label: '&About Notepad', onSelect: () => api.about('Notepad') }],
    },
  ]

  return (
    <div className={`w95-app w95-notepad ${props.color ? 'is-tinted' : ''}`} style={props.color ? { '--accent': props.color } : undefined}>
      <MenuBar menus={menus} />
      <div className="w95-well">
        <textarea
          ref={ref}
          className={`w95-notepad__text ${wrap ? '' : 'is-nowrap'}`}
          value={text}
          wrap={wrap ? 'soft' : 'off'}
          spellCheck={false}
          aria-label={`${props.name ?? 'Untitled'} - Notepad`}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'F5') return
            event.preventDefault()
            replaceSelection(timeDate())
          }}
        />
      </div>
    </div>
  )
}
