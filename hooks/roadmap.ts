import type { RoadmapItem, RoadmapSection } from '../types'

const DONE = 'Done'

const cells = (line: string) => line.split('|').slice(1, -1).map(c => c.trim())
const isRow = (line: string) => line.startsWith('|')
const isSeparator = (line: string) => /^\|[\s\-:|]+\|$/.test(line)
const isHeader = (line: string) => cells(line)[0] === '#' || cells(line)[0] === 'Date'

// The base table is `| # | Task | Description |`; any other column (owner, date, id...) is
// ignored. Task and Description are found by name, else the second and the last column.
type Columns = { task: number; description: number }
const BASE: Columns = { task: 1, description: -1 }
const columnsOf = (header: string[]): Columns => {
  const names = header.map(h => h.toLowerCase())
  const task = names.findIndex(h => h === 'task' || h === 'item')
  const description = names.findIndex(h => h === 'description' || h === 'next step')
  return { task: task < 0 ? 1 : task, description: description < 0 ? -1 : description }
}
const itemOf = (c: string[], cols: Columns): RoadmapItem => ({
  n: c[0] ?? '',
  item: c[cols.task] ?? '',
  next: c.at(cols.description) ?? '',
})

// Open sections in file order; Done is left out.
export const parse = (md: string) => {
  const sections: RoadmapSection[] = []
  let current: RoadmapSection | null = null
  let cols = BASE

  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim()
      current = title === DONE ? null : { title, items: [] }
      if (current) sections.push(current)
      cols = BASE
      continue
    }
    if (!current || !isRow(line) || isSeparator(line)) continue
    if (isHeader(line)) cols = columnsOf(cells(line))
    else current.items.push(itemOf(cells(line), cols))
  }

  return { sections }
}

// Removes item `n` from its open section and adds it on top of the Done table.
export const markDone = (md: string, n: string, date: string): string => {
  const lines = md.split('\n')
  let section = ''
  let at = -1
  let item: RoadmapItem | undefined
  let cols = BASE

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      section = line.slice(3).trim()
      cols = BASE
    } else if (isRow(line) && isHeader(line)) cols = columnsOf(cells(line))
    else if (at < 0 && section !== DONE && isRow(line) && !isSeparator(line) && cells(line)[0] === n) {
      at = i
      item = itemOf(cells(line), cols)
    }
  })
  if (at < 0 || !item) throw new Error(`#${n} is not an open item`)

  lines.splice(at, 1)
  const done = lines.findIndex(l => l.trim() === `## ${DONE}`)
  if (done < 0) throw new Error('no Done section')
  const separator = lines.findIndex((l, i) => i > done && isSeparator(l.trim()))
  if (separator < 0) throw new Error('no Done table')
  lines.splice(separator + 1, 0, `| ${date} | #${n} ${item.item} |`)

  return lines.join('\n')
}

// Item `n`'s row as written, and the number of the row above it in its table (null when first).
export const rowOf = (md: string, n: string): { line: string; after: string | null } => {
  let after: string | null = null
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('## ')) after = null
    else if (isRow(line) && !isSeparator(line) && !isHeader(line)) {
      if (cells(line)[0] === n) return { line: raw, after }
      after = cells(line)[0] ?? null
    }
  }
  throw new Error(`#${n} is not an open item`)
}

// Undoes markDone: drops item `n`'s Done row and puts `line` back below row `after` of `section`.
export const unmarkDone = (md: string, n: string, section: string, line: string, after: string | null): string => {
  const lines = md.split('\n')
  const done = lines.findIndex(l => l.trim() === `## ${DONE}`)
  const row = lines.findIndex((l, i) => i > done && isRow(l.trim()) && (cells(l.trim())[1] ?? '').startsWith(`#${n} `))
  if (done < 0 || row < 0) throw new Error(`#${n} is not in Done`)
  lines.splice(row, 1)

  const head = lines.findIndex(l => l.trim() === `## ${section}`)
  if (head < 0) throw new Error(`no ${section} section`)
  // Row `after` may have left the table since; the row then goes first.
  const below = after === null ? -1 : lines.findIndex((l, i) => i > head && isRow(l.trim()) && cells(l.trim())[0] === after)
  const anchor = below >= 0 ? below : lines.findIndex((l, i) => i > head && isSeparator(l.trim()))
  if (anchor < 0) throw new Error(`no place for #${n} in ${section}`)
  lines.splice(anchor + 1, 0, line)

  return lines.join('\n')
}
