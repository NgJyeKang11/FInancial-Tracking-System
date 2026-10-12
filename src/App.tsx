import { useEffect, useMemo, useState } from 'react'
import { BudgetAlerts } from './components/BudgetAlerts'
import { BudgetPanel } from './components/BudgetPanel'
import { ImportDialog } from './components/ImportDialog'
import { MonthPicker } from './components/MonthPicker'
import { RecentTransactions } from './components/RecentTransactions'
import { SpendingCharts } from './components/SpendingCharts'
import { SummaryCards } from './components/SummaryCards'
import { TransactionDialog } from './components/TransactionDialog'
import { TransactionList } from './components/TransactionList'
import { useBudgets } from './hooks/useBudgets'
import { useTransactions } from './hooks/useTransactions'
import { monthOf, todayISO } from './lib/dates'
import { balanceByDate, budgetStatuses, expensesOnly, inMonth } from './lib/stats'
import { loadCurrency, saveCurrency } from './lib/storage'
import { CATEGORIES, INCOME_CATEGORIES, type Category, type Transaction } from './types'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'MYR', 'SGD', 'AUD', 'CAD', 'JPY', 'INR', 'CNY']

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'insights', label: 'Insights' },
] as const

type Tab = (typeof TABS)[number]['id']

/** The tab named in the address (#budgets), so a refresh or a shared link opens the same page. */
const tabFromHash = (): Tab => TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? 'overview'

function App() {
  const { transactions, add, addMany, update, remove } = useTransactions()
  const { budgets, setBudget } = useBudgets()
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [importing, setImporting] = useState(false)
  /** The add / edit pop-up: 'new' to add, a transaction to edit, null when closed. */
  const [form, setForm] = useState<Transaction | 'new' | null>(null)
  const [month, setMonth] = useState(monthOf(todayISO()))
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All')
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState(() => loadCurrency() ?? 'USD')

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const openTab = (next: Tab) => {
    setTab(next)
    window.history.replaceState(null, '', next === 'overview' ? window.location.pathname : `#${next}`)
  }

  const monthTransactions = useMemo(() => inMonth(transactions, month), [transactions, month])
  const newestFirst = useMemo(
    () => [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)),
    [monthTransactions],
  )
  const monthExpenses = useMemo(() => expensesOnly(monthTransactions), [monthTransactions])
  const statuses = useMemo(() => budgetStatuses(monthTransactions, budgets), [monthTransactions, budgets])

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
  }

  const stats = { all: transactions, monthTransactions, month, currency }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Financier <span className="byline">by JK</span>
        </h1>
        <div className="header-actions">
          <button type="button" onClick={() => setImporting(true)}>
            Import
          </button>
          <button type="button" className="primary" onClick={() => setForm('new')}>
            + Add
          </button>
        </div>
      </header>

      <div className="toolbar">
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'selected' : undefined}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => openTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <main className="page">
        {tab === 'overview' &&
          (transactions.length === 0 ? (
            <div className="card empty welcome">
              <h2>Welcome to Financier</h2>
              <p className="muted">Add your first transaction, or import a bank statement to fill things in quickly.</p>
              <div className="welcome-actions">
                <button type="button" onClick={() => setImporting(true)}>
                  Import a statement
                </button>
                <button type="button" className="primary" onClick={() => setForm('new')}>
                  + Add a transaction
                </button>
              </div>
            </div>
          ) : (
            <>
              <SummaryCards {...stats} show={['balance', 'spent', 'income']} />
              <BudgetAlerts statuses={statuses} currency={currency} />
              <RecentTransactions
                transactions={newestFirst}
                currency={currency}
                onSeeAll={() => openTab('transactions')}
              />
            </>
          ))}

        {tab === 'transactions' && (
          <>
            <div className="filters">
              <input
                type="search"
                className="grow"
                placeholder="Search notes"
                aria-label="Search notes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as Category | 'All')}
              >
                <option value="All">All categories</option>
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
            </div>
            <TransactionList
              transactions={visible}
              balances={balances}
              currency={currency}
              onEdit={setForm}
              onDelete={handleDelete}
            />
          </>
        )}

        {tab === 'budgets' && (
          <>
            <BudgetAlerts statuses={statuses} currency={currency} />
            <BudgetPanel
              monthTransactions={monthTransactions}
              budgets={budgets}
              currency={currency}
              onChange={setBudget}
            />
          </>
        )}

        {tab === 'insights' && (
          <>
            <SummaryCards {...stats} show={['net', 'average', 'top', 'savings']} />
            {monthExpenses.length === 0 ? (
              <div className="card empty">
                <p className="muted">No spending this month to chart yet.</p>
              </div>
            ) : (
              <SpendingCharts monthTransactions={monthExpenses} month={month} currency={currency} />
            )}
          </>
        )}
      </main>

      <footer className="app-footer muted">
        <label className="currency">
          Currency
          <select value={currency} onChange={(e) => changeCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <span>Built with assistance from Claude</span>
      </footer>

      {form !== null && (
        <TransactionDialog
          editing={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSubmit={(input) => {
            if (form === 'new') add(input)
            else update(form.id, input)
            // Show the transaction's month so the user can see what they just saved.
            setMonth(monthOf(input.date))
          }}
        />
      )}

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
    </div>
  )
}

export default App
