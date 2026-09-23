import { BulbIcon, CodeIcon, CoffeeIcon, GradCapIcon, PencilIcon } from './Icons.jsx'

const CHIPS = [
  { label: 'Write', Icon: PencilIcon },
  { label: 'Learn', Icon: GradCapIcon },
  { label: 'Code', Icon: CodeIcon },
  { label: 'Life stuff', Icon: CoffeeIcon },
  { label: 'Claude’s choice', Icon: BulbIcon },
]

export default function SuggestionChips() {
  return (
    <div className="chips">
      {CHIPS.map(({ label, Icon }) => (
        <button key={label} className="chip" type="button" data-nudge>
          <Icon />
          {label}
        </button>
      ))}
    </div>
  )
}
