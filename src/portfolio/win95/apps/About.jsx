import { useWin95 } from '../context.js'
import Icon from '../icons.jsx'

const PRODUCTS = {
  Notepad: { icon: 'notepad' },
  Minesweeper: { icon: 'minesweeper', credit: 'by Robert Donner and Curt Johnson' },
  'Internet Explorer': { icon: 'ie' },
}

// The About box every Windows 95 program shares; it also carries the font credit.
export default function About({ win, props }) {
  const { api } = useWin95()
  const product = props.product ?? 'Windows 95'
  const { icon = 'windows', credit } = PRODUCTS[product] ?? {}

  return (
    <div className="w95-about">
      <div className="w95-about__main">
        <Icon name={icon} size={32} />
        <div className="w95-about__text">
          <p>
            Microsoft&reg; {product}
            {credit && (
              <>
                <br />
                {credit}
              </>
            )}
            <br />
            Windows&nbsp;95 look-alike, built with React for this portfolio.
          </p>
          <p>
            This product is licensed to:
            <br />
            Julian Rohm
            <br />
            Portfolio
          </p>
          <div className="w95-separator" role="separator" />
          <p className="w95-about__stats">
            <span>Physical Memory Available to Windows:</span>
            <span>16,384 KB</span>
            <span>System Resources:</span>
            <span>87% Free</span>
          </p>
          <p className="w95-about__credit">MS Sans Serif pixel font by &ldquo;lou&rdquo; (fontstruct.com), CC&nbsp;BY-SA&nbsp;3.0.</p>
        </div>
      </div>
      <div className="w95-buttons">
        <button type="button" className="w95-button is-default" autoFocus onClick={() => api.close(win.id)}>
          OK
        </button>
      </div>
    </div>
  )
}
