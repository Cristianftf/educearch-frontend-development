export type ExternalApiActivityStatus = 'info' | 'success' | 'warning' | 'error'

export type ExternalApiActivityEvent = {
  id: string
  runId: string
  timestamp: string
  provider: string
  status: ExternalApiActivityStatus
  message: string
  latencyMs?: number
  resultCount?: number
}

type ExternalApiActivityListener = (event: ExternalApiActivityEvent) => void

const listeners = new Set<ExternalApiActivityListener>()

export function subscribeExternalApiActivity(listener: ExternalApiActivityListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitExternalApiActivity(
  payload: Omit<ExternalApiActivityEvent, 'id' | 'timestamp'> &
    Partial<Pick<ExternalApiActivityEvent, 'id' | 'timestamp'>>
): void {
  const event: ExternalApiActivityEvent = {
    ...payload,
    id: payload.id ?? `external-api-log-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  }
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // Ignore listener errors to avoid breaking the search flow.
    }
  }
}
