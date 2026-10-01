import { useState } from 'react'
import Icon from '../icons.jsx'
import AccessKey from './AccessKey.jsx'
import { CaptionGlyph, RadioGlyph } from './Glyphs.jsx'

const OPTIONS = [
  { value: 'shutdown', label: '&Shut down the computer?' },
  { value: 'restart', label: '&Restart the computer?' },
  { value: 'dos', label: 'Restart the computer in &MS-DOS mode?' },
  { value: 'logoff', label: '&Close all programs and log on as a different user?' },
]

// Windows 95 dims the whole screen with a dither pattern behind this dialog.
export default function ShutDownDialog({ onChoose, onCancel, onHelp }) {
  const [choice, setChoice] = useState('shutdown')

  return (
    <div className="w95-modal" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <div className="w95-dither" />
      <section className="w95-window is-active is-dialog w95-shutdown" role="alertdialog" aria-modal="true" aria-labelledby="w95-shutdown-title">
        <div className="w95-titlebar">
          <span className="w95-titlebar__text" id="w95-shutdown-title">
            Shut Down Windows
          </span>
          <span className="w95-titlebar__buttons">
            <button type="button" className="w95-caption w95-caption--close" aria-label="Close" onClick={onCancel}>
              <CaptionGlyph name="close" />
            </button>
          </span>
        </div>
        <div className="w95-window__body w95-shutdown__body">
          <Icon name="shutdown" size={32} />
          <fieldset className="w95-shutdown__options">
            <legend>Are you sure you want to:</legend>
            {OPTIONS.map((option) => (
              <label key={option.value} className="w95-radio">
                <input
                  type="radio"
                  name="w95-shutdown"
                  value={option.value}
                  checked={choice === option.value}
                  onChange={() => setChoice(option.value)}
                />
                <RadioGlyph checked={choice === option.value} />
                <span>
                  <AccessKey label={option.label} />
                </span>
              </label>
            ))}
          </fieldset>
          <div className="w95-buttons w95-shutdown__buttons">
            <button type="button" className="w95-button is-default" autoFocus onClick={() => onChoose(choice)}>
              <AccessKey label="&Yes" />
            </button>
            <button type="button" className="w95-button" onClick={onCancel}>
              <AccessKey label="&No" />
            </button>
            <button type="button" className="w95-button" onClick={onHelp}>
              <AccessKey label="&Help" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
