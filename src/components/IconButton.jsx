// Decorative chrome button. `data-nudge` makes App bump the scroll hint on click.
export default function IconButton({ label, className = '', children }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} data-nudge>
      {children}
    </button>
  )
}
