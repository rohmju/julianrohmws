// Renders "&File" as "File" with the F underlined, like every Windows 95 menu and button.
export default function AccessKey({ label }) {
  const at = label.indexOf('&')
  if (at < 0) return label
  return (
    <>
      {label.slice(0, at)}
      <u>{label[at + 1]}</u>
      {label.slice(at + 2)}
    </>
  )
}

export const plain = (label) => label.replace('&', '')
