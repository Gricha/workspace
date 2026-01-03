import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TabNavigator } from './src/navigation/TabNavigator'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
})

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0a84ff',
    background: '#000',
    card: '#1c1c1e',
    text: '#fff',
    border: '#2c2c2e',
    notification: '#ff3b30',
  },
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={DarkTheme}>
        <TabNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </QueryClientProvider>
  )
}
