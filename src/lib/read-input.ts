import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { parsePortfolioCsv, detectFormat } from './csv'
import type { RebalanceInput } from './types'

export async function readInput(): Promise<RebalanceInput> {
  let text: string

  const fileArg = process.argv[2]
  if (fileArg) {
    text = await readFile(fileArg, 'utf-8')
  } else {
    const lines: string[] = []
    const rl = createInterface({ input: process.stdin })
    for await (const line of rl) {
      lines.push(line)
    }
    text = lines.join('\n')
  }

  if (detectFormat(text) === 'csv') {
    return parsePortfolioCsv(text)
  }
  return JSON.parse(text)
}
