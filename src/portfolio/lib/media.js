// Paths and framing for the video stage.
// Everything here is produced by scripts/generate-videos.js into /public/videos.

export const VIDEO_BASE = '/videos'

// Landscape screens get the 16:9 clips; portrait screens get the centered 9:16 crop, which is
// sharper and lighter on phones. The choice is made once per visit so a clip never swaps mid-play.
export function pickVariant() {
  if (typeof window === 'undefined') return 'landscape'
  return window.innerWidth / window.innerHeight < 1 ? 'portrait' : 'landscape'
}

export function clipSources(name, variant) {
  return [
    { src: `${VIDEO_BASE}/${name}-${variant}.webm`, type: 'video/webm' },
    { src: `${VIDEO_BASE}/${name}-${variant}.mp4`, type: 'video/mp4' },
  ]
}

export const idlePoster = (variant) => `${VIDEO_BASE}/idle-poster-${variant}.jpg`

// The PC leaves the idle loop through `reveal` and comes back through `back`. endImage is the
// reveal's last frame (the CRT showing the Windows 95 start-up screen), backImage the return's
// first (the same monitor, switched off); without motion they replace the clips.
export const PC = {
  reveal: 'departments',
  back: 'departments-return',
  endImage: `${VIDEO_BASE}/screen-end.jpg`,
  backImage: `${VIDEO_BASE}/screen-off.jpg`,
}
