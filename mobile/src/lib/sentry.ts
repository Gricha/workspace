import * as Sentry from '@sentry/react-native'

let isInitialized = false

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

  if (!dsn) {
    console.log('Sentry DSN not configured, skipping initialization')
    return
  }

  Sentry.init({
    dsn,
    enableInExpoDevelopment: false,
    debug: __DEV__,
  })

  isInitialized = true
}

export function setUserContext(serverUrl: string) {
  if (!isInitialized) return

  Sentry.setContext('server', {
    url: serverUrl,
  })
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!isInitialized) return

  Sentry.withScope((scope: Sentry.Scope) => {
    if (context) {
      scope.setContext('errorContext', context)
    }

    Sentry.captureException(error)
  })
}
