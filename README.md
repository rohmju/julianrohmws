# 🖥️ julianrohmws

> Julian Rohm's portfolio: a start page, a video stage, a project board and a fully clickable **Windows 95 desktop**.

```
 ┌──────────────────────────────────────────────┐
 │ ▓▓ Start │ 📁 My Departments │ 💬 Ask Julian  │
 └──────────────────────────────────────────────┘
```

## ✨ What's inside

| | |
|---|---|
| 🪟 **Windows 95 desktop** | Draggable windows, Start menu, Notepad, DOS Prompt, Run dialog, Help |
| 📁 **My Departments** | Every department Julian worked in, as folders and text files |
| 💬 **Ask Julian** | A chatbot (Gemini) that knows Julian's skills, departments and projects |
| 💣 **Minesweeper** | The classic. Ask Julian can look at your board and give you hints |
| 🗂️ **Project board** | A lazily loaded Three.js board with the projects |

## 🚀 Run it locally

```bash
npm install
npm run dev
```

For the chatbot, put a Gemini key in `.env.local`:

```
GEMINI_API_KEY=your-key-from-aistudio.google.com
```

The Vite dev server also serves `api/chat.js`, so you don't need the Vercel CLI.

## 🧱 Stack

React 18 · Vite 5 · React Router · Three.js · Gemini API · deployed on Vercel

## 📦 Deploy

Push to `main`. Vercel builds it. Set `GEMINI_API_KEY` in the Vercel project's environment variables.

---

<sub>Built with way too much nostalgia for 1995. 💾</sub>
