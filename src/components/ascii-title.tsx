import { Text } from 'ink'

const TITLE_ART = `             _           _
  _ __ ___  | |__   __ _| | __ _ _ __   ___ ___
 | '__/ _ \\ | '_ \\ / _\` | |/ _\` | '_ \\ / __/ _ \\
 | | |  __/ | |_) | (_| | | (_| | | | | (_|  __/
 |_|  \\___| |_.__/ \\__,_|_|\\__,_|_| |_|\\___\\___|
            c a l c u l a t o r`

export function AsciiTitle() {
  return <Text color="cyan">{TITLE_ART}</Text>
}
