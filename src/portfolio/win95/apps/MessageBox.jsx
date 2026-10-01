import { useWin95 } from '../context.js'
import AccessKey from '../components/AccessKey.jsx'
import Icon from '../icons.jsx'

// A Windows 95 message box. Every button simply closes it.
export default function MessageBox({ win, props: { icon, text, buttons = ['OK'] } }) {
  const { api } = useWin95()
  return (
    <div className="w95-msgbox">
      <div className="w95-msgbox__main">
        {icon && <Icon name={icon} size={32} />}
        <p className="w95-msgbox__text">{text}</p>
      </div>
      <div className="w95-buttons">
        {buttons.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`w95-button ${i === 0 ? 'is-default' : ''}`}
            autoFocus={i === 0}
            onClick={() => api.close(win.id)}
          >
            <AccessKey label={label} />
          </button>
        ))}
      </div>
    </div>
  )
}
