// The desktop's icon grid. Every icon sits in a cell { col, row }; dragged icons keep the cell
// they were dropped on, the rest fill the grid column by column, each group from a new column.

export const CELL = 75 // an icon's width and height, as in Windows 95
export const GRID_INSET = 2

export const gridSize = ({ width, height }) => ({
  cols: Math.max(1, Math.floor((width - GRID_INSET) / CELL)),
  rows: Math.max(1, Math.floor((height - GRID_INSET) / CELL)),
})

const keyOf = ({ col, row }) => `${col},${row}`

// Where each icon goes: { [id]: { col, row } }. Placed cells that no longer fit (the screen
// got smaller) or collide are given up and filled like the rest.
export function layoutIcons(groups, placed, { cols, rows }) {
  const cells = {}
  const taken = new Set()
  const claim = (id, cell) => {
    cells[id] = cell
    taken.add(keyOf(cell))
  }

  for (const node of groups.flat()) {
    const cell = placed[node.id]
    if (cell && cell.col < cols && cell.row < rows && !taken.has(keyOf(cell))) claim(node.id, cell)
  }

  const cursor = { col: 0, row: 0 }
  const advance = () => {
    cursor.row += 1
    if (cursor.row >= rows) Object.assign(cursor, { col: cursor.col + 1, row: 0 })
  }
  for (const group of groups) {
    const open = group.filter((node) => !cells[node.id])
    if (!open.length) continue
    if (cursor.row > 0) Object.assign(cursor, { col: cursor.col + 1, row: 0 })
    for (const node of open) {
      while (taken.has(keyOf(cursor))) advance()
      claim(node.id, { ...cursor })
      advance()
    }
  }
  return cells
}

// The free cell closest to where an icon was dropped (the drop cell itself when it's free).
export function nearestFreeCell(cells, id, target, { cols, rows }) {
  const want = { col: Math.min(cols - 1, Math.max(0, target.col)), row: Math.min(rows - 1, Math.max(0, target.row)) }
  const taken = new Set(Object.entries(cells).filter(([other]) => other !== id).map(([, cell]) => keyOf(cell)))
  let best = null
  let bestDistance = Infinity
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (taken.has(`${col},${row}`)) continue
      const distance = (col - want.col) ** 2 + (row - want.row) ** 2
      if (distance < bestDistance) [best, bestDistance] = [{ col, row }, distance]
    }
  }
  return best ?? cells[id]
}
