import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { BOARD_IMAGE, clipSources, idlePoster } from '../lib/media.js'
import { hasFrame, nextPresentedFrame, playedToEnd, preload, wait } from '../lib/video.js'

const STILL_FADE_MS = 900

// Three stacked <video> layers: idle loop, reveal and return. All three clips share their
// boundary frames (see scripts/generate-videos.js), so a handoff just starts the next clip
// underneath, waits until it has presented its first frame and then hides the previous one.
//
// Without motion (prefers-reduced-motion) or without video files, the same API crossfades
// between the two still frames instead.
const VideoStage = forwardRef(function VideoStage({ variant, stillsOnly, onIdleVisible }, ref) {
  const idleRef = useRef(null)
  const revealRef = useRef(null)
  const returnRef = useRef(null)
  const [missing, setMissing] = useState(false)
  const [boardStill, setBoardStill] = useState(false)
  const useStills = stillsOnly || missing

  const layer = (video, state) => {
    if (video) video.dataset.layer = state
  }

  useEffect(() => {
    const idle = idleRef.current
    layer(idle, 'front')
    layer(revealRef.current, 'hidden')
    layer(returnRef.current, 'hidden')
    if (useStills) {
      idle.pause()
      return
    }
    // Buffer the reveal as soon as the loop is running smoothly.
    const warm = () => preload(revealRef.current)
    idle.addEventListener('canplaythrough', warm, { once: true })
    const fallback = setTimeout(warm, 4000)
    idle.play().catch(() => {}) // autoplay may be refused (e.g. low-power mode); the poster stays
    return () => {
      idle.removeEventListener('canplaythrough', warm)
      clearTimeout(fallback)
    }
  }, [useStills])

  useImperativeHandle(ref, () => ({
    // 0..1 position inside the current idle cycle and the seconds left in it.
    loopState() {
      const idle = idleRef.current
      if (useStills || !idle || idle.paused || !Number.isFinite(idle.duration)) return { progress: 1, remaining: 0 }
      return { progress: idle.currentTime / idle.duration, remaining: idle.duration - idle.currentTime }
    },

    warmReveal() {
      if (!useStills) preload(revealRef.current)
    },

    // Lets the idle loop finish its current cycle, then continues frame-exactly into the reveal.
    // Resolves when the reveal has ended and is holding its last frame (= the board).
    async playReveal({ onStart } = {}) {
      if (useStills) {
        onStart?.()
        setBoardStill(true)
        await wait(STILL_FADE_MS)
        return
      }
      const idle = idleRef.current
      const reveal = revealRef.current
      preload(reveal)
      // Inside the click's user gesture: make sure the reveal is decodable when we need it.
      reveal.currentTime = 0
      reveal.play().then(() => reveal.pause()).catch(() => {}).finally(() => { reveal.currentTime = 0 })

      idle.loop = false
      await playedToEnd(idle)

      onStart?.()
      layer(reveal, 'under')
      reveal.currentTime = 0
      await reveal.play().catch(() => {})
      await nextPresentedFrame(reveal)
      layer(reveal, 'front')
      layer(idle, 'hidden')
      idle.pause()
      await playedToEnd(reveal)
      preload(returnRef.current)
    },

    // Called once the board canvas fully covers the stage.
    parkAfterReveal() {
      const idle = idleRef.current
      if (useStills || !idle) return
      idle.currentTime = 0
      idle.loop = true
      preload(returnRef.current)
    },

    // Shows the return clip's first frame (= the bare board) so the canvas can fade into it.
    async prepareReturn() {
      if (useStills) return
      const back = returnRef.current
      preload(back)
      if (back.currentTime !== 0) back.currentTime = 0
      await hasFrame(back)
      layer(back, 'front')
      layer(revealRef.current, 'hidden')
      revealRef.current.currentTime = 0
    },

    // Plays the return clip, then resumes the idle loop from its first frame (= the return's last).
    async playReturn() {
      if (useStills) {
        setBoardStill(false)
        await wait(STILL_FADE_MS)
        onIdleVisible?.()
        return
      }
      const idle = idleRef.current
      const back = returnRef.current
      await back.play().catch(() => {})
      await playedToEnd(back)

      idle.currentTime = 0
      idle.loop = true
      layer(idle, 'under')
      await idle.play().catch(() => {})
      await nextPresentedFrame(idle)
      layer(idle, 'front')
      layer(back, 'hidden')
      back.pause()
      back.currentTime = 0
      onIdleVisible?.()
    },
  }), [useStills, onIdleVisible])

  const onMissing = () => setMissing(true)
  const renderSources = (name) =>
    clipSources(name, variant).map((s, i, all) => (
      <source key={s.type} src={s.src} type={s.type} onError={i === all.length - 1 ? onMissing : undefined} />
    ))

  return (
    <div className="pf-stage" aria-hidden="true">
      <img className="pf-stage__still" src={idlePoster(variant)} alt="" fetchpriority="high" decoding="async" />
      <video
        ref={idleRef}
        className="pf-stage__video"
        poster={idlePoster(variant)}
        muted
        loop
        playsInline
        preload={useStills ? 'none' : 'auto'}
        disablePictureInPicture
      >
        {!stillsOnly && renderSources('idle')}
      </video>
      <video ref={revealRef} className="pf-stage__video" poster={idlePoster(variant)} muted playsInline preload="none" disablePictureInPicture>
        {!useStills && renderSources('reveal')}
      </video>
      <video ref={returnRef} className="pf-stage__video" poster={BOARD_IMAGE} muted playsInline preload="none" disablePictureInPicture>
        {!useStills && renderSources('return')}
      </video>
      <img
        className={`pf-stage__still pf-stage__still--board ${boardStill ? 'is-visible' : ''}`}
        src={BOARD_IMAGE}
        alt=""
        decoding="async"
        loading={useStills ? 'eager' : 'lazy'}
      />
    </div>
  )
})

export default VideoStage
