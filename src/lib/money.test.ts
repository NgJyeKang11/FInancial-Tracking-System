import { describe, expect, it } from 'vitest'
import { centsToInput, parseAmountToCents } from './money'

describe('parseAmountToCents', () => {
  it('parses whole and decimal amounts', () => {
    expect(parseAmountToCents('12')).toBe(1200)
    expect(parseAmountToCents('12.5')).toBe(1250)
    expect(parseAmountToCents('0.07')).toBe(7)
    expect(parseAmountToCents(' 1,200.99 ')).toBe(120099)
  })

  it('avoids floating-point rounding errors', () => {
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(parseAmountToCents('0.29')).toBe(29)
  })

  it('rejects invalid amounts', () => {
    for (const bad of ['', 'abc', '-5', '0', '0.00', '1.234', '1e5', '.5']) {
      expect(parseAmountToCents(bad)).toBeNull()
    }
  })
})

describe('centsToInput', () => {
  it('formats cents for editing', () => {
    expect(centsToInput(1250)).toBe('12.50')
    expect(centsToInput(7)).toBe('0.07')
  })
})
