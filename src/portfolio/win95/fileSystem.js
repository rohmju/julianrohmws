// The desktop's little file system: a folder per department (from departments.json) plus the
// standard Windows 95 places. Node types:
//   folder  children                 opens a folder window
//   file    text                     opens in Notepad
//   link    url                      opens the URL in Internet Explorer
//   app     app                      starts a program (see apps/index.js)
//   error   error {title,text,icon}  shows a message box, like an empty floppy drive

const PLACEHOLDER = '(coming soon)'
// Every file claims the day Windows 95 shipped.
export const MODIFIED = '8/24/95 11:11 AM'

const field = (label, value) => `${label.padEnd(9)}${value || PLACEHOLDER}`
const heading = (text) => [text.toUpperCase(), '='.repeat(text.length)]
const bullets = (items) => (items?.length ? items.map((item) => `  - ${item}`) : [`  ${PLACEHOLDER}`])

// The 8 criteria the trainer rates (departments.json: grades and feedback follow this order) and the 3
// Julian rates the department on (studentFeedback).
const CRITERIA = ['Onboarding success', 'Expertise', 'Comprehension & understanding', 'Commitment', 'Interest & willingness to learn', 'Working style', 'Work results', 'Conduct (team & superiors)']
const STUDENT_CRITERIA = ['Insight into the department', 'Support', 'Tasks']
const SCALE = ['4 = Very good performance', '3 = Good performance', '2 = Potential for improvement', '1 = Urgent need for improvement']

// Every department folder holds the same four text files (named after the sections of the report), so
// the Documents menu names files by their folder too.
function departmentFolder(d) {
  const file = (slug, name, lines) => ({
    type: 'file',
    id: `${d.id}/${slug}`,
    name: `${name}.txt`,
    path: `${d.name}\\${name}.txt`,
    icon: 'text',
    color: d.color,
    text: lines.join('\n'),
  })
  const row = (label, grade) => `${label.padEnd(36, '.')} ${grade ?? PLACEHOLDER}`
  const grade = (list, i) => list?.[i] ?? PLACEHOLDER
  const meta = [['Period:', d.period], ['Trainer:', d.trainer], ['Grade:', d.rating]].map(([label, value]) => field(label, value))

  const info = [
    ...heading(`${d.name}: info`),
    '',
    'GRADING SCALE',
    ...SCALE.map((line) => `  ${line}`),
    '',
    field('Period:', d.period),
    field('Year:', d.year),
    field('Trainer:', d.trainer),
    field('Average:', d.rating),
    '',
    "TRAINER'S RATING",
    ...CRITERIA.map((name, i) => row(`${i + 1}. ${name}`, d.grades?.[i])),
    '',
    "JULIAN'S RATING OF THE DEPARTMENT",
    ...STUDENT_CRITERIA.map((name, i) => row(`${i + 1}. ${name}`, d.studentFeedback?.[i]?.grade)),
  ]

  const feedback = d.feedback?.length
    ? CRITERIA.flatMap((name, i) => [`${i + 1}. ${name} (Grade ${grade(d.grades, i)})`, `   ${d.feedback[i]}`, '']).slice(0, -1)
    : [`  ${PLACEHOLDER}`]

  const julian = d.studentFeedback?.length
    ? STUDENT_CRITERIA.flatMap((name, i) => [
        `${i + 1}. ${name} (Grade ${d.studentFeedback[i]?.grade ?? PLACEHOLDER})`,
        ...(d.studentFeedback[i]?.notes ?? [PLACEHOLDER]).map((note) => `   ${note}`),
        '',
      ]).slice(0, -1)
    : [`  ${PLACEHOLDER}`]

  const children = [
    file('info', 'Info', info),
    file('tasks', 'Tasks & Focus Areas', [...heading(d.name), '', ...meta, '', ...bullets(d.tasks)]),
    file('feedback', 'Trainer Feedback & Special Achievements', [...heading(`${d.name}: trainer feedback`), '', ...feedback]),
    file('julian', "Julian's Feedback to the Department", [...heading(`${d.name}: Julian's feedback`), '', ...julian]),
  ]
  return { type: 'folder', id: `department/${d.id}`, name: d.name, icon: 'folder', color: d.color, children }
}

const notAccessible = (drive) => ({
  title: `${drive}:\\`,
  text: `${drive}:\\ is not accessible.\n\nThe device is not ready.`,
  icon: 'error',
  buttons: ['&Retry', 'Cancel'],
})

const unavailable = (name) => ({
  title: name,
  text: `${name} is not available on this computer.`,
  icon: 'info',
})

const WIN_INI = `[windows]
load=
run=
NullPort=None

[Desktop]
Wallpaper=(None)
TileWallpaper=0
Pattern=(None)

[intl]
iCountry=49
sLanguage=enu`

const AUTOEXEC_BAT = `@ECHO OFF
PROMPT $p$g
PATH C:\\WINDOWS;C:\\WINDOWS\\COMMAND
SET TEMP=C:\\WINDOWS\\TEMP`

const CONFIG_SYS = `DEVICE=C:\\WINDOWS\\HIMEM.SYS
DOS=HIGH,UMB
FILES=40`

