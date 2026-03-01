import { Box, Text, Static, useInput, useApp } from 'ink'
import type { ReactNode } from 'react'
import type { ChatMessage, ToolCall } from './types.ts'
import { MessageBubble } from './MessageBubble.tsx'
import { StreamingText } from './StreamingText.tsx'
import { ToolCallCard } from './ToolCallCard.tsx'
import { ChatInput } from './ChatInput.tsx'

interface ChatViewProps {
  messages: ChatMessage[]
  streamingText?: string
  isLoading?: boolean
  activeToolCalls?: ToolCall[]
  onSendMessage: (text: string) => void
  onCancel?: () => void
  /** Render custom content at a specific position in the message flow */
  renderInterstitial?: (afterMessageIndex: number) => ReactNode | null
  /** Whether to handle Escape key internally (default: true). Set to false when parent handles Escape. */
  handleEscape?: boolean
  /** Custom status bar text. If not provided, shows "Esc: quit" */
  statusBarText?: string
  /** Use Static for messages (default: true). Set false for modal usage to avoid scrollback persistence. */
  staticMessages?: boolean
  /** Hide the bottom status bar text (default: false). Use when parent renders its own status bar. */
  hideStatusBar?: boolean
}

export function ChatView({
  messages,
  streamingText = '',
  isLoading = false,
  activeToolCalls = [],
  onSendMessage,
  onCancel,
  renderInterstitial,
  handleEscape = true,
  statusBarText,
  staticMessages = true,
  hideStatusBar = false,
}: ChatViewProps) {
  const { exit } = useApp()

  useInput((_input, key) => {
    if (key.escape && handleEscape) {
      onCancel?.()
      exit()
      process.exit(0)
    }
  })

  // Build the list of static items: messages with optional interstitials
  const staticItems: Array<{
    id: string
    type: 'message' | 'interstitial'
    message?: ChatMessage
    afterIndex?: number
  }> = []

  for (let i = 0; i < messages.length; i++) {
    staticItems.push({
      id: `msg-${messages[i]!.id}`,
      type: 'message',
      message: messages[i]!,
    })

    if (renderInterstitial) {
      const interstitial = renderInterstitial(i)
      if (interstitial) {
        staticItems.push({
          id: `interstitial-${i}`,
          type: 'interstitial',
          afterIndex: i,
        })
      }
    }
  }

  const isInputDisabled = isLoading || !!streamingText

  return (
    <Box flexDirection="column" paddingX={1}>
      {staticMessages ? (
        <Static items={staticItems}>
          {(item) => {
            if (item.type === 'message' && item.message) {
              return (
                <Box key={item.id}>
                  <MessageBubble message={item.message} />
                </Box>
              )
            }
            if (item.type === 'interstitial' && renderInterstitial) {
              return (
                <Box key={item.id}>
                  {renderInterstitial(item.afterIndex!)}
                </Box>
              )
            }
            return <Box key={item.id} />
          }}
        </Static>
      ) : (
        <Box flexDirection="column">
          {staticItems.map((item) => {
            if (item.type === 'message' && item.message) {
              return (
                <Box key={item.id}>
                  <MessageBubble message={item.message} />
                </Box>
              )
            }
            if (item.type === 'interstitial' && renderInterstitial) {
              return (
                <Box key={item.id}>
                  {renderInterstitial(item.afterIndex!)}
                </Box>
              )
            }
            return <Box key={item.id} />
          })}
        </Box>
      )}

      {activeToolCalls.length > 0 && (
        <Box flexDirection="column" marginY={0}>
          {activeToolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </Box>
      )}

      {streamingText ? (
        <StreamingText text={streamingText} />
      ) : isLoading ? (
        <Box>
          <Text dimColor>  Thinking...</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <ChatInput
          onSubmit={onSendMessage}
          disabled={isInputDisabled}
        />
      </Box>

      {!hideStatusBar && (
        <Box>
          <Text dimColor>  {statusBarText ?? 'Esc: quit'}</Text>
        </Box>
      )}
    </Box>
  )
}
