import { useState } from 'react'
import { useWin95 } from '../context.js'
import AccessKey from '../components/AccessKey.jsx'
import DesktopIcon from '../components/DesktopIcon.jsx'
import MenuBar from '../components/MenuBar.jsx'
import { MODIFIED, formatSize, kindOf, sizeOf } from '../fileSystem.js'

// Every node under `node` with the folder it sits in, as Windows writes it ("C:\My Documents").
function* walk(node, path) {
  for (const child of node.children ?? []) {
    if (child.type === 'error') continue
    yield { node: child, folder: path === 'C:' ? 'C:\\' : path || 'My Computer' }
    if (child.type === 'folder') yield* walk(child, child.id === 'drive-c' ? 'C:' : `${path}\\${child.name}`)
  }
}

// Start → Find → Files or Folders. Matches names and, unless switched off, what the files say,
// so "Terraform" finds the departments that used it.
export default function Find({ win }) {
  const { api } = useWin95()
  const places = [
    { label: 'My Computer', node: api.fs.myComputer, path: '' },
    { label: 'My Documents', node: api.fs.myDocuments, path: 'C:\\My Documents' },
  ]
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState(0)
  const [contents, setContents] = useState(true)
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState(null)

  const find = (event) => {
    event?.preventDefault()
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const { node, path } = places[place]
    const matches = (hit) => {
      const name = hit.node.name.toLowerCase()
      const text = contents ? (hit.node.text ?? '').toLowerCase() : ''
      return words.every((word) => name.includes(word) || text.includes(word))
    }
    setSelected(null)
    setResults([...walk(node, path)].filter(matches))
  }

  const reset = () => {
    setQuery('')
    setResults(null)
    setSelected(null)
  }

  const current = results?.find((hit) => hit.node.id === selected)?.node
  const menus = [
    {
      label: '&File',
      items: [{ label: '&Open', disabled: !current, onSelect: () => api.openNode(current) }, '-', { label: '&Close', onSelect: () => api.close(win.id) }],
    },
    {
      label: '&Options',
      items: [{ label: 'Search file &contents', checked: contents, onSelect: () => setContents((on) => !on) }],
    },
    {
      label: '&Help',
      items: [{ label: '&Help Topics', onSelect: () => api.run('help') }, '-', { label: '&About Windows 95', onSelect: () => api.about() }],
    },
  ]

  return (
    <div className="w95-app w95-find">
      <MenuBar menus={menus} />
      <form className="w95-find__form" onSubmit={find}>
        <div className="w95-find__search">
          <div className="w95-tabs" role="tablist">
            <span role="tab" aria-selected="true" className="w95-tab is-selected">
              Name &amp; Location
            </span>
          </div>
          <div className="w95-tabpanel w95-find__fields">
            <label htmlFor={`find-named-${win.id}`}>
              <AccessKey label="&Named:" />
            </label>
            <input
              id={`find-named-${win.id}`}
              className="w95-input"
              value={query}
              placeholder="e.g. Terraform, Cyber Security"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label htmlFor={`find-in-${win.id}`}>
              <AccessKey label="&Look in:" />
            </label>
            <select id={`find-in-${win.id}`} className="w95-input" value={place} onChange={(event) => setPlace(Number(event.target.value))}>
              {places.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
            <label className="w95-check">
              <input type="checkbox" checked={contents} onChange={(event) => setContents(event.target.checked)} />
              <span>
                <AccessKey label="Search file &contents too" />
              </span>
            </label>
          </div>
        </div>
        <div className="w95-find__buttons">
          <button type="submit" className="w95-button is-default" disabled={!query.trim()}>
            <AccessKey label="F&ind Now" />
          </button>
          <button type="button" className="w95-button" disabled>
            <AccessKey label="Sto&p" />
          </button>
          <button type="button" className="w95-button" onClick={reset}>
            <AccessKey label="Ne&w Search" />
          </button>
        </div>
      </form>
      {results && (
        <div className="w95-well w95-find__results">
          <table className="w95-details">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">In Folder</th>
                <th scope="col">Size</th>
                <th scope="col">Type</th>
                <th scope="col">Modified</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ node, folder }) => {
                const size = sizeOf(node)
                return (
                  <tr key={`${folder}\\${node.id}`}>
                    <td>
                      <DesktopIcon node={node} small selected={selected === node.id} onSelect={setSelected} onOpen={api.openNode} />
                    </td>
                    <td>{folder}</td>
                    <td className="is-number">{size === null ? '' : formatSize(size)}</td>
                    <td>{kindOf(node)}</td>
                    <td>{MODIFIED}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="w95-statusbar">
        <span className="w95-statusbar__field">{results ? `${results.length} file(s) found` : 'Type a name or a word, then click Find Now.'}</span>
        <span className="w95-statusbar__field" />
      </div>
    </div>
  )
}
