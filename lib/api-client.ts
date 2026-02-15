// ============ HTTP CLIENT ============

export class ApiHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly endpoint: string

  constructor(endpoint: string, status: number, statusText: string) {
    super(`API Error: ${status} ${statusText}`)
    this.name = 'ApiHttpError'
    this.endpoint = endpoint
    this.status = status
    this.statusText = statusText
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
      if (response.status === 401) {
        const isAuthEndpoint =
          endpoint.startsWith('/auth/login') ||
          endpoint.startsWith('/auth/register') ||
          endpoint.startsWith('/auth/forgot-password') ||
          endpoint.startsWith('/auth/reset-password')

        if (!isAuthEndpoint) {
          // Handle unauthorized - redirect to login
          window.location.href = '/login'
        }
      }
      throw new ApiHttpError(endpoint, response.status, response.statusText)
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export const api = new ApiClient(API_BASE_URL)
