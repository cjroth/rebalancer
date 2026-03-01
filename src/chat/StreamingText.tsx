import { Box, Text } from 'ink'

interface StreamingTextProps {
  text: string
  cursorChar?: string
}

export function StreamingText({ text, cursorChar = '_' }: StreamingTextProps) {
  if (!text) return null

  return (
    <Box>
      <Text>
        <Text bold color="blue">{'< '}</Text>
        <Text wrap="wrap">{text}</Text>
        <Text dimColor>{cursorChar}</Text>
      </Text>
    </Box>
  )
}
