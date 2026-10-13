import { useEffect, useRef } from 'react'
import type { RatesSource } from '../hooks/useRates'
import { formatDayHeading } from '../lib/dates'
import { formatCents } from '../lib/money'
import { convertCents, rateBetween, type Rates } from '../lib/rates'

interface Props {
  from: string
  to: string
  /** The balance today, in `from`, to show what converting does. */
  balanceCents: number
  rates: Rates
  ratesSource: RatesSource
  onConvert: () => void
  onRelabel: () => void
  onClose: () => void
}

/** Shows a rate like 4.0839 with sensible precision: 4.08, 0.2449, 158.6. */
function formatRate(rate: number): string {
  return rate.toLocaleString(undefined, { maximumSignificantDigits: rate >= 1 ? 4 : 3 })
}

/**
 * Asked when the currency is changed and there's data: convert every amount at today's
 * exchange rate, or just change the label because the amounts were already in that currency.
 */
export function CurrencyDialog({ from, to, balanceCents, rates, ratesSource, onConvert, onRelabel, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Tell the parent straight away rather than waiting for the dialog's close event, which the
  // browser can hold back (for example while the tab is in the background).
  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const rate = rateBetween(from, to, rates)
  const converted = rate === null ? null : Math.sign(balanceCents) * convertCents(Math.abs(balanceCents), rate)

  return (
    <dialog ref={dialogRef} className="dialog form-dialog" onClose={onClose} aria-labelledby="currency-dialog-title">
      <div className="form">
        <h2 id="currency-dialog-title">
          Change {from} to {to}
        </h2>
        <p className="muted">Your amounts are saved as {from}. Which of these is right?</p>

        <div className="choice">
          <button
            type="button"
            className="primary"
            disabled={rate === null}
            onClick={() => {
              onConvert()
              close()
            }}
          >
            Convert my amounts to {to}
          </button>
          <p className="muted">
            {rate === null ? (
              `There's no exchange rate for ${to}.`
            ) : (
              <>
                For amounts that really are {from}. Everything is converted at{' '}
                <strong>
                  1 {from} = {formatRate(rate)} {to}
                </strong>
                {balanceCents !== 0 && converted !== null && (
                  <>
                    , so your balance of {formatCents(balanceCents, from)} becomes{' '}
                    <strong>{formatCents(converted, to)}</strong>
                  </>
                )}
                .
              </>
            )}
          </p>
        </div>

        <div className="choice">
          <button
            type="button"
            onClick={() => {
              onRelabel()
              close()
            }}
          >
            They're already {to}, just change the label
          </button>
          <p className="muted">
            For when the numbers were right but the currency setting wasn't, e.g. ringgit from a Malaysian bank shown
            as {from}. Nothing is converted.
          </p>
        </div>

        <p className="muted rates-note">
          {ratesSource === 'fresh'
            ? `European Central Bank reference rates from ${formatDayHeading(rates.date)}, updated daily.`
            : `Built-in rates from ${formatDayHeading(rates.date)} (today's couldn't be fetched).`}{' '}
          You can undo either choice for a few seconds afterwards.
        </p>

        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  )
}
