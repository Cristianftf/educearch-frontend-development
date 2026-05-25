export const STUDENT_FALLBACK_KEYS = {
  searchHistory: 'student_fallback_search_history_v1',
  searchSessions: 'student_fallback_search_sessions_v1',
  verificationHistory: 'student_fallback_verification_history_v1',
  bibliographyHistory: 'student_fallback_bibliography_history_v1',
  caseStudies: 'student_fallback_case_studies_v1',
  caseSubmissions: 'student_fallback_case_submissions_v1',
  professorAnalyticsOverview: 'professor_fallback_analytics_overview_v1',
  professorHedges: 'professor_fallback_hedges_v1',
} as const

const BACKEND_STATUS_TTL_MS = 15000
const BACKEND_CHECK_TIMEOUT_MS = 1500

let backendStatusCache: { checkedAt: number; isAvailable: boolean } | null = null

export const isClient = () => typeof window !== 'undefined'

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.')
  if (segments.length < 2) return null
  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json =
      typeof window !== 'undefined' && typeof window.atob === 'function'
        ? window.atob(padded)
        : ''
    if (!json) return null
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

function normalizeScopePart(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_')
  return normalized || 'anonymous'
}

export function getStorageScope(): string {
  if (!isClient()) return 'server'
  const token = window.localStorage.getItem('auth_token')
  if (!token) return 'anonymous'

  const payload = decodeJwtPayload(token)
  const subject = typeof payload?.sub === 'string' ? payload.sub : 'anonymous'
  const authorities = typeof payload?.authorities === 'string' ? payload.authorities : ''
  const role = authorities
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .find((item) => item.startsWith('role_'))
    ?.replace('role_', '')

  if (role) {
    return `${normalizeScopePart(role)}:${normalizeScopePart(subject)}`
  }
  return normalizeScopePart(subject)
}

export function getScopedStorageKey(baseKey: string): string {
  return `${baseKey}:${getStorageScope()}`
}

export function readLocalStorage<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeLocalStorage<T>(key: string, value: T): void {
  if (!isClient()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore local persistence errors
  }
}

export function paginateItems<T>(items: T[], page = 1, limit = 10): { pageItems: T[]; total: number } {
  const safePage = Math.max(1, Math.trunc(page))
  const safeLimit = Math.max(1, Math.trunc(limit))
  const start = (safePage - 1) * safeLimit
  return {
    pageItems: items.slice(start, start + safeLimit),
    total: items.length,
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim()
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/+$/, '')
  }
  if (normalized.startsWith('/')) {
    return normalized.replace(/\/+$/, '')
  }
  return `/${normalized.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

export async function isBackendReachable(forceRefresh = false): Promise<boolean> {
  if (!isClient()) return true

  if (
    !forceRefresh &&
    backendStatusCache &&
    Date.now() - backendStatusCache.checkedAt < BACKEND_STATUS_TTL_MS
  ) {
    return backendStatusCache.isAvailable
  }

  const apiBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL || '/api')
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_CHECK_TIMEOUT_MS)

  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    const isAvailable = response.status < 500
    backendStatusCache = { checkedAt: Date.now(), isAvailable }
    return isAvailable
  } catch {
    backendStatusCache = { checkedAt: Date.now(), isAvailable: false }
    return false
  } finally {
    window.clearTimeout(timeoutId)
  }
}
