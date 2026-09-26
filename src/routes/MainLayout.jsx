import { Link } from 'react-router-dom'
import './MainLayout.css'

// New top-level layout for "/". Empty shell for now — nav + content area,
// ready to be filled in.
export default function MainLayout() {
  return (
    <div className="main-layout">
      <header className="main-layout__header">
        <span className="main-layout__brand">Julian</span>
        <nav className="main-layout__nav">
          <Link to="/home">Claude</Link>
        </nav>
      </header>

      <main className="main-layout__content">
        <p className="main-layout__placeholder">Main layout — coming soon.</p>
      </main>
    </div>
  )
}
