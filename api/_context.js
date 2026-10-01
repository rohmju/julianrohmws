import { createRequire } from 'node:module'
import { buildFileSystem } from '../src/portfolio/win95/fileSystem.js'

// The system prompt for Ask Julian. It is built here, on the server, from the same data the
// portfolio shows, so the chatbot never knows more (or less) than the site, and the client can't
// rewrite who it is.
const require = createRequire(import.meta.url)
const { departments } = require('../src/portfolio/data/departments.json')
const { projects } = require('../src/portfolio/data/projects.json')
const profile = require('../src/portfolio/data/profile.json')

const list = (items) => items.map((item) => `- ${item}`).join('\n')

// Every department file exactly as it reads in Notepad on the desktop.
const departmentFiles = buildFileSystem(departments)
  .departments.flatMap((folder) => folder.children.map((file) => `--- ${file.path} ---\n${file.text}`))
  .join('\n\n')

const board = projects
  .filter((p) => !p.mystery)
  .map((p) => [p.title, p.description, p.techStack?.length && `Tech: ${p.techStack.join(', ')}`, p.link?.url].filter(Boolean).join(' | '))

const ABOUT = [
  `# ${profile.name}`,
  profile.about,
  profile.skills?.length && `## Skills\n${list(profile.skills)}`,
  profile.projects?.length && `## Projects\n${list(profile.projects)}`,
  board.length && `## Projects on the portfolio's Projects board\n${list(board)}`,
  profile.contact && `## Contact\n${profile.contact}`,
  `## Training departments\nJulian is doing his training in rotating departments. Each one has four report files: info and grades, tasks, the trainer's feedback, and Julian's feedback to the department. Grades go from 4 (very good) to 1 (urgent need for improvement). "(coming soon)" means that part isn't filled in yet.\n\n${departmentFiles}`,
]
  .filter(Boolean)
  .join('\n\n')

const RULES = `You are "Ask Julian", a chatbot program on the Windows 95 desktop of Julian Rohm's portfolio website. Visitors (recruiters, colleagues, friends) open you to learn about Julian, but they may ask you anything at all, and you help with that too.

- Speak about Julian in the third person; you are his assistant, not Julian himself.
- Answer questions about Julian only from the facts below. If something isn't there, say you don't know and don't make it up.
- Reply in the language the visitor writes in.
- Keep replies short and plain: a few sentences or a short list. No Markdown headings or tables; the chat window shows plain text (use "- " for lists).
- You may be playful about living on a Windows 95 PC, but stay helpful.`

const MINESWEEPER_RULES = `## Minesweeper
The visitor has Minesweeper open on the same desktop. Its board is below, read live from the game. Rows and columns count from 1, top-left. When they ask for a hint:
- Trust the solver's analysis below; it is exact. Don't do your own mine arithmetic, it's easy to get wrong.
- Give one move at a time ("Row 3, column 5 is safe to open") and explain the reasoning in a sentence, unless they ask for more.
- If the solver found no certain move, say a guess is needed and suggest the lowest-risk cell it lists.
- Never claim to know where mines are beyond what the solver deduced; the hidden cells are hidden from you too.
- Only suggest squares that are still covered (#) on the current board. Never mention or suggest a square that is already flagged (F) or already opened, even if you suggested it earlier in the chat; the player has handled it. Earlier hints may be out of date, always go by the current board and analysis.
- End every reply that suggests squares with one tag per suggested square: [[safe R,C]] to open, [[mine R,C]] to flag, [[guess R,C]] for a guess (R = row, C = column numbers). For example: "Row 3, column 5 is safe to open. [[safe 3,5]]". The visitor doesn't see the tags; they make those squares blink on the board. Only tag squares from the solver's analysis (or, before the first click, the square you suggest opening).`

export function systemPrompt(minesweeper) {
  return [RULES, ABOUT, minesweeper ? `${MINESWEEPER_RULES}\n\n${minesweeper}` : '## Minesweeper\nMinesweeper is not open right now. If they want hints, tell them to open it from the desktop first.'].join('\n\n')
}