export function buildFileSystem(departments) {
  const folders = departments.map(departmentFolder)

  const programs = {
    notepad: { type: 'app', id: 'app/notepad', name: 'Notepad', icon: 'notepad', app: 'notepad' },
    minesweeper: { type: 'app', id: 'app/minesweeper', name: 'Minesweeper', icon: 'minesweeper', app: 'minesweeper' },
    browser: { type: 'app', id: 'app/iexplore', name: 'Internet Explorer', icon: 'ie', app: 'browser' },
  }

  const driveC = {
    type: 'folder',
    id: 'drive-c',
    name: '(C:)',
    icon: 'drive-hd',
    kind: 'Local Disk',
    children: [
      { type: 'folder', id: 'my-documents', name: 'My Documents', icon: 'folder', children: folders },
      {
        type: 'folder',
        id: 'program-files',
        name: 'Program Files',
        icon: 'folder',
        children: [
          { type: 'folder', id: 'accessories', name: 'Accessories', icon: 'folder', children: [programs.notepad, programs.minesweeper] },
          { type: 'folder', id: 'plus', name: 'Plus!', icon: 'folder', children: [{ ...programs.browser, id: 'plus/iexplore', name: 'Iexplore.exe' }] },
        ],
      },
      {
        type: 'folder',
        id: 'windows',
        name: 'Windows',
        icon: 'folder',
        children: [
          { type: 'app', id: 'windows/command', name: 'Command.com', icon: 'dos', app: 'dos' },
          { type: 'app', id: 'windows/notepad', name: 'Notepad.exe', icon: 'notepad', app: 'notepad' },
          { type: 'app', id: 'windows/winmine', name: 'Winmine.exe', icon: 'minesweeper', app: 'minesweeper' },
          { type: 'file', id: 'windows/win-ini', name: 'Win.ini', icon: 'text', text: WIN_INI },
        ],
      },
      { type: 'file', id: 'autoexec', name: 'Autoexec.bat', icon: 'text', text: AUTOEXEC_BAT },
      { type: 'file', id: 'config', name: 'Config.sys', icon: 'text', text: CONFIG_SYS },
    ],
  }

  const myComputer = {
    type: 'folder',
    id: 'my-computer',
    name: 'My Computer',
    icon: 'computer',
    kind: 'System Folder',
    children: [
      { type: 'error', id: 'drive-a', name: '3½ Floppy (A:)', icon: 'drive-floppy', kind: '3½ Inch Floppy Disk', error: notAccessible('A') },
      driveC,
      { type: 'error', id: 'drive-d', name: '(D:)', icon: 'drive-cd', kind: 'CD-ROM Disc', error: notAccessible('D') },
      { type: 'error', id: 'control-panel', name: 'Control Panel', icon: 'control', kind: 'System Folder', error: unavailable('Control Panel') },
      { type: 'error', id: 'printers', name: 'Printers', icon: 'printers', kind: 'System Folder', error: unavailable('Printing') },
    ],
  }

  const network = {
    type: 'folder',
    id: 'network',
    name: 'Network Neighborhood',
    icon: 'network',
    kind: 'System Folder',
    children: [
      {
        type: 'error',
        id: 'entire-network',
        name: 'Entire Network',
        icon: 'globe',
        kind: 'Network',
        error: {
          title: 'Network Neighborhood',
          text: "Unable to browse the network.\n\nThe network is not accessible.\n\nFor more information, look up 'troubleshooting networks' in the Help index.",
          icon: 'error',
        },
      },
      { type: 'folder', id: 'julian', name: 'Julian', icon: 'computer', kind: 'Computer', children: [{ type: 'folder', id: 'shared-departments', name: 'Departments', icon: 'folder', children: folders }] },
    ],
  }

  const recycleBin = { type: 'folder', id: 'recycle-bin', name: 'Recycle Bin', icon: 'recycle', kind: 'System Folder', children: [] }

  return {
    myComputer,
    departments: folders,
    // Desktop: the system icons in the first column, then the departments.
    system: [myComputer, network, { ...programs.browser, id: 'desktop/iexplore' }, recycleBin, { ...programs.minesweeper, id: 'desktop/minesweeper', shortcut: true }],
    programs,
  }
}

// What Windows calls each kind of node in a folder's Details view.
export function kindOf(node) {
  if (node.kind) return node.kind
  if (node.type === 'folder') return 'File Folder'
  if (node.type === 'link') return 'Internet Shortcut'
  if (node.type === 'app') return 'Application'
  if (node.name.toLowerCase().endsWith('.ini')) return 'Configuration Settings'
  if (node.name.toLowerCase().endsWith('.bat')) return 'MS-DOS Batch File'
  if (node.name.toLowerCase().endsWith('.sys')) return 'System file'
  return 'Text Document'
}

// Bytes a node takes up; programs get plausible sizes of the real ones.
const APP_BYTES = { notepad: 34304, minesweeper: 24336, dos: 92870, browser: 438272 }
export function sizeOf(node) {
  if (node.type === 'file') return new TextEncoder().encode(node.text).length
  if (node.type === 'app') return APP_BYTES[node.app] ?? 0
  if (node.type === 'link') return 108
  return null
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)}KB`
}
