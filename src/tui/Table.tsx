import { Box, Text } from 'ink'
import { Table as DataTable } from '../components/table'
import type { Column, Cell } from '../components/table'
import type { TableData } from '../lib/types.ts'
import type { DisplayMode } from './App.tsx'

interface TableProps {
  tableData: TableData
  grandTotal: number
  displayMode?: DisplayMode
}

function formatUSD(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatK(amount: number): string {
  return '$' + Math.round(amount / 1000) + 'k'
}

function fmtPct(value: number, grandTotal: number): string {
  return ((value / grandTotal) * 100).toFixed(1) + '%'
}

export function Table({ tableData, grandTotal, displayMode = '$k' }: TableProps) {
  const showDollar = displayMode === '$' || displayMode === '$k' || displayMode === 'Both'
  const showPct = displayMode === '%' || displayMode === 'Both'
  const fmtDollar = displayMode === '$k' ? formatK : formatUSD
  const { rows, cols, cells } = tableData

  if (grandTotal === 0) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text dimColor>No holdings data.</Text>
      </Box>
    )
  }

  // Build columns: label, Total, then each col
  const columns: Column[] = [
    { header: '', align: 'left', minWidth: Math.max(5, ...rows.map(r => r.label.length)) },
    { header: 'Total', align: 'right', headerColor: 'cyan', minWidth: 6 },
    ...cols.map(col => ({
      header: col.label,
      align: 'right' as const,
      minWidth: 6,
    })),
  ]

  // Build data rows
  const dataRows: Cell[][] = []
  for (const row of rows) {
    if (showDollar) {
      const dollarRow: Cell[] = [
        { text: row.label },
        { text: fmtDollar(row.total), color: 'green', bold: true },
        ...cols.map(col => {
          const cell = cells.get(`${row.key}:${col.key}`)
          const val = cell && cell.value > 0 ? fmtDollar(cell.value) : ''
          return { text: val, color: val ? 'green' : undefined }
        }),
      ]
      dataRows.push(dollarRow)
    }
    if (showPct) {
      const pctRow: Cell[] = [
        { text: showDollar ? '' : row.label, dimColor: showDollar },
        { text: fmtPct(row.total, grandTotal), color: 'cyan', dimColor: showDollar },
        ...cols.map(col => {
          const cell = cells.get(`${row.key}:${col.key}`)
          const val = cell && cell.value > 0 ? fmtPct(cell.value, grandTotal) : ''
          return { text: val, color: 'cyan', dimColor: showDollar }
        }),
      ]
      dataRows.push(pctRow)
    }
  }

  // Build footer rows
  const footerRows: Cell[][] = []
  if (showDollar) {
    footerRows.push([
      { text: 'Total', bold: true, color: 'yellowBright' },
      { text: fmtDollar(grandTotal), bold: true, color: 'yellowBright' },
      ...cols.map(col => ({
        text: fmtDollar(col.total),
        bold: true,
        color: 'yellow',
      })),
    ])
  }
  if (showPct) {
    footerRows.push([
      {
        text: showDollar ? '' : 'Total',
        bold: true,
        color: showDollar ? undefined : 'yellowBright',
        dimColor: showDollar,
      },
      { text: fmtPct(grandTotal, grandTotal), bold: true, color: 'cyan', dimColor: showDollar },
      ...cols.map(col => ({
        text: fmtPct(col.total, grandTotal),
        bold: true,
        color: 'cyan',
        dimColor: showDollar,
      })),
    ])
  }

  return <DataTable columns={columns} rows={dataRows} footerRows={footerRows} />
}
