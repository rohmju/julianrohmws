import { useState } from 'react'
import { useWin95 } from '../context.js'
import DesktopIcon from '../components/DesktopIcon.jsx'
import MenuBar from '../components/MenuBar.jsx'
import { MODIFIED, formatSize, kindOf, sizeOf } from '../fileSystem.js'

// A folder window as Windows 95 opens it from the desktop: menu bar, icon view, status bar.
export default function Folder({ win, props: { node } }) {
  const { api } = useWin95()
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('large')
  const children = node.children ?? []
  const current = children.find((child) => child.id === selected)
  const bytes = children.reduce((sum, child) => sum + (sizeOf(child) ?? 0), 0)
  const viewItem = (label, value) => ({ label, checked: view === value, onSelect: () => setView(value) })

  const menus = [
    {
      label: '&File',
      items: [
        { label: '&Open', disabled: !current, onSelect: () => api.openNode(current) },
        '-',
        { label: '&Delete', disabled: !current, onSelect: () => api.remove(current) },
        '-',
        { label: '&Close', onSelect: () => api.close(win.id) },
      ],
    },
    {
      label: '&Edit',
      items: [
        { label: '&Undo', disabled: true },
        '-',
        { label: 'Cu&t', disabled: true },
        { label: '&Copy', disabled: true },
        { label: '&Paste', disabled: true },
        '-',
        { label: 'Select &All', disabled: true },
      ],
    },
    {
      label: '&View',
      items: [viewItem('Lar&ge Icons', 'large'), viewItem('S&mall Icons', 'small'), viewItem('&List', 'list'), viewItem('&Details', 'details')],
    },
    {
      label: '&Help',
      items: [{ label: '&Help Topics', onSelect: () => api.run('help') }, '-', { label: '&About Windows 95', onSelect: () => api.about() }],
    },
  ]

  const icon = (child) => (
    <DesktopIcon
      key={child.id}
      node={child}
      small={view !== 'large'}
      selected={selected === child.id}
      onSelect={setSelected}
      onOpen={api.openNode}
    />
  )

  return (
    <div className="w95-app w95-folder">
      <MenuBar menus={menus} />
      <div className="w95-well">
        <div
          className={`w95-folder__view is-${view}`}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          {view === 'details' ? (
            <table className="w95-details">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Size</th>
                  <th scope="col">Type</th>
                  <th scope="col">Modified</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child) => {
                  const size = sizeOf(child)
                  return (
                    <tr key={child.id}>
                      <td>{icon(child)}</td>
                      <td className="is-number">{size === null ? '' : formatSize(size)}</td>
                      <td>{kindOf(child)}</td>
                      <td>{MODIFIED}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            children.map(icon)
          )}
        </div>
      </div>
      <div className="w95-statusbar">
        <span className="w95-statusbar__field">{children.length} object(s)</span>
        <span className="w95-statusbar__field">{bytes ? formatSize(bytes) : ''}</span>
      </div>
    </div>
  )
}
