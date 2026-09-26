// Paths and framing shared by the video stage and the Three.js board.
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

// Last frame of the reveal clip; the board scene is textured with it for a seamless crossfade.
export const BOARD_IMAGE = `${VIDEO_BASE}/board-end.jpg`

// The board image in world units (16:9), and the part of it each clip variant shows before CSS
// object-fit: cover crops it further. The board camera reproduces exactly the same crop.
export const BOARD_SIZE = { width: 16, height: 9 }
export const SOURCE_RECT = {
  landscape: { width: 16, height: 9 },
  portrait: { width: (9 * 9) / 16, height: 9 },
}
