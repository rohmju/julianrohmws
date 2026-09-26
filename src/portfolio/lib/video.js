// Small promise helpers for frame-accurate video handoffs.

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Resolves once the element has actually presented a new frame (falls back to `playing`).
export function nextPresentedFrame(video, timeout = 1500) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout)
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(done)
    } else if (!video.paused && video.readyState >= 3) {
      requestAnimationFrame(() => requestAnimationFrame(done))
    } else {
      video.addEventListener('playing', () => requestAnimationFrame(() => requestAnimationFrame(done)), { once: true })
    }
  })
}

// Resolves when playback reaches the end. A video that isn't playing (autoplay blocked, missing
// file) resolves right away so a transition can never hang on it.
export function playedToEnd(video) {
  return new Promise((resolve) => {
    if (video.ended || video.paused || !Number.isFinite(video.duration)) return resolve()
    const remaining = (video.duration - video.currentTime) / (video.playbackRate || 1)
    const timer = setTimeout(finish, remaining * 1000 + 1500)
    function finish() {
      clearTimeout(timer)
      video.removeEventListener('ended', finish)
      video.removeEventListener('error', finish)
      resolve()
    }
    video.addEventListener('ended', finish)
    video.addEventListener('error', finish)
  })
}

// Resolves when the current frame is decoded and displayable (or after `timeout`).
export function hasFrame(video, timeout = 2500) {
  return new Promise((resolve) => {
    if (video.readyState >= 2) return resolve()
    const timer = setTimeout(finish, timeout)
    function finish() {
      clearTimeout(timer)
      video.removeEventListener('loadeddata', finish)
      video.removeEventListener('seeked', finish)
      resolve()
    }
    video.addEventListener('loadeddata', finish)
    video.addEventListener('seeked', finish)
  })
}

// Starts buffering a clip that was rendered with preload="none".
export function preload(video) {
  if (!video || video.dataset.preloaded) return
  video.dataset.preloaded = 'true'
  video.preload = 'auto'
  if (video.readyState === 0) video.load()
}
