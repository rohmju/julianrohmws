import { useWin95 } from '../context.js'
import Icon from '../icons.jsx'

// An icon with its label, on the desktop or in a folder window. A click selects it and a double
// click (or Enter) opens it; on touch screens a tap opens it straight away. Delete, or Delete in
// its right-click menu, tries to delete it.
export default function DesktopIcon({ node, selected, small = false, onSelect, onOpen, style }) {
  const { api, coarsePointer } = useWin95()
  return (
    <button
      type="button"
      className={`w95-icon ${small ? 'w95-icon--small' : ''} ${selected ? 'is-selected' : ''}`}
      style={style}
      onClick={() => (coarsePointer ? onOpen(node) : onSelect(node.id))}
      onDoubleClick={() => {
        if (!coarsePointer) onOpen(node)
      }}
      onFocus={() => onSelect(node.id)}
      onKeyDown={(event) => {
        if (event.key === 'Delete') return api.remove(node)
        if (event.key !== 'Enter') return
        event.preventDefault()
        onOpen(node)
      }}
      onContextMenu={(event) => {
        onSelect(node.id)
        api.contextMenu(event, [
          { label: '&Open', onSelect: () => onOpen(node) },
          '-',
          { label: '&Delete', onSelect: () => api.remove(node) },
          { label: 'Rena&me', disabled: true },
          '-',
          { label: 'P&roperties', disabled: true },
        ])
      }}
    >
      <span className="w95-icon__image">
        <Icon name={node.icon} size={small ? 16 : 32} shortcut={node.shortcut} color={node.color} />
      </span>
      <span className="w95-icon__label">{node.name}</span>
    </button>
  )
}
