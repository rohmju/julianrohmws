import { useEffect, useRef, useState } from 'react'
import { useWin95 } from '../context.js'

const PROMPT = 'C:\\WINDOWS>'
const BANNER = ['', 'Microsoft(R) Windows 95', '   (C)Copyright Microsoft Corp 1981-1995.', '']

const DIR = [
  '',
  ' Volume in drive C has no label',
  ' Volume Serial Number is 1995-0824',
  ' Directory of C:\\WINDOWS',
  '',
  '.              <DIR>        08-24-95 11:11a .',
  '..             <DIR>        08-24-95 11:11a ..',
  'COMMAND        <DIR>        08-24-95 11:11a COMMAND',
  'SYSTEM         <DIR>        08-24-95 11:11a SYSTEM',
  'WIN      INI           312  08-24-95 11:11a WIN.INI',
  'NOTEPAD  EXE        34,304  08-24-95 11:11a NOTEPAD.EXE',
  'WINMINE  EXE        24,336  08-24-95 11:11a WINMINE.EXE',
  '         3 file(s)         58,952 bytes',
  '         4 dir(s)     104,857,600 bytes free',
]

const HELP = [
  'CLS      Clears the screen.',
  'DATE     Displays the date.',
  'DIR      Displays a list of files and subdirectories in a directory.',
  'ECHO     Displays messages.',
  'EXIT     Quits the MS-DOS prompt.',
  'TIME     Displays the time.',
  'VER      Displays the Windows version.',
  '',
  'NOTEPAD, WINMINE and EXPLORER start those programs.',
]

const pad = (n) => String(n).padStart(2, '0')
const dosDate = (d) => `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`
const dosTime = (d) => {
  const hours = d.getHours() % 12 || 12
  return `${String(hours).padStart(2)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(Math.floor(d.getMilliseconds() / 10))}${d.getHours() < 12 ? 'a' : 'p'}`
}

// A windowed MS-DOS prompt with a handful of built-in commands.
export default function DosPrompt({ win }) {
  const { api } = useWin95()
  const [lines, setLines] = useState(BANNER)
  const [input, setInput] = useState('')
  const history = useRef({ entries: [], at: 0 })
  const inputRef = useRef(null)
  const screenRef = useRef(null)

  useEffect(() => {
    screenRef.current.scrollTop = screenRef.current.scrollHeight
  }, [lines, input])

  // Returns the lines a command prints, or null when it has handled the screen itself.
  const run = (command) => {
    const [name = '', ...args] = command.trim().split(/\s+/)
    switch (name.toLowerCase()) {
      case '':
        return []
      case 'cls':
        setLines([])
        return null
      case 'dir':
        return DIR
      case 'ver':
        return ['', 'Windows 95. [Version 4.00.950]']
      case 'date':
        return [`Current date is ${dosDate(new Date())}`]
      case 'time':
        return [`Current time is ${dosTime(new Date())}`]
      case 'echo':
        return [args.join(' ') || 'ECHO is on']
      case 'help':
        return HELP
      case 'cd':
      case 'chdir':
        return [args.length ? 'Invalid directory' : 'C:\\WINDOWS']
      case 'win':
        return ['You are already running Windows.']
      case 'exit':
        api.close(win.id)
        return null
      case 'notepad':
      case 'winmine':
      case 'explorer':
      case 'iexplore':
        api.launch(args.length ? `${name} ${args.join(' ')}` : name)
        return []
      default:
        return ['Bad command or file name']
    }
  }

  const submit = () => {
    const command = input
    setInput('')
    if (command.trim()) history.current = { entries: [...history.current.entries, command], at: history.current.entries.length + 1 }
    const output = run(command)
    if (output) setLines((current) => [...current, `${PROMPT}${command}`, ...output, ''])
  }

  const recall = (step) => {
    const { entries, at } = history.current
    const next = Math.min(entries.length, Math.max(0, at + step))
    history.current.at = next
    setInput(entries[next] ?? '')
  }

  return (
    <div className="w95-app w95-dos" onPointerUp={() => inputRef.current?.focus()}>
      <div className="w95-dos__screen" ref={screenRef}>
        {lines.map((line, i) => (
          <div key={i}>{line || '\u00a0'}</div>
        ))}
        <div>
          {PROMPT}
          {input}
          <span className="w95-dos__cursor">_</span>
        </div>
      </div>
      <input
        ref={inputRef}
        className="w95-dos__input"
        value={input}
        aria-label="MS-DOS command"
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          else if (event.key === 'ArrowUp') recall(-1)
          else if (event.key === 'ArrowDown') recall(1)
          else return
          event.preventDefault()
        }}
      />
    </div>
  )
}
