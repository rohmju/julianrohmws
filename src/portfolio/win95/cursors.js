// The Windows 95 mouse pointers, drawn once into PNG data URLs (SVG cursors aren't supported by
// every browser). X = black, . = white, space = transparent.
const ARROW = [
  'X',
  'XX',
  'X.X',
  'X..X',
  'X...X',
  'X....X',
  'X.....X',
  'X......X',
  'X.......X',
  'X........X',
  'X.........X',
  'X......XXXXX',
  'X...X..X',
  'X..XX..X',
  'X.X  X..X',
  'XX   X..X',
  'X     X..X',
  '      X..X',
  '       XX',
]

const HOURGLASS = [
  'XXXXXXXXXXX',
  'X.........X',
  'XXXXXXXXXXX',
  ' X.......X',
  ' X.......X',
  ' X.XXXXX.X',
  ' X..XXX..X',
  '  X..X..X',
  '   X...X',
  '    X.X',
  '    X.X',
  '   X...X',
  '  X..X..X',
  ' X...X...X',
  ' X..XXX..X',
  ' X.XXXXX.X',
  ' X.......X',
  'XXXXXXXXXXX',
  'X.........X',
  'XXXXXXXXXXX',
]

function draw(rows) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  rows.forEach((row, y) => {
    ;[...row].forEach((pixel, x) => {
      if (pixel === ' ') return
      ctx.fillStyle = pixel === 'X' ? '#000' : '#fff'
      ctx.fillRect(x, y, 1, 1)
    })
  })
  return canvas.toDataURL('image/png')
}

let cached = null

// CSS custom properties for the desktop's root element.
export function cursorVariables() {
  if (!cached) {
    try {
      cached = {
        '--w95-arrow': `url(${draw(ARROW)}) 0 0, default`,
        '--w95-busy': `url(${draw(HOURGLASS)}) 5 10, wait`,
      }
    } catch {
      cached = {} // no canvas: the system pointers stand in
    }
  }
  return cached
}
