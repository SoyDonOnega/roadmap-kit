import type { ClientModule } from 'claude-code'

import type { RowProps } from '../types'

// One item as one region: circle, number and wrapped title. A press on the circle's
// columns marks the item done; anywhere else opens its next step.
const Row: ClientModule<RowProps> = (row, surface) => {
  const { Box, Text } = surface.elements

  surface.onPointer(e => {
    if (e.type === 'down' && e.button === 'left') surface.post({ press: e.x < 3 ? 'circle' : 'row' })
  })

  return (
    <Box flexDirection="row">
      {/* flexShrink 0: a long title would otherwise squeeze these columns and break the alignment. */}
      <Box width={3} flexShrink={0}>
        <Text>{row.isDone ? '●' : '○'}</Text>
      </Box>
      <Box width={4} flexShrink={0}>
        <Text dimColor>{row.n}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1}>
        <Text wrap="wrap" strikethrough={row.isDone} dimColor={row.isDone}>
          {row.title}
        </Text>
      </Box>
    </Box>
  )
}

export default Row
