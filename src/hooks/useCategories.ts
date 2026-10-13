import { createContext, useContext } from 'react'
import { categoriesFor, type Category, type CustomCategory, type TransactionType } from '../types'

/** The person's own categories, shared with every component that offers a category choice. */
export const CustomCategoriesContext = createContext<CustomCategory[]>([])

export const useCustomCategories = () => useContext(CustomCategoriesContext)

/** The category choices for a type, including the person's own. */
export function useCategoryChoices(type: TransactionType): Category[] {
  return categoriesFor(type, useCustomCategories())
}
