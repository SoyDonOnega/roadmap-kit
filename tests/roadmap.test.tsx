import { expect, test } from 'claude-code/testing'

import { markDone, parse, rowOf, unmarkDone } from '../hooks/roadmap'

const MD = `# Roadmap

## Next session

Nothing for now (cleared 2026-10-27).

## Stack setup

| #   | Task | Description |
| --- | ---- | ----------- |
| 33  | Product trial | 7-day free trial, \`example.com\`. |
| 43  | Invoice data check | Ask **the accountant**. |

## Done

| Date | Task |
|---|---|
| 2026-11-01 | #41 Phone number set. |
| 2026-10-31 | Invoices tool live. |
`

// The option a person sets at install; these tests seed the state, so the file is never read.
const OPTS = { options: { roadmapPath: '~/Roadmap.md' } }

const PANE = {
  plugin: 'roadmap-kit',
  component: 'Pane',
  requestId: 'roadmap',
  props: {
    title: 'Roadmap',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('parse keeps open sections and leaves Done out', async () => {
  const r = parse(MD)
  expect(r.sections.map(s => s.title)).toEqual(['Next session', 'Stack setup'])
  expect(r.sections[0]?.items).toEqual([])
  expect(r.sections[1]?.items.map(i => i.n)).toEqual(['33', '43'])
  expect(r.sections[1]?.items[1]?.next).toBe('Ask **the accountant**.')
})

test('columns added to the base table are ignored, wherever they sit', async () => {
  const md = `## Later

| # | Owner | Task | Added | Description | ID |
|---|---|---|---|---|---|
| 7 | Ana | Try the beta | 2026-11-01 | Ask for an invite. | X-7 |

## Done

| Date | Task |
|---|---|
`
  expect(parse(md).sections[0]?.items).toEqual([{ n: '7', item: 'Try the beta', next: 'Ask for an invite.' }])
  expect(markDone(md, '7', '2026-11-02')).toContain('| 2026-11-02 | #7 Try the beta |')
})

test('markDone moves the row to the top of Done', async () => {
  const out = markDone(MD, '33', '2026-11-02')
  const r = parse(out)
  expect(r.sections[1]?.items.map(i => i.n)).toEqual(['43'])
  expect(out).toContain('|---|---|\n| 2026-11-02 | #33 Product trial |\n| 2026-11-01 |')
})

test('unmarkDone puts the row back where it was and drops its Done row', async () => {
  const { line, after } = rowOf(MD, '43')
  expect(after).toBe('33')
  const out = markDone(MD, '43', '2026-11-02')
  expect(unmarkDone(out, '43', 'Stack setup', line, after)).toBe(MD)
})

test('unmarkDone puts the row first when the row above has left', async () => {
  const { line, after } = rowOf(MD, '43')
  const out = markDone(markDone(MD, '43', '2026-11-02'), '33', '2026-11-02')
  const r = parse(unmarkDone(out, '43', 'Stack setup', line, after))
  expect(r.sections[1]?.items.map(i => i.n)).toEqual(['43'])
})

test('markDone refuses an unknown item', async () => {
  expect(() => markDone(MD, '99', '2026-11-02')).toThrow()
})

const seed = (on: Parameters<Parameters<typeof test>[1]>[1]) =>
  on('state.get', (_, e) =>
    e.key === 'roadmap'
      ? { value: { value: { shape: 'roadmap-2', value: { ...parse(MD), mtimeMs: 1 } }, version: 1 } }
      : { value: { value: e.key === 'folded' || e.key === 'struck' ? [] : null, version: 1 } },
  )

test('the pane draws each section and one row region per item, on terminal and desktop', OPTS, async ($, on) => {
  seed(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'head-Stack setup' })).toBeDefined()
    expect(await ui.find({ key: 'row-33' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Done:|Nothing for now/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('a press on the row, not the circle, opens the item', OPTS, async ($, on) => {
  seed(on)
  const writes: [string, unknown][] = []
  on('state.set', (_, e) => {
    writes.push([e.key, e.value])
    return { value: { isSet: true, version: 2 } }
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: 'row-43' })
  expect(writes).toContainEqual(['open', '43'])
  await ui.unmount()
})

test('a heading draws its title and an underlined rule, no item count', OPTS, async ($, on) => {
  seed(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Stack setup$/, in: 'head-Stack setup' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ +$/, in: 'head-Stack setup' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\d+$/, in: 'head-Stack setup' })).toBeUndefined()
  await ui.unmount()
})

test('a press on a heading folds its section', OPTS, async ($, on) => {
  seed(on)
  const writes: [string, unknown][] = []
  on('state.set', (_, e) => {
    writes.push([e.key, e.value])
    return { value: { isSet: true, version: 2 } }
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'head-Stack setup' })
  expect(writes).toContainEqual(['folded', ['Stack setup']])
  await ui.unmount()
})

test('without Client (vscode) each item falls back to a circle and a row Button', OPTS, async ($, on) => {
  seed(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  expect(await ui.find({ key: 'section-Stack setup' })).toBeDefined()
  expect(await ui.find({ key: 'circle-33' })).toBeDefined()
  expect(await ui.find({ key: 'item-33' })).toBeDefined()
  await ui.unmount()
})
