import { useEffect, useState } from 'react'
import {
  FALLBACK_RATES,
  fetchRates,
  loadCachedRates,
  RATES_MAX_AGE_MS,
  saveCachedRates,
  type Rates,
} from '../lib/rates'

/** Whether the rates in use came from the service, or are the built-in ones because it couldn't be reached. */
export type RatesSource = 'fresh' | 'built-in'

/**
 * Exchange rates for converting between currencies. Starts from the last rates saved on this
 * device (or the built-in ones) and fetches today's when those are more than 12 hours old.
 */
export function useRates() {
  const [cached] = useState(() => loadCachedRates())
  const [rates, setRates] = useState<Rates>(cached?.rates ?? FALLBACK_RATES)
  const [source, setSource] = useState<RatesSource>(cached ? 'fresh' : 'built-in')

  useEffect(() => {
    if (cached && Date.now() - cached.fetchedAt < RATES_MAX_AGE_MS) return
    let cancelled = false
    fetchRates()
      .then((fresh) => {
        saveCachedRates({ rates: fresh, fetchedAt: Date.now() })
        if (cancelled) return
        setRates(fresh)
        setSource('fresh')
      })
      .catch(() => {
        // Keep whatever we have; conversion still works with older or built-in rates.
      })
    return () => {
      cancelled = true
    }
  }, [cached])

  return { rates, source }
}
