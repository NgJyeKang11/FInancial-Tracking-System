import { describe, expect, it } from 'vitest'
import { MAX_AMOUNT_CENTS, amountError, centsToInput, parseAmountToCents, parseBalanceToCents } from './money'

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

  it('caps amounts at 999,999,999.99', () => {
    expect(parseAmountToCents('999,999,999.99')).toBe(MAX_AMOUNT_CENTS)
    expect(parseAmountToCents('1000000000')).toBeNull()
    expect(parseAmountToCents('1'.padEnd(45, '0'))).toBeNull()
  })
})

describe('amountError', () => {
  it('is null for a usable amount', () => {
    expect(amountError('12.50')).toBeNull()
  })

  it('says when an amount is too large', () => {
    expect(amountError('1'.padEnd(45, '0'))).toMatch(/too large/)
  })

  it('asks for a valid amount otherwise', () => {
    for (const bad of ['', 'abc', '0', '1.234']) {
      expect(amountError(bad)).toMatch(/greater than 0/)
    }
  })
})

describe('parseBalanceToCents', () => {
  it('accepts zero and negative balances', () => {
    expect(parseBalanceToCents('1,234.50')).toBe(123450)
    expect(parseBalanceToCents('-45.2')).toBe(-4520)
    expect(parseBalanceToCents('0')).toBe(0)
    expect(parseBalanceToCents('0.00')).toBe(0)
  })

  it('rejects anything that is not an amount', () => {
    for (const bad of ['', '-', 'abc', '1.234', '--5', '.']) {
      expect(parseBalanceToCents(bad)).toBeNull()
    }
  })
})

describe('centsToInput', () => {
  it('formats cents for editing', () => {
    expect(centsToInput(1250)).toBe('12.50')
    expect(centsToInput(7)).toBe('0.07')
  })
})
