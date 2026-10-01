import { useWin95 } from '../context.js'
import Icon from '../icons.jsx'

// An icon with its label, on the desktop or in a folder window. A click selects it and a double
// click (or Enter) opens it; on touch screens a tap opens it straight away.
export default function DesktopIcon({ node, selected, small = false, onSelect, onOpen, style }) {
  const { coarsePointer } = useWin95()
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
        if (event.key !== 'Enter') return
        event.preventDefault()
        onOpen(node)
      }}
    >
      <span className="w95-icon__image">
        <Icon name={node.icon} size={small ? 16 : 32} shortcut={node.shortcut} color={node.color} />
      </span>
      <span className="w95-icon__label">{node.name}</span>
    </button>
  )
}
