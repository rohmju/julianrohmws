import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion.js'

// Maps window scroll depth to a character count: every `pxPerChar` pixels
// scrolled reveals one more character, scrolling up removes them.
//
// The returned count chases the scroll target one character at a time, so a
// coarse wheel notch still reads as typing. It catches up within a few frames
// and then stops — no scroll, no typing.
export function useScrollTyping(length, pxPerChar, active = true) {
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)

  useEffect(() => {
    if (!active) return

    let raf = 0
    let goal = 0

    const goalFromScroll = () =>
      Math.min(length, Math.floor(Math.max(0, window.scrollY) / pxPerChar))

    const tick = () => {
      raf = 0
      const diff = goal - shownRef.current
      if (diff === 0) return
      const dist = Math.abs(diff)
      const step = prefersReducedMotion()
        ? dist
        : Math.min(dist, Math.max(1, Math.round(dist * 0.2)))
      shownRef.current += Math.sign(diff) * step
      setShown(shownRef.current)
      if (shownRef.current !== goal) raf = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      goal = goalFromScroll()
      if (!raf && goal !== shownRef.current) raf = requestAnimationFrame(tick)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [length, pxPerChar, active])

  return shown
}
