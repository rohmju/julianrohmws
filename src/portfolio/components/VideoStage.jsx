import { createRef, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { PC, clipSources, idlePoster } from '../lib/media.js'
import { hasFrame, nextPresentedFrame, playedToEnd, preload, wait } from '../lib/video.js'

const STILL_FADE_MS = 900

const CLIP_NAMES = ['idle', PC.reveal, PC.back]
const STILL_IMAGES = [PC.endImage, PC.backImage]

// Stacked <video> layers: the idle loop plus the PC reveal and its return. All clips share
// their boundary frames (see scripts/generate-videos.js), so a handoff just starts the next clip
// underneath, waits until it has presented its first frame and then hides the previous one.
//
// Without motion (prefers-reduced-motion) or without video files, the same API crossfades
// between the still frames instead.
const VideoStage = forwardRef(function VideoStage({ variant, stillsOnly, onIdleVisible }, ref) {
  const refs = useRef(null)
  if (!refs.current) refs.current = Object.fromEntries(CLIP_NAMES.map((name) => [name, createRef()]))
  const clip = (name) => refs.current[name].current
  const [missing, setMissing] = useState(false)
  const [still, setStill] = useState(null)
  const useStills = stillsOnly || missing

  const layer = (video, state) => {
    if (video) video.dataset.layer = state
  }

  useEffect(() => {
    const idle = clip('idle')
    for (const name of CLIP_NAMES) layer(clip(name), name === 'idle' ? 'front' : 'hidden')
    if (useStills) {
      idle.pause()
      return
    }
    // Buffer the PC reveal as soon as the loop is running smoothly.
    const warm = () => preload(clip(PC.reveal))
    idle.addEventListener('canplaythrough', warm, { once: true })
    const fallback = setTimeout(warm, 4000)
    idle.play().catch(() => {}) // autoplay may be refused (e.g. low-power mode); the poster stays
    return () => {
      idle.removeEventListener('canplaythrough', warm)
      clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useStills])

  // The return clip's poster is its first frame; it's only fetched once the PC is opened.
  const armReturn = () => {
    const video = clip(PC.back)
    if (video && !video.getAttribute('poster')) video.setAttribute('poster', PC.backImage)
  }

  useImperativeHandle(ref, () => ({
    // 0..1 position inside the current idle cycle and the seconds left in it.
    loopState() {
      const idle = clip('idle')
      if (useStills || !idle || idle.paused || !Number.isFinite(idle.duration)) return { progress: 1, remaining: 0 }
      return { progress: idle.currentTime / idle.duration, remaining: idle.duration - idle.currentTime }
    },

    warmReveal() {
      if (!useStills) preload(clip(PC.reveal))
    },

    // Lets the idle loop finish its current cycle, then continues frame-exactly into the PC
    // reveal. Resolves when the reveal has ended and is holding its last frame.
    async playReveal({ onStart } = {}) {
      if (useStills) {
        onStart?.()
        setStill(PC.endImage)
        await wait(STILL_FADE_MS)
        return
      }
      const idle = clip('idle')
      const reveal = clip(PC.reveal)
      preload(reveal)
      armReturn()
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
      preload(clip(PC.back))
    },

    // Called once the desktop fully covers the stage.
    parkAfterReveal() {
      const idle = clip('idle')
      if (useStills || !idle) return
      idle.currentTime = 0
      idle.loop = true
      preload(clip(PC.back))
    },

    // Shows the return clip's first frame so the desktop can fade into it.
    async prepareReturn() {
      if (useStills) {
        setStill(PC.backImage)
        await wait(STILL_FADE_MS)
        return
      }
      const back = clip(PC.back)
      const reveal = clip(PC.reveal)
      preload(back)
      if (back.currentTime !== 0) back.currentTime = 0
      await hasFrame(back)
      layer(back, 'front')
      layer(reveal, 'hidden')
      reveal.currentTime = 0
    },

    // Plays the return clip, then resumes the idle loop from its first frame (= the return's last).
    async playReturn() {
      if (useStills) {
        setStill(null)
        await wait(STILL_FADE_MS)
        onIdleVisible?.()
        return
      }
      const idle = clip('idle')
      const back = clip(PC.back)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        ref={refs.current.idle}
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
      <video ref={refs.current[PC.reveal]} className="pf-stage__video" poster={idlePoster(variant)} muted playsInline preload="none" disablePictureInPicture>
        {!useStills && renderSources(PC.reveal)}
      </video>
      <video ref={refs.current[PC.back]} className="pf-stage__video" muted playsInline preload="none" disablePictureInPicture>
        {!useStills && renderSources(PC.back)}
      </video>
      {/* Without motion the PC's boundary frames crossfade instead of the clips. */}
      {useStills &&
        STILL_IMAGES.map((src) => (
          <img key={src} className={`pf-stage__still pf-stage__still--end ${still === src ? 'is-visible' : ''}`} src={src} alt="" decoding="async" />
        ))}
    </div>
  )
})

export default VideoStage
