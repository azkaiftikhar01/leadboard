import { useCallback, useEffect, useState } from 'react'

const KEY = 'leadboard.theme'

/** Light by default. The choice sticks, and applies before paint via index.html. */
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) || 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(KEY, theme) } catch { /* private window */ }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), [])
  return { theme, toggle }
}
