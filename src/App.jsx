import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Composer from './components/Composer.jsx'
import IconButton from './components/IconButton.jsx'
import { GhostIcon, MenuIcon, Spark } from './components/Icons.jsx'
import ScrollHint from './components/ScrollHint.jsx'
import Sidebar from './components/Sidebar.jsx'
import SuggestionChips from './components/SuggestionChips.jsx'
import { useScrollTyping } from './hooks/useScrollTyping.js'
import { prefersReducedMotion } from './lib/motion.js'
import './App.css'

const TARGET = 'yo claude make a website about myself make no mistake'
const PX_PER_CHAR = 30 // scroll distance that reveals one character

function App({ onExit }) {
  const [wipeOrigin, setWipeOrigin] = useState(null)
  const [nudge, setNudge] = useState(0)
  const submitted = wipeOrigin !== null

  const shown = useScrollTyping(TARGET.length, PX_PER_CHAR, !submitted)
  const value = TARGET.slice(0, shown)
  const canSend = !submitted && value === TARGET

  const appRef = useRef(null)
  const sendRef = useRef(null)
  const wipeRef = useRef(null)
  const canSendRef = useRef(false)

  // Layout effect so the ref flips in the same commit that toggles the
  // button's `disabled` — the keyboard path can never see a stale "ready".
  useLayoutEffect(() => {
    canSendRef.current = canSend
  }, [canSend])

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  const bump = useCallback(() => setNudge((n) => n + 1), [])

  const trySubmit = useCallback(() => {
    if (!canSendRef.current) {
      bump()
      return
    }
    canSendRef.current = false
    appRef.current.inert = true

    const r = sendRef.current.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 2
    setWipeOrigin({ x, y, radius })
  }, [bump])

  // White circle grows out of the send button; once it covers the screen,
  // onExit clears the whole document.
  useLayoutEffect(() => {
    if (!wipeOrigin) return
    const { x, y, radius } = wipeOrigin
    const anim = prefersReducedMotion()
      ? wipeRef.current.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 200,
          easing: 'ease-out',
          fill: 'forwards',
        })
      : wipeRef.current.animate(
          [
            { clipPath: `circle(0px at ${x}px ${y}px)` },
            { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
          ],
          { duration: 850, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
        )

    let done = false
    const finish = () => {
      if (done) return
      done = true
      onExit()
    }
    anim.finished.then(finish, finish)
    const fallback = setTimeout(finish, 1500)
    return () => clearTimeout(fallback)
  }, [wipeOrigin, onExit])

  useEffect(() => {
    if (submitted) return
    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey || e.isComposing || e.target === sendRef.current) return // the button handles its own Enter
        e.preventDefault()
        trySubmit()
      } else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bump() // typing does nothing here — point people at the scroll instead
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [submitted, trySubmit, bump])

  const onSubmit = (e) => {
    e.preventDefault()
    trySubmit()
  }

  const onAppClick = (e) => {
    if (e.target instanceof Element && e.target.closest('[data-nudge]')) bump()
  }

  return (
    <>
      <div className="app" ref={appRef} onClick={onAppClick}>
        <Sidebar />
        <main className="main">
          <header className="topbar">
            <IconButton label="Open menu" className="menu-btn"><MenuIcon /></IconButton>
            <IconButton label="Incognito chat"><GhostIcon /></IconButton>
          </header>

          <section className="hero">
            <h1 className="greeting">
              <Spark className="spark" />
              <span>What do you want to build today, Julian?</span>
            </h1>
            <Composer value={value} canSend={canSend} sendRef={sendRef} onSubmit={onSubmit} />
            <SuggestionChips />
          </section>
        </main>
      </div>

      <ScrollHint progress={shown / TARGET.length} ready={canSend} nudge={nudge} />

      <div
        className="scroll-track"
        aria-hidden="true"
        style={{ '--type-distance': `${TARGET.length * PX_PER_CHAR}px` }}
      />
      {submitted && <div className="wipe" ref={wipeRef} />}
    </>
  )
}

export default App
