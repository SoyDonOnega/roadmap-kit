export type RoadmapItem = { n: string; item: string; next: string }
export type RoadmapSection = { title: string; items: RoadmapItem[] }
// What the row surface module draws for one item.
export type RowProps = { n: string; title: string; isDone: boolean }
// What the section surface module draws for one heading.
export type SectionProps = { title: string; pull: number }
export type Struck = { n: string; section: string; line: string; after: string | null }
export type Roadmap = {
  sections: RoadmapSection[]
  mtimeMs: number
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'roadmap-kit': {
      roadmap: Shaped<Roadmap | null>
      open: string | null
      struck: Struck[]
      folded: string[]
    }
  }
}
