import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeId, ThemeColors, themeColors, themeDefinitions } from '../lib/themes'

const STORAGE_KEY = 'perry_theme'

interface ThemeContextValue {
  themeId: ThemeId
  colors: ThemeColors
  setTheme: (id: ThemeId) => void
  definitions: typeof themeDefinitions
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('default')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && stored in themeColors) {
        setThemeId(stored as ThemeId)
      }
      setIsLoaded(true)
    })
  }, [])

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id)
    AsyncStorage.setItem(STORAGE_KEY, id)
  }, [])

  const colors = themeColors[themeId]

  if (!isLoaded) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ themeId, colors, setTheme, definitions: themeDefinitions }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
