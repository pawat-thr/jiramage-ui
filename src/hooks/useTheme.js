import { useEffect, useState } from 'react'
import { getThemePref, setThemePref, watchSystemTheme } from '../utils/theme.js'

export function useTheme() {
  const [pref, setPref] = useState(getThemePref())

  useEffect(watchSystemTheme, [])

  const change = (next) => {
    setThemePref(next)
    setPref(next)
  }

  return [pref, change]
}
