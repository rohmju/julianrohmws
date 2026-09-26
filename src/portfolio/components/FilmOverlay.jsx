import { useMemo } from 'react'

// Film grain + vignette laid over everything (videos and the board alike), so the look never
// changes across a handoff. The grain tile is generated once and shifted with a stepped CSS
// animation, which costs next to nothing per frame.
export default function FilmOverlay() {
  const grain = useMemo(() => {
    const size = 160
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const image = ctx.createImageData(size, size)
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.random() * 255
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v
      image.data[i + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
    return canvas.toDataURL('image/png')
  }, [])

  return (
    <div className="pf-film" aria-hidden="true">
      <div className="pf-film__grain" style={{ backgroundImage: `url(${grain})` }} />
      <div className="pf-film__vignette" />
    </div>
  )
}
