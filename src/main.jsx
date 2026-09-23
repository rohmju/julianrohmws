import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ClawdScene from './components/ClawdScene.jsx'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// Called once the white wipe has covered the screen: tear React down and
// leave nothing behind but a blank white document.
function clearToWhite() {
  root.unmount()
  const html = document.documentElement
  const body = document.createElement('body')
  html.replaceChildren(document.createElement('head'), body)
  for (const { name } of Array.from(html.attributes)) html.removeAttribute(name)
  html.style.cssText = 'background:#fff;color-scheme:light;'
  body.style.cssText = 'margin:0;min-height:100vh;background:#fff;overflow:hidden;'
  return body
}

// The white screen is the stage for the next scene: Clawd calls in the crew.
function startClawdScene(body) {
  const viewport = document.createElement('meta')
  viewport.name = 'viewport'
  viewport.content = 'width=device-width, initial-scale=1.0'
  document.head.append(viewport)

  const stage = document.createElement('div')
  body.append(stage)
  ReactDOM.createRoot(stage).render(
    <React.StrictMode>
      <ClawdScene />
    </React.StrictMode>,
  )
}

root.render(
  <React.StrictMode>
    <App onExit={() => startClawdScene(clearToWhite())} />
  </React.StrictMode>,
)
