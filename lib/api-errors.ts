import { ApiHttpError } from './api-client'

export function isConnectivityError(error: unknown): boolean {
  if (error instanceof ApiHttpError) return false
  if (error instanceof SyntaxError) return false

  if (error instanceof Error) {
    if (error.name === 'AbortError') return true
    if (/failed to fetch/i.test(error.message)) return true
    if (/network/i.test(error.message)) return true
    if (/load failed/i.test(error.message)) return true
    return !/^API Error:/.test(error.message)
  }

  return true
}

