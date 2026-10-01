import { useEffect, useRef, useState } from 'react'
import profile from '../../data/profile.json'
import { useWin95 } from '../context.js'
import AccessKey from '../components/AccessKey.jsx'
import Icon from '../icons.jsx'
import { playModem } from '../sounds.js'

// What the status line says while "connecting", and for how long (ms).
const STEPS = [
  ['Dialing...', 3800],
  ['Verifying user name and password...', 1200],
  ['Logging on to the network...', 900],
]

const mailto = ({ name, from, message }) => {
  const subject = `Hello from ${name.trim() || 'your portfolio'}`
  const signature = [name.trim(), from.trim() && `(${from.trim()})`].filter(Boolean).join(' ')
  const body = signature ? `${message.trim()}\n\n${signature}` : message.trim()
  return `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// Dial-Up Networking's "Connect To" dialog as Julian's contact form. Connect plays the modem,
// then hands the message to the visitor's mail program (a mailto: link to profile.email).
export default function DialUp({ win }) {
  const { api, reducedMotion } = useWin95()
  const [form, setForm] = useState({ name: '', from: '', message: '' })
  const [phase, setPhase] = useState({ step: null }) // { step: index into STEPS | 'done' | null }
  const hangUp = useRef(() => {})
  const timers = useRef([])
  const set = (field) => (event) => {
    const { value } = event.target
    // With "simonmail" on (MS-DOS Prompt), typing "Simon" as your name gets you Foxy.
    if (field === 'name' && api.peek('simonmail') &&value.trim().toLowerCase() === 'simon' && form.name.trim().toLowerCase() !== 'simon') api.jumpscare()
    setForm((current) => ({ ...current, [field]: value }))
  }

  const stop = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    hangUp.current()
    hangUp.current = () => {}
  }
  useEffect(() => stop, [])

  const connect = (event) => {
    event.preventDefault()
    if (!profile.email) {
      return api.message({
        title: 'Dial-Up Networking',
        icon: 'error',
        text: 'Dial-Up Networking could not connect to Julian Rohm.\n\nNo phone number (e-mail address) has been set up for this connection yet.',
      })
    }
    if (!form.message.trim()) {
      return api.message({ title: 'Dial-Up Networking', icon: 'warning', text: 'Type a message for Julian before you connect.' })
    }
    hangUp.current = playModem()
    let at = 0
    STEPS.forEach(([, ms], i) => {
      timers.current.push(setTimeout(() => setPhase({ step: i }), at))
      at += reducedMotion ? 150 : ms
    })
    timers.current.push(
      setTimeout(() => {
        stop()
        setPhase({ step: 'done' })
        const link = document.createElement('a')
        link.href = mailto(form)
        link.click()
      }, at),
    )
  }

  const cancel = () => {
    stop()
    setPhase({ step: null })
  }

  if (phase.step !== null) {
    const done = phase.step === 'done'
    return (
      <div className="w95-dialup is-status">
        <div className="w95-dialup__main">
          <Icon name="dialup" size={32} />
          <p className="w95-dialup__status" role="status">
            {done ? (
              <>
                Connected to Julian Rohm.
                <br />
                <br />
                Your message is waiting in your mail program: press Send there. No mail program? Write to{' '}
                <span className="w95-select">{profile.email}</span>.
              </>
            ) : (
              <>
                Status: {STEPS[phase.step][0]}
                <span className="w95-dialup__lights" aria-hidden="true">
                  <span />
                  <span />
                </span>
              </>
            )}
          </p>
        </div>
        <div className="w95-buttons">
          {done ? (
            <>
              <button type="button" className="w95-button is-default" autoFocus onClick={() => api.close(win.id)}>
                Close
              </button>
              <button type="button" className="w95-button" onClick={() => navigator.clipboard?.writeText(profile.email).catch(() => {})}>
                <AccessKey label="&Copy address" />
              </button>
            </>
          ) : (
            <button type="button" className="w95-button is-default" autoFocus onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <form className="w95-dialup" onSubmit={connect}>
      <div className="w95-dialup__main">
        <Icon name="dialup" size={32} />
        <b className="w95-dialup__title">Julian Rohm</b>
      </div>
      <div className="w95-dialup__fields">
        <label htmlFor={`dialup-name-${win.id}`}>
          <AccessKey label="&Your name:" />
        </label>
        <input id={`dialup-name-${win.id}`} className="w95-input" value={form.name} autoFocus autoComplete="name" onChange={set('name')} />
        <label htmlFor={`dialup-from-${win.id}`}>
          <AccessKey label="&Company:" />
        </label>
        <input id={`dialup-from-${win.id}`} className="w95-input" value={form.from} autoComplete="organization" onChange={set('from')} />
        <label htmlFor={`dialup-message-${win.id}`}>
          <AccessKey label="&Message:" />
        </label>
        <textarea id={`dialup-message-${win.id}`} className="w95-input w95-dialup__message" value={form.message} rows={4} onChange={set('message')} />
        <div className="w95-separator" role="separator" />
        <span>Phone number:</span>
        <span className="w95-dialup__number">{profile.email || '(not set up)'}</span>
        <span>Dialing from:</span>
        <span>Default Location</span>
      </div>
      <div className="w95-buttons">
        <button type="submit" className="w95-button is-default">
          <AccessKey label="C&onnect" />
        </button>
        <button type="button" className="w95-button" onClick={() => api.close(win.id)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
