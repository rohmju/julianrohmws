import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import '@fontsource/vt323/400.css'
import './win95.css'
import departmentsData from '../data/departments.json'
import profile from '../data/profile.json'
import { APPS, iconOf, titleOf } from './apps/index.js'
import DesktopIcons from './components/DesktopIcons.jsx'
import { ContextMenu } from './components/MenuBar.jsx'
import ShutDownDialog from './components/ShutDownDialog.jsx'
import StartMenu from './components/StartMenu.jsx'
import Taskbar from './components/Taskbar.jsx'
import Window from './components/Window.jsx'
import { Win95Context, createSharedStore } from './context.js'
import { cursorVariables } from './cursors.js'
import { gridSize, layoutIcons, nearestFreeCell } from './desktopGrid.js'
import { buildFileSystem } from './fileSystem.js'
import { screenScale, useDesktopScale } from './scale.js'
import { playStartup } from './sounds.js'

const TASKBAR_HEIGHT = 28
const COMPACT_WIDTH = 640 // narrower screens open resizable windows maximized
const ICON_STEP_MS = 70 // the desktop icons appear one after another while Windows starts

// Start-up and shut-down, stage by stage: the stage that follows and how long this one lasts.
const TIMELINE = {
  black: ['loading', 650], // the monitor switching video mode after the start-up screen
  loading: ['icons', 700], // the bare desktop and the hourglass
  icons: ['ready', null], // one icon after another, then the taskbar
  closing: ['goodbye', 900], // every window closed, the hourglass again
  goodbye: ['safe', 450],
  safe: ['off', 2600], // "It's now safe to turn off your computer."
  off: [null, 750], // the picture collapses into a line and a dot
  dead: ['black', 4000], // someone deleted My Computer: nothing, then a reboot
}
const TIMELINE_REDUCED = { black: 250, loading: 250, icons: 0, closing: 300, goodbye: 150, safe: 1800, off: 300, dead: 2000 }
const DESKTOP_STAGES = new Set(['loading', 'icons', 'ready', 'closing'])

// Keep the pixel font loading while the screen is still black.
document.fonts?.load('11px "W95 Sans"').catch(() => {})
document.fonts?.load('bold 11px "W95 Sans"').catch(() => {})

// ---------------------------------------------------------------------------------------------
// Window manager

const NO_WINDOWS = { windows: [], focused: null, nextId: 1, nextZ: 1 }

const topmost = (windows) => windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.id ?? null

const raise = (state, id) => ({
  ...state,
  focused: id,
  nextZ: state.nextZ + 1,
  windows: state.windows.map((w) => (w.id === id ? { ...w, z: state.nextZ, minimized: false } : w)),
})

function manage(state, action) {
  switch (action.type) {
    case 'open': {
      // A window with the same key (a folder, a file, a single-instance program) is brought back.
      const existing = action.key && state.windows.find((w) => w.key === action.key)
      if (existing) return raise(state, existing.id)
      const { type, ...spec } = action
      const win = { ...spec, id: state.nextId, minimized: false, z: state.nextZ }
      return { windows: [...state.windows, win], focused: win.id, nextId: state.nextId + 1, nextZ: state.nextZ + 1 }
    }
    case 'focus': {
      const win = state.windows.find((w) => w.id === action.id)
      if (!win || (state.focused === win.id && !win.minimized && win.z === state.nextZ - 1)) return state
      return raise(state, win.id)
    }
    case 'blur':
      return state.focused === null ? state : { ...state, focused: null }
    case 'close': {
      const windows = state.windows.filter((w) => w.id !== action.id)
      return { ...state, windows, focused: state.focused === action.id ? topmost(windows) : state.focused }
    }
    case 'minimize': {
      const windows = state.windows.map((w) => (w.id === action.id ? { ...w, minimized: true } : w))
      return { ...state, windows, focused: state.focused === action.id ? topmost(windows) : state.focused }
    }
    case 'maximize':
      return { ...state, windows: state.windows.map((w) => (w.id === action.id ? { ...w, maximized: !w.maximized } : w)) }
    case 'place':
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, x: action.x, y: action.y, w: action.w ?? w.w, h: action.h ?? w.h } : w)),
      }
    case 'closeAll':
      return { ...NO_WINDOWS, nextId: state.nextId }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------------------------

