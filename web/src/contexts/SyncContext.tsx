import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { SyncToast } from '@/components/SyncToast'

interface SyncContextValue {
  showSyncNotification: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const [showToast, setShowToast] = useState(false)

  const showSyncNotification = useCallback(() => {
    setShowToast(true)
  }, [])

  const dismissToast = useCallback(() => {
    setShowToast(false)
  }, [])

  return (
    <SyncContext.Provider value={{ showSyncNotification }}>
      {children}
      <SyncToast show={showToast} onDismiss={dismissToast} />
    </SyncContext.Provider>
  )
}

export function useSyncNotification() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSyncNotification must be used within SyncProvider')
  }
  return context.showSyncNotification
}
