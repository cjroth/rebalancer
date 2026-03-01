import { useState } from 'react'
import { Box, Text, useInput } from 'ink'

interface ChatInputProps {
  onSubmit: (text: string) => void
  placeholder?: string
  prompt?: string
  promptColor?: string
  disabled?: boolean
}

export function ChatInput({
  onSubmit,
  placeholder = 'Type a message...',
  prompt = '> ',
  promptColor = 'green',
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState('')

  useInput(
    (input, key) => {
      if (disabled) return

      if (key.return) {
        const trimmed = value.trim()
        if (trimmed) {
          onSubmit(trimmed)
          setValue('')
        }
        return
      }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1))
        return
      }

      if (!key.ctrl && !key.meta && input) {
        setValue((prev) => prev + input)
      }
    },
  )

  return (
    <Box>
      <Text color={promptColor}>{prompt}</Text>
      {value ? (
        <Text>
          {value}
          {!disabled && <Text inverse> </Text>}
        </Text>
      ) : (
        <>
          <Text dimColor>{placeholder}</Text>
          {!disabled && <Text inverse> </Text>}
        </>
      )}
    </Box>
  )
}
