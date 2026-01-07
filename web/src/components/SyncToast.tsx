import { useEffect } from 'react'
import { Check } from 'lucide-react'

interface SyncToastProps {
  show: boolean
  onDismiss: () => void
}

export function SyncToast({ show, onDismiss }: SyncToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onDismiss, 2500)
      return () => clearTimeout(timer)
    }
  }, [show, onDismiss])

  if (!show) return null

  return (
    <div
      data-testid="sync-toast"
      className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200"
    >
      <div className="bg-card border rounded-lg shadow-lg p-3 flex items-center gap-3">
        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
        <span className="text-sm">Synced to workspaces</span>
      </div>
    </div>
  )
}
