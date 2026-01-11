import { useState, useEffect, useMemo } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Sentry from '@sentry/react-native'
import { initSentry } from './src/lib/sentry'
import { TabNavigator } from './src/navigation/TabNavigator'
import { NetworkProvider, ConnectionBanner } from './src/lib/network'
import { SetupScreen } from './src/screens/SetupScreen'
import { loadServerConfig, isConfigured } from './src/lib/api'
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext'
import { ThemeColors } from './src/lib/themes'

initSentry()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
})

function createNavigationTheme(colors: ThemeColors, isDark: boolean) {
  return {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
  }
}

function AppContent() {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const { colors, themeId } = useTheme()

  const isDark = themeId !== 'concrete' && themeId !== 'blossom' && themeId !== 'slate'
  const navigationTheme = useMemo(() => createNavigationTheme(colors, isDark), [colors, isDark])

  useEffect(() => {
    loadServerConfig().then(() => {
      setConfigured(isConfigured())
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    )
  }

  if (!configured) {
    return (
      <>
        <SetupScreen onComplete={() => setConfigured(true)} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    )
  }

  return (
    <NetworkProvider>
      <NavigationContainer theme={navigationTheme}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <ConnectionBanner />
          <TabNavigator />
        </View>
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NetworkProvider>
  )
}

function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

export default Sentry.wrap(App)
