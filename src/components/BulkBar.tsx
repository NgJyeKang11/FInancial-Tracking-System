import { useCustomCategories } from '../hooks/useCategories'
import { categoriesFor, type Category } from '../types'

interface Props {
  selectedCount: number
  visibleCount: number
  onSelectAll: () => void
  onClear: () => void
  onSetCategory: (category: Category) => void
  onDelete: () => void
  onDone: () => void
}

/** The bar shown while picking several transactions: change their category or delete them. */
export function BulkBar({ selectedCount, visibleCount, onSelectAll, onClear, onSetCategory, onDelete, onDone }: Props) {
  const custom = useCustomCategories()
  const allSelected = selectedCount === visibleCount && visibleCount > 0

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Selected transactions">
      <span className="bulk-count" role="status">
        {selectedCount} selected
      </span>
      <button type="button" className="link" onClick={allSelected ? onClear : onSelectAll}>
        {allSelected ? 'Select none' : `Select all ${visibleCount}`}
      </button>
      <span className="bulk-actions">
        <select
          aria-label="Change category of the selected transactions"
          value=""
          disabled={selectedCount === 0}
          onChange={(e) => e.target.value && onSetCategory(e.target.value)}
        >
          <option value="">Change category…</option>
          <optgroup label="Spending">
            {categoriesFor('expense', custom).map((c) => (
              <option key={`e-${c}`} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
          <optgroup label="Income">
            {categoriesFor('income', custom)
              .filter((c) => !categoriesFor('expense', custom).includes(c))
              .map((c) => (
                <option key={`i-${c}`} value={c}>
                  {c}
                </option>
              ))}
          </optgroup>
        </select>
        <button type="button" className="danger" disabled={selectedCount === 0} onClick={onDelete}>
          Delete
        </button>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </span>
    </div>
  )
}
