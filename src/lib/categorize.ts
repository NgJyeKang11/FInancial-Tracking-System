import { INCOME_CATEGORIES, type Category, type ExpenseCategory, type IncomeCategory, type TransactionType } from '../types'

/**
 * Keywords to look for in a bank statement description, checked top to bottom: the first
 * category with a matching keyword wins, so more specific ones (like "grabfood") come before
 * broader ones (like "grab").
 */
const EXPENSE_RULES: [ExpenseCategory, string[]][] = [
  ['Food & Drink', ['grabfood', 'foodpanda', 'deliveroo', 'ubereats', 'uber eats', 'doordash', 'starbucks', 'mcdonald', 'kfc', 'burger', 'pizza', 'sushi', 'restaurant', 'cafe', 'coffee', 'bakery', 'bistro', 'kopitiam', 'dining', 'food court', 'boba', 'tealive', 'noodle', 'restoran', 'warung', 'mamak', 'kitchen', 'eatery', 'food', 'bbq', 'steamboat', 'hotpot', 'ramen', 'dim sum']],
  ['Groceries', ['grocer', 'supermarket', 'hypermarket', 'tesco', 'aeon', 'lotus', 'giant', 'jaya grocer', 'cold storage', 'fairprice', 'walmart', 'aldi', 'lidl', 'kroger', 'speedmart', 'mydin', 'village grocer', 'market']],
  ['Transport', ['grab', 'uber', 'lyft', 'taxi', 'petrol', 'petronas', 'shell', 'fuel', 'gas station', 'parking', 'toll', 'touch n go', 'tng', 'mrt', 'lrt', 'train', 'bus ', 'airasia', 'flight', 'airline', 'transit']],
  ['Entertainment', ['netflix', 'spotify', 'disney', 'youtube', 'cinema', 'tgv', 'gsc', 'steam', 'playstation', 'xbox', 'movie', 'concert', 'ticket', 'hbo', 'apple music']],
  ['Health', ['pharmacy', 'guardian', 'watsons', 'clinic', 'hospital', 'dental', 'dentist', 'doctor', 'medical', 'gym', 'fitness', 'optical', 'cvs']],
  ['Bills & Utilities', ['electric', 'tnb', 'water bill', 'syabas', 'internet', 'unifi', 'maxis', 'celcom', 'digi', 'u mobile', 'telco', 'singtel', 'starhub', 'insurance', 'takaful', 'rent', 'mortgage', 'loan', 'utility', 'utilities', 'bill payment', 'phone bill', 'tax', 'subscription']],
  ['Shopping', ['amazon', 'shopee', 'lazada', 'zalora', 'uniqlo', 'ikea', 'mall', 'store', 'shop', 'retail', 'fashion', 'ebay', 'target', 'h&m']],
]

const INCOME_RULES: [IncomeCategory, string[]][] = [
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

/** Picks a likely category from a statement description. Falls back to "Other" / "Other income". */
export function categorize(description: string, type: TransactionType): Category {
  const text = description.toLowerCase()
  const rules: [Category, string[]][] = type === 'income' ? INCOME_RULES : EXPENSE_RULES
  for (const [category, keywords] of rules) {
    if (keywords.some((k) => hasKeyword(text, k))) return category
  }
  return type === 'income' ? INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1] : 'Other'
}
