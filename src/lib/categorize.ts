import { fallbackCategory, type Category, type CategoryRules, type TransactionType } from '../types'

/**
 * Keywords to look for in a bank statement description, checked top to bottom: the first
 * category with a matching keyword wins, so more specific ones (like "grabfood") come before
 * broader ones (like "grab").
 */
const EXPENSE_RULES: [Category, string[]][] = [
  ['Food & Drink', ['grabfood', 'foodpanda', 'deliveroo', 'ubereats', 'uber eats', 'doordash', 'starbucks', 'mcdonald', 'kfc', 'burger', 'pizza', 'sushi', 'restaurant', 'cafe', 'coffee', 'bakery', 'bistro', 'kopitiam', 'dining', 'food court', 'boba', 'tealive', 'noodle', 'restoran', 'warung', 'mamak', 'kitchen', 'eatery', 'food', 'bbq', 'steamboat', 'hotpot', 'ramen', 'dim sum']],
  ['Groceries', ['grocer', 'supermarket', 'hypermarket', 'tesco', 'aeon', 'lotus', 'giant', 'jaya grocer', 'cold storage', 'fairprice', 'walmart', 'aldi', 'lidl', 'kroger', 'speedmart', 'mydin', 'village grocer', 'market']],
  ['Transport', ['grab', 'uber', 'lyft', 'taxi', 'petrol', 'petronas', 'shell', 'fuel', 'gas station', 'parking', 'toll', 'touch n go', 'tng', 'mrt', 'lrt', 'train', 'bus ', 'airasia', 'flight', 'airline', 'transit']],
  ['Entertainment', ['netflix', 'spotify', 'disney', 'youtube', 'cinema', 'tgv', 'gsc', 'steam', 'playstation', 'xbox', 'movie', 'concert', 'ticket', 'hbo', 'apple music']],
  ['Health', ['pharmacy', 'guardian', 'watsons', 'clinic', 'hospital', 'dental', 'dentist', 'doctor', 'medical', 'gym', 'fitness', 'optical', 'cvs']],
  ['Bills & Utilities', ['electric', 'tnb', 'water bill', 'syabas', 'internet', 'unifi', 'maxis', 'celcom', 'digi', 'u mobile', 'telco', 'singtel', 'starhub', 'insurance', 'takaful', 'rent', 'mortgage', 'loan', 'utility', 'utilities', 'bill payment', 'phone bill', 'tax', 'subscription']],
  ['Shopping', ['amazon', 'shopee', 'lazada', 'zalora', 'uniqlo', 'ikea', 'mall', 'store', 'shop', 'retail', 'fashion', 'ebay', 'target', 'h&m']],
]

const INCOME_RULES: [Category, string[]][] = [
  ['Salary', ['salary', 'payroll', 'wages', 'gaji', 'paycheck', 'paycheque']],
  ['Freelance', ['freelance', 'invoice', 'client', 'consulting', 'commission']],
  ['Investments', ['dividend', 'interest', 'investment', 'capital gain', 'coupon', 'asnb', 'stock']],
  ['Gift', ['gift', 'angpao', 'ang pao', 'red packet', 'duit raya', 'birthday']],
]

/** True if `keyword` appears at the start of a word, so "rent" matches "rent" but not "current". */
function hasKeyword(text: string, keyword: string): boolean {
  for (let i = text.indexOf(keyword); i >= 0; i = text.indexOf(keyword, i + 1)) {
    if (i === 0 || !/[a-z0-9]/.test(text[i - 1])) return true
  }
  return false
}

/**
 * The key a remembered category is saved under: the type plus the description with numbers,
 * punctuation and extra spaces removed, so "TRANSFER TO AHMAD 0123" and "Transfer to Ahmad
 * 0456" share one. Null when nothing useful is left (a description that's only numbers).
 */
export function categoryRuleKey(description: string, type: TransactionType): string | null {
  const words = description
    .toLowerCase()
    .replace(/[^a-z&]+/g, ' ')
    .trim()
  return words.length >= 3 ? `${type}|${words}` : null
}

/** Most remembered categories kept; the oldest are dropped first. */
export const MAX_CATEGORY_RULES = 500

/**
 * Adds remembered categories to `rules`, keeping the newest `MAX_CATEGORY_RULES`. Picking the
 * category the keywords would have guessed anyway removes the rule instead, so it can't go stale.
 */
export function learnCategories(
  rules: CategoryRules,
  picks: { description: string; type: TransactionType; category: Category }[],
): CategoryRules {
  const next = { ...rules }
  for (const { description, type, category } of picks) {
    const key = categoryRuleKey(description, type)
    if (!key) continue
    delete next[key]
    if (category !== categorize(description, type)) next[key] = category
  }
  const keys = Object.keys(next)
  return keys.length <= MAX_CATEGORY_RULES ? next : Object.fromEntries(keys.slice(-MAX_CATEGORY_RULES).map((k) => [k, next[k]]))
}

/**
 * Picks a likely category from a statement description: one the person picked before for
 * the same description (see `learnCategories`), otherwise the first keyword match, otherwise
 * "Other" / "Other income".
 */
export function categorize(description: string, type: TransactionType, remembered: CategoryRules = {}): Category {
  const key = categoryRuleKey(description, type)
  if (key && remembered[key]) return remembered[key]
  const text = description.toLowerCase()
  const rules = type === 'income' ? INCOME_RULES : EXPENSE_RULES
  for (const [category, keywords] of rules) {
    if (keywords.some((k) => hasKeyword(text, k))) return category
  }
  return fallbackCategory(type)
}
