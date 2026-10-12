import { useWin95 } from '../context.js'
import AccessKey from '../components/AccessKey.jsx'
import Icon from '../icons.jsx'

// A Windows 95 message box. A button is a label, or { label, onSelect } to do something as it closes.
export default function MessageBox({ win, props: { icon, text, buttons = ['OK'] } }) {
  const { api } = useWin95()
  return (
    <div className="w95-msgbox">
      <div className="w95-msgbox__main">
        {icon && <Icon name={icon} size={32} />}
        <p className="w95-msgbox__text">{text}</p>
      </div>
      <div className="w95-buttons">
        {buttons.map((button, i) => {
          const { label, onSelect } = typeof button === 'string' ? { label: button } : button
          return (
            <button
              key={label}
              type="button"
              className={`w95-button ${i === 0 ? 'is-default' : ''}`}
              autoFocus={i === 0}
              onClick={() => {
                api.close(win.id)
                onSelect?.()
              }}
            >
              <AccessKey label={label} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
