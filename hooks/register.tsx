import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Roadmap } from '../types'
import { markDone, parse, rowOf, unmarkDone } from './roadmap'

const PANE = 'roadmap'
const POLL_MS = 30_000

const roadmap = atom({ plugin: 'roadmap-kit', key: 'roadmap' } as const, null, { shape: 'roadmap-2' })
const open = atom({ plugin: 'roadmap-kit', key: 'open' } as const, null)
// Rows written to Done and still drawn, struck, until the next read of the file.
const struck = atom({ plugin: 'roadmap-kit', key: 'struck' } as const, [])
const folded = atom({ plugin: 'roadmap-kit', key: 'folded' } as const, [])

const pad = (x: number) => String(x).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const plain = (s: string) => s.replace(/`/g, '').replace(/\*\*/g, '')

// The `roadmapPath` option, with a leading ~ expanded.
let configured = ''
const roadmapPath = async ($: EngineInterface) =>
  configured.startsWith('~/') ? `${await $.env.get('HOME')}${configured.slice(1)}` : configured

// macOS sync folders (~/Library/CloudStorage/<Provider>-<account>/) and the app that keeps
// each in sync. Writing to one while its app is closed lands in a stale cache.
const SYNC_APPS: [string, string][] = [
  ['/Library/CloudStorage/GoogleDrive-', 'Google Drive'],
  ['/Library/CloudStorage/OneDrive', 'OneDrive'],
  ['/Library/CloudStorage/Dropbox', 'Dropbox'],
  ['/Library/CloudStorage/Box-', 'Box'],
]
const closedSyncApp = async ($: EngineInterface, file: string) => {
  const app = SYNC_APPS.find(([folder]) => file.includes(folder))?.[1]
  if (!app) return undefined
  const run = await $.process.run(['pgrep', '-x', app])
  return run.exitCode === 0 ? undefined : app
}

// Re-reads the file only when its mtime moved, unless forced.
const refresh = async ($: EngineInterface, force = false) => {
  try {
    const PATH = await roadmapPath($)
    const { mtimeMs } = await $.fs.stat(PATH)
    const current = await read($, roadmap)
    if (!force && current && !current.error && current.mtimeMs === mtimeMs) return
    const text = await $.fs.read(PATH)
    const next: Roadmap = { ...parse(text), mtimeMs }
    await update($, roadmap, () => next)
    await update($, struck, () => [])
  } catch {
    const error = configured
      ? `Cannot read ${configured}. Check the path, and that its sync app is running.`
      : 'No roadmap file set: give the roadmap-kit option roadmapPath (claude plugin configure roadmap-kit@roadmap-kit).'
    const failed: Roadmap = { sections: [], mtimeMs: 0, error }
    await update($, roadmap, () => failed)
  }
}

// Marks item `n` done, or undoes it while its row is still drawn struck.
const toggleDone = async ($: EngineInterface, n: string, section: string) => {
  try {
    const PATH = await roadmapPath($)
    const closed = await closedSyncApp($, PATH)
    if (closed) {
      $.ui.toast(`${closed} is not running: nothing changed`)
      return
    }
    const text = await $.fs.read(PATH)
    const was = (await read($, struck)).find(x => x.n === n)
    if (was) {
      await $.fs.write(PATH, unmarkDone(text, n, was.section, was.line, was.after))
      await update($, struck, cur => cur.filter(x => x.n !== n))
    } else {
      const row = rowOf(text, n)
      await $.fs.write(PATH, markDone(text, n, today()))
      await update($, struck, cur => [...cur, { n, section, ...row }])
    }
  } catch (err) {
    $.ui.toast(`roadmap-kit: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export const register: Register = (on, options) => {
  configured = String(options.roadmapPath ?? '').trim()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'roadmap', description: 'Show or hide the Roadmap.md pane' })
    await refresh($)
    $.clock.every(POLL_MS, () => void refresh($))

    return next(e)
  })

  on('command.run', { command: 'roadmap' }, async $ => {
    const panes = await $.ui.panes()
    if (panes.some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: 'Roadmap pane closed.' }
    }
    await refresh($, true)
    await $.ui.open({ id: PANE, title: 'Roadmap' })

    return { text: 'Roadmap pane opened.' }
  })

  // Presses posted by the surface modules: a heading folds its section; on a row,
  // the circle marks done and the rest opens it.
  on('ui.message', async ($, e, next) => {
    const press = (e.data as { press?: string } | null)?.press
    if (e.requestId !== PANE || !press) return next(e)
    if (e.element.startsWith('head-')) {
      const title = e.element.slice(5)
      await update($, folded, cur => (cur.includes(title) ? cur.filter(t => t !== title) : [...cur, title]))
      return {}
    }
    if (!e.element.startsWith('row-')) return next(e)
    const n = e.element.slice(4)
    if (press === 'circle') {
      const section = (await read($, roadmap))?.sections.find(s => s.items.some(it => it.n === n))
      if (section) await toggleDone($, n, section.title)
    } else {
      await update($, open, cur => (cur === n ? null : n))
    }
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button, Markdown } = elements
    // Only these two surfaces draw a Client (the vscode table lists none, mobile neither).
    const Client = e.surface === 'terminal' || e.surface === 'desktop' ? $.ui.resolve(e).Client : undefined
    const data = await read($, roadmap)
    const opened = await read($, open)
    const shut = await read($, folded)
    const gone = await read($, struck)

    if (!data) return <Text dimColor>Reading Roadmap.md…</Text>
    if (data.error) return <Text>{data.error}</Text>

    // Desktop: two rows between sections and the rule pulled up to the title, so each
    // heading reads with its own rows. The terminal's whole cells would put the rule on the title.
    const isDesktop = e.surface === 'desktop'

    return (
      <Box flexDirection="column" gap={isDesktop ? 2 : 1}>
        {data.sections.map(s => {
          const isShut = shut.includes(s.title)
          return (
            <Box flexDirection="column">
              {/* With a Client, the heading's rule already spaces the rows from the title. */}
              <Box marginBottom={Client ? 0 : 1}>
                {Client ? (
                  // The heading module takes its press itself, so the title keeps its heading size and weight.
                  <Client
                    key={`head-${s.title}`}
                    module="./section.tsx"
                    width="100%"
                    props={{ title: s.title, pull: isDesktop ? 0.6 : 0 }}
                  />
                ) : (
                  // No Client on this surface: the title is the fold Button, drawn at the Button's own size.
                  <Button
                    key={`section-${s.title}`}
                    plain
                    onPress={() =>
                      update($, folded, cur => (cur.includes(s.title) ? cur.filter(t => t !== s.title) : [...cur, s.title]))
                    }
                  >
                    <Text bold>{s.title}</Text>
                  </Button>
                )}
              </Box>
              {!isShut &&
                s.items.map(it => {
                  const isDone = gone.some(x => x.n === it.n)
                  const toggleOpen = () => update($, open, cur => (cur === it.n ? null : it.n))
                  return (
                    <Box flexDirection="column">
                      {Client ? (
                        // The row module takes its presses itself (ui.message below), so the title can wrap.
                        <Client
                          key={`row-${it.n}`}
                          module="./row.tsx"
                          width="100%"
                          props={{ n: it.n, title: plain(it.item), isDone }}
                        />
                      ) : (
                        // No Client on this surface: a Button is one line, so the title is cut until opened.
                        <Box flexDirection="row" gap={0}>
                          <Button key={`circle-${it.n}`} plain onPress={() => toggleDone($, it.n, s.title)}>
                            {isDone ? '●' : '○'}
                          </Button>
                          <Button key={`item-${it.n}`} plain onPress={toggleOpen}>
                            <Text dimColor>{it.n}</Text> <Text strikethrough={isDone}>{plain(it.item)}</Text>
                          </Button>
                        </Box>
                      )}
                      {opened === it.n && (
                        <Box paddingLeft={7} paddingY={1}>
                          <Markdown text={it.next} />
                        </Box>
                      )}
                    </Box>
                  )
                })}
            </Box>
          )
        })}
      </Box>
    )
  })
}
