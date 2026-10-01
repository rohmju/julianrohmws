// The small black glyphs Windows 95 draws itself: caption buttons, menu marks, radio buttons.

const CAPTION = {
  minimize: 'M1 6h6v2H1z',
  maximize: 'M0 0h9v9H0zM1 2v6h7V2z',
  close: 'M0 1h2v1H0zM6 1h2v1H6zM1 2h2v1H1zM5 2h2v1H5zM2 3h4v1H2zM3 4h2v1H3zM2 5h4v1H2zM1 6h2v1H1zM5 6h2v1H5zM0 7h2v1H0zM6 7h2v1H6z',
}

export function CaptionGlyph({ name }) {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {name === 'restore' ? (
        <>
          <path fill="currentColor" fillRule="evenodd" d="M3 0h6v6H3zM4 2v3h4V2z" />
          <path fill="currentColor" d="M0 3h6v6H0z" />
          <path fill="#c0c0c0" d="M1 5h4v3H1z" />
        </>
      ) : (
        <path fill="currentColor" fillRule="evenodd" d={CAPTION[name]} />
      )}
    </svg>
  )
}

export function CheckGlyph() {
  return (
    <svg width="7" height="7" viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M6 0h1v1H6zM5 1h2v1H5zM0 2h1v1H0zM4 2h3v1H4zM0 3h2v1H0zM3 3h3v1H3zM0 4h5v1H0zM1 5h3v1H1zM2 6h1v1H2z" />
    </svg>
  )
}

export function ArrowGlyph() {
  return (
    <svg className="w95-arrow" width="4" height="7" viewBox="0 0 4 7" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z" />
    </svg>
  )
}

// A sunken round radio button; the #w95-radio-half clip path lives in the desktop's shared defs.
export function RadioGlyph({ checked }) {
  return (
    <svg className="w95-radio__glyph" width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="6" fill="#fff" />
      <circle cx="6" cy="6" r="6" fill="#808080" clipPath="url(#w95-radio-half)" />
      <circle cx="6" cy="6" r="5" fill="#dfdfdf" />
      <circle cx="6" cy="6" r="5" fill="#000" clipPath="url(#w95-radio-half)" />
      <circle cx="6" cy="6" r="4" fill="#fff" />
      {checked && <circle cx="6" cy="6" r="2" fill="#000" />}
    </svg>
  )
}
