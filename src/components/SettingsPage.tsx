import { SYNC_STATUS_TEXT, useAccountActions } from '../hooks/useAccountActions'
import type { SyncStatus } from '../hooks/useCloudSync'
import { initialOf, type CloudUser } from '../lib/cloud'
import { CURRENCIES } from '../lib/money'
import { APP_VERSION } from '../version'
import type { AppData, CustomCategory } from '../types'
import { CategoriesPanel } from './CategoriesPanel'
import { DataMenu } from './DataMenu'

interface Props {
  data: AppData
  cloud: {
    enabled: boolean
    user: CloudUser | null
    status: SyncStatus
    signIn: () => Promise<void>
    signOut: () => Promise<void>
  }
  /** Asks to change the currency; the parent decides whether to convert or relabel. */
  onCurrencyChange: (currency: string) => void
  usage: (category: string) => number
  onAddCategory: (category: CustomCategory) => void
  onRemoveCategory: (category: CustomCategory) => void
  onRestore: (data: AppData) => void
  onReset: () => void
}

function AccountCard({ cloud }: { cloud: Props['cloud'] }) {
  const { busy, error, signIn, signOut } = useAccountActions(cloud.status, cloud.signIn, cloud.signOut)
  const { user, status } = cloud

  return (
    <section className="card settings-card" aria-labelledby="account-title">
      <h2 id="account-title">Account</h2>
      {user ? (
        <div className="account-row">
          <span className="account-avatar" aria-hidden="true">
            {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : initialOf(user)}
          </span>
          <span className="account-who">
            {user.name && <strong>{user.name}</strong>}
            <span className="muted">{user.email}</span>
            <span className={status === 'error' ? 'error' : 'muted'} role="status">
              {SYNC_STATUS_TEXT[status]}
            </span>
          </span>
          <button type="button" disabled={busy} onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Sign in with Google to keep your data in your account and use it on your phone and computer. Without
            signing in, everything stays on this device only.
          </p>
          <div className="settings-actions">
            <button type="button" className="primary" disabled={busy} onClick={signIn}>
              Sign in with Google
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}

/** The Settings page: account, currency, your categories, backups, and resetting everything. */
export function SettingsPage({
  data,
  cloud,
  onCurrencyChange,
  usage,
  onAddCategory,
  onRemoveCategory,
  onRestore,
  onReset,
}: Props) {
  return (
    <>
      {cloud.enabled && <AccountCard cloud={cloud} />}

      <section className="card settings-card" aria-labelledby="currency-title">
        <h2 id="currency-title">Currency</h2>
        <p className="muted">
          The currency your amounts are in. When you change it, you can convert everything at today's exchange rate
          or just change the label.
        </p>
        <select
          aria-labelledby="currency-title"
          className="settings-select"
          value={data.currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </section>

      <CategoriesPanel custom={data.customCategories} usage={usage} onAdd={onAddCategory} onRemove={onRemoveCategory} />

      <DataMenu data={data} onRestore={onRestore} />

      <section className="card settings-card danger-zone" aria-labelledby="danger-title">
        <h2 id="danger-title">Danger zone</h2>
        <p className="muted">
          Delete every transaction, monthly item, budget and category{cloud.user ? ', here and in your account' : ''}. You
          get a warning first and a few seconds to undo it.
        </p>
        <div className="settings-actions">
          <button type="button" className="danger" onClick={onReset}>
            Reset everything…
          </button>
        </div>
      </section>

      <p className="app-version muted">
        Telemachus v{APP_VERSION} ·{' '}
        <a href="https://github.com/NgJyeKang11/Telemachus/releases" target="_blank" rel="noreferrer">
          What's new
        </a>
      </p>
    </>
  )
}
