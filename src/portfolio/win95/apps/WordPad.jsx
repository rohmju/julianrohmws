import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWin95 } from '../context.js'
import MenuBar from '../components/MenuBar.jsx'
import { resumeText } from '../resume.js'

// A document's blocks (see resume.js) as rich text, on screen and on paper.
function Document({ blocks }) {
  return blocks.map((block, i) => {
    switch (block.type) {
      case 'title':
        return <h1 key={i}>{block.text}</h1>
      case 'subtitle':
        return <p key={i} className="is-subtitle">{block.text}</p>
      case 'heading':
        return <h2 key={i}>{block.text}</h2>
      case 'list':
        return (
          <ul key={i}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )
      case 'entry':
        return (
          <section key={i} className="is-entry">
            <h3>
              <span>{block.title}</span>
              <span>{block.meta}</span>
            </h3>
            {block.detail && <p className="is-detail">{block.detail}</p>}
            {block.items.length > 0 && (
              <ul>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        )
      default:
        return <p key={i}>{block.text}</p>
    }
  })
}

const PrinterGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path fill="#000" d="M4 1h8v5H4z" />
    <path fill="#fff" d="M5 2h6v4H5z" />
    <path fill="#000" d="M1 6h14v7H1z" />
    <path fill="#c0c0c0" d="M2 7h12v5H2z" />
    <path fill="#fff" d="M2 7h12v1H2z" />
    <path fill="#0f0" d="M11 9h2v1h-2z" />
    <path fill="#000" d="M4 11h8v4H4z" />
    <path fill="#fff" d="M5 12h6v3H5z" />
  </svg>
)

// WordPad with a read-only document, here Julian's CV. File → Print (or Ctrl+P) prints a clean
// copy of it, and the browser's print dialog can save that as a PDF.
export default function WordPad({ win, props }) {
  const { api } = useWin95()
  const blocks = props.blocks ?? []
  const [bars, setBars] = useState({ toolbar: true, format: true, ruler: true, status: true })
  const pageRef = useRef(null)
  const toggle = (bar) => setBars((on) => ({ ...on, [bar]: !on[bar] }))
  const print = () => window.print()

  const menus = [
    {
      label: '&File',
      items: [
        { label: '&New...', disabled: true },
        { label: '&Open...', disabled: true },
        { label: '&Save', disabled: true },
        { label: 'Save &As PDF...', onSelect: print },
        '-',
        { label: '&Print...', shortcut: 'Ctrl+P', onSelect: print },
        { label: 'Print Pre&view', onSelect: print },
        '-',
        { label: 'E&xit', onSelect: () => api.close(win.id) },
      ],
    },
    {
      label: '&Edit',
      items: [
        { label: '&Copy All', shortcut: 'Ctrl+C', onSelect: () => navigator.clipboard?.writeText(resumeText(blocks)).catch(() => {}) },
        { label: 'Select &All', onSelect: () => window.getSelection()?.selectAllChildren(pageRef.current) },
      ],
    },
    {
      label: '&View',
      items: [
        { label: '&Toolbar', checked: bars.toolbar, onSelect: () => toggle('toolbar') },
        { label: '&Format Bar', checked: bars.format, onSelect: () => toggle('format') },
        { label: '&Ruler', checked: bars.ruler, onSelect: () => toggle('ruler') },
        { label: '&Status Bar', checked: bars.status, onSelect: () => toggle('status') },
      ],
    },
    {
      label: '&Help',
      items: [{ label: '&Help Topics', onSelect: () => api.run('help') }, '-', { label: '&About WordPad', onSelect: () => api.about('WordPad') }],
    },
  ]

  return (
    <div className="w95-app w95-wordpad">
      <MenuBar menus={menus} />
      {bars.toolbar && (
        <div className="w95-toolbar">
          <button type="button" className="w95-toolbar__button" title="Print" onClick={print}>
            <PrinterGlyph />
            <span>Print</span>
          </button>
          <button type="button" className="w95-toolbar__button" title="Save as PDF" onClick={print}>
            <span>Save as PDF</span>
          </button>
        </div>
      )}
      {bars.format && (
        <div className="w95-toolbar" aria-hidden="true">
          <span className="w95-wordpad__font">Times New Roman</span>
          <span className="w95-wordpad__font is-size">10</span>
          <span className="w95-toolbar__button is-letter">
            <b>B</b>
          </span>
          <span className="w95-toolbar__button is-letter">
            <i>I</i>
          </span>
          <span className="w95-toolbar__button is-letter">
            <u>U</u>
          </span>
        </div>
      )}
      {bars.ruler && <div className="w95-wordpad__ruler" aria-hidden="true" />}
      <div className="w95-well">
        <article className="w95-wordpad__page w95-doc" ref={pageRef}>
          <Document blocks={blocks} />
        </article>
      </div>
      {bars.status && (
        <div className="w95-statusbar">
          <span className="w95-statusbar__field">For Help, press F1</span>
          <span className="w95-statusbar__field">Print → &ldquo;Save as PDF&rdquo;</span>
        </div>
      )}
      {createPortal(
        <div className="w95-print-sheet w95-doc">
          <Document blocks={blocks} />
        </div>,
        document.body,
      )}
    </div>
  )
}
