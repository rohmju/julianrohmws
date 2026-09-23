import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion.js'
import { ArrowUpIcon, ChevronDownIcon, ClockIcon, PlusIcon, SlidersIcon } from './Icons.jsx'

// The chat input. Its value is fully controlled by the parent (scroll
// position), so it renders like Claude's editor but can't be typed into.
export default function Composer({ value, canSend, sendRef, onSubmit }) {
  const [typing, setTyping] = useState(false)
  const wasSendable = useRef(false)

  // Hold the caret solid while characters change, blink when idle.
  useEffect(() => {
    setTyping(true)
    const t = setTimeout(() => setTyping(false), 450)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    if (canSend && !wasSendable.current && !prefersReducedMotion()) {
      sendRef.current?.animate(
        [{ transform: 'scale(0.86)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
        { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
      )
    }
    wasSendable.current = canSend
  }, [canSend, sendRef])

  const editorClass = ['editor', !value && 'is-empty', typing && 'is-typing'].filter(Boolean).join(' ')

  return (
    <form className="composer" onSubmit={onSubmit} autoComplete="off">
      <input type="hidden" name="prompt" value={value} />
      <div
        className={editorClass}
        role="textbox"
        tabIndex={0}
        aria-readonly="true"
        aria-label="Prompt"
        aria-describedby="hint-label"
      >
        <p data-placeholder="How can I help you today?">
          <span>{value}</span>
          <span className="caret" aria-hidden="true" />
        </p>
      </div>

      <div className="controls">
        <button className="tool-btn" type="button" aria-label="Add files and photos" data-nudge>
          <PlusIcon />
        </button>
        <button className="tool-btn" type="button" aria-label="Search and tools" data-nudge>
          <SlidersIcon />
        </button>
        <button className="tool-btn" type="button" aria-label="Extended thinking" data-nudge>
          <ClockIcon />
        </button>
        <span className="spacer" />
        <button className="model-btn" type="button" aria-label="Model: Opus 6.7" data-nudge>
          Opus 6.7
          <ChevronDownIcon />
        </button>
        <button ref={sendRef} className="send" type="submit" aria-label="Send message" disabled={!canSend}>
          <ArrowUpIcon />
        </button>
      </div>
    </form>
  )
}
