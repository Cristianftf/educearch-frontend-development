// ============ HTTP CLIENT ROBUSTO ============
// Incluye: timeouts, reintentos, rate limiting handling,
// detección de desconexión, y manejo de errores completo.

export class ApiHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly endpoint: string
  readonly details?: string
  readonly payload?: unknown
  readonly code?: string

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
    this.code = (payload as Record<string, unknown>)?.code as string | undefined
  }

  get isRateLimit(): boolean {
    return this.status === 429
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isServerError(): boolean {
    return this.status >= 500
  }

  get isPayloadTooLarge(): boolean {
    return this.status === 413
  }
}

export class ApiTimeoutError extends Error {
  readonly endpoint: string
  readonly timeoutMs: number

  constructor(endpoint: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms: ${endpoint}`)
    this.name = 'ApiTimeoutError'
    this.endpoint = endpoint
    this.timeoutMs = timeoutMs
  }
}

export class ApiNetworkError extends Error {
  readonly endpoint: string

  constructor(endpoint: string, message: string) {
    super(`Network error: ${message} - ${endpoint}`)
    this.name = 'ApiNetworkError'
    this.endpoint = endpoint
  }
}

export class ApiAbortedError extends Error {
  readonly endpoint: string

  constructor(endpoint: string) {
    super(`Request aborted: ${endpoint}`)
    this.name = 'ApiAbortedError'
    this.endpoint = endpoint
  }
}

interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  retryOnStatuses: number[]
}

type ApiRequestInit = RequestInit & {
  timeoutMs?: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 4000,
  retryOnStatuses: [408, 429, 500, 502, 503, 504],
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private userRole: string | null = null
  private defaultTimeoutMs: number
  private retryConfig: RetryConfig
  private abortControllers: Map<string, AbortController> = new Map()

  constructor(
    baseUrl: string,
    timeoutMs = 30000,
    retryConfig: Partial<RetryConfig> = {}
  ) {
    this.baseUrl = baseUrl
    this.defaultTimeoutMs = timeoutMs
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
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

  /**
   * Aborta una petición en curso
   */
  abort(endpoint: string) {
    const controller = this.abortControllers.get(endpoint)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(endpoint)
    }
  }

  /**
   * Aborta todas las peticiones en curso
   */
  abortAll() {
    this.abortControllers.forEach((controller) => controller.abort())
    this.abortControllers.clear()
  }

  private buildHeaders(options: RequestInit = {}): HeadersInit {
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData
    const headers = new Headers(options.headers)
    headers.set('X-UCI-Platform', 'competencia-informacional')

    if (
      !isFormData &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json')
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }

    if (this.userRole) {
      headers.set('X-User-Role', this.userRole)
    }

    return headers
  }

  private async requestWithTimeout<T>(
    endpoint: string,
    options: RequestInit,
    timeoutMs?: number
  ): Promise<Response> {
    const actualTimeout = timeoutMs ?? this.defaultTimeoutMs
    const controller = new AbortController()
    const externalSignal = options.signal
    let timedOut = false
    this.abortControllers.set(endpoint, controller)

    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
      this.abortControllers.delete(endpoint)
    }, actualTimeout)

    if (externalSignal?.aborted) {
      clearTimeout(timeoutId)
      this.abortControllers.delete(endpoint)
      throw new ApiAbortedError(endpoint)
    }

    const handleExternalAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', handleExternalAbort, { once: true })
    const { signal: _signal, ...fetchOptions } = options

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
      })
      return response
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (timedOut) {
          throw new ApiTimeoutError(endpoint, actualTimeout)
        }
        throw new ApiAbortedError(endpoint)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', handleExternalAbort)
      this.abortControllers.delete(endpoint)
    }
  }

  private async executeWithRetry<T>(
    endpoint: string,
    executeFn: () => Promise<T>,
    method: string,
    retryCount = 0
  ): Promise<T> {
    try {
      return await executeFn()
    } catch (error) {
      const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
      // No reintentar en ciertos errores
      if (error instanceof ApiTimeoutError) {
        throw error // Timeout no se reintenta por defecto
      }

      if (error instanceof ApiHttpError) {
        if (
          error.isUnauthorized ||
          error.isForbidden ||
          error.isNotFound ||
          error.isPayloadTooLarge
        ) {
          throw error // No reintentar errores de cliente específicos
        }

        if (
          error.isRateLimit &&
          isSafeMethod &&
          retryCount < this.retryConfig.maxRetries
        ) {
          // Para rate limiting, esperar más tiempo (Retry-After header)
          const delayMs = this.computeRateLimitDelay()
          await this.sleep(delayMs)
          return this.executeWithRetry(endpoint, executeFn, method, retryCount + 1)
        }

        if (
          error.isServerError &&
          isSafeMethod &&
          retryCount < this.retryConfig.maxRetries
        ) {
          const delayMs = this.computeBackoff(retryCount)
          await this.sleep(delayMs)
          return this.executeWithRetry(endpoint, executeFn, method, retryCount + 1)
        }

        throw error
      }

      // Errores de red: reintentar
      if (
        error instanceof ApiNetworkError &&
        isSafeMethod &&
        retryCount < this.retryConfig.maxRetries
      ) {
        const delayMs = this.computeBackoff(retryCount)
        await this.sleep(delayMs)
        return this.executeWithRetry(endpoint, executeFn, method, retryCount + 1)
      }

      // Error desconocido
      throw error
    }
  }

  private computeBackoff(retryCount: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(2, retryCount)
    const jitter = Math.random() * 0.3 * delay // 30% jitter
    return Math.min(delay + jitter, this.retryConfig.maxDelayMs)
  }

  private computeRateLimitDelay(): number {
    // Esperar 5 segundos para rate limiting
    return 5000 + Math.random() * 3000
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async parseErrorResponse(
    endpoint: string,
    response: Response
  ): Promise<ApiHttpError> {
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
          } else if (
            typeof parsed.error === 'string' &&
            parsed.error.trim()
          ) {
            details = parsed.error.trim()
          }
        } catch {
          details = raw.trim()
        }
      }
    } catch {
      details = undefined
    }

    return new ApiHttpError(
      endpoint,
      response.status,
      response.statusText,
      details,
      payload
    )
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestInit = {},
    responseType: 'json' | 'blob' | 'text' = 'json'
  ): Promise<T> {
    const { timeoutMs, ...fetchOptions } = options
    const method = (fetchOptions.method || 'GET').toUpperCase()
    const headers = this.buildHeaders(options)
    const requestOptions = { ...fetchOptions, headers }

    return this.executeWithRetry(endpoint, async () => {
      let response: Response

      try {
        response = await this.requestWithTimeout(endpoint, requestOptions, timeoutMs)
      } catch (error) {
        if (error instanceof ApiTimeoutError) {
          throw error
        }
        if (error instanceof ApiAbortedError) {
          throw error
        }
        if (error instanceof TypeError) {
          // Errores de red (fetch lanza TypeError en fallos de red)
          throw new ApiNetworkError(
            endpoint,
            error.message || 'Failed to fetch'
          )
        }
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          throw new ApiAbortedError(endpoint)
        }
        throw new ApiNetworkError(
          endpoint,
          error instanceof Error ? error.message : 'Unknown network error'
        )
      }

      if (!response.ok) {
        throw await this.parseErrorResponse(endpoint, response)
      }

      if (responseType === 'blob') {
        return response.blob() as Promise<T>
      }

      if (response.status === 204) {
        return undefined as T
      }

      const contentType = response.headers.get('content-type') || ''

      if (
        responseType === 'text' ||
        !contentType.includes('application/json')
      ) {
        return (await response.text()) as T
      }

      const text = await response.text()
      if (!text) {
        return undefined as T
      }
      return JSON.parse(text) as T
    }, method)
  }

  get<T>(endpoint: string, timeoutMs?: number): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      timeoutMs,
    })
  }

  getBlob(endpoint: string): Promise<Blob> {
    return this.request<Blob>(endpoint, { method: 'GET' }, 'blob')
  }

  post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  postForm<T>(
    endpoint: string,
    formData: FormData,
    options?: RequestInit
  ): Promise<T> {
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

  patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  async prefetch(endpoint: string): Promise<void> {
    const headers = this.buildHeaders()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })
    } catch {
      // Ignore prefetch failures
    } finally {
      clearTimeout(timeoutId)
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

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL
)

export const api = new ApiClient(API_BASE_URL)
