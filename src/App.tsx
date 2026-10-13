import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountMenu } from './components/AccountMenu'
import { AdjustBalanceDialog } from './components/AdjustBalanceDialog'
import { BudgetAlerts } from './components/BudgetAlerts'
import { BudgetPanel } from './components/BudgetPanel'
import { BulkBar } from './components/BulkBar'
import { CategoriesPanel } from './components/CategoriesPanel'
import { DataMenu } from './components/DataMenu'
import { ImportDialog } from './components/ImportDialog'
import { MonthComparison } from './components/MonthComparison'
import { MonthPicker } from './components/MonthPicker'
import { RecentTransactions } from './components/RecentTransactions'
import { RecurringPanel, type RecurringDraft } from './components/RecurringPanel'
import { ResetDialog } from './components/ResetDialog'
import { SpendingCharts } from './components/SpendingCharts'
import { SummaryCards } from './components/SummaryCards'
import { TransactionDialog } from './components/TransactionDialog'
import { TransactionList } from './components/TransactionList'
import { UndoToast, type UndoAction } from './components/UndoToast'
import { useBudgets } from './hooks/useBudgets'
import { CustomCategoriesContext } from './hooks/useCategories'
import { useCloudSync } from './hooks/useCloudSync'
import { useRecurring } from './hooks/useRecurring'
import { useStoredState } from './hooks/useStoredState'
import { useTransactions } from './hooks/useTransactions'
import { learnCategories } from './lib/categorize'
import { EMPTY_DATA } from './lib/sync'
import { addMonths, formatMonth, monthOf, todayISO } from './lib/dates'
import { catchUp, dueTransactions } from './lib/recurring'
import { balanceAsOf, balanceByDate, budgetStatuses, compareMonths, expensesOnly, inMonth } from './lib/stats'
import {
  loadCategoryRules,
  loadCurrency,
  loadCustomCategories,
  saveCategoryRules,
  saveCurrency,
  saveCustomCategories,
} from './lib/storage'
import {
  ADJUSTMENT,
  budgetCategories,
  categoriesFor,
  fallbackCategory,
  type AppData,
  type Category,
  type CustomCategory,
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function App() {
  const { transactions, add, addMany, addExisting, update, replace: replaceTransactions } = useTransactions()
  const { budgets, setBudget, replace: replaceBudgets } = useBudgets()
  const { recurring, add: addRecurring, replace: replaceRecurring } = useRecurring()
  const [customCategories, setCustomCategories] = useStoredState(loadCustomCategories, saveCustomCategories)
  const [categoryRules, setCategoryRules] = useStoredState(loadCategoryRules, saveCategoryRules)
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
  /** Ids ticked on the Transactions page, or null when not picking several. */
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const clearUndo = useCallback(() => setUndoAction(null), [])
  const [resetting, setResetting] = useState(false)

  const appData = useMemo<AppData>(
    () => ({ transactions, budgets, recurring, currency, customCategories, categoryRules }),
    [transactions, budgets, recurring, currency, customCategories, categoryRules],
  )
  const replaceAll = (data: AppData) => {
    replaceTransactions(data.transactions)
    replaceBudgets(data.budgets)
    replaceRecurring(data.recurring)
    setCustomCategories(data.customCategories)
    setCategoryRules(data.categoryRules)
    setCurrency(data.currency)
    saveCurrency(data.currency)
  }
  const cloud = useCloudSync(appData, replaceAll)

  /**
   * Deletes all data: transactions, monthly items, budgets, categories and remembered
   * categories (and, when signed in, the account's copy, as the change syncs). The currency
   * stays, since it's a display setting rather than data.
   */
  const resetEverything = () => {
    replaceAll({ ...EMPTY_DATA, currency })
    setUndoAction(null)
    setSelected(null)
    setSearch('')
    setCategoryFilter('All')
    setMonth(monthOf(todayISO()))
    openTab('overview')
  }

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const openTab = (next: Tab) => {
    setTab(next)
    setSelected(null)
    window.history.replaceState(null, '', next === 'overview' ? window.location.pathname : `#${next}`)
  }

  const monthTransactions = useMemo(() => inMonth(transactions, month), [transactions, month])
  // Reversed first so that, within a day, the most recently added comes first.
  const newestFirst = useMemo(
    () => [...transactions].reverse().sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  )
  const monthExpenses = useMemo(() => expensesOnly(monthTransactions), [monthTransactions])
  const statuses = useMemo(
    () => budgetStatuses(monthTransactions, budgets, budgetCategories(customCategories)),
    [monthTransactions, budgets, customCategories],
  )
  const comparison = useMemo(
    () => compareMonths(monthTransactions, inMonth(transactions, addMonths(month, -1))),
    [monthTransactions, transactions, month],
  )

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
  const selectedVisible = selected ? visible.filter((t) => selected.has(t.id)) : []

  const changeCurrency = (value: string) => {
    setCurrency(value)
    saveCurrency(value)
  }

  /** Removes transactions now; Undo puts them back where they were. */
  const deleteTransactions = (doomed: Transaction[]) => {
    const ids = new Set(doomed.map((t) => t.id))
    const removed = transactions.flatMap((t, index) => (ids.has(t.id) ? [{ t, index }] : []))
    replaceTransactions((prev) => prev.filter((t) => !ids.has(t.id)))
    setUndoAction({
      message: doomed.length === 1 ? `Deleted ${doomed[0].note || doomed[0].category}` : `Deleted ${plural(doomed.length, 'transaction')}`,
      undo: () =>
        replaceTransactions((prev) => {
          const next = [...prev]
          for (const { t, index } of removed) {
            if (!next.some((x) => x.id === t.id)) next.splice(Math.min(index, next.length), 0, t)
          }
          return next
        }),
    })
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
    const index = recurring.findIndex((x) => x.id === r.id)
    replaceRecurring((prev) => prev.filter((x) => x.id !== r.id))
    setUndoAction({
      message: `Stopped ${r.note || r.category}. Ones already added stay.`,
      undo: () =>
        replaceRecurring((prev) => {
          if (prev.some((x) => x.id === r.id)) return prev
          const next = [...prev]
          next.splice(Math.min(index, next.length), 0, r)
          return next
        }),
    })
  }

  /** Removes a category of the person's own; what used it moves to Other / Other income. */
  const handleRemoveCategory = (c: CustomCategory) => {
    const before = { transactions, recurring, budgets, customCategories, categoryRules }
    const moved = transactions.filter((t) => t.category === c.name).length
    const move = <T extends { type: Transaction['type']; category: Category }>(item: T): T =>
      item.category === c.name ? { ...item, category: fallbackCategory(item.type) } : item
    replaceTransactions((prev) => prev.map(move))
    replaceRecurring((prev) => prev.map(move))
    replaceBudgets((prev) => Object.fromEntries(Object.entries(prev).filter(([name]) => name !== c.name)))
    setCategoryRules((prev) => Object.fromEntries(Object.entries(prev).filter(([, name]) => name !== c.name)))
    setCustomCategories((prev) => prev.filter((x) => x.name !== c.name))
    if (categoryFilter === c.name) setCategoryFilter('All')
    setUndoAction({
      message: moved > 0 ? `Removed ${c.name}. ${plural(moved, 'transaction')} moved to ${fallbackCategory(c.type)}.` : `Removed ${c.name}.`,
      undo: () => {
        replaceTransactions(before.transactions)
        replaceRecurring(before.recurring)
        replaceBudgets(before.budgets)
        setCategoryRules(before.categoryRules)
        setCustomCategories(before.customCategories)
      },
    })
  }

  /** Gives the ticked transactions a category; ones of the other type (in or out) are left alone. */
  const setCategoryOfSelected = (category: Category) => {
    const changes = selectedVisible.filter(
      (t) => t.category !== category && categoriesFor(t.type, customCategories).includes(category),
    )
    const skipped = selectedVisible.filter((t) => !categoriesFor(t.type, customCategories).includes(category)).length
    const previous = new Map(changes.map((t) => [t.id, t.category]))
    replaceTransactions((prev) => prev.map((t) => (previous.has(t.id) ? { ...t, category } : t)))
    setUndoAction({
      message:
        `Moved ${plural(changes.length, 'transaction')} to ${category}.` +
        (skipped > 0 ? ` ${skipped} skipped (it's a ${categoriesFor('income', customCategories).includes(category) ? 'money in' : 'spending'} category).` : ''),
      undo: () =>
        replaceTransactions((prev) => prev.map((t) => (previous.has(t.id) ? { ...t, category: previous.get(t.id)! } : t))),
    })
  }

  const toggleSelected = (t: Transaction) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(t.id)) next.delete(t.id)
      else next.add(t.id)
      return next
    })

  const stats = { all: transactions, monthTransactions, month, currency }
  const spendingChoices = categoriesFor('expense', customCategories).filter((c) => c !== ADJUSTMENT)
  const incomeChoices = categoriesFor('income', customCategories).filter((c) => c !== ADJUSTMENT)

  return (
    <CustomCategoriesContext value={customCategories}>
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
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All">All categories</option>
                  <optgroup label="Spending">
                    {spendingChoices.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Income">
                    {incomeChoices.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </optgroup>
                  <option>{ADJUSTMENT}</option>
                </select>
                {!selected && visible.length > 0 && (
                  <button type="button" onClick={() => setSelected(new Set())}>
                    Select
                  </button>
                )}
              </div>
              {selected && (
                <BulkBar
                  selectedCount={selectedVisible.length}
                  visibleCount={visible.length}
                  onSelectAll={() => setSelected(new Set(visible.map((t) => t.id)))}
                  onClear={() => setSelected(new Set())}
                  onSetCategory={setCategoryOfSelected}
                  onDelete={() => {
                    deleteTransactions(selectedVisible)
                    setSelected(new Set())
                  }}
                  onDone={() => setSelected(null)}
                />
              )}
              <TransactionList
                transactions={visible}
                balances={balances}
                currency={currency}
                onEdit={setForm}
                onDelete={(t) => deleteTransactions([t])}
                selected={selected ?? undefined}
                onToggle={toggleSelected}
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
              <CategoriesPanel
                custom={customCategories}
                usage={(name) => transactions.filter((t) => t.category === name).length}
                onAdd={(c) => setCustomCategories((prev) => [...prev, c])}
                onRemove={handleRemoveCategory}
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
              <MonthComparison rows={comparison} month={month} currency={currency} />
            </>
          )}
        </main>

        <footer className="app-footer muted">
          <div className="footer-tools">
            <label className="currency">
              Currency
              <select value={currency} onChange={(e) => changeCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <DataMenu
              data={appData}
              onRestore={(data) => {
                // Add any monthly items that came due since the backup was made.
                const due = catchUp(data.transactions, data.recurring, todayISO())
                replaceAll({ ...data, transactions: due.transactions, recurring: due.recurring })
              }}
              onReset={() => setResetting(true)}
            />
          </div>
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

        {resetting && (
          <ResetDialog
            data={appData}
            signedIn={cloud.user !== null}
            onConfirm={resetEverything}
            onClose={() => setResetting(false)}
          />
        )}

        {importing && (
          <ImportDialog
            existing={transactions}
            currency={currency}
            remembered={categoryRules}
            onClose={() => setImporting(false)}
            onImport={(inputs, picks) => {
              addMany(inputs)
              if (picks.length > 0) setCategoryRules((prev) => learnCategories(prev, picks))
              // Show the newest month that was imported, so the new transactions are on screen.
              const newest = inputs.map((t) => t.date).sort().at(-1)
              if (newest) setMonth(monthOf(newest))
            }}
          />
        )}

        {undoAction && <UndoToast action={undoAction} onDone={clearUndo} />}
      </div>
    </CustomCategoriesContext>
  )
}

export default App
