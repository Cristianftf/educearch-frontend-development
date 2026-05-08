import type { SearchHedge } from '@/types'
import { api } from './api-client'

type HedgeTestResponse = {
  query?: string
  resultCount?: number
  estimatedPrecision?: number
  estimatedRecall?: number
  status?: string
  message?: string
}

const MAX_HEDGE_NAME_LENGTH = 120
const MAX_HEDGE_QUERY_LENGTH = 1500
const MAX_HEDGE_DESCRIPTION_LENGTH = 800

function sanitizeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return normalized || fallback
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeRatio(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return clampNumber(value, 0, 1)
}

function normalizeHedge(value: unknown, fallbackId?: string): SearchHedge {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const id = sanitizeString(item.id, fallbackId ?? `hedge-${Date.now()}`)
  const name = sanitizeString(item.name, 'Hedge sin nombre').slice(0, MAX_HEDGE_NAME_LENGTH)
  const category = sanitizeString(item.category, 'General')
  const query = sanitizeString(item.query).slice(0, MAX_HEDGE_QUERY_LENGTH)
  const description = sanitizeString(item.description).slice(0, MAX_HEDGE_DESCRIPTION_LENGTH)
  const estimatedResults =
    typeof item.estimatedResults === 'number' && Number.isFinite(item.estimatedResults)
      ? Math.max(0, Math.round(item.estimatedResults))
      : 0
  const precision = normalizeRatio(item.precision)
  const recall = normalizeRatio(item.recall)
  return {
    id,
    name,
    category,
    query,
    description,
    estimatedResults,
    precision,
    recall,
    createdBy: sanitizeString(item.createdBy, 'system'),
    createdAt: sanitizeString(item.createdAt, new Date().toISOString()),
    isTemplate: item.isTemplate === true,
  }
}

function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return ['General']
  const unique = new Set<string>()
  for (const item of value) {
    const category = sanitizeString(item)
    if (!category) continue
    unique.add(category)
  }
  if (!unique.has('General')) {
    unique.add('General')
  }
  return Array.from(unique)
}

function normalizeCreatePayload(
  hedge: Omit<SearchHedge, 'id' | 'createdAt' | 'createdBy'>
): Omit<SearchHedge, 'id' | 'createdAt' | 'createdBy'> {
  const name = sanitizeString(hedge.name).slice(0, MAX_HEDGE_NAME_LENGTH)
  const query = sanitizeString(hedge.query).slice(0, MAX_HEDGE_QUERY_LENGTH)
  if (!name) {
    throw new Error('El nombre del hedge es obligatorio.')
  }
  if (!query) {
    throw new Error('La query del hedge es obligatoria.')
  }
  return {
    ...hedge,
    name,
    category: sanitizeString(hedge.category, 'General'),
    query,
    description: sanitizeString(hedge.description).slice(0, MAX_HEDGE_DESCRIPTION_LENGTH),
    estimatedResults:
      typeof hedge.estimatedResults === 'number' && Number.isFinite(hedge.estimatedResults)
        ? Math.max(0, Math.round(hedge.estimatedResults))
        : 0,
    precision: normalizeRatio(hedge.precision),
    recall: normalizeRatio(hedge.recall),
    isTemplate: hedge.isTemplate === true,
  }
}

export const hedgesApi = {
  getAll: (category?: string) =>
    api
      .get<SearchHedge[]>(`/hedges${category ? `?category=${category}` : ''}`)
      .then((hedges) => {
        const normalized = Array.isArray(hedges)
          ? hedges.map((hedge, index) => normalizeHedge(hedge, `hedge-${index + 1}`))
          : []
        return category
          ? normalized.filter((hedge) => hedge.category === category)
          : normalized
      }),

  getCategories: () =>
    api.get<string[]>('/hedges/categories')
      .then((categories) => normalizeCategories(categories)),

  create: (hedge: Omit<SearchHedge, 'id' | 'createdAt' | 'createdBy'>) =>
    api.post<SearchHedge>('/hedges', normalizeCreatePayload(hedge))
      .then((response) => normalizeHedge(response)),

  update: (id: string, hedge: Partial<SearchHedge>) =>
    api.put<SearchHedge>(`/hedges/${id}`, {
      ...hedge,
      name: typeof hedge.name === 'string' ? sanitizeString(hedge.name).slice(0, MAX_HEDGE_NAME_LENGTH) : hedge.name,
      category: typeof hedge.category === 'string' ? sanitizeString(hedge.category, 'General') : hedge.category,
      query: typeof hedge.query === 'string' ? sanitizeString(hedge.query).slice(0, MAX_HEDGE_QUERY_LENGTH) : hedge.query,
      description:
        typeof hedge.description === 'string'
          ? sanitizeString(hedge.description).slice(0, MAX_HEDGE_DESCRIPTION_LENGTH)
          : hedge.description,
    }).then((response) => normalizeHedge(response, id)),

  delete: (id: string) => api.delete<void>(`/hedges/${id}`),

  test: (query: string) =>
    api.post<HedgeTestResponse>('/hedges/test', {
      query: sanitizeString(query).slice(0, MAX_HEDGE_QUERY_LENGTH),
    }).then((response) => {
      const item = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
      return {
        query: sanitizeString(item.query),
        resultCount:
          typeof item.resultCount === 'number' && Number.isFinite(item.resultCount)
            ? Math.max(0, Math.round(item.resultCount))
            : 0,
        estimatedPrecision: normalizeRatio(item.estimatedPrecision),
        estimatedRecall: normalizeRatio(item.estimatedRecall),
        status: sanitizeString(item.status, 'ok'),
        message: sanitizeString(item.message),
      }
    }),
}
