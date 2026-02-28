import { Box, Text, useInput, useApp, Static } from 'ink'
import { TextInput } from '../components/text-input'
import { Spinner } from '../components/spinner'
import { sendUserMessage } from './bridge.ts'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface ChatViewProps {
  messages: ChatMessage[]
  streamingText: string
  isWaiting: boolean
  onUserMessage: (text: string) => void
}

export function ChatView({ messages, streamingText, isWaiting, onUserMessage }: ChatViewProps) {
  const { exit } = useApp()

  useInput((_input, key) => {
    if (key.escape) {
      exit()
      process.exit(0)
    }
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Static items={messages.map((msg, i) => ({ ...msg, id: i }))}>
        {(item) => (
          <Box key={item.id}>
            {item.role === 'user' ? (
              <Text>
                <Text bold color="green">{"> "}</Text>
                <Text>{item.text}</Text>
              </Text>
            ) : (
              <Text>
                <Text bold color="blue">{"< "}</Text>
                <Text>{item.text}</Text>
              </Text>
            )}
          </Box>
        )}
      </Static>

      {streamingText ? (
        <Box>
          <Text>
            <Text bold color="blue">{"< "}</Text>
            <Text>{streamingText}</Text>
            <Text dimColor>{"_"}</Text>
          </Text>
        </Box>
      ) : isWaiting ? (
        <Box>
          <Text>{"  "}</Text>
          <Spinner text="Thinking..." />
        </Box>
      ) : null}

      <Box marginTop={1}>
        <TextInput
          prompt="> "
          promptColor="green"
          focus={!isWaiting}
          onSubmit={(text) => {
            onUserMessage(text)
            sendUserMessage(text)
          }}
        />
      </Box>

      <Box>
        <Text dimColor>{"  Esc: quit"}</Text>
      </Box>
    </Box>
  )
}
