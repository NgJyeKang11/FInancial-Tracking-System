import { useRef, useState } from 'react'
import { downloadBackup, downloadText, parseBackup, toCsv } from '../lib/backup'
import { todayISO } from '../lib/dates'
import type { AppData } from '../types'

interface Props {
  data: AppData
  /** Replaces everything with a backup's data. */
  onRestore: (data: AppData) => void
  /** Opens the "Reset everything" warning. */
  onReset: () => void
}

const MAX_BACKUP_BYTES = 20 * 1024 * 1024

/** Footer links to download a backup, restore one, export transactions as CSV, or reset everything. */
export function DataMenu({ data, onRestore, onReset }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const restore = async (file: File) => {
    setMessage(null)
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ text: "That file is too big to be a Telemachus backup.", error: true })
      return
    }
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setMessage({ text: result.reason, error: true })
      return
    }
    const when = result.exportedAt ? ` from ${new Date(result.exportedAt).toLocaleString()}` : ''
    const count = result.data.transactions.length
    const ok = window.confirm(
      `Restore the backup${when}? It has ${count} transaction${count === 1 ? '' : 's'}.\n\n` +
        'This replaces everything currently in the app (and in your account, if you are signed in).',
    )
    if (!ok) return
    onRestore(result.data)
    setMessage({ text: `Restored ${count} transaction${count === 1 ? '' : 's'}.`, error: false })
  }

  return (
    <div className="data-menu">
      <button type="button" className="link" onClick={() => downloadBackup(data)}>
        Download backup
      </button>
      <button type="button" className="link" onClick={() => fileRef.current?.click()}>
        Restore backup
      </button>
      <button
        type="button"
        className="link"
        disabled={data.transactions.length === 0}
        onClick={() => downloadText(`telemachus-transactions-${todayISO()}.csv`, toCsv(data.transactions), 'text/csv')}
      >
        Export CSV
      </button>
      <button type="button" className="link danger" onClick={onReset}>
        Reset everything
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void restore(file)
        }}
      />
      {message && (
        <span className={message.error ? 'error' : 'muted'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </span>
      )}
    </div>
  )
}
