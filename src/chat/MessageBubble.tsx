import { Box, Text } from 'ink'
import type { ChatMessage } from './types.ts'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <Box>
      <Text>
        <Text bold color={isUser ? 'green' : 'blue'}>
          {isUser ? '> ' : '< '}
        </Text>
        <Text wrap="wrap">{message.content}</Text>
      </Text>
    </Box>
  )
}
