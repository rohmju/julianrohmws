import About from './About.jsx'
import AskJulian from './AskJulian.jsx'
import Browser from './Browser.jsx'
import DosPrompt from './DosPrompt.jsx'
import Folder from './Folder.jsx'
import Help from './Help.jsx'
import MessageBox from './MessageBox.jsx'
import Minesweeper from './Minesweeper.jsx'
import Notepad from './Notepad.jsx'
import Run from './Run.jsx'

// Every program the desktop can open. width/height is the initial size of resizable windows;
// the others size themselves to their content. Dialogs have no taskbar button and no
// minimize/maximize buttons.
export const APPS = {
  folder: { component: Folder, width: 400, height: 280, resizable: true, title: (p) => p.node.name, icon: (p) => p.node.icon },
  notepad: { component: Notepad, width: 480, height: 340, resizable: true, title: (p) => `${p.name ?? 'Untitled'} - Notepad`, icon: 'notepad' },
  minesweeper: { component: Minesweeper, maximizable: false, title: 'Minesweeper', icon: 'minesweeper' },
  browser: { component: Browser, width: 640, height: 460, resizable: true, title: 'Microsoft Internet Explorer', icon: 'ie' },
  chat: { component: AskJulian, width: 400, height: 440, resizable: true, title: 'Ask Julian', icon: 'chat' },
  dos: { component: DosPrompt, width: 600, height: 380, resizable: true, title: 'MS-DOS Prompt', icon: 'dos' },
  help: { component: Help, width: 440, height: 420, resizable: true, title: 'Windows Help', icon: 'help' },
  about: { component: About, dialog: true, title: (p) => `About ${p.product ?? 'Windows 95'}` },
  run: { component: Run, dialog: true, title: 'Run' },
  message: { component: MessageBox, dialog: true, title: (p) => p.title },
}

export const titleOf = (win) => {
  const { title } = APPS[win.app]
  return typeof title === 'function' ? title(win.props) : title
}

export const iconOf = (win) => {
  const { icon } = APPS[win.app]
  return typeof icon === 'function' ? icon(win.props) : icon
}
