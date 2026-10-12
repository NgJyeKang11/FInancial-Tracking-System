import { addMonths, formatMonth } from '../lib/dates'

interface Props {
  month: string
  onChange: (month: string) => void
}

/** "‹ October 2026 ›": steps through months one at a time. */
export function MonthPicker({ month, onChange }: Props) {
  return (
    <div className="month-picker" role="group" aria-label="Month">
      <button type="button" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <span aria-live="polite">{formatMonth(month)}</span>
      <button type="button" aria-label="Next month" onClick={() => onChange(addMonths(month, 1))}>
        ›
      </button>
    </div>
  )
}
