import { useEffect, useState } from 'react'
import foxy from './foxy.webp'

const SHOW_MS = 1100 // the jump plays once (840 ms), then holds on the last frame briefly

// Plays the Foxy jumpscare full-screen, centred, on a transparent background each time `play` changes.
export default function FoxyJumpscare({ play }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!play) return
    setShown(play)
    const timer = setTimeout(() => setShown(0), SHOW_MS)
    return () => clearTimeout(timer)
  }, [play])

  if (!shown) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        key={shown}
        src={`${foxy}?${shown}`}
        alt=""
        draggable={false}
        style={{ width: '100vw', height: '100vh', objectFit: 'contain' }}
      />
    </div>
  )
}
