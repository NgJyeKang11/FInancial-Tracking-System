import { useEffect, useState } from 'react'

/** State that starts from saved data and is saved again whenever it changes. */
export function useStoredState<T>(load: () => T, save: (value: T) => void) {
  const [value, setValue] = useState<T>(load)

  useEffect(() => {
    save(value)
  }, [value, save])

  return [value, setValue] as const
}
