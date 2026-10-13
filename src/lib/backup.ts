import type { AppData, Transaction } from '../types'
import { todayISO } from './dates'
import { parseAppData } from './sync'

/** Marks a file as a Telemachus backup, and which shape it's in. */
const BACKUP_FORMAT = 'telemachus-backup'
const BACKUP_VERSION = 1

/** Everything the app saves, as the text of a backup file. */
export function toBackupJson(data: AppData, now: Date = new Date()): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data }, null, 2)
}

export type BackupResult = { ok: true; data: AppData; exportedAt: string | null } | { ok: false; reason: string }

/** Reads a backup file's text, checking everything in it the same way saved data is checked. */
export function parseBackup(text: string): BackupResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, reason: "That file isn't a Telemachus backup (it isn't readable JSON)." }
  }
  if (typeof value !== 'object' || value === null || (value as Record<string, unknown>).format !== BACKUP_FORMAT) {
    return { ok: false, reason: "That file isn't a Telemachus backup." }
  }
  const { version, data, exportedAt } = value as Record<string, unknown>
  if (typeof version !== 'number' || version > BACKUP_VERSION) {
    return { ok: false, reason: 'That backup was made by a newer version of Telemachus. Refresh the page and try again.' }
  }
  const parsed = parseAppData(data)
  if (!parsed) return { ok: false, reason: 'That backup has no data in it.' }
  return { ok: true, data: parsed, exportedAt: typeof exportedAt === 'string' ? exportedAt : null }
}

/** Quotes a CSV cell when it needs it (commas, quotes or line breaks). */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Transactions as CSV for a spreadsheet, oldest first. Amounts are signed (money out is
 * negative), which is also a layout the app's own CSV import understands.
 */
export function toCsv(transactions: Transaction[]): string {
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [
      t.date,
      t.note,
      t.category,
      t.type === 'income' ? 'Money in' : 'Money out',
      ((t.type === 'income' ? 1 : -1) * t.amountCents / 100).toFixed(2),
    ])
  return [['Date', 'Description', 'Category', 'Type', 'Amount'], ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** Saves a backup of everything as telemachus-backup-<date>.json. */
export function downloadBackup(data: AppData): void {
  downloadText(`telemachus-backup-${todayISO()}.json`, toBackupJson(data), 'application/json')
}

/** Starts a download of `text` as a file in the browser. */
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
