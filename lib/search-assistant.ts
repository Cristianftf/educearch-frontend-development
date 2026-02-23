import { api } from './api-client'

export type AssistantOperator = 'AND' | 'OR' | 'NOT'

export interface SearchAssistantRequest {
  message: string
  selectedTerms?: string[]
  operators?: AssistantOperator[]
  recentTerms?: string[]
  filters?: {
    yearFrom?: number
    yearTo?: number
    studyTypes?: string[]
    hasFullText?: boolean
    language?: string
    minSampleSize?: number
    maxResults?: number
  }
}

export interface AssistantSuggestedTerm {
  id: string
  term: string
  description: string
}

export interface SearchAssistantResponse {
  reply: string
  suggestedTerms: AssistantSuggestedTerm[]
  suggestedOperators: AssistantOperator[]
  suggestedFilters?: {
    yearFrom?: number
    yearTo?: number
    studyTypes?: string[]
    hasFullText?: boolean
    language?: string
    minSampleSize?: number
    maxResults?: number
  }
  autoPlan?: {
    terms: string[]
    operators: AssistantOperator[]
    filters?: {
      yearFrom?: number
      yearTo?: number
      studyTypes?: string[]
      hasFullText?: boolean
      language?: string
      minSampleSize?: number
      maxResults?: number
    }
    rationale: string
  }
  canAutoApply: boolean
  tips: string[]
  usedAi: boolean
  fallbackUsed: boolean
}

function normalizeOperators(value: unknown): AssistantOperator[] {
  if (!Array.isArray(value)) return []
  const result: AssistantOperator[] = []
  for (const item of value) {
    if (item === 'AND' || item === 'OR' || item === 'NOT') {
      result.push(item)
    }
    if (result.length >= 3) break
  }
  return result
}

function normalizeSuggestedTerms(value: unknown): AssistantSuggestedTerm[] {
  if (!Array.isArray(value)) return []
  const result: AssistantSuggestedTerm[] = []
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i]
    if (!item || typeof item !== 'object') continue
    const term = typeof (item as Record<string, unknown>).term === 'string'
      ? ((item as Record<string, unknown>).term as string).trim()
      : ''
    if (!term) continue
    const id = typeof (item as Record<string, unknown>).id === 'string' &&
      ((item as Record<string, unknown>).id as string).trim()
      ? ((item as Record<string, unknown>).id as string)
      : term.toUpperCase().replace(/\s+/g, '_')
    const description = typeof (item as Record<string, unknown>).description === 'string' &&
      ((item as Record<string, unknown>).description as string).trim()
      ? ((item as Record<string, unknown>).description as string)
      : 'Termino sugerido por el asistente.'
    result.push({ id, term, description })
    if (result.length >= 4) break
  }
  return result
}

function normalizeTips(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const tips: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const tip = item.trim()
    if (!tip) continue
    tips.push(tip)
    if (tips.length >= 3) break
  }
  return tips
}

function normalizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const normalized = entry.trim()
    if (!normalized) continue
    items.push(normalized)
    if (items.length >= limit) break
  }
  return items
}

function normalizeResponse(value: unknown): SearchAssistantResponse {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const autoPlanRaw =
    item.autoPlan && typeof item.autoPlan === 'object' ? (item.autoPlan as Record<string, unknown>) : null
  const autoPlanTerms = autoPlanRaw ? normalizeStringArray(autoPlanRaw.terms, 4) : []
  const autoPlanOperators = autoPlanRaw ? normalizeOperators(autoPlanRaw.operators) : []
  const autoPlanRationale =
    autoPlanRaw && typeof autoPlanRaw.rationale === 'string' && autoPlanRaw.rationale.trim()
      ? autoPlanRaw.rationale.trim()
      : 'Plan sugerido por el asistente.'
  const autoPlanFilters =
    autoPlanRaw && autoPlanRaw.filters && typeof autoPlanRaw.filters === 'object'
      ? (autoPlanRaw.filters as SearchAssistantResponse['suggestedFilters'])
      : undefined

  return {
    reply:
      typeof item.reply === 'string' && item.reply.trim()
        ? item.reply.trim()
        : 'No fue posible generar una respuesta del asistente.',
    suggestedTerms: normalizeSuggestedTerms(item.suggestedTerms),
    suggestedOperators: normalizeOperators(item.suggestedOperators),
    suggestedFilters:
      item.suggestedFilters && typeof item.suggestedFilters === 'object'
        ? (item.suggestedFilters as SearchAssistantResponse['suggestedFilters'])
        : undefined,
    autoPlan:
      autoPlanTerms.length > 0
        ? {
            terms: autoPlanTerms.slice(0, 4),
            operators: autoPlanOperators,
            filters: autoPlanFilters,
            rationale: autoPlanRationale,
          }
        : undefined,
    canAutoApply: item.canAutoApply === true || autoPlanTerms.length > 0,
    tips: normalizeTips(item.tips),
    usedAi: item.usedAi === true,
    fallbackUsed: item.fallbackUsed === true,
  }
}

export const searchAssistantApi = {
  ask: async (request: SearchAssistantRequest): Promise<SearchAssistantResponse> => {
    const response = await api.post<SearchAssistantResponse>('/search/assistant', request)
    return normalizeResponse(response)
  },
}
