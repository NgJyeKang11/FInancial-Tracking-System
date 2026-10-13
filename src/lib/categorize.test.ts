import { describe, expect, it } from 'vitest'
import { categorize, categoryRuleKey, learnCategories, MAX_CATEGORY_RULES } from './categorize'

describe('categoryRuleKey', () => {
  it('ignores numbers, punctuation, case and spacing', () => {
    expect(categoryRuleKey('DuitNow Transfer /TRANSFER, AHMAD 0123', 'expense')).toBe(
      categoryRuleKey('duitnow transfer transfer ahmad 98765', 'expense'),
    )
    expect(categoryRuleKey('DuitNow Transfer, AHMAD', 'expense')).toBe('expense|duitnow transfer ahmad')
  })

  it('keeps money in and money out apart, and skips descriptions with nothing to go on', () => {
    expect(categoryRuleKey('Ahmad', 'income')).not.toBe(categoryRuleKey('Ahmad', 'expense'))
    expect(categoryRuleKey('0123 456', 'expense')).toBeNull()
  })
})

describe('learnCategories and categorize', () => {
  it('uses a category picked before for the same description', () => {
    const rules = learnCategories({}, [{ description: 'TRANSFER TO AHMAD 0123', type: 'expense', category: 'Transport' }])
    expect(categorize('Transfer to Ahmad 0456', 'expense', rules)).toBe('Transport')
    expect(categorize('Transfer to Siti', 'expense', rules)).toBe('Other')
  })

  it('beats the keyword guess', () => {
    const rules = learnCategories({}, [{ description: 'GRAB RIDE', type: 'expense', category: 'Food & Drink' }])
    expect(categorize('GRAB RIDE', 'expense')).toBe('Transport')
    expect(categorize('GRAB RIDE', 'expense', rules)).toBe('Food & Drink')
  })

  it("doesn't store a pick that matches the keyword guess, and removes an old rule for it", () => {
    const first = learnCategories({}, [{ description: 'GRAB RIDE', type: 'expense', category: 'Food & Drink' }])
    const second = learnCategories(first, [{ description: 'GRAB RIDE', type: 'expense', category: 'Transport' }])
    expect(second).toEqual({})
  })

  it(`keeps only the newest ${MAX_CATEGORY_RULES}`, () => {
    const picks = Array.from({ length: MAX_CATEGORY_RULES + 5 }, (_, i) => ({
      description: `shop ${'x'.repeat(i + 1)}`,
      type: 'expense' as const,
      category: 'Pets',
    }))
    const rules = learnCategories({}, picks)
    expect(Object.keys(rules)).toHaveLength(MAX_CATEGORY_RULES)
    expect(rules['expense|shop x']).toBeUndefined()
    expect(rules[`expense|shop ${'x'.repeat(MAX_CATEGORY_RULES + 5)}`]).toBe('Pets')
  })
})
