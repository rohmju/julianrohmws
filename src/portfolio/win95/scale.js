import { useEffect, useState } from 'react'

// The whole desktop is drawn at 1x (a 640x480-style layout) and magnified with a CSS transform.
// Layout measurements (clientWidth, left/top, ...) stay in desktop pixels; pointer coordinates and
// getBoundingClientRect() are in screen pixels, so those have to be divided by the scale.
const SCALE = 2
const MIN_SCREEN = { width: 1024, height: 640 } // smaller screens keep 1x, or nothing would fit

const pick = () => (window.innerWidth >= MIN_SCREEN.width && window.innerHeight >= MIN_SCREEN.height ? SCALE : 1)

export function useDesktopScale() {
  const [scale, setScale] = useState(pick)
  useEffect(() => {
    const update = () => setScale(pick())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return scale
}

// The scale currently applied to the desktop that contains `element`.
export function screenScale(element) {
  const root = element?.closest('.w95')
  return root?.offsetWidth ? root.getBoundingClientRect().width / root.offsetWidth : 1
}