// The Windows 95 desktop behind "My Departments". It mounts black (the display switching mode
// after the start-up screen), boots, and after Start → Shut Down ends black again and calls
// onShutDown so the portfolio can play its way back.
export default function Win95({ leaving, reducedMotion, coarsePointer, onShutDown }) {
  const fs = useMemo(() => buildFileSystem(departmentsData.departments, profile), [])
  const [stage, setStage] = useState('black')
  const [wm, dispatch] = useReducer(manage, NO_WINDOWS)
  const [selected, setSelected] = useState(null)
  const [start, setStart] = useState(null) // { keyboard } while the Start menu is open
  const [context, setContext] = useState(null) // { x, y, items } of an open right-click menu
  const [shutDownOpen, setShutDownOpen] = useState(false)
  const [recent, setRecent] = useState([])
  const [placed, setPlaced] = useState({}) // desktop icons' cells, once one has been dragged
  const scale = useDesktopScale()
  const [bounds, setBounds] = useState(() => ({ width: window.innerWidth / scale, height: window.innerHeight / scale - TASKBAR_HEIGHT }))
  const rootRef = useRef(null)
  const desktopRef = useRef(null)
  const afterBoot = useRef(null)
  const latest = useRef(null)
  latest.current = { wm, bounds, onShutDown }

  const showDesktop = DESKTOP_STAGES.has(stage)
  const iconCount = fs.system.length + fs.departments.length
  const iconGroups = useMemo(() => [fs.system, fs.departments], [fs])
  const grid = gridSize(bounds)
  const cells = layoutIcons(iconGroups, placed, grid)
  // A dropped icon snaps to the nearest free cell; every other icon stays where it is now.
  // Dropped on the Recycle Bin, it is "deleted" instead.
  const moveIcon = (id, target) => {
    const bin = cells['recycle-bin']
    if (id !== 'recycle-bin' && bin.col === target.col && bin.row === target.row) return api.remove(iconGroups.flat().find((n) => n.id === id))
    setPlaced({ ...cells, [id]: nearestFreeCell(cells, id, target, grid) })
  }

  useEffect(() => {
    if (!TIMELINE[stage]) return
    const [next, ms] = TIMELINE[stage]
    const duration = reducedMotion ? TIMELINE_REDUCED[stage] : ms ?? iconCount * ICON_STEP_MS + 250
    const timer = setTimeout(() => (next ? setStage(next) : latest.current.onShutDown?.()), duration)
    return () => clearTimeout(timer)
  }, [stage, reducedMotion, iconCount])

  // The start-up sound plays as the desktop appears, after every boot and log-on. It is left to
  // finish across the following stages and only stopped when the desktop goes away.
  const stopSound = useRef(() => {})
  useEffect(() => {
    if (stage === 'loading') stopSound.current = playStartup()
  }, [stage])
  useEffect(() => () => stopSound.current(), [])

  // Once the desktop is up: keyboard focus moves onto it, and a pending program starts.
  useEffect(() => {
    if (stage !== 'ready') return
    rootRef.current?.focus({ preventScroll: true })
    const run = afterBoot.current
    afterBoot.current = null
    run?.()
  }, [stage])

  // Any key or click skips the wait on "It's now safe to turn off your computer."
  useEffect(() => {
    if (stage !== 'safe') return
    const skip = () => setStage('off')
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [stage])

  useLayoutEffect(() => {
    const desktop = desktopRef.current
    if (!desktop) return
    const measure = () => setBounds({ width: desktop.clientWidth, height: desktop.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(desktop)
    return () => observer.disconnect()
  }, [showDesktop])

  const api = useMemo(() => {
    const shared = createSharedStore()
    const open =(app, props = {}, { key, maximized } = {}) => {
      const spec = APPS[app]
      const { wm, bounds } = latest.current
      let place = {}
      if (spec.width) {
        // New windows cascade down and to the right from the top-left corner.
        const step = (wm.windows.length % 8) * 22
        const w = Math.min(spec.width, bounds.width)
        const h = Math.min(spec.height, bounds.height)
        place = { x: Math.max(0, Math.min(36 + step, bounds.width - w)), y: Math.max(0, Math.min(20 + step, bounds.height - h)), w, h }
      }
      dispatch({ type: 'open', app, props, key, maximized: maximized ?? Boolean(spec.resizable && bounds.width < COMPACT_WIDTH), ...place })
    }
    const message = (props) => open('message', props)
    const run = (app, options = {}) => {
      if (app === 'explorer') return openNode(fs.myComputer)
      if (app === 'wordpad') return openNode(fs.resume) // the only document on this computer
      if (app === 'notepad') return open('notepad', {}, options) // every Notepad is a new window
      return open(app, {}, { key: app, ...options })
    }
    const remember = (node) => setRecent((list) => [node, ...list.filter((n) => n.id !== node.id)].slice(0, 10))
    const openNode = (node) => {
      switch (node.type) {
        case 'folder':
          return open('folder', { node, color: node.color }, { key: `folder:${node.id}` })
        case 'file':
          remember(node)
          return open('notepad', { name: node.name, text: node.text, color: node.color }, { key: `file:${node.id}` })
        case 'document':
          // The desktop shortcut and the file in My Documents share one window.
          remember(fs.resume)
          return open('wordpad', { name: node.name, blocks: node.blocks }, { key: `document:${node.name}` })
        case 'link':
          return open('browser', { url: node.url }, { key: `link:${node.id}` })
        case 'app':
          return run(node.app)
        default:
          return message(node.error)
      }
    }
    // Start → Run and the MS-DOS prompt: a program, a drive, a folder on the desktop, or the error.
    const launch = (command) => {
      const name = command.toLowerCase().replace(/\.(exe|com)$/, '')
      const programs = {
        notepad: 'notepad',
        winmine: 'minesweeper',
        minesweeper: 'minesweeper',
        command: 'dos',
        cmd: 'dos',
        explorer: 'explorer',
        winhelp: 'help',
        help: 'help',
        iexplore: 'browser',
        askjulian: 'chat',
        chat: 'chat',
        wordpad: 'wordpad',
        write: 'wordpad',
        find: 'find',
        sysdm: 'sysprops',
        'sysdm.cpl': 'sysprops',
        rasphone: 'dialup',
        dialup: 'dialup',
        contact: 'dialup',
      }
      if (programs[name]) return run(programs[name])
      // "iexplore <address>" or a web address on its own opens a new browser window.
      const [program, ...rest] = command.trim().split(/\s+/)
      if (/^iexplore(\.exe)?$/i.test(program)) return open('browser', { url: rest.join(' ') })
      if (/^(https?:\/\/|www\.)/i.test(command.trim())) return open('browser', { url: command.trim() })
      const drive = /^([acd]):\\?$/.exec(name)
      if (drive) return openNode(fs.myComputer.children.find((node) => node.id === `drive-${drive[1]}`))
      const node = [...fs.system, ...fs.departments].find((n) => n.name.toLowerCase() === name)
      if (node) return openNode(node)
      return message({
        title: command,
        icon: 'error',
        text: `Cannot find the file '${command}' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.`,
      })
    }
    // Nothing can be deleted: every attempt opens another NOPE.GIF, and My Computer takes the
    // whole computer down with it.
    const remove = (node) => {
      if (node?.id !== fs.myComputer.id) return open('nope')
      setStart(null)
      setContext(null)
      setShutDownOpen(false)
      setSelected(null)
      dispatch({ type: 'closeAll' })
      setStage('dead')
    }
    // A right-click menu at the pointer, e.g. an icon's.
    const contextMenu = (event, items) => {
      event.preventDefault()
      event.stopPropagation()
      const screen = rootRef.current.getBoundingClientRect()
      const k = screenScale(rootRef.current)
      setContext({ x: (event.clientX - screen.left) / k, y: (event.clientY - screen.top) / k, items })
    }
    return {
      ...shared,
      fs,
      open,
      openNode,
      run,
      launch,
      message,
      remove,
      contextMenu,
      about: (product) => open('about', { product }, { key: `about:${product ?? 'Windows 95'}` }),
      notAvailable: (name) => message({ title: name, icon: 'info', text: `${name} is not available on this computer.` }),
      focus: (id) => dispatch({ type: 'focus', id }),
      close: (id) => dispatch({ type: 'close', id }),
      minimize: (id) => dispatch({ type: 'minimize', id }),
      toggleMaximize: (id) => dispatch({ type: 'maximize', id }),
      place: (id, rect) => dispatch({ type: 'place', id, ...rect }),
    }
  }, [fs])

  const contextValue = useMemo(() => ({ api, coarsePointer, reducedMotion }), [api, coarsePointer, reducedMotion])
  const closeStart = useCallback(() => setStart(null), [])
  const closeContext = useCallback(() => setContext(null), [])

  const startItems = useMemo(
    () => [
      {
        label: '&Programs',
        icon: 'programs',
        submenu: [
          {
            label: 'Accessories',
            icon: 'programs',
            submenu: [
              { label: 'Games', icon: 'programs', submenu: [{ label: 'Minesweeper', icon: 'minesweeper', onSelect: () => api.run('minesweeper') }] },
              { label: 'Dial-Up Networking', icon: 'dialup', onSelect: () => api.run('dialup') },
              { label: 'Notepad', icon: 'notepad', onSelect: () => api.run('notepad') },
              { label: 'WordPad', icon: 'wordpad', onSelect: () => api.run('wordpad') },
            ],
          },
          { label: 'StartUp', icon: 'programs', submenu: [{ label: '(Empty)', disabled: true }] },
          { label: 'Ask Julian', icon: 'chat', onSelect: () => api.run('chat') },
          { label: 'Contact Julian', icon: 'dialup', onSelect: () => api.run('dialup') },
          { label: 'Internet Explorer', icon: 'ie', onSelect: () => api.run('browser') },
          { label: 'MS-DOS Prompt', icon: 'dos', onSelect: () => api.run('dos') },
          { label: 'Windows Explorer', icon: 'explorer', onSelect: () => api.run('explorer') },
        ],
      },
      {
        label: '&Documents',
        icon: 'documents',
        submenu: recent.length
          ? recent.map((node) => ({ label: node.path ?? node.name, icon: node.icon === 'wordpad' ? 'wordpad' : 'text', onSelect: () => api.openNode(node) }))
          : [{ label: '(Empty)', disabled: true }],
      },
      {
        label: '&Settings',
        icon: 'settings',
        submenu: [
          { label: '&Control Panel', icon: 'control', onSelect: () => api.notAvailable('Control Panel') },
          { label: '&Printers', icon: 'printers', onSelect: () => api.notAvailable('Printing') },
          { label: '&Taskbar...', icon: 'settings', onSelect: () => api.notAvailable('Taskbar Properties') },
        ],
      },
      {
        label: '&Find',
        icon: 'find',
        submenu: [
          { label: '&Files or Folders...', icon: 'find', onSelect: () => api.run('find') },
          { label: '&Computer...', icon: 'computer', onSelect: () => api.notAvailable('Find Computer') },
        ],
      },
      { label: '&Help', icon: 'help', onSelect: () => api.run('help') },
      { label: '&Run...', icon: 'run', onSelect: () => api.run('run') },
      '-',
      { label: 'Sh&ut Down...', icon: 'shutdown', onSelect: () => setShutDownOpen(true) },
    ],
    [api, recent],
  )

  const desktopMenu = [
    { label: 'Arrange &Icons', onSelect: () => setPlaced({}) },
    { label: 'Line &up Icons', disabled: true },
    '-',
    { label: '&Paste', disabled: true },
    { label: 'Paste &Shortcut', disabled: true },
    '-',
    { label: 'Ne&w', disabled: true },
    '-',
    { label: 'P&roperties', onSelect: () => api.notAvailable('Display Properties') },
  ]

  const onShutDownChoice = (choice) => {
    setShutDownOpen(false)
    setStart(null)
    setSelected(null)
    dispatch({ type: 'closeAll' })
    if (choice === 'shutdown') return setStage('closing')
    if (choice === 'logoff') return setStage('loading')
    if (choice === 'dos') afterBoot.current = () => api.run('dos', { maximized: true })
    return setStage('black')
  }

  const onTask = (id) => {
    const win = wm.windows.find((w) => w.id === id)
    if (win && wm.focused === id && !win.minimized) api.minimize(id)
    else api.focus(id)
  }

  // A press on the bare desktop deselects its icons and deactivates every window.
  const onDesktopPointerDown = (event) => {
    if (event.target.closest('.w95-icon, .w95-window, .w95-outline')) return
    setSelected(null)
    dispatch({ type: 'blur' })
  }

  const tasks = wm.windows.filter((w) => !APPS[w.app].dialog).map((w) => ({ id: w.id, title: titleOf(w), icon: iconOf(w) }))
  const busy = stage === 'loading' || stage === 'icons' || stage === 'closing'

  return (
    <Win95Context.Provider value={contextValue}>
      <section
        ref={rootRef}
        className={`w95 ${leaving ? 'is-leaving' : ''}`}
        data-stage={stage}
        data-busy={busy ? '' : undefined}
        style={{ ...cursorVariables(), '--w95-scale': scale }}
        aria-label="Windows 95 desktop"
        tabIndex={-1}
      >
        <svg className="w95-defs" aria-hidden="true" focusable="false">
          {/* Selected icons are tinted half navy, like Windows 95's dithered highlight. */}
          <filter id="w95-selected" colorInterpolationFilters="sRGB">
            <feFlood floodColor="#000080" floodOpacity="0.5" />
            <feComposite in2="SourceAlpha" operator="in" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <clipPath id="w95-radio-half">
            <path d="M0 0h12L0 12z" />
          </clipPath>
        </svg>

        {showDesktop && (
          <div
            className="w95-desktop"
            ref={desktopRef}
            onPointerDown={onDesktopPointerDown}
            onContextMenu={(event) => {
              event.preventDefault()
              if (stage !== 'ready' || event.target.closest('.w95-window')) return
              api.contextMenu(event, desktopMenu)
            }}
          >
            {(stage === 'icons' || stage === 'ready') && (
              <DesktopIcons
                nodes={iconGroups.flat()}
                cells={cells}
                selected={selected}
                onSelect={setSelected}
                onOpen={api.openNode}
                onMove={moveIcon}
              />
            )}
            {wm.windows.map((win) => {
              const spec = APPS[win.app]
              const Program = spec.component
              const active = wm.focused === win.id
              return (
                <Window
                  key={win.id}
                  win={win}
                  title={titleOf(win)}
                  icon={iconOf(win)}
                  active={active}
                  bounds={bounds}
                  dialog={spec.dialog}
                  resizable={spec.resizable}
                  maximizable={spec.maximizable ?? spec.resizable}
                >
                  <Program win={win} props={win.props} active={active} />
                </Window>
              )
            })}
          </div>
        )}

        {stage === 'ready' && (
          <Taskbar
            tasks={tasks}
            activeId={wm.focused}
            startOpen={Boolean(start)}
            onStart={(event) => setStart(start ? null : { keyboard: event.detail === 0 })}
            onTask={onTask}
          />
        )}
        {stage === 'ready' && start && <StartMenu items={startItems} onClose={closeStart} autoFocus={start.keyboard} />}
        {stage === 'ready' && context && <ContextMenu x={context.x} y={context.y} items={context.items} onClose={closeContext} />}
        {shutDownOpen && (
          <ShutDownDialog
            onChoose={onShutDownChoice}
            onCancel={() => setShutDownOpen(false)}
            onHelp={() => {
              setShutDownOpen(false)
              api.run('help')
            }}
          />
        )}

        {(stage === 'safe' || stage === 'off') && (
          <div className="w95-safe" onPointerDown={() => stage === 'safe' && setStage('off')}>
            <p>
              It&rsquo;s now safe to turn off
              <br />
              your computer.
            </p>
          </div>
        )}
        {stage === 'off' && <div className="w95-crt-off" aria-hidden="true" />}
      </section>
    </Win95Context.Provider>
  )
}
