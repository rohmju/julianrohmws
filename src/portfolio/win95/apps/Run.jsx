import { useState } from 'react'
import { useWin95 } from '../context.js'
import AccessKey from '../components/AccessKey.jsx'
import Icon from '../icons.jsx'

// Start → Run. Knows the programs, drives and folders on this desktop (see Win95's launch()).
export default function Run({ win }) {
  const { api } = useWin95()
  const [command, setCommand] = useState('')

  return (
    <form
      className="w95-run"
      onSubmit={(event) => {
        event.preventDefault()
        if (!command.trim()) return
        api.close(win.id)
        api.launch(command.trim())
      }}
    >
      <div className="w95-run__main">
        <Icon name="run" size={32} />
        <p>Type the name of a program, folder, or document, and Windows will open it for you.</p>
      </div>
      <label className="w95-run__field">
        <span>
          <AccessKey label="&Open:" />
        </span>
        <input
          className="w95-input"
          value={command}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => setCommand(event.target.value)}
        />
      </label>
      <div className="w95-buttons">
        <button type="submit" className="w95-button is-default">
          OK
        </button>
        <button type="button" className="w95-button" onClick={() => api.close(win.id)}>
          Cancel
        </button>
        <button type="button" className="w95-button" disabled>
          <AccessKey label="&Browse..." />
        </button>
      </div>
    </form>
  )
}
