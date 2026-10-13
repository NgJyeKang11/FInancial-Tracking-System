import { useRef, useState } from 'react'
import { downloadBackup, downloadText, parseBackup, toCsv } from '../lib/backup'
import { todayISO } from '../lib/dates'
import type { AppData } from '../types'

interface Props {
  data: AppData
  /** Replaces everything with a backup's data. */
  onRestore: (data: AppData) => void
}

const MAX_BACKUP_BYTES = 20 * 1024 * 1024

/** The "Backup & export" settings: download a backup, restore one, or export transactions as CSV. */
export function DataMenu({ data, onRestore }: Props) {
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
    <section className="card settings-card" aria-labelledby="data-title">
      <h2 id="data-title">Backup &amp; export</h2>
      <p className="muted">
        A backup is one file with everything in it. Keep it somewhere safe and restore it here, or in another browser,
        any time.
      </p>
      <div className="settings-actions">
        <button type="button" onClick={() => downloadBackup(data)}>
          Download backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Restore backup
        </button>
        <button
          type="button"
          disabled={data.transactions.length === 0}
          onClick={() => downloadText(`telemachus-transactions-${todayISO()}.csv`, toCsv(data.transactions), 'text/csv')}
        >
          Export CSV
        </button>
      </div>
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
        <p className={message.error ? 'error' : 'muted'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  )
}
