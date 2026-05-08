// ============ HTTP CLIENT ============

export class ApiHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly endpoint: string
  readonly details?: string
  readonly payload?: unknown

  constructor(
    endpoint: string,
    status: number,
    statusText: string,
    details?: string,
    payload?: unknown
  ) {
    const suffix = details ? ` - ${details}` : ''
    super(`API Error: ${status} ${statusText}${suffix}`)
    this.name = 'ApiHttpError'
    this.endpoint = endpoint
    this.status = status
    this.statusText = statusText
    this.details = details
    this.payload = payload
  }
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private userRole: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setToken(token: string | null) {
    this.token = token
  }

  setUserRole(role: string | null) {
    this.userRole = role
  }

  getUserRole(): string | null {
    return this.userRole
  }

  private buildHeaders(options: RequestInit = {}): HeadersInit {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    const headers: HeadersInit = {
      'X-UCI-Platform': 'competencia-informacional',
      ...(options.headers || {}),
    }

    if (!isFormData && !(headers as Record<string, string>)['Content-Type']) {
      ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
    }

    if (this.token) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`
    }

    if (this.userRole) {
      ;(headers as Record<string, string>)['X-User-Role'] = this.userRole
    }

    return headers
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    responseType: 'json' | 'blob' | 'text' = 'json'
  ): Promise<T> {
    const headers = this.buildHeaders(options)

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })
    if (!response.ok) {
      let details: string | undefined
      let payload: unknown
      try {
        const raw = await response.text()
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            payload = parsed
            if (typeof parsed.message === 'string' && parsed.message.trim()) {
              details = parsed.message.trim()
            } else if (typeof parsed.error === 'string' && parsed.error.trim()) {
              details = parsed.error.trim()
            }
          } catch {
            details = raw.trim()
          }
        }
      } catch {
        details = undefined
      }

      throw new ApiHttpError(endpoint, response.status, response.statusText, details, payload)
    }

    if (responseType === 'blob') {
      return response.blob() as Promise<T>
    }

    if (response.status === 204) {
      return undefined as T
    }

    const contentType = response.headers.get('content-type') || ''

    if (responseType === 'text' || !contentType.includes('application/json')) {
      return (await response.text()) as T
    }

    const text = await response.text()
    if (!text) {
      return undefined as T
    }
    return JSON.parse(text) as T
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  getBlob(endpoint: string): Promise<Blob> {
    return this.request<Blob>(endpoint, { method: 'GET' }, 'blob')
  }

  post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  postForm<T>(endpoint: string, formData: FormData, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      ...options,
    })
  }

  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  async prefetch(endpoint: string): Promise<void> {
    const headers = this.buildHeaders()
    try {
      await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      })
    } catch {
      // Ignore prefetch failures
    }
  }
}

function normalizeApiBaseUrl(baseUrl?: string): string {
  const fallbackBaseUrl = '/api'
  const raw = baseUrl?.trim()
  if (!raw) return fallbackBaseUrl

  const normalizePath = (value: string): string => {
    const trimmed = value.replace(/\/+$/, '')
    if (!trimmed || trimmed === '/') return '/api'
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw)
      const normalizedPath = normalizePath(parsed.pathname || '/')
      return `${parsed.origin}${normalizedPath}`
    } catch {
      return fallbackBaseUrl
    }
  }

  return normalizePath(raw)
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)

export const api = new ApiClient(API_BASE_URL)
