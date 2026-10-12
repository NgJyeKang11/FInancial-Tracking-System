import { useMemo, useState } from 'react'
import { ImportDialog } from './components/ImportDialog'
import { SpendingCharts } from './components/SpendingCharts'
import { SummaryCards } from './components/SummaryCards'
import { TransactionForm } from './components/TransactionForm'
import { TransactionList } from './components/TransactionList'
import { useTransactions } from './hooks/useTransactions'
import { formatMonth, monthOf, todayISO } from './lib/dates'
import { balanceByDate, expensesOnly, inMonth } from './lib/stats'
import { loadCurrency, saveCurrency } from './lib/storage'
import { CATEGORIES, INCOME_CATEGORIES, type Category, type Transaction } from './types'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'MYR', 'SGD', 'AUD', 'CAD', 'JPY', 'INR', 'CNY']

function App() {
  const { transactions, add, addMany, update, remove } = useTransactions()
  const [importing, setImporting] = useState(false)
  const [month, setMonth] = useState(monthOf(todayISO()))
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [currency, setCurrency] = useState(() => loadCurrency() ?? 'USD')

  const monthTransactions = useMemo(() => inMonth(transactions, month), [transactions, month])

  const monthExpenses = useMemo(() => expensesOnly(monthTransactions), [monthTransactions])

  // Balances use every transaction, so filtering the list never changes the running balance.
  const balances = useMemo(() => balanceByDate(transactions), [transactions])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return monthTransactions.filter(
      (t) =>
        (categoryFilter === 'All' || t.category === categoryFilter) &&
        (query === '' || t.note.toLowerCase().includes(query)),
    )
  }, [monthTransactions, categoryFilter, search])

  const changeCurrency = (value: string) => {
    setCurrency(value)
    saveCurrency(value)
  }

  const handleDelete = (t: Transaction) => {
    if (!window.confirm(`Delete this ${t.category} transaction?`)) return
    remove(t.id)
    if (editing?.id === t.id) setEditing(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Spending Tracker</h1>
          <p className="muted">Log what comes in and goes out each day, and see where your money goes.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setImporting(true)}>
            Import statement
          </button>
          <label className="inline">
            Currency
            <select value={currency} onChange={(e) => changeCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {importing && (
        <ImportDialog
          existing={transactions}
          currency={currency}
          onClose={() => setImporting(false)}
          onImport={(inputs) => {
            addMany(inputs)
            // Show the newest month that was imported, so the new transactions are on screen.
            const newest = inputs.map((t) => t.date).sort().at(-1)
            if (newest) setMonth(monthOf(newest))
          }}
        />
      )}

      <div className="filters">
        <label className="inline">
          Month
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
        <label className="inline">
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as Category | 'All')}>
            <option>All</option>
            <optgroup label="Expenses">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </optgroup>
            <optgroup label="Income">
              {INCOME_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="inline grow">
          Search notes
          <input type="search" placeholder="e.g. coffee" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <SummaryCards all={transactions} monthTransactions={monthTransactions} month={month} currency={currency} />

      <main className="layout">
        <aside>
          {/* `key` resets the form's fields whenever we switch between adding and editing. */}
          <TransactionForm
            key={editing?.id ?? 'new'}
            editing={editing}
            onSubmit={(input) => {
              if (editing) {
                update(editing.id, input)
                setEditing(null)
              } else {
                add(input)
              }
              // Jump to the transaction's month so the user can see what they just saved.
              setMonth(monthOf(input.date))
            }}
            onCancelEdit={() => setEditing(null)}
          />
        </aside>

        <div className="content">
          <SpendingCharts monthTransactions={monthExpenses} month={month} currency={currency} />
          <h2 className="section-title">Transactions · {formatMonth(month)}</h2>
          <TransactionList
            transactions={visible}
            balances={balances}
            currency={currency}
            editingId={editing?.id ?? null}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        </div>
      </main>
    </div>
  )
}

export default App
