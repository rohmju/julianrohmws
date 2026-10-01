import { useState } from 'react'
import departmentsData from '../../data/departments.json'
import { useWin95 } from '../context.js'
import AccessKey from '../components/AccessKey.jsx'
import Icon from '../icons.jsx'
import { COMPUTER, DEVICES } from '../systemSpecs.js'

const TABS = ['General', 'Device Manager', 'Performance']

// "3.50 / 4.00 (…)" → 3.5
const gradeOf = (rating) => parseFloat(rating)

function General() {
  return (
    <div className="w95-sysprops__general">
      <Icon name="computer" size={64} />
      <div>
        <p>System:</p>
        <p className="w95-sysprops__indent">
          Microsoft Windows 95
          <br />
          4.00.950
        </p>
        <p>Registered to:</p>
        <p className="w95-sysprops__indent">
          Julian Rohm
          <br />
          Portfolio
        </p>
        <p>Computer:</p>
        <p className="w95-sysprops__indent">
          {COMPUTER.map((line, i) => (
            <span key={line}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}

function DeviceManager() {
  const { api } = useWin95()
  const [open, setOpen] = useState(() => new Set(DEVICES.map((d) => d.category)))
  const [selected, setSelected] = useState(null)
  const toggle = (category) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })

  return (
    <div className="w95-sysprops__devices">
      <div className="w95-well">
        <ul className="w95-tree" role="tree" aria-label="Devices">
          <li role="treeitem" aria-expanded="true">
            <span className="w95-tree__row">
              <Icon name="computer" size={16} />
              Computer
            </span>
            <ul role="group">
              {DEVICES.map(({ category, icon, devices }) => (
                <li key={category} role="treeitem" aria-expanded={open.has(category)}>
                  <button type="button" className={`w95-tree__row ${selected === category ? 'is-selected' : ''}`} onClick={() => setSelected(category)} onDoubleClick={() => toggle(category)}>
                    <span
                      className="w95-tree__toggle"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggle(category)
                      }}
                    >
                      {open.has(category) ? '−' : '+'}
                    </span>
                    <Icon name={icon} size={16} />
                    <span>{category}</span>
                  </button>
                  {open.has(category) && (
                    <ul role="group">
                      {devices.map((device) => (
                        <li key={device} role="treeitem">
                          <button type="button" className={`w95-tree__row ${selected === device ? 'is-selected' : ''}`} onClick={() => setSelected(device)}>
                            <Icon name={icon} size={16} />
                            <span>{device}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </div>
      <div className="w95-buttons w95-sysprops__actions">
        <button type="button" className="w95-button" disabled>
          <AccessKey label="P&roperties" />
        </button>
        <button type="button" className="w95-button" onClick={() => setSelected(null)}>
          <AccessKey label="R&efresh" />
        </button>
        <button type="button" className="w95-button" disabled={!selected} onClick={() => api.remove()}>
          <AccessKey label="Remo&ve" />
        </button>
      </div>
    </div>
  )
}

// The trainer's average for each department, drawn as Windows 95's block progress bars.
function Performance() {
  const graded = departmentsData.departments.filter((d) => d.rating)
  return (
    <div className="w95-sysprops__performance">
      <fieldset className="w95-group">
        <legend>Performance status</legend>
        <dl className="w95-sysprops__stats">
          <dt>Memory:</dt>
          <dd>64.0 MB of RAM</dd>
          <dt>System Resources:</dt>
          <dd>87% free</dd>
          <dt>File System:</dt>
          <dd>32-bit</dd>
        </dl>
        <p>Your system is configured for optimal performance.</p>
      </fieldset>
      <fieldset className="w95-group">
        <legend>Trainer&rsquo;s grade per department (out of 4)</legend>
        {graded.map((d) => (
          <div key={d.id} className="w95-sysprops__meter">
            <span>{d.name}</span>
            <span className="w95-progress" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={gradeOf(d.rating)} aria-label={d.name}>
              <span style={{ width: `${(gradeOf(d.rating) / 4) * 100}%` }} />
            </span>
            <span>{gradeOf(d.rating).toFixed(2)}</span>
          </div>
        ))}
      </fieldset>
    </div>
  )
}

// System Properties (right-click My Computer → Properties): Julian's skills as the PC's hardware.
export default function SystemProperties({ win }) {
  const { api } = useWin95()
  const [tab, setTab] = useState(0)
  const Page = [General, DeviceManager, Performance][tab]

  return (
    <div className="w95-sysprops">
      <div className="w95-tabs" role="tablist">
        {TABS.map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={tab === i} className={`w95-tab ${tab === i ? 'is-selected' : ''}`} onClick={() => setTab(i)}>
            {label}
          </button>
        ))}
      </div>
      <div className="w95-tabpanel" role="tabpanel" aria-label={TABS[tab]}>
        <Page />
      </div>
      <div className="w95-buttons w95-sysprops__buttons">
        <button type="button" className="w95-button is-default" autoFocus onClick={() => api.close(win.id)}>
          OK
        </button>
        <button type="button" className="w95-button" onClick={() => api.close(win.id)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
