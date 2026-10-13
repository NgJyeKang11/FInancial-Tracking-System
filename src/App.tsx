import { useEffect, useMemo, useState } from 'react'
import { AccountMenu } from './components/AccountMenu'
import { AdjustBalanceDialog } from './components/AdjustBalanceDialog'
import { BudgetAlerts } from './components/BudgetAlerts'
import { BudgetPanel } from './components/BudgetPanel'
import { ImportDialog } from './components/ImportDialog'
import { MonthPicker } from './components/MonthPicker'
import { RecentTransactions } from './components/RecentTransactions'
import { RecurringPanel, type RecurringDraft } from './components/RecurringPanel'
import { SpendingCharts } from './components/SpendingCharts'
import { SummaryCards } from './components/SummaryCards'
import { TransactionDialog } from './components/TransactionDialog'
import { TransactionList } from './components/TransactionList'
import { useBudgets } from './hooks/useBudgets'
import { useCloudSync } from './hooks/useCloudSync'
import { useRecurring } from './hooks/useRecurring'
import { useTransactions } from './hooks/useTransactions'
import { addMonths, formatMonth, monthOf, todayISO } from './lib/dates'
import { dueTransactions } from './lib/recurring'
import { balanceAsOf, balanceByDate, budgetStatuses, expensesOnly, inMonth } from './lib/stats'
import { loadCurrency, saveCurrency } from './lib/storage'
import {
  ADJUSTMENT,
  CATEGORIES,
  INCOME_CATEGORIES,
  type AppData,
  type Category,
  type Recurring,
  type Transaction,
} from './types'

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
  const { transactions, add, addMany, addExisting, update, remove, replace: replaceTransactions } = useTransactions()
  const { budgets, setBudget, replace: replaceBudgets } = useBudgets()
  const { recurring, add: addRecurring, remove: removeRecurring, replace: replaceRecurring } = useRecurring()
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [importing, setImporting] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  /** The Transactions page lists every month by default, so old ones are easy to find. */
  const [allTime, setAllTime] = useState(true)
  /** The add / edit pop-up: 'new' to add, a transaction to edit, null when closed. */
  const [form, setForm] = useState<Transaction | 'new' | null>(null)
  const [month, setMonth] = useState(monthOf(todayISO()))
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All')
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState(() => loadCurrency() ?? 'USD')

  const appData = useMemo<AppData>(
    () => ({ transactions, budgets, recurring, currency }),
    [transactions, budgets, recurring, currency],
  )
  const cloud = useCloudSync(appData, (data) => {
    replaceTransactions(data.transactions)
    replaceBudgets(data.budgets)
    replaceRecurring(data.recurring)
    setCurrency(data.currency)
    saveCurrency(data.currency)
  })

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
  // Reversed first so that, within a day, the most recently added comes first.
  const newestFirst = useMemo(
    () => [...transactions].reverse().sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  )
  const monthExpenses = useMemo(() => expensesOnly(monthTransactions), [monthTransactions])
  const statuses = useMemo(() => budgetStatuses(monthTransactions, budgets), [monthTransactions, budgets])

  // Balances use every transaction, so filtering the list never changes the running balance.
  const balances = useMemo(() => balanceByDate(transactions), [transactions])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (allTime ? transactions : monthTransactions).filter(
      (t) =>
        (categoryFilter === 'All' || t.category === categoryFilter) &&
        (query === '' || t.note.toLowerCase().includes(query)),
    )
  }, [allTime, transactions, monthTransactions, categoryFilter, search])

  const changeCurrency = (value: string) => {
    setCurrency(value)
    saveCurrency(value)
  }

  const handleDelete = (t: Transaction) => {
    if (!window.confirm(`Delete this ${t.category} transaction?`)) return
    remove(t.id)
  }

  const handleAddRecurring = (draft: RecurringDraft, startThisMonth: boolean) => {
    const thisMonth = monthOf(todayISO())
    // `lastMonth` is the month before the first one to add.
    const item: Recurring = {
      ...draft,
      id: crypto.randomUUID(),
      lastMonth: startThisMonth ? addMonths(thisMonth, -1) : thisMonth,
    }
    const { transactions: due, item: updated } = dueTransactions(item, todayISO())
    addRecurring(updated)
    if (due.length > 0) addExisting(due)
  }

  const handleRemoveRecurring = (r: Recurring) => {
    if (!window.confirm(`Stop adding "${r.note || r.category}" every month? Ones already added stay.`)) return
    removeRecurring(r.id)
  }

  const stats = { all: transactions, monthTransactions, month, currency }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Telemachus <span className="byline">by JK</span>
        </h1>
        <div className="header-actions">
          <button type="button" onClick={() => setImporting(true)}>
            Import
          </button>
          <button type="button" className="primary" onClick={() => setForm('new')}>
            + Add
          </button>
          {cloud.enabled && (
            <AccountMenu user={cloud.user} status={cloud.status} onSignIn={cloud.signIn} onSignOut={cloud.signOut} />
          )}
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
        {!(tab === 'transactions' && allTime) && <MonthPicker month={month} onChange={setMonth} />}
      </div>

      <main className="page">
        {tab === 'overview' &&
          (transactions.length === 0 ? (
            <div className="card empty welcome">
              <h2>Welcome to Telemachus</h2>
              <p className="muted">Add your first transaction, or import a bank statement to fill things in quickly.</p>
              {cloud.enabled && !cloud.user && (
                <p className="muted">Used Telemachus on another device? Sign in with Google to bring your data here.</p>
              )}
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
              <SummaryCards {...stats} show={['balance', 'spent', 'income']} onAdjustBalance={() => setAdjusting(true)} />
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
                aria-label="Which months to show"
                value={allTime ? 'all' : 'month'}
                onChange={(e) => setAllTime(e.target.value === 'all')}
              >
                <option value="all">All time</option>
                <option value="month">{formatMonth(month)}</option>
              </select>
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
                <option>{ADJUSTMENT}</option>
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
            <RecurringPanel
              recurring={recurring}
              currency={currency}
              onAdd={handleAddRecurring}
              onRemove={handleRemoveRecurring}
            />
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

      {adjusting && (
        <AdjustBalanceDialog
          balanceCents={balanceAsOf(transactions, todayISO())}
          currency={currency}
          onClose={() => setAdjusting(false)}
          onSave={(input) => {
            add(input)
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
