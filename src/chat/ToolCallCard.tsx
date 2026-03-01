import { Box, Text } from 'ink'
import type { ToolCall } from './types.ts'

interface ToolCallCardProps {
  toolCall: ToolCall
}

const STATUS_ICONS: Record<ToolCall['status'], string> = {
  calling: '\u280B',
  complete: '\u2713',
  error: '\u2717',
}

const STATUS_COLORS: Record<ToolCall['status'], string> = {
  calling: 'yellow',
  complete: 'green',
  error: 'red',
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const icon = STATUS_ICONS[toolCall.status]
  const color = STATUS_COLORS[toolCall.status]

  return (
    <Box paddingLeft={2}>
      <Text color={color}>
        {icon} {toolCall.name}
      </Text>
      {toolCall.status === 'calling' && (
        <Text dimColor> ...</Text>
      )}
    </Box>
  )
}
