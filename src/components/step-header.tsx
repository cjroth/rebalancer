import { Box, Text } from 'ink'

interface StepHeaderProps {
  step: number
  totalSteps: number
  title: string
  description: string
}

const INNER_WIDTH = 54

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current && current.length + 1 + word.length > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = current ? current + ' ' + word : word
    }
  }
  if (current) lines.push(current)
  return lines
}

export function StepHeader({ step, totalSteps, title, description }: StepHeaderProps) {
  const stepLabel = ` Step ${step} of ${totalSteps} `
  const topAfter = '─'.repeat(INNER_WIDTH - stepLabel.length - 1)
  const bottom = '─'.repeat(INNER_WIDTH)
  const pad = ' '.repeat(INNER_WIDTH)
  const descLines = wrapText(description, INNER_WIDTH - 4)

  return (
    <Box flexDirection="column">
      <Text>
        {'╭─'}
        <Text color="cyan" bold>{stepLabel}</Text>
        {topAfter}
        {'╮'}
      </Text>
      <Text>{'│' + pad + '│'}</Text>
      <Text>{'│  '}<Text bold>{title}</Text>{' '.repeat(INNER_WIDTH - 2 - title.length)}{'│'}</Text>
      {descLines.map((line, i) => (
        <Text key={i}>{'│  '}<Text dimColor>{line}</Text>{' '.repeat(INNER_WIDTH - 2 - line.length)}{'│'}</Text>
      ))}
      <Text>{'│' + pad + '│'}</Text>
      <Text>{'╰' + bottom + '╯'}</Text>
    </Box>
  )
}
