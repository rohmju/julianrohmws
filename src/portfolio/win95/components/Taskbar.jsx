import { useEffect, useState } from 'react'
import Icon from '../icons.jsx'

const clockText = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dateText = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

// Start button, a button per open window (pressed = active) and the clock in the tray.
export default function Taskbar({ tasks, activeId, startOpen, onStart, onTask }) {
  const [clock, setClock] = useState(clockText)
  useEffect(() => {
    const timer = setInterval(() => setClock(clockText()), 10000)
    return () => clearInterval(timer)
  }, [])

  return (
    <footer className="w95-taskbar">
      <button
        type="button"
        className={`w95-start ${startOpen ? 'is-pressed' : ''}`}
        aria-haspopup="menu"
        aria-expanded={startOpen}
        data-start-button=""
        onClick={onStart}
      >
        <Icon name="windows" size={16} />
        <span>Start</span>
      </button>
      <div className="w95-taskbar__tasks">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`w95-task ${task.id === activeId ? 'is-pressed' : ''}`}
            aria-pressed={task.id === activeId}
            title={task.title}
            onClick={() => onTask(task.id)}
          >
            {task.icon && <Icon name={task.icon} size={16} />}
            <span className="w95-task__title">{task.title}</span>
          </button>
        ))}
      </div>
      <div className="w95-tray">
        <time title={dateText()}>{clock}</time>
      </div>
    </footer>
  )
}
