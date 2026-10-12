import { describe, expect, it } from 'vitest'
import { addMonths } from './dates'

describe('addMonths', () => {
  it('moves forwards and backwards across years', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-03', -14)).toBe('2025-01')
  })
})
