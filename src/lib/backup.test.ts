import { describe, expect, it } from 'vitest'
import type { AppData, Transaction } from '../types'
import { parseBackup, toBackupJson, toCsv } from './backup'
import { parseCsv, rowsToTransactions, guessColumns } from './csv'
import { EMPTY_DATA } from './sync'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'a',
  type: 'expense',
  amountCents: 1250,
  category: 'Food & Drink',
  date: '2026-10-02',
  note: 'Lunch',
  ...over,
})

const data: AppData = {
  ...EMPTY_DATA,
  transactions: [tx({})],
  budgets: { Groceries: 30000, Pets: 5000 },
  customCategories: [{ name: 'Pets', type: 'expense' }],
  categoryRules: { 'expense|transfer to ahmad': 'Pets' },
  currency: 'MYR',
}

describe('backups', () => {
  it('round-trips everything', () => {
    const result = parseBackup(toBackupJson(data, new Date('2026-10-13T08:00:00Z')))
    expect(result).toEqual({ ok: true, data, exportedAt: '2026-10-13T08:00:00.000Z' })
  })

  it('rejects files that are not backups', () => {
    expect(parseBackup('not json').ok).toBe(false)
    expect(parseBackup('{"transactions": []}').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ format: 'telemachus-backup', version: 99, data })).ok).toBe(false)
  })

  it('drops broken entries instead of failing', () => {
    const text = JSON.stringify({
      format: 'telemachus-backup',
      version: 1,
      data: { ...data, transactions: [tx({}), { id: 'bad' }] },
    })
    const result = parseBackup(text)
    expect(result.ok && result.data.transactions).toEqual([tx({})])
  })
})

describe('toCsv', () => {
  it('writes signed amounts oldest first and quotes awkward cells', () => {
    const csv = toCsv([
      tx({ id: 'b', date: '2026-10-05', type: 'income', category: 'Gift', amountCents: 50000, note: 'Allowance, Oct' }),
      tx({ note: 'Say "hi"' }),
    ])
    expect(csv.split('\r\n')).toEqual([
      'Date,Description,Category,Type,Amount',
      '2026-10-02,"Say ""hi""",Food & Drink,Money out,-12.50',
      '2026-10-05,"Allowance, Oct",Gift,Money in,500.00',
    ])
  })

  it("can be imported again by the app's own CSV import", () => {
    const rows = parseCsv(toCsv([tx({}), tx({ id: 'b', type: 'income', category: 'Gift', amountCents: 50000, note: 'Allowance' })]))
    const columns = guessColumns(rows[0])
    const imported = rowsToTransactions(rows.slice(1), { columns, dateOrder: 'dmy', flipSigns: false })
    expect(imported.map((r) => r.ok && [r.input.type, r.input.amountCents, r.input.note])).toEqual([
      ['expense', 1250, 'Lunch'],
      ['income', 50000, 'Allowance'],
    ])
  })
})
