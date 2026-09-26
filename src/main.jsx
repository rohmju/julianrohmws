import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Portfolio from './portfolio/Portfolio.jsx'
import './index.css'

// Loaded on demand so the portfolio's first paint doesn't pay for the demo.
const ClaudeHome = lazy(() => import('./claude/ClaudeHome.jsx'))

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/home" element={<Suspense fallback={null}><ClaudeHome /></Suspense>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
