/**
 * Chat Modal — full-screen overlay with bordered chat view.
 * Renders ChatView inside a bordered box. Escape closes the modal.
 */
import { Box, Text, useInput } from 'ink'
import { ChatView } from './ChatView.tsx'
import { StatusBar } from '../components/status-bar.tsx'
import type { ChatMessage, ToolCall } from './types.ts'

interface ChatModalProps {
  messages: ChatMessage[]
  streamingText: string
  isLoading: boolean
  activeToolCalls: ToolCall[]
  onSendMessage: (text: string) => void
  onClose: () => void
}

export function ChatModal({
  messages,
  streamingText,
  isLoading,
  activeToolCalls,
  onSendMessage,
  onClose,
}: ChatModalProps) {
  useInput((_input, key) => {
    if (key.escape) {
      onClose()
    }
  })

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="round"
        borderColor="blue"
      >
        <Box paddingX={1} marginBottom={0}>
          <Text bold color="blue">AI Chat</Text>
        </Box>
        <ChatView
          messages={messages}
          streamingText={streamingText}
          isLoading={isLoading}
          activeToolCalls={activeToolCalls}
          onSendMessage={onSendMessage}
          handleEscape={false}
          staticMessages={false}
          hideStatusBar
        />
      </Box>
      <StatusBar
        items={[
          { key: 'Esc', label: 'back to wizard' },
        ]}
      />
    </Box>
  )
}
