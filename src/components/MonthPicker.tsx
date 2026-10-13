import { addMonths, formatMonth } from '../lib/dates'

interface Props {
  month: string
  /** The latest month that can be picked ("YYYY-MM"), usually the current one. */
  max: string
  onChange: (month: string) => void
}

/** "‹ October 2026 ›": steps through months one at a time, up to `max`. */
export function MonthPicker({ month, max, onChange }: Props) {
  const atLatest = month >= max
  return (
    <div className="month-picker" role="group" aria-label="Month">
      <button type="button" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <span aria-live="polite">{formatMonth(month)}</span>
      <button
        type="button"
        aria-label="Next month"
        title={atLatest ? 'Next month opens when it starts' : undefined}
        disabled={atLatest}
        onClick={() => onChange(addMonths(month, 1))}
      >
        ›
      </button>
    </div>
  )
}
