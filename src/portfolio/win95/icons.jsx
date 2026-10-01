// Pixel icons in the Windows 95 style, drawn by hand on a 32×32 grid, with a separate 16×16
// design where the small version needs one. Everything sits on whole pixels and renders with
// crisp edges, so the icons stay sharp at 1× and 2×.

const K = '#000000'
const W = '#ffffff'
const S = '#c0c0c0'
const G = '#808080'
const N = '#000080'
const T = '#008080'
const Y = '#ffff00'
const O = '#808000'
const D = '#c0c000'
const R = '#ff0000'
const L = '#00ff00'
const E = '#008000'
const B = '#0000ff'
const A = '#00ffff'

// A department folder is tinted by mixing its color with black (shadows) or white (highlights).
const mix = (hex, other, amount) => {
  const channel = (i) => {
    const from = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
    const to = parseInt(other.slice(1 + i * 2, 3 + i * 2), 16)
    return Math.round(from + (to - from) * amount).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(1)}${channel(2)}`
}
const tintOf = (color) => (color ? { front: color, back: mix(color, K, 0.35), shade: mix(color, K, 0.5) } : { front: Y, back: D, shade: O })

const folderBack = (tint = tintOf()) => (
  <>
    <path fill={K} d="M2 6h10l2 2h16v20H2z" />
    <path fill={tint.back} d="M3 7h8l2 2h16v18H3z" />
  </>
)

const folderFront = (top, tint = tintOf()) => (
  <>
    <path fill={K} d={`M2 ${top}h28v${28 - top}H2z`} />
    <path fill={tint.front} d={`M3 ${top + 1}h26v${26 - top}H3z`} />
    <path fill={W} d={`M3 ${top + 1}h26v1H4v${25 - top}H3z`} />
    <path fill={tint.shade} d={`M28 ${top + 2}h1v${25 - top}H4v-1h24z`} />
  </>
)

const computer = (screen) => (
  <>
    <path fill={K} d="M5 2h22v18H5z" />
    <path fill={S} d="M6 3h20v16H6z" />
    <path fill={W} d="M6 3h20v1H7v15H6z" />
    <path fill={G} d="M8 5h16v1H9v10H8z" />
    <path fill={screen} d="M9 6h15v10H9z" />
    <path fill={G} d="M12 20h8v2h-8z" />
    <path fill={K} d="M3 22h26v6H3z" />
    <path fill={S} d="M4 23h24v4H4z" />
    <path fill={W} d="M4 23h24v1H4z" />
    <path fill={K} d="M18 25h7v1h-7z" />
    <path fill={L} d="M6 25h2v1H6z" />
    <path fill={K} d="M5 29h22v3H5z" />
    <path fill={S} d="M6 30h20v1H6z" />
  </>
)

const page = (
  <>
    <path fill={K} d="M6 2h14l6 6v22H6z" />
    <path fill={W} d="M7 3h12v6h6v20H7z" />
    <path fill={S} d="M20 4l4 4h-4z" />
  </>
)

const driveBody = (
  <>
    <path fill={K} d="M2 14h28v11H2z" />
    <path fill={S} d="M3 15h26v9H3z" />
    <path fill={W} d="M3 15h26v1H4v8H3z" />
    <path fill={G} d="M4 23h25v1H4z" />
  </>
)

const panel = (
  <>
    <path fill={K} d="M3 5h26v22H3z" />
    <path fill={S} d="M4 6h24v20H4z" />
    <path fill={W} d="M4 6h24v1H5v19H4z" />
    <path fill={K} d="M10 9h2v14h-2zM20 9h2v14h-2z" />
    <path fill={B} d="M7 12h8v3H7z" />
    <path fill={R} d="M17 17h8v3h-8z" />
  </>
)

const bubble = <path fill={W} stroke={K} d="M6.5 3.5h19l3 3v14l-3 3h-11l-6 6v-6h-2l-3-3v-14z" />

const LARGE = {
  folder: (tint) => (
    <>
      {folderBack(tint)}
      {folderFront(12, tint)}
    </>
  ),
  text: () => (
    <>
      {page}
      <path fill={G} d="M9 12h14v1H9zM9 15h12v1H9zM9 18h14v1H9zM9 21h10v1H9zM9 24h13v1H9z" />
    </>
  ),
  notepad: () => (
    <>
      <path fill={K} d="M6 5h20v25H6z" />
      <path fill={W} d="M7 6h18v23H7z" />
      <path fill={A} d="M7 6h18v3H7z" />
      <path fill={K} d="M9 3h2v5H9zM13 3h2v5h-2zM17 3h2v5h-2zM21 3h2v5h-2z" />
      <path fill={G} d="M9 12h14v1H9zM9 15h14v1H9zM9 18h14v1H9zM9 21h14v1H9zM9 24h10v1H9z" />
    </>
  ),
  // WordPad and its documents: a page with a blue heading and a pencil.
  wordpad: () => (
    <>
      {page}
      <path fill={B} d="M9 6h8v3H9z" />
      <path fill={G} d="M9 12h14v1H9zM9 15h14v1H9zM9 18h10v1H9zM9 21h8v1H9z" />
      <path fill={K} d="M14 27l11-11 4 4-11 11h-4z" />
      <path fill={Y} d="M15 27l10-10 3 3-10 10h-3z" />
      <path fill={K} d="M14 28h2v2h-2z" />
    </>
  ),
  // Dial-Up Networking: a computer and a telephone.
  dialup: () => (
    <>
      <path fill={K} d="M2 2h18v14H2z" />
      <path fill={S} d="M3 3h16v12H3z" />
      <path fill={W} d="M3 3h16v1H4v11H3z" />
      <path fill={T} d="M5 5h12v8H5z" />
      <path fill={K} d="M7 16h8v2H7zM4 18h14v3H4z" />
      <path fill={S} d="M5 19h12v1H5z" />
      <path fill={K} d="M13 20h18v3H13zM13 23h4v2h-4zM27 23h4v2h-4zM17 24h10v7H17z" />
      <path fill={S} d="M18 25h8v5h-8z" />
      <path fill={K} d="M19 26h1v1h-1zM21 26h1v1h-1zM23 26h1v1h-1zM19 28h1v1h-1zM21 28h1v1h-1zM23 28h1v1h-1z" />
    </>
  ),
  computer: () => computer(T),
  shutdown: () => computer('#101828'),
  network: () => (
    <>
      <path fill={K} d="M2 2h14v11H2z" />
      <path fill={S} d="M3 3h12v9H3z" />
      <path fill={T} d="M5 5h8v5H5z" />
      <path fill={K} d="M1 13h16v3H1z" />
      <path fill={S} d="M2 14h14v1H2z" />
      <path fill={K} d="M8 16h1v6h7v1H8z" />
      <path fill={K} d="M15 12h15v12H15z" />
      <path fill={S} d="M16 13h13v10H16z" />
      <path fill={T} d="M18 15h9v6h-9z" />
      <path fill={K} d="M14 24h17v4H14z" />
      <path fill={S} d="M15 25h15v2H15z" />
      <path fill={K} d="M16 29h13v2H16z" />
    </>
  ),
  recycle: () => (
    <>
      <path fill={K} d="M6 5h20v4H6z" />
      <path fill={S} d="M7 6h18v2H7z" />
      <path fill={K} d="M7 9h18l-2 21H9z" />
      <path fill={W} d="M8 9h16l-2 20H10z" />
      <path fill={S} d="M12 10h1v18h-1zM16 10h1v19h-1zM20 10h1v18h-1z" />
      <path fill="none" stroke={E} strokeWidth="2" d="M16 13l5 8h-10z" />
    </>
  ),
  minesweeper: () => (
    <>
      <path fill={K} d="M15 3h2v26h-2zM3 15h26v2H3zM7 7h3v3H7zM22 7h3v3h-3zM7 22h3v3H7zM22 22h3v3h-3z" />
      <circle cx="16" cy="16" r="8.5" fill={K} />
      <path fill={W} d="M12 12h3v3h-3z" />
    </>
  ),
  help: () => (
    <>
      <path fill={K} d="M6 3h21v26H6z" />
      <path fill={T} d="M7 4h19v21H7z" />
      <path fill="#004040" d="M7 4h3v21H7z" />
      <path fill={W} d="M8 25h18v3H8z" />
      <path fill={G} d="M8 26h18v1H8z" />
      <path fill={Y} d="M13 8h8v2h-8zM21 10h2v5h-2zM17 15h4v2h-4zM16 17h3v3h-3zM16 21h3v2h-3z" />
    </>
  ),
  run: () => (
    <>
      <path fill={K} d="M6 5h24v20H6z" />
      <path fill={N} d="M7 6h22v3H7z" />
      <path fill={W} d="M7 9h22v15H7z" />
      <path fill={E} stroke={K} d="M2.5 15.5h8v-3l6 5-6 5v-3h-8z" />
    </>
  ),
  find: () => (
    <>
      <path fill={K} d="M3 2h14l4 4v20H3z" />
      <path fill={W} d="M4 3h12v4h4v18H4z" />
      <path fill={G} d="M6 10h10v1H6zM6 13h8v1H6zM6 16h9v1H6z" />
      <circle cx="20" cy="19" r="6" fill={A} stroke={K} strokeWidth="2" />
      <path fill={W} d="M17 16h2v2h-2z" />
      <path fill={K} d="M24 24l2-2 5 5-2 2z" />
    </>
  ),
  settings: () => panel,
  documents: () => (
    <>
      {folderBack()}
      <path fill={K} d="M13 3h14v14H13z" />
      <path fill={W} d="M14 4h12v12H14z" />
      <path fill={G} d="M16 7h8v1h-8zM16 10h8v1h-8zM16 13h6v1h-6z" />
      {folderFront(14)}
    </>
  ),
  programs: () => (
    <>
      <path fill={K} d="M2 5h28v23H2z" />
      <path fill={N} d="M3 6h26v3H3z" />
      <path fill={S} d="M3 9h26v18H3z" />
      <path fill={Y} d="M6 12h6v5H6z" />
      <path fill={R} d="M14 12h6v5h-6z" />
      <path fill={B} d="M22 12h5v5h-5z" />
      <path fill={E} d="M6 20h6v5H6z" />
      <path fill={T} d="M14 20h6v5h-6z" />
    </>
  ),
  explorer: () => (
    <>
      {folderBack()}
      {folderFront(12)}
      <circle cx="21" cy="19" r="5" fill={A} stroke={K} strokeWidth="2" />
      <path fill={K} d="M24 23l2-2 5 5-2 2z" />
    </>
  ),
  'drive-floppy': () => (
    <>
      <path fill={K} d="M10 2h12v12H10z" />
      <path fill="#202020" d="M11 3h10v10H11z" />
      <path fill={S} d="M13 3h6v4h-6z" />
      <path fill={W} d="M12 9h8v4h-8z" />
      {driveBody}
      <path fill={K} d="M8 19h16v2H8z" />
      <path fill={G} d="M24 21h3v1h-3z" />
    </>
  ),
  'drive-hd': () => (
    <>
      <path fill={K} d="M2 12h28v12H2z" />
      <path fill={S} d="M3 13h26v10H3z" />
      <path fill={W} d="M3 13h26v1H4v9H3z" />
      <path fill={G} d="M4 22h25v1H4zM6 16h12v2H6z" />
      <path fill={L} d="M24 17h3v2h-3z" />
    </>
  ),
  'drive-cd': () => (
    <>
      <circle cx="16" cy="10" r="8.5" fill={S} stroke={K} strokeWidth="1" />
      <circle cx="16" cy="10" r="5" fill="#e0e0e0" />
      <circle cx="16" cy="10" r="1.5" fill={K} />
      <path fill={A} d="M10 7h3v2h-3z" />
      {driveBody}
      <path fill={K} d="M8 19h16v2H8z" />
      <path fill={L} d="M25 21h2v1h-2z" />
    </>
  ),
  control: () => (
    <>
      {folderBack()}
      {folderFront(12)}
      <path fill={K} d="M16 15h14v14H16z" />
      <path fill={S} d="M17 16h12v12H17z" />
      <path fill={K} d="M20 18h1v8h-1zM26 18h1v8h-1z" />
      <path fill={B} d="M18 20h5v2h-5z" />
      <path fill={R} d="M24 23h5v2h-5z" />
    </>
  ),
  printers: () => (
    <>
      {folderBack()}
      {folderFront(12)}
      <path fill={K} d="M18 13h10v6H18z" />
      <path fill={W} d="M19 14h8v5h-8z" />
      <path fill={K} d="M15 19h16v8H15z" />
      <path fill={S} d="M16 20h14v6H16z" />
      <path fill={L} d="M27 22h2v1h-2z" />
    </>
  ),
  globe: () => (
    <>
      <circle cx="16" cy="16" r="12.5" fill={B} stroke={K} strokeWidth="1" />
      <path fill={E} d="M9 8h6v3h2v4h-4v3h-3v-5H8v-3h1zM19 16h6v3h-2v4h-3v-3h-1zM17 6h4v2h-4z" />
      <path fill={A} d="M11 23h3v1h-3z" />
    </>
  ),
  url: () => (
    <>
      {page}
      <path fill={G} d="M9 12h14v1H9zM9 15h8v1H9z" />
      <circle cx="21" cy="23" r="6.5" fill={B} stroke={K} strokeWidth="1" />
      <path fill={E} d="M18 19h4v2h1v3h-3v2h-2v-3h-1v-2h1z" />
    </>
  ),
  // Internet Explorer: a blue "e" with a gold orbit around it.
  ie: () => (
    <>
      <ellipse cx="16" cy="16" rx="14" ry="6" transform="rotate(-25 16 16)" fill="none" stroke={K} strokeWidth="4" />
      <ellipse cx="16" cy="16" rx="14" ry="6" transform="rotate(-25 16 16)" fill="none" stroke={Y} strokeWidth="2" />
      <path fill="none" stroke={K} strokeWidth="6" d="M24 17A8 8 0 1 0 21.7 22.7M8 17h16" />
      <path fill="none" stroke={B} strokeWidth="4" d="M24 17A8 8 0 1 0 21.7 22.7M9 17h14" />
    </>
  ),
  error: () => (
    <>
      <circle cx="16" cy="16" r="13.5" fill={R} stroke={K} strokeWidth="1" />
      <path fill={W} d="M10 8l6 6 6-6 2 2-6 6 6 6-2 2-6-6-6 6-2-2 6-6-6-6z" />
    </>
  ),
  info: () => (
    <>
      {bubble}
      <path fill={B} d="M15 7h3v3h-3zM13 12h5v8h2v2h-7v-2h2v-6h-2z" />
    </>
  ),
  question: () => (
    <>
      {bubble}
      <path fill={B} d="M12 7h8v2h-8zM20 9h2v4h-2zM16 13h4v2h-4zM15 15h3v2h-3zM15 19h3v2h-3z" />
    </>
  ),
  warning: () => (
    <>
      <path fill={Y} stroke={K} d="M16 2.5l13.5 26h-27z" />
      <path fill={K} d="M15 10h3v10h-3zM15 22h3v3h-3z" />
    </>
  ),
  // Ask Julian: a white speech bubble answered by a yellow one that's still typing.
  chat: () => (
    <>
      <path fill={K} d="M2 3h20v14H2zM5 16h4v1h-1v1h-1v1h-1v1H5z" />
      <path fill={W} d="M3 4h18v12H3zM6 16h2v1h-1v1H6z" />
      <path fill={N} d="M5 6h14v1H5zM5 9h14v1H5zM5 12h5v1H5z" />
      <path fill={K} d="M11 12h19v13H11zM23 24h4v4h-1v-1h-1v-1h-1v-1h-1z" />
      <path fill={Y} d="M12 13h17v11H12zM24 24h2v2h-1v-1h-1z" />
      <path fill={K} d="M15 18h2v2h-2zM19 18h2v2h-2zM23 18h2v2h-2z" />
    </>
  ),
}

const smallFolderTinted = (tint = tintOf()) => (
  <>
    <path fill={K} d="M1 3h6l1 1h7v10H1z" />
    <path fill={tint.back} d="M2 4h4l1 1h7v8H2z" />
    <path fill={K} d="M1 6h14v8H1z" />
    <path fill={tint.front} d="M2 7h12v6H2z" />
    <path fill={W} d="M2 7h12v1H2z" />
  </>
)
const smallFolder = smallFolderTinted()

const smallComputer = (screen) => (
  <>
    <path fill={K} d="M2 1h12v9H2z" />
    <path fill={S} d="M3 2h10v7H3z" />
    <path fill={screen} d="M4 3h8v5H4z" />
    <path fill={G} d="M6 10h4v1H6z" />
    <path fill={K} d="M1 11h14v3H1z" />
    <path fill={S} d="M2 12h12v1H2z" />
    <path fill={K} d="M2 15h12v1H2z" />
  </>
)

const smallDrive = (
  <>
    <path fill={K} d="M1 8h14v6H1z" />
    <path fill={S} d="M2 9h12v4H2z" />
    <path fill={W} d="M2 9h12v1H2z" />
    <path fill={K} d="M4 11h7v1H4z" />
  </>
)

const SMALL = {
  folder: (tint) => smallFolderTinted(tint),
  chat: () => (
    <>
      <path fill={K} d="M0 1h11v8H0zM2 9h3v1h-1v1h-1v1H2z" />
      <path fill={W} d="M1 2h9v6H1zM3 8h1v1H3z" />
      <path fill={N} d="M2 3h7v1H2zM2 5h3v1H2z" />
      <path fill={K} d="M5 5h11v8H5zM11 13h3v3h-1v-1h-1v-1h-1z" />
      <path fill={Y} d="M6 6h9v6H6zM12 12h1v1h-1z" />
      <path fill={K} d="M8 8h1v2H8zM10 8h1v2h-1zM12 8h1v2h-1z" />
    </>
  ),
  documents: () => (
    <>
      {smallFolder}
      <path fill={K} d="M7 1h7v8H7z" />
      <path fill={W} d="M8 2h5v6H8z" />
      <path fill={G} d="M9 3h3v1H9zM9 5h3v1H9z" />
      <path fill={K} d="M1 8h14v6H1z" />
      <path fill={Y} d="M2 9h12v4H2z" />
    </>
  ),
  explorer: () => (
    <>
      {smallFolder}
      <circle cx="10.5" cy="9.5" r="2.5" fill={A} stroke={K} />
      <path fill={K} d="M12 12h2v1h1v2h-1v-1h-1v-1h-1z" />
    </>
  ),
  control: () => (
    <>
      {smallFolder}
      <path fill={K} d="M8 7h8v9H8z" />
      <path fill={S} d="M9 8h6v7H9z" />
      <path fill={K} d="M10 9h1v5h-1zM13 9h1v5h-1z" />
      <path fill={B} d="M9 10h3v1H9z" />
      <path fill={R} d="M12 12h3v1h-3z" />
    </>
  ),
  printers: () => (
    <>
      {smallFolder}
      <path fill={K} d="M10 6h5v4h-5z" />
      <path fill={W} d="M11 7h3v3h-3z" />
      <path fill={K} d="M8 10h8v5H8z" />
      <path fill={S} d="M9 11h6v3H9z" />
    </>
  ),
  settings: () => (
    <>
      <path fill={K} d="M1 2h14v12H1z" />
      <path fill={S} d="M2 3h12v10H2z" />
      <path fill={K} d="M5 4h1v8H5zM10 4h1v8h-1z" />
      <path fill={B} d="M3 6h5v2H3z" />
      <path fill={R} d="M8 9h5v2H8z" />
    </>
  ),
  find: () => (
    <>
      <path fill={K} d="M2 1h8v12H2z" />
      <path fill={W} d="M3 2h6v10H3z" />
      <circle cx="10" cy="9" r="3" fill={A} stroke={K} />
      <path fill={K} d="M12 12h2v1h1v2h-1v-1h-1v-1h-1z" />
    </>
  ),
  run: () => (
    <>
      <path fill={K} d="M3 3h13v10H3z" />
      <path fill={N} d="M4 4h11v2H4z" />
      <path fill={W} d="M4 6h11v6H4z" />
      <path fill={E} d="M0 8h4V6l3 3-3 3v-2H0z" />
    </>
  ),
  shutdown: () => smallComputer('#101828'),
  'drive-hd': () => (
    <>
      {smallDrive}
      <path fill={L} d="M12 11h1v1h-1z" />
    </>
  ),
  'drive-floppy': () => (
    <>
      <path fill={K} d="M4 1h8v7H4z" />
      <path fill="#202020" d="M5 2h6v5H5z" />
      <path fill={S} d="M6 2h4v2H6z" />
      {smallDrive}
    </>
  ),
  'drive-cd': () => (
    <>
      <circle cx="8" cy="5" r="4.5" fill={S} stroke={K} />
      <circle cx="8" cy="5" r="1" fill={K} />
      {smallDrive}
    </>
  ),
  globe: () => (
    <>
      <circle cx="8" cy="8" r="6.5" fill={B} stroke={K} />
      <path fill={E} d="M5 4h3v2h1v2H7v2H5V7H4V5h1zM10 8h3v2h-1v2h-2z" />
    </>
  ),
  url: () => (
    <>
      <path fill={K} d="M2 1h7l3 3v6H2z" />
      <path fill={W} d="M3 2h5v3h3v4H3z" />
      <circle cx="11" cy="11" r="4" fill={B} stroke={K} />
      <path fill={E} d="M9 9h2v2h1v2h-2v-2H9z" />
    </>
  ),
  text: () => (
    <>
      <path fill={K} d="M3 1h7l3 3v11H3z" />
      <path fill={W} d="M4 2h5v3h3v9H4z" />
      <path fill={G} d="M5 7h6v1H5zM5 9h6v1H5zM5 11h4v1H5z" />
    </>
  ),
  notepad: () => (
    <>
      <path fill={K} d="M3 2h10v13H3z" />
      <path fill={W} d="M4 3h8v11H4z" />
      <path fill={A} d="M4 3h8v2H4z" />
      <path fill={K} d="M5 1h1v3H5zM8 1h1v3H8zM11 1h1v3h-1z" />
      <path fill={G} d="M5 7h6v1H5zM5 9h6v1H5zM5 11h6v1H5z" />
    </>
  ),
  wordpad: () => (
    <>
      <path fill={K} d="M2 1h7l3 3v11H2z" />
      <path fill={W} d="M3 2h5v3h3v9H3z" />
      <path fill={B} d="M4 3h3v2H4z" />
      <path fill={G} d="M4 7h6v1H4zM4 9h5v1H4zM4 11h3v1H4z" />
      <path fill={K} d="M8 14l6-6 2 2-6 6H8z" />
      <path fill={Y} d="M9 14l5-5 1 1-5 5H9z" />
    </>
  ),
  dialup: () => (
    <>
      <path fill={K} d="M1 1h9v7H1z" />
      <path fill={T} d="M2 2h7v5H2z" />
      <path fill={K} d="M3 8h5v1H3zM6 10h10v2H6zM6 12h2v1H6zM14 12h2v1h-2zM8 12h6v4H8z" />
      <path fill={S} d="M9 13h4v2H9z" />
    </>
  ),
  computer: () => smallComputer(T),
  network: () => (
    <>
      <path fill={K} d="M1 1h7v6H1z" />
      <path fill={T} d="M2 2h5v4H2z" />
      <path fill={K} d="M4 7h1v4h4v1H4z" />
      <path fill={K} d="M8 7h7v6H8z" />
      <path fill={T} d="M9 8h5v4H9z" />
      <path fill={K} d="M7 13h9v2H7z" />
    </>
  ),
  recycle: () => (
    <>
      <path fill={K} d="M3 2h10v2H3z" />
      <path fill={K} d="M4 4h8l-1 11H5z" />
      <path fill={W} d="M5 4h6l-1 10H6z" />
      <path fill={E} d="M7 7h2v1H7zM6 8h1v2H6zM9 8h1v2H9zM7 10h2v1H7z" />
    </>
  ),
  minesweeper: () => (
    <>
      <path fill={K} d="M7 1h2v14H7zM1 7h14v2H1zM3 3h2v2H3zM11 3h2v2h-2zM3 11h2v2H3zM11 11h2v2h-2z" />
      <circle cx="8" cy="8" r="4.5" fill={K} />
      <path fill={W} d="M6 6h2v2H6z" />
    </>
  ),
  dos: () => (
    <>
      <path fill={S} d="M1 2h14v12H1z" />
      <path fill={N} d="M2 3h12v2H2z" />
      <path fill={K} d="M2 5h12v8H2z" />
      <path fill={W} d="M3 7h1v1H3zM4 8h1v1H4zM3 9h1v1H3zM6 10h3v1H6z" />
    </>
  ),
  help: () => (
    <>
      <path fill={K} d="M3 1h10v14H3z" />
      <path fill={T} d="M4 2h8v11H4z" />
      <path fill={W} d="M4 13h8v1H4z" />
      <path fill={Y} d="M6 4h4v1H6zM10 5h1v2h-1zM8 7h2v1H8zM7 8h2v2H7zM7 11h2v1H7z" />
    </>
  ),
  programs: () => (
    <>
      <path fill={K} d="M1 2h14v12H1z" />
      <path fill={N} d="M2 3h12v2H2z" />
      <path fill={S} d="M2 5h12v8H2z" />
      <path fill={Y} d="M3 7h3v2H3z" />
      <path fill={R} d="M7 7h3v2H7z" />
      <path fill={B} d="M11 7h2v2h-2z" />
      <path fill={E} d="M3 10h3v2H3z" />
    </>
  ),
  // The flag on the Start button: four panes, the right half a pixel higher, trailing squares left.
  windows: () => (
    <>
      <path fill={R} d="M5 2h4v4H5z" />
      <path fill={L} d="M10 1h4v4h-4z" />
      <path fill={B} d="M5 7h4v4H5z" />
      <path fill={Y} d="M10 6h4v4h-4z" />
      <path fill={K} d="M4 2h1v10H4zM9 1h1v11H9zM14 1h1v10h-1zM5 1h4v1H5zM10 0h4v1h-4zM5 6h4v1H5zM10 5h4v1h-4zM5 11h4v1H5zM10 10h4v1h-4z" />
      <path fill={R} d="M2 3h1v2H2zM0 4h1v1H0z" />
      <path fill={B} d="M2 8h1v2H2zM0 9h1v1H0z" />
    </>
  ),
}

// The shortcut arrow in its white box, laid over the lower-left corner.
const SHORTCUT = (
  <>
    <path fill={K} d="M0 21h11v11H0z" />
    <path fill={W} d="M1 22h9v9H1z" />
    <path fill={K} d="M3 25h3v2H5v4H3zM6 23l3 3-3 3z" />
  </>
)

export default function Icon({ name, size = 32, shortcut = false, color, className = '' }) {
  const small = size <= 16 && SMALL[name]
  const draw = small ? SMALL[name] : LARGE[name] ?? SMALL[name]
  if (!draw) return null
  const grid = small || !LARGE[name] ? 16 : 32
  return (
    <svg
      className={`w95-glyph ${className}`}
      viewBox={`0 0 ${grid} ${grid}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {draw(name === 'folder' && color ? tintOf(color) : undefined)}
      {shortcut && grid === 32 && SHORTCUT}
    </svg>
  )
}
