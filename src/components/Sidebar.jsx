import IconButton from './IconButton.jsx'
import { ChatIcon, CodeXmlIcon, FolderIcon, LayersIcon, PanelLeftIcon, PlusIcon } from './Icons.jsx'

export default function Sidebar() {
  return (
    <nav className="rail" aria-label="Sidebar">
      <IconButton label="Open sidebar"><PanelLeftIcon /></IconButton>
      <div className="rail-group">
        <IconButton label="New chat" className="new-chat">
          <span className="new-chat-dot"><PlusIcon /></span>
        </IconButton>
        <IconButton label="Chats"><ChatIcon /></IconButton>
        <IconButton label="Projects"><FolderIcon /></IconButton>
        <IconButton label="Artifacts"><LayersIcon /></IconButton>
        <IconButton label="Code"><CodeXmlIcon /></IconButton>
      </div>
      <button type="button" className="avatar" aria-label="Account: Julian" data-nudge>JR</button>
    </nav>
  )
}
