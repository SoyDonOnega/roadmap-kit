import type { ClientModule } from 'claude-code'

import type { SectionProps } from '../types'

// Underlined no-break spaces, cut at the region's edge by their one-row Box: the thin line a
// Client can draw on desktop, where a bordered Box is a rounded box one row high.
const RULE = ' '.repeat(300)

// A section heading as one region: bold title at heading size, a thin dim rule under it,
// pulled up `pull` rows toward the title.
// A press anywhere on it folds or unfolds the section.
const Section: ClientModule<SectionProps> = (head, surface) => {
  const { Box, Text } = surface.elements

  surface.onPointer(e => {
    if (e.type === 'down' && e.button === 'left') surface.post({ press: 'fold' })
  })

  return (
    <Box flexDirection="column">
      <Text size="heading" bold>
        {head.title}
      </Text>
      <Box width="100%" height={1} overflow="hidden" marginTop={-head.pull}>
        <Text size="caption" underline dimColor>
          {RULE}
        </Text>
      </Box>
    </Box>
  )
}

export default Section
