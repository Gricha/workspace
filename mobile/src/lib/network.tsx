import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { api, getBaseUrl } from './api'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'server-unreachable'

interface NetworkContextValue {
  status: ConnectionStatus
  isOnline: boolean
  lastError: string | null
  checkConnection: () => Promise<void>
  serverHostname: string | null
}

const NetworkContext = createContext<NetworkContextValue>({
  status: 'connecting',
  isOnline: false,
  lastError: null,
  checkConnection: async () => {},
  serverHostname: null,
})

export function useNetwork() {
  return useContext(NetworkContext)
}

interface NetworkProviderProps {
  children: ReactNode
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [isOnline, setIsOnline] = useState(true)
  const [lastError, setLastError] = useState<string | null>(null)
  const [serverHostname, setServerHostname] = useState<string | null>(null)

  const checkConnection = useCallback(async () => {
    setStatus('connecting')
    setLastError(null)

    try {
      const info = await api.getInfo()
      setStatus('connected')
      setServerHostname(info.hostname)
      setLastError(null)
    } catch (err) {
      const error = err as Error
      const message = error.message || 'Unknown error'

      if (message.includes('Network request failed') || message.includes('fetch')) {
        setStatus('server-unreachable')
        setLastError(`Cannot reach server at ${getBaseUrl()}. Check your Tailscale connection or server URL.`)
      } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        setStatus('server-unreachable')
        setLastError('Connection timed out. The server may be unreachable over Tailscale.')
      } else {
        setStatus('disconnected')
        setLastError(message)
      }
      setServerHostname(null)
    }
  }, [])

  useEffect(() => {
    checkConnection()

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false
      setIsOnline(online)

      if (!online) {
        setStatus('disconnected')
        setLastError('No network connection')
      } else if (status === 'disconnected') {
        checkConnection()
      }
    })

    const interval = setInterval(() => {
      if (status === 'server-unreachable' || status === 'disconnected') {
        checkConnection()
      }
    }, 30000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [checkConnection, status])

  return (
    <NetworkContext.Provider value={{ status, isOnline, lastError, checkConnection, serverHostname }}>
      {children}
    </NetworkContext.Provider>
  )
}

export function ConnectionBanner() {
  const { status, lastError, checkConnection } = useNetwork()
  const insets = useSafeAreaInsets()
  const [fadeAnim] = useState(new Animated.Value(0))
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    const shouldShow = status === 'disconnected' || status === 'server-unreachable'
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [status, fadeAnim])

  const handleRetry = async () => {
    setIsRetrying(true)
    await checkConnection()
    setIsRetrying(false)
  }

  if (status === 'connected' || status === 'connecting') {
    return null
  }

  const isServerUnreachable = status === 'server-unreachable'

  return (
    <Animated.View style={[styles.banner, isServerUnreachable ? styles.bannerWarning : styles.bannerError, { opacity: fadeAnim, paddingTop: insets.top + 12 }]}>
      <View style={styles.bannerContent}>
        <Text style={styles.bannerIcon}>{isServerUnreachable ? '⚠' : '✕'}</Text>
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>
            {isServerUnreachable ? 'Server Unreachable' : 'Connection Lost'}
          </Text>
          <Text style={styles.bannerMessage} numberOfLines={2}>
            {lastError || (isServerUnreachable
              ? 'Check your Tailscale VPN or server settings'
              : 'Check your network connection')}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={handleRetry}
        disabled={isRetrying}
      >
        <Text style={styles.retryText}>{isRetrying ? '...' : 'Retry'}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export function withNetworkCheck<T extends object>(
  WrappedComponent: React.ComponentType<T>
): React.FC<T> {
  return function NetworkCheckedComponent(props: T) {
    useNetwork()

    return (
      <View style={{ flex: 1 }}>
        <ConnectionBanner />
        <WrappedComponent {...props} />
      </View>
    )
  }
}

export function parseNetworkError(error: unknown): string {
  const err = error as Error
  const message = err?.message || 'Unknown error'

  if (message.includes('Network request failed')) {
    return 'Cannot connect to server. Check your Tailscale VPN connection and server URL in Settings.'
  }
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return 'Request timed out. The server may be unreachable or slow to respond.'
  }
  if (message.includes('ECONNREFUSED')) {
    return 'Connection refused. Make sure the workspace agent is running.'
  }
  if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
    return 'Server not found. Check your server URL in Settings.'
  }
  if (message.includes('certificate') || message.includes('SSL')) {
    return 'SSL/TLS error. Check your server URL protocol (http vs https).'
  }

  return message
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerError: {
    backgroundColor: '#ff3b30',
  },
  bannerWarning: {
    backgroundColor: '#ff9f0a',
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  bannerMessage: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    marginLeft: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
})
