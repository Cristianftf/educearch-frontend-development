import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'

type ImportErrorItem = { row: number; error: string }

type ImportCsvResponse = {
  created: number
  updated: number
  failed: number
  errors: ImportErrorItem[]
  warnings: string[]
}

type CsvUserPayload = {
  name: string
  email: string
  role: 'student' | 'professor' | 'admin'
  faculty?: string
  status?: 'active' | 'inactive' | 'pending'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function shouldFallback(error: unknown): boolean {
  if (isConnectivityError(error)) return true
  return error instanceof ApiHttpError && error.status >= 500
}

function sanitizeRole(value: unknown): CsvUserPayload['role'] {
  const normalized = asString(value, '').toLowerCase()
  if (normalized === 'professor' || normalized === 'admin') return normalized
  return 'student'
}

function sanitizeStatus(value: unknown): CsvUserPayload['status'] | undefined {
  const normalized = asString(value, '').toLowerCase()
  if (normalized === 'active' || normalized === 'inactive' || normalized === 'pending') return normalized
  return undefined
}

function sanitizeName(value: unknown): string {
  return asString(value, '').replace(/\s+/g, ' ').slice(0, 160)
}

function sanitizeEmail(value: unknown): string {
  return asString(value, '').toLowerCase().slice(0, 200)
}

function sanitizeFaculty(value: unknown): string | undefined {
  const normalized = asString(value, '').replace(/\s+/g, ' ').slice(0, 120)
  return normalized || undefined
}

function normalizeImportResponse(raw: unknown, defaultFailed = 0): ImportCsvResponse {
  if (!isRecord(raw)) {
    return {
      created: 0,
      updated: 0,
      failed: defaultFailed,
      errors: defaultFailed > 0 ? [{ row: 0, error: 'No se recibió una respuesta válida del servidor.' }] : [],
      warnings: [],
    }
  }

  const errors = asArray<unknown>(raw.errors)
    .map((item, index): ImportErrorItem | null => {
      if (isRecord(item)) {
        return {
          row: Math.max(0, Math.trunc(asNumber(item.row, 0))),
          error: asString(item.error, 'Error desconocido'),
        }
      }
      if (typeof item === 'string' && item.trim()) return { row: 0, error: item.trim() }
      if (item instanceof Error) return { row: 0, error: item.message }
      if (item !== null && item !== undefined) return { row: index + 1, error: String(item) }
      return null
    })
    .filter((item): item is ImportErrorItem => item !== null)

  return {
    created: Math.max(0, Math.trunc(asNumber(raw.created, 0))),
    updated: Math.max(0, Math.trunc(asNumber(raw.updated, 0))),
    failed: Math.max(0, Math.trunc(asNumber(raw.failed, defaultFailed))),
    errors,
    warnings: asArray<string>(raw.warnings).map((warning) => asString(warning, '')).filter(Boolean),
  }
}

function sanitizeCsvUsers(users: unknown[]): CsvUserPayload[] {
  return users
    .map((item) => {
      if (!isRecord(item)) return null
      const email = sanitizeEmail(item.email)
      const name = sanitizeName(item.name)
      if (!email || !name) return null
      const faculty = sanitizeFaculty(item.faculty)
      const status = sanitizeStatus(item.status)
      return {
        name,
        email,
        role: sanitizeRole(item.role),
        ...(faculty ? { faculty } : {}),
        ...(status ? { status } : {}),
      }
    })
    .filter((item): item is CsvUserPayload => item !== null)
}

export const adminImportApi = {
  importCsvUsers: async (users: unknown[]) => {
    const sourceUsers = Array.isArray(users) ? users : []
    if (sourceUsers.length === 0) {
      throw new Error('No hay usuarios para importar.')
    }
    if (sourceUsers.length > 10000) {
      throw new Error('El archivo excede el límite de 10,000 filas por importación.')
    }

    const sanitizedUsers = sanitizeCsvUsers(sourceUsers)
    if (sanitizedUsers.length === 0) {
      throw new Error('No se encontraron filas válidas para importar.')
    }

    try {
      const response = await api.post<unknown>('/admin/users/import-csv', { users: sanitizedUsers })
      return normalizeImportResponse(response, sourceUsers.length - sanitizedUsers.length)
    } catch (error) {
      if (shouldFallback(error)) return normalizeImportResponse(null, sourceUsers.length)
      throw error
    }
  },

  bulkImport: async (file: File) => {
    if (!(file instanceof File)) {
      throw new Error('Archivo de importación inválido.')
    }
    if (file.size <= 0) {
      throw new Error('El archivo CSV está vacío.')
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('El archivo CSV excede el límite de 10 MB.')
    }
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.postForm<unknown>('/admin/users/import', formData)
    return normalizeImportResponse(response)
  },
}
