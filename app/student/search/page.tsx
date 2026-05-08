'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { searchApi } from '@/lib/api'
import { searchAssistantApi } from '@/lib/search-assistant'
import type { AssistantConversationMessage } from '@/lib/search-assistant'
import type { MeshTerm, SearchQuery, SearchSession, SearchFilters, SearchResult } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Plus,
  X,
  Sparkles,
  MessageSquare,
  History,
  Star,
  StarOff,
  Loader2,
  AlertCircle,
  BookOpen,
  Users,
  Calendar,
  ExternalLink,
  GripVertical,
  Palette,
  Settings,
  CheckCircle2,
  Activity,
} from 'lucide-react'
import QueryBuilder from '@/components/query-builder'
import { useStudent } from '@/contexts/student-context'
import { useStudentSearch } from '@/hooks/use-student-search'
import {
  subscribeExternalApiActivity,
  type ExternalApiActivityEvent,
} from '@/lib/external-api-activity'
import {
  type RequestLoadProfile,
  DEFAULT_REQUEST_LOAD_PROFILE,
  REQUEST_LOAD_PROFILE_LABELS,
  REQUEST_LOAD_PROFILE_DESCRIPTIONS,
  SEARCH_MAX_RESULTS_BY_PROFILE,
  normalizeRequestLoadProfile,
  readStoredRequestLoadProfile,
  writeStoredRequestLoadProfile,
} from '@/lib/request-load-profile'

const BOOLEAN_OPERATORS = ['AND', 'OR', 'NOT'] as const
type BooleanOperator = (typeof BOOLEAN_OPERATORS)[number]

const STUDY_TYPES = [
  { id: 'systematic_review', label: 'Revision sistematica' },
  { id: 'meta_analysis', label: 'Metaanalisis' },
  { id: 'rct', label: 'Ensayo clinico aleatorizado' },
  { id: 'cohort', label: 'Estudio de cohorte' },
  { id: 'case_control', label: 'Caso-control' },
  { id: 'case_report', label: 'Reporte de caso' },
]

const LANGUAGE_OPTIONS = [
  { id: 'eng', label: 'Ingles' },
  { id: 'spa', label: 'Espanol' },
  { id: 'por', label: 'Portugues' },
]

const STUDY_TYPE_IDS = new Set(STUDY_TYPES.map((type) => type.id))
const LANGUAGE_IDS = new Set(LANGUAGE_OPTIONS.map((language) => language.id))
const YEAR_MIN = 2000
const YEAR_MAX = 2026
const MAX_EXTERNAL_ACTIVITY_EVENTS = 80
const MIN_MESH_INPUT_CHARS = 2
const MAX_MESH_INPUT_LENGTH = 180
const MAX_SELECTED_RESULTS = 200
const MAX_ASSISTANT_MESSAGES = 18

type NormalizedSearchFilters = Required<
  Pick<SearchFilters, 'yearRange' | 'studyTypes' | 'minSampleSize' | 'languages' | 'hasFullText' | 'maxResults'>
>

type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type AssistantSuggestedFilters = {
  yearFrom?: number
  yearTo?: number
  studyTypes?: string[]
  hasFullText?: boolean
  language?: string
  minSampleSize?: number
  maxResults?: number
}

type AssistantAutoPlan = {
  terms: string[]
  operators: BooleanOperator[]
  filters?: AssistantSuggestedFilters
  rationale: string
}

const DEFAULT_FILTERS: NormalizedSearchFilters = {
  yearRange: [2018, 2026],
  studyTypes: [],
  minSampleSize: 0,
  languages: ['eng'],
  hasFullText: false,
  maxResults: 30,
}

const INITIAL_ASSISTANT_MESSAGE =
  'Soy tu asistente IA de busqueda clinica. Puedo sugerir terminos MeSH, operadores y filtros listos para aplicar.'

const ASSISTANT_PROJECT_CONTEXT =
  'Proyecto EDUSEARCH: asistente de busqueda avanzada en salud para estudiantes y profesores. ' +
  'Objetivo: mejorar estrategias con terminos MeSH, operadores booleanos y filtros clinicos aplicables. ' +
  'Prioriza evidencia de alta calidad (revision sistematica, metaanalisis, ECA), evita inventar datos y entrega recomendaciones accionables listas para aplicar en la interfaz.'

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const sanitizeInputText = (value: string) => value.trim().slice(0, MAX_MESH_INPUT_LENGTH)

const normalizeQueryMode = (value: string): 'visual' | 'advanced' =>
  value === 'visual' || value === 'advanced' ? value : 'advanced'

const normalizeBooleanOperator = (value: unknown): BooleanOperator | null =>
  value === 'AND' || value === 'OR' || value === 'NOT' ? value : null

const buildSafeExternalUrl = (sourceUrl?: string, doi?: string): string | null => {
  const source = typeof sourceUrl === 'string' ? sourceUrl.trim() : ''
  if (/^https?:\/\//i.test(source)) {
    return source
  }
  const normalizedDoi = typeof doi === 'string' ? doi.trim() : ''
  if (normalizedDoi) {
    return `https://doi.org/${normalizedDoi}`
  }
  return null
}

const formatActivityTimestamp = (timestamp: string): string => {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return '--:--:--'
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const getActivityDotClassName = (status: ExternalApiActivityEvent['status']): string => {
  switch (status) {
    case 'success':
      return 'bg-emerald-500'
    case 'warning':
      return 'bg-amber-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-blue-500'
  }
}

const getActivityItemClassName = (status: ExternalApiActivityEvent['status']): string => {
  switch (status) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50/70'
    case 'warning':
      return 'border-amber-200 bg-amber-50/70'
    case 'error':
      return 'border-red-200 bg-red-50/70'
    default:
      return 'border-border bg-background'
  }
}

const buildAssistantConversationHistory = (
  messages: AssistantMessage[],
  nextUserMessage: AssistantMessage
): AssistantConversationMessage[] =>
  [...messages, nextUserMessage]
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim(),
    }))
    .filter((entry) => entry.content.length > 0)
    .slice(-8)

const normalizeYearRange = (range?: SearchFilters['yearRange']): [number, number] => {
  if (!Array.isArray(range) || range.length !== 2) {
    return DEFAULT_FILTERS.yearRange
  }
  const [fromRaw, toRaw] = range
  const from =
    typeof fromRaw === 'number' && Number.isFinite(fromRaw) ? fromRaw : DEFAULT_FILTERS.yearRange[0]
  const to =
    typeof toRaw === 'number' && Number.isFinite(toRaw) ? toRaw : DEFAULT_FILTERS.yearRange[1]
  const clampedFrom = clampNumber(from, YEAR_MIN, YEAR_MAX)
  const clampedTo = clampNumber(to, YEAR_MIN, YEAR_MAX)
  return clampedFrom <= clampedTo ? [clampedFrom, clampedTo] : [clampedTo, clampedFrom]
}

const normalizeStudyTypes = (studyTypes?: SearchFilters['studyTypes']) => {
  if (!Array.isArray(studyTypes)) return []
  const unique = new Set<string>()
  for (const entry of studyTypes) {
    if (typeof entry === 'string' && STUDY_TYPE_IDS.has(entry)) {
      unique.add(entry)
    }
  }
  return Array.from(unique)
}

const normalizeLanguages = (languages?: SearchFilters['languages']) => {
  if (!Array.isArray(languages) || languages.length === 0) return DEFAULT_FILTERS.languages
  const selected = languages
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => LANGUAGE_IDS.has(entry))
  return selected.length > 0 ? [selected[0]] : DEFAULT_FILTERS.languages
}

const normalizeFilters = (filters?: SearchFilters): NormalizedSearchFilters => ({
  yearRange: normalizeYearRange(filters?.yearRange),
  studyTypes: normalizeStudyTypes(filters?.studyTypes),
  minSampleSize:
    typeof filters?.minSampleSize === 'number' && Number.isFinite(filters.minSampleSize)
      ? clampNumber(filters.minSampleSize, 0, 1000)
      : DEFAULT_FILTERS.minSampleSize,
  languages: normalizeLanguages(filters?.languages),
  hasFullText: filters?.hasFullText === true,
  maxResults:
    typeof filters?.maxResults === 'number' && Number.isFinite(filters.maxResults)
      ? clampNumber(filters.maxResults, 5, 200)
      : DEFAULT_FILTERS.maxResults,
})

const normalizeStudyTypeValue = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  switch (normalized) {
    case 'systematic_review':
    case 'systematicreview':
      return 'systematic_review'
    case 'meta_analysis':
    case 'metaanalysis':
      return 'meta_analysis'
    case 'rct':
    case 'randomized_controlled_trial':
    case 'randomizedcontrolledtrial':
      return 'rct'
    case 'cohort':
    case 'cohort_study':
    case 'cohortstudy':
      return 'cohort'
    case 'case_control':
    case 'casecontrol':
      return 'case_control'
    case 'case_report':
    case 'casereport':
      return 'case_report'
    default:
      return normalized
  }
}

const areOperatorsEqual = (a?: BooleanOperator[], b?: BooleanOperator[]) => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

const areTermsEqual = (a?: MeshTerm[], b?: MeshTerm[]) => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (left?.id !== right?.id || left?.term !== right?.term) {
      return false
    }
  }
  return true
}

const sanitizeMeshTerms = (terms: MeshTerm[]): MeshTerm[] => {
  const unique = new Set<string>()
  const sanitized: MeshTerm[] = []

  for (const term of terms) {
    const rawTerm = typeof term?.term === 'string' ? term.term.trim() : ''
    if (!rawTerm) continue
    const normalizedKey = rawTerm.toLowerCase()
    if (unique.has(normalizedKey)) continue
    unique.add(normalizedKey)

    sanitized.push({
      id: typeof term?.id === 'string' && term.id.trim() ? term.id : rawTerm.toUpperCase(),
      term: rawTerm,
      description: typeof term?.description === 'string' ? term.description : undefined,
    })
  }

  return sanitized
}

const normalizeQueryParts = (terms: MeshTerm[], operators: BooleanOperator[]) => {
  const normalizedTerms = sanitizeMeshTerms(terms)
  const maxOperators = Math.max(0, normalizedTerms.length - 1)
  const normalizedOperators = operators
    .filter((operator): operator is BooleanOperator => BOOLEAN_OPERATORS.includes(operator))
    .slice(0, maxOperators)

  while (normalizedOperators.length < maxOperators) {
    normalizedOperators.push('AND')
  }

  return {
    terms: normalizedTerms,
    operators: normalizedOperators,
  }
}

const buildRawQuery = (
  terms: MeshTerm[],
  operators: BooleanOperator[],
  filters: NormalizedSearchFilters
): string => {
  if (terms.length === 0) return ''

  let query = `[${terms[0].term}]`
  for (let i = 1; i < terms.length; i += 1) {
    const op = operators[i - 1] || 'AND'
    query += ` ${op} [${terms[i].term}]`
  }

  query += ` AND [${filters.yearRange[0]}:${filters.yearRange[1]}]`
  if (filters.languages.length > 0) {
    query += ` AND [lang:${filters.languages[0]}]`
  }
  if (filters.hasFullText) {
    query += ' AND [full-text]'
  }
  query += ` [max:${filters.maxResults}]`

  return query
}

export default function SearchPage() {
  const [requestLoadProfile, setRequestLoadProfile] = useState<RequestLoadProfile>(
    DEFAULT_REQUEST_LOAD_PROFILE
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<MeshTerm[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [selectedTerms, setSelectedTerms] = useState<MeshTerm[]>([])
  const [operators, setOperators] = useState<BooleanOperator[]>([])
  const [queryMode, setQueryMode] = useState<'visual' | 'advanced'>('advanced')
  const [visualQuery, setVisualQuery] = useState<{
    rawQuery: string
    terms: MeshTerm[]
    operators: BooleanOperator[]
  } | null>(null)
  const [filters, setFilters] = useState<NormalizedSearchFilters>(() => normalizeFilters())
  const {
    searchHistory,
    loadHistory,
    executeSearch: executeSearchHook,
    error: searchHookError,
    clearError: clearSearchHookError,
  } = useStudentSearch()
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<SearchResult | null>(null)
  const [selectedResults, setSelectedResults] = useState<SearchResult[]>([])
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    { id: 'assistant-init', role: 'assistant', content: INITIAL_ASSISTANT_MESSAGE },
  ])
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantStatus, setAssistantStatus] = useState<string | null>(null)
  const [assistantTips, setAssistantTips] = useState<string[]>([])
  const [assistantSuggestedTerms, setAssistantSuggestedTerms] = useState<MeshTerm[]>([])
  const [assistantSuggestedOperators, setAssistantSuggestedOperators] = useState<BooleanOperator[]>([])
  const [assistantSuggestedFilters, setAssistantSuggestedFilters] = useState<AssistantSuggestedFilters | null>(null)
  const [assistantAutoPlan, setAssistantAutoPlan] = useState<AssistantAutoPlan | null>(null)
  const [activeSearchRunId, setActiveSearchRunId] = useState<string | null>(null)
  const [externalApiEvents, setExternalApiEvents] = useState<ExternalApiActivityEvent[]>([])
  const activeSearchRunIdRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const searchExecutionIdRef = useRef(0)
  const assistantRequestIdRef = useRef(0)
  const historyLoadedRef = useRef(false)
  const suggestionRequestIdRef = useRef(0)
  const exportMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toggleSearchFavorite } = useStudent()
  const router = useRouter()
  const profileMaxResults = SEARCH_MAX_RESULTS_BY_PROFILE[requestLoadProfile]
  const normalizedSearchInput = useMemo(() => sanitizeInputText(searchTerm), [searchTerm])

  const handleVisualQueryChange = useCallback(
    (data: { rawQuery: string; terms: MeshTerm[]; operators: BooleanOperator[] }) => {
      const normalizedTerms = sanitizeMeshTerms(Array.isArray(data.terms) ? data.terms : [])
      const normalizedOperators = (Array.isArray(data.operators) ? data.operators : [])
        .map((operator) => normalizeBooleanOperator(operator))
        .filter((operator): operator is BooleanOperator => Boolean(operator))
        .slice(0, Math.max(0, normalizedTerms.length - 1))
      while (normalizedOperators.length < Math.max(0, normalizedTerms.length - 1)) {
        normalizedOperators.push('AND')
      }
      const normalizedRawQuery =
        typeof data.rawQuery === 'string' && data.rawQuery.trim().length > 0
          ? data.rawQuery.trim()
          : buildRawQuery(normalizedTerms, normalizedOperators, filters)
      setVisualQuery((prev) => {
        if (
          prev &&
          prev.rawQuery === normalizedRawQuery &&
          areTermsEqual(prev.terms, normalizedTerms) &&
          areOperatorsEqual(prev.operators, normalizedOperators)
        ) {
          return prev
        }
        return {
          rawQuery: normalizedRawQuery,
          terms: normalizedTerms,
          operators: normalizedOperators,
        }
      })
    },
    [filters]
  )

  // Debounced MeSH suggestions
  useEffect(() => {
    if (normalizedSearchInput.length < MIN_MESH_INPUT_CHARS) {
      suggestionRequestIdRef.current += 1
      setSuggestions([])
      setIsLoadingSuggestions(false)
      return
    }

    const requestId = suggestionRequestIdRef.current + 1
    suggestionRequestIdRef.current = requestId
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true)
      try {
        const results = await searchApi.getMeshSuggestions(normalizedSearchInput)
        if (suggestionRequestIdRef.current !== requestId) return
        setSuggestions(
          results.filter(
            (result) => typeof result.term === 'string' && result.term.trim().length >= MIN_MESH_INPUT_CHARS
          )
        )
      } catch (err) {
        if (suggestionRequestIdRef.current !== requestId) return
        setSuggestions([])
        console.error('[v0] Error fetching MeSH suggestions:', err)
      } finally {
        if (suggestionRequestIdRef.current !== requestId) return
        setIsLoadingSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [normalizedSearchInput])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (historyLoadedRef.current) return
    historyLoadedRef.current = true
    void loadHistory(1, 10)
  }, [loadHistory])

  useEffect(() => {
    if (!searchHookError) return
    setError(searchHookError)
  }, [searchHookError])

  useEffect(() => {
    return () => {
      if (exportMessageTimeoutRef.current) {
        clearTimeout(exportMessageTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    activeSearchRunIdRef.current = activeSearchRunId
  }, [activeSearchRunId])

  useEffect(() => {
    const unsubscribe = subscribeExternalApiActivity((event) => {
      const runId = activeSearchRunIdRef.current
      if (!runId || event.runId !== runId) return
      setExternalApiEvents((prev) => {
        if (prev.some((entry) => entry.id === event.id)) return prev
        const next = [...prev, event]
        return next.slice(-MAX_EXTERNAL_ACTIVITY_EVENTS)
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const stored = readStoredRequestLoadProfile()
    setRequestLoadProfile(stored)
  }, [])

  useEffect(() => {
    writeStoredRequestLoadProfile(requestLoadProfile)
    const maxByProfile = SEARCH_MAX_RESULTS_BY_PROFILE[requestLoadProfile]
    setFilters((prev) => {
      if (prev.maxResults <= maxByProfile) return prev
      return {
        ...prev,
        maxResults: maxByProfile,
      }
    })
  }, [requestLoadProfile])

  const addTerm = useCallback((term: MeshTerm) => {
    const normalized = sanitizeMeshTerms([term])[0]
    if (!normalized) return
    setSelectedTerms((prev) => {
      const normalizedTerm = normalized.term.trim().toLowerCase()
      if (
        prev.some(
          (candidate) =>
            candidate.id === normalized.id || candidate.term.trim().toLowerCase() === normalizedTerm
        )
      ) {
        return prev
      }
      return [...prev, normalized]
    })
    setSearchTerm('')
    setSuggestions([])
  }, [])

  const removeTerm = useCallback((termId: string) => {
    setSelectedTerms((prev) => {
      const index = prev.findIndex((t) => t.id === termId)
      if (index === -1) return prev
      setOperators((prevOps) => {
        if (prev.length <= 1) return []
        const nextOps = [...prevOps]
        const removeAt = Math.max(0, index - 1)
        if (nextOps.length > 0) {
          nextOps.splice(removeAt, 1)
        }
        return nextOps
      })
      return prev.filter((t) => t.id !== termId)
    })
  }, [])

  const addOperator = useCallback((operator: BooleanOperator) => {
    const normalizedOperator = normalizeBooleanOperator(operator)
    if (!normalizedOperator) return
    setOperators((prev) => {
      const maxOperators = Math.max(0, selectedTerms.length - 1)
      if (maxOperators === 0 || prev.length >= maxOperators) {
        return prev
      }
      return [...prev, normalizedOperator]
    })
  }, [selectedTerms.length])

  const buildQueryString = useCallback(
    (termsInput = selectedTerms, operatorsInput = operators): string => {
      const normalized = normalizeQueryParts(termsInput, operatorsInput)
      return buildRawQuery(normalized.terms, normalized.operators, filters)
    },
    [selectedTerms, operators, filters]
  )

  const executeSearch = useCallback(async () => {
    const executionId = searchExecutionIdRef.current + 1
    searchExecutionIdRef.current = executionId
    const activeTerms = queryMode === 'visual' ? (visualQuery?.terms ?? []) : selectedTerms
    const activeOperators = queryMode === 'visual' ? (visualQuery?.operators ?? []) : operators
    const normalizedQuery = normalizeQueryParts(sanitizeMeshTerms(activeTerms), activeOperators)
    const activeRawQuery = buildRawQuery(normalizedQuery.terms, normalizedQuery.operators, filters)

    if (normalizedQuery.terms.length === 0) {
      setError('Anade al menos un termino MeSH para buscar')
      return
    }

    const activityRunId = `search-run-${Date.now()}`
    setActiveSearchRunId(activityRunId)
    setExternalApiEvents([])
    setIsSearching(true)
    setError(null)
    clearSearchHookError()

    try {
      const query: SearchQuery = {
        id: `query-${Date.now()}`,
        terms: normalizedQuery.terms,
        operators: normalizedQuery.operators,
        filters,
        rawQuery: activeRawQuery,
        createdAt: new Date().toISOString(),
      }

      const session = await executeSearchHook(query, { activityRunId, loadProfile: requestLoadProfile })
      if (!isMountedRef.current || searchExecutionIdRef.current !== executionId) {
        return
      }
      if (!session) {
        setError('La busqueda fue cancelada o no retorno resultados validos.')
        return
      }
      setCurrentSession(session)
      setSelectedResults([])
      setSelectedArticle(null)
      await loadHistory(1, 10)
    } catch (err) {
      if (!isMountedRef.current || searchExecutionIdRef.current !== executionId) {
        return
      }
      const message = err instanceof Error ? err.message : 'Error al ejecutar la busqueda. Intenta de nuevo.'
      setError(message)
      console.error('[v0] Search error:', err)
    } finally {
      if (!isMountedRef.current || searchExecutionIdRef.current !== executionId) {
        return
      }
      setIsSearching(false)
      setActiveSearchRunId(null)
    }
  }, [
    selectedTerms,
    operators,
    filters,
    queryMode,
    visualQuery,
    executeSearchHook,
    loadHistory,
    requestLoadProfile,
    clearSearchHookError,
  ])

  const toggleResultSelection = useCallback((result: SearchResult) => {
    if (!result?.id) return
    setSelectedResults((prev) => {
      const exists = prev.some((item) => item.id === result.id)
      if (exists) {
        return prev.filter((item) => item.id !== result.id)
      }
      if (prev.length >= MAX_SELECTED_RESULTS) {
        return prev
      }
      return [...prev, result]
    })
  }, [])

  const addResultSelection = useCallback((result: SearchResult) => {
    if (!result?.id) return
    setSelectedResults((prev) => {
      if (prev.some((item) => item.id === result.id)) {
        return prev
      }
      if (prev.length >= MAX_SELECTED_RESULTS) {
        return prev
      }
      return [...prev, result]
    })
  }, [])

  const exportSelection = useCallback(() => {
    if (selectedResults.length === 0) {
      setError('Selecciona al menos un articulo para exportar.')
      return
    }
    try {
      setError(null)
      localStorage.setItem(
        'search_selection_v2',
        JSON.stringify({ version: 2, items: selectedResults })
      )
      setExportMessage('Seleccion enviada a bibliografias.')
      if (exportMessageTimeoutRef.current) {
        clearTimeout(exportMessageTimeoutRef.current)
      }
      exportMessageTimeoutRef.current = setTimeout(() => {
        setExportMessage(null)
      }, 2000)
      router.push('/student/bibliography?source=search')
    } catch (err) {
      console.error('[v0] Error exporting selection:', err)
      setError('No se pudo exportar la seleccion. Verifica espacio en el navegador e intentalo de nuevo.')
    }
  }, [selectedResults, router])

  const toggleFavorite = useCallback(async (searchId: string, currentFavorite: boolean) => {
    if (!searchId) return
    try {
      await searchApi.saveSearch(searchId, !currentFavorite)
      toggleSearchFavorite(searchId)
      await loadHistory(1, 10)
    } catch (err) {
      setError('No se pudo actualizar el favorito de la busqueda.')
      console.error('[v0] Error toggling favorite:', err)
    }
  }, [toggleSearchFavorite, loadHistory])

  const reuseSearch = useCallback((query: SearchQuery) => {
    const normalized = normalizeQueryParts(
      sanitizeMeshTerms(Array.isArray(query.terms) ? query.terms : []),
      (Array.isArray(query.operators) ? query.operators : [])
        .map((operator) => normalizeBooleanOperator(operator))
        .filter((operator): operator is BooleanOperator => Boolean(operator))
    )
    setSelectedTerms(normalized.terms)
    setOperators(normalized.operators)
    setFilters(normalizeFilters(query.filters))
    setQueryMode('advanced')
    setError(null)
    setVisualQuery({
      rawQuery: query.rawQuery,
      terms: normalized.terms,
      operators: normalized.operators,
    })
  }, [])

  const recentSearchTerms = useMemo(() => {
    const unique = new Set<string>()
    for (const query of searchHistory.slice(0, 6)) {
      for (const term of query.terms ?? []) {
        const value = typeof term?.term === 'string' ? term.term.trim() : ''
        if (!value) continue
        unique.add(value)
        if (unique.size >= 8) break
      }
      if (unique.size >= 8) break
    }
    return Array.from(unique)
  }, [searchHistory])

  const askAssistant = useCallback(async (message: string) => {
    const trimmed = message.trim()
    if (!trimmed || assistantLoading) return

    const requestId = assistantRequestIdRef.current + 1
    assistantRequestIdRef.current = requestId

    const userMessage: AssistantMessage = {
      id: `assistant-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    const conversationHistory = buildAssistantConversationHistory(assistantMessages, userMessage)
    setAssistantMessages((prev) => [...prev, userMessage].slice(-MAX_ASSISTANT_MESSAGES))
    setAssistantLoading(true)
    setAssistantStatus(null)
    setAssistantAutoPlan(null)

    try {
      const response = await searchAssistantApi.ask({
        message: trimmed,
        selectedTerms: selectedTerms.map((term) => term.term),
        operators,
        recentTerms: recentSearchTerms,
        projectContext: ASSISTANT_PROJECT_CONTEXT,
        conversationHistory,
        filters: {
          yearFrom: filters.yearRange[0],
          yearTo: filters.yearRange[1],
          studyTypes: filters.studyTypes,
          hasFullText: filters.hasFullText,
          language: filters.languages[0],
          minSampleSize: filters.minSampleSize,
          maxResults: filters.maxResults,
        },
      })

      if (!isMountedRef.current || assistantRequestIdRef.current !== requestId) {
        return
      }

      setAssistantMessages((prev) => [
        ...prev,
        {
          id: `assistant-reply-${Date.now()}`,
          role: 'assistant' as const,
          content: response.reply,
        },
      ].slice(-MAX_ASSISTANT_MESSAGES))

      const mappedTerms = sanitizeMeshTerms(
        response.suggestedTerms.map((term, index) => ({
          id: term.id || `${term.term.toUpperCase().replace(/\s+/g, '_')}-${index + 1}`,
          term: term.term,
          description: term.description,
        }))
      )
      const mappedOperators = response.suggestedOperators
        .map((operator) => normalizeBooleanOperator(operator))
        .filter((operator): operator is BooleanOperator => Boolean(operator))

      setAssistantSuggestedTerms(mappedTerms)
      setAssistantSuggestedOperators(mappedOperators)
      setAssistantSuggestedFilters(response.suggestedFilters ?? null)
      const autoPlanTerms = Array.isArray(response.autoPlan?.terms)
        ? response.autoPlan.terms
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
            .slice(0, 4)
        : []
      const normalizedAutoPlan: AssistantAutoPlan | null =
        response.canAutoApply && autoPlanTerms.length > 0
          ? {
              terms: autoPlanTerms,
              operators: (response.autoPlan?.operators ?? [])
                .map((operator) => normalizeBooleanOperator(operator))
                .filter((operator): operator is BooleanOperator => Boolean(operator))
                .slice(0, Math.max(0, autoPlanTerms.length - 1)),
              filters: response.autoPlan?.filters ?? undefined,
              rationale: response.autoPlan?.rationale || 'Plan IA aplicado.',
            }
          : null
      setAssistantAutoPlan(normalizedAutoPlan)
      setAssistantTips((response.tips ?? []).slice(0, 4))
      setAssistantStatus(
        response.usedAi
          ? 'Respuesta generada por IA en tiempo real.'
          : 'Sin conexion a Gemini. Configura GEMINI_API_KEY (o GOOGLE_AI_API_KEY) en backend.'
      )
      setAssistantInput('')
    } catch (err) {
      if (!isMountedRef.current || assistantRequestIdRef.current !== requestId) {
        return
      }
      const fallbackMessage =
        err instanceof Error
          ? `No pude consultar la IA externa ahora: ${err.message}`
          : 'No pude consultar la IA externa ahora. Intenta de nuevo.'
      setAssistantMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant' as const,
          content: fallbackMessage,
        },
      ].slice(-MAX_ASSISTANT_MESSAGES))
      setAssistantSuggestedTerms([])
      setAssistantSuggestedOperators([])
      setAssistantSuggestedFilters(null)
      setAssistantAutoPlan(null)
      setAssistantStatus('Fallo temporal del asistente.')
    } finally {
      if (!isMountedRef.current || assistantRequestIdRef.current !== requestId) {
        return
      }
      setAssistantLoading(false)
    }
  }, [assistantMessages, assistantLoading, selectedTerms, operators, recentSearchTerms, filters])

  const requestAssistantSuggestions = useCallback(() => {
    const defaultPrompt =
      selectedTerms.length > 0
        ? `Optimiza mi estrategia para: ${selectedTerms.map((item) => item.term).join(', ')}`
        : 'Sugiere terminos MeSH iniciales para una busqueda clinica.'
    void askAssistant(defaultPrompt)
  }, [askAssistant, selectedTerms])

  const applySuggestedFiltersValue = useCallback((value: AssistantSuggestedFilters | null | undefined) => {
    if (!value) return
    setFilters((prev) => {
      const nextYearRange = normalizeYearRange([
        value.yearFrom ?? prev.yearRange[0],
        value.yearTo ?? prev.yearRange[1],
      ])

      const nextStudyTypes = Array.isArray(value.studyTypes)
        ? Array.from(
            new Set(
              value.studyTypes
                .map((entry) => normalizeStudyTypeValue(entry))
                .filter((entry) => STUDY_TYPE_IDS.has(entry))
            )
          )
        : prev.studyTypes

      const languageCandidate =
        typeof value.language === 'string'
          ? [value.language]
          : prev.languages

      return {
        ...prev,
        yearRange: nextYearRange,
        studyTypes: nextStudyTypes,
        hasFullText:
          typeof value.hasFullText === 'boolean'
            ? value.hasFullText
            : prev.hasFullText,
        languages: normalizeLanguages(languageCandidate),
        minSampleSize:
          typeof value.minSampleSize === 'number' &&
          Number.isFinite(value.minSampleSize)
            ? clampNumber(Math.round(value.minSampleSize), 0, 1000)
            : prev.minSampleSize,
        maxResults:
          typeof value.maxResults === 'number' &&
          Number.isFinite(value.maxResults)
            ? clampNumber(
                Math.round(value.maxResults),
                5,
                SEARCH_MAX_RESULTS_BY_PROFILE[requestLoadProfile]
              )
            : prev.maxResults,
      }
    })
  }, [requestLoadProfile])

  const applyAssistantFilters = useCallback(() => {
    if (!assistantSuggestedFilters) return
    applySuggestedFiltersValue(assistantSuggestedFilters)
    setAssistantStatus('Filtros sugeridos aplicados a la query.')
  }, [assistantSuggestedFilters, applySuggestedFiltersValue])

  const submitAssistantInput = useCallback(() => {
    if (!assistantInput.trim()) return
    void askAssistant(assistantInput)
  }, [assistantInput, askAssistant])

  const applyAssistantTerm = useCallback((term: MeshTerm) => {
    setQueryMode('advanced')
    addTerm(term)
  }, [addTerm])

  const applyAssistantOperator = useCallback((operator: BooleanOperator) => {
    setQueryMode('advanced')
    addOperator(operator)
  }, [addOperator])

  const applyAssistantAutoPlan = useCallback(() => {
    if (!assistantAutoPlan) return
    const mappedTerms = sanitizeMeshTerms(
      assistantAutoPlan.terms.map((term, index) => ({
        id: `${term.toUpperCase().replace(/\s+/g, '_')}-${index + 1}`,
        term,
        description: 'Termino aplicado desde plan IA',
      }))
    )
    const normalized = normalizeQueryParts(mappedTerms, assistantAutoPlan.operators)
    setQueryMode('advanced')
    setSelectedTerms(normalized.terms)
    setOperators(normalized.operators)
    applySuggestedFiltersValue(assistantAutoPlan.filters)
    setAssistantStatus(assistantAutoPlan.rationale || 'Plan IA aplicado.')
  }, [assistantAutoPlan, applySuggestedFiltersValue])

  const yearRangeValue = filters.yearRange
  const minSampleValue = [filters.minSampleSize]
  const maxResultsValue = [filters.maxResults]

  const [yearRangeDraft, setYearRangeDraft] = useState<[number, number]>(yearRangeValue)
  const [minSampleDraft, setMinSampleDraft] = useState<number[]>(minSampleValue)
  const [maxResultsDraft, setMaxResultsDraft] = useState<number[]>(maxResultsValue)

  useEffect(() => {
    setYearRangeDraft((prev) =>
      prev[0] === yearRangeValue[0] && prev[1] === yearRangeValue[1]
        ? prev
        : yearRangeValue
    )
  }, [yearRangeValue[0], yearRangeValue[1]])

  useEffect(() => {
    setMinSampleDraft((prev) =>
      prev[0] === minSampleValue[0]
        ? prev
        : minSampleValue
    )
  }, [minSampleValue[0]])

  useEffect(() => {
    setMaxResultsDraft((prev) =>
      prev[0] === maxResultsValue[0]
        ? prev
        : maxResultsValue
    )
  }, [maxResultsValue[0]])

  const updateYearRange = useCallback((value: [number, number]) => {
    const from = typeof value?.[0] === 'number' && Number.isFinite(value[0]) ? value[0] : YEAR_MIN
    const to = typeof value?.[1] === 'number' && Number.isFinite(value[1]) ? value[1] : YEAR_MAX
    const bounded = normalizeYearRange([from, to])
    setFilters((prev) => {
      const current = prev.yearRange
      if (current[0] === bounded[0] && current[1] === bounded[1]) {
        return prev
      }
      return { ...prev, yearRange: bounded }
    })
  }, [])

  const updateMinSampleSize = useCallback((value: number) => {
    const bounded = Number.isFinite(value) ? clampNumber(Math.round(value), 0, 1000) : 0
    setFilters((prev) => {
      const current = prev.minSampleSize
      if (current === bounded) {
        return prev
      }
      return { ...prev, minSampleSize: bounded }
    })
  }, [])

  const updateMaxResults = useCallback((value: number) => {
    const safeValue = Number.isFinite(value) ? Math.round(value) : DEFAULT_FILTERS.maxResults
    const boundedValue = clampNumber(safeValue, 5, SEARCH_MAX_RESULTS_BY_PROFILE[requestLoadProfile])
    setFilters((prev) => {
      const current = prev.maxResults
      if (current === boundedValue) {
        return prev
      }
      return { ...prev, maxResults: boundedValue }
    })
  }, [requestLoadProfile])

  const displayQuery = queryMode === 'visual'
    ? buildQueryString(visualQuery?.terms ?? [], visualQuery?.operators ?? [])
    : buildQueryString()

  const canSearch = useMemo(() => {
    const activeTerms = queryMode === 'visual' ? (visualQuery?.terms ?? []) : selectedTerms
    const activeOperators = queryMode === 'visual' ? (visualQuery?.operators ?? []) : operators
    return normalizeQueryParts(sanitizeMeshTerms(activeTerms), activeOperators).terms.length > 0
  }, [queryMode, visualQuery, selectedTerms, operators])

  const externalApiProviders = useMemo(() => {
    const providerCounter = new Map<string, number>()
    for (const event of externalApiEvents) {
      providerCounter.set(event.provider, (providerCounter.get(event.provider) ?? 0) + 1)
    }
    return Array.from(providerCounter.entries())
      .map(([provider, count]) => ({ provider, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6)
  }, [externalApiEvents])

  const filteredResults = useMemo(() => {
    if (!currentSession) return []
    const sourceResults = Array.isArray(currentSession.results) ? currentSession.results : []
    const [yearFrom, yearTo] = filters.yearRange
    const filtered = sourceResults.filter((result) => {
      if (!result || typeof result !== 'object') return false
      if (!result.id || !result.title) return false
      if (result.year < yearFrom || result.year > yearTo) {
        return false
      }
      if (filters.studyTypes.length > 0) {
        const normalizedStudyType = result.studyType ? normalizeStudyTypeValue(result.studyType) : ''
        if (!filters.studyTypes.includes(normalizedStudyType)) {
          return false
        }
      }
      if (filters.minSampleSize > 0) {
        const sampleSize = result.sampleSize ?? 0
        if (sampleSize < filters.minSampleSize) {
          return false
        }
      }
      if (filters.hasFullText && !result.sourceUrl && !result.doi) {
        return false
      }
      return true
    })
    return filtered.slice(0, filters.maxResults)
  }, [
    currentSession,
    filters.yearRange,
    filters.studyTypes,
    filters.minSampleSize,
    filters.hasFullText,
    filters.maxResults,
  ])
  const selectedArticleExternalUrl = selectedArticle
    ? buildSafeExternalUrl(selectedArticle.sourceUrl, selectedArticle.doi)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Busqueda Avanzada</h1>
        <p className="text-muted-foreground mt-1">
          Construye queries con terminos MeSH y operadores booleanos
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Query Builder */}
        <div className="space-y-6 min-w-0 xl:col-span-2">
          <Tabs value={queryMode} onValueChange={(value) => setQueryMode(normalizeQueryMode(value))} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Constructor Visual
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Modo Avanzado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Buscar terminos para el constructor
                  </CardTitle>
                  <CardDescription>
                    Escribe una palabra clave y arrastra los terminos sugeridos al constructor visual.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar terminos MeSH (ej: diabetes, hypertension)..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value.slice(0, MAX_MESH_INPUT_LENGTH))}
                    />
                    {isLoadingSuggestions && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.slice(0, 12).map((term) => (
                        <Badge key={`visual-suggestion-${term.id}`} variant="outline" className="text-xs">
                          {term.term}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Introduce al menos 2 caracteres para cargar sugerencias.
                    </p>
                  )}
                </CardContent>
              </Card>
              <QueryBuilder
                availableTerms={suggestions}
                onQueryChange={handleVisualQueryChange}
              />
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              {/* Term Search */}
              <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Terminos MeSH
              </CardTitle>
              <CardDescription>
                Busca y anade terminos del vocabulario controlado MeSH
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar terminos MeSH (ej: diabetes, hypertension)..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.slice(0, MAX_MESH_INPUT_LENGTH))}
                />
                {isLoadingSuggestions && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                )}
                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <Card className="absolute left-0 top-full z-10 mt-1 w-full max-h-64 overflow-auto shadow-lg">
                    <CardContent className="p-2">
                      {suggestions.map((term) => (
                        <button
                          type="button"
                          key={term.id}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                          onClick={() => addTerm(term)}
                        >
                          <p className="font-medium">{term.term}</p>
                          {term.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {term.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Selected terms */}
              {selectedTerms.length > 0 && (
                <div className="space-y-3">
                  <Label>Terminos seleccionados</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTerms.map((term, index) => (
                      <div key={term.id} className="flex max-w-full items-center gap-1">
                        {index > 0 && (
                          <select
                            className="h-8 max-w-[96px] px-2 rounded border bg-background text-sm font-mono"
                            value={operators[index - 1] || 'AND'}
                            onChange={(e) => {
                              const selectedOperator = normalizeBooleanOperator(e.target.value) ?? 'AND'
                              const newOps = [...operators]
                              newOps[index - 1] = selectedOperator
                              setOperators(newOps)
                            }}
                          >
                            {BOOLEAN_OPERATORS.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        )}
                        <Badge variant="secondary" className="max-w-full px-3 py-1.5 gap-2">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                          <span className="max-w-[40vw] truncate sm:max-w-[360px]">{term.term}</span>
                          <button
                            onClick={() => removeTerm(term.id)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick add operators */}
              <div className="flex flex-wrap gap-2">
                {BOOLEAN_OPERATORS.map((op) => (
                  <Button
                    key={op}
                    variant="outline"
                    size="sm"
                    onClick={() => addOperator(op)}
                    className="font-mono"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {op}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Vista previa del query</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
                {displayQuery || (
                  <span className="text-muted-foreground">
                    Anade terminos para construir tu query...
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {exportMessage && (
                <div className="mt-4 flex items-center gap-2 text-success text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {exportMessage}
                </div>
              )}

              <Button
                className="w-full mt-4"
                size="lg"
                onClick={executeSearch}
                disabled={isSearching || !canSearch}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Ejecutar busqueda
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {currentSession && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">Resultados</CardTitle>
                    <CardDescription>
                      {filteredResults.length} articulos encontrados
                      {currentSession.totalResults !== filteredResults.length && (
                        <span className="text-muted-foreground">
                          {' '}
                          (de {currentSession.totalResults} totales)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportSelection}
                    className="w-full sm:w-auto"
                    disabled={selectedResults.length === 0}
                  >
                    Exportar seleccion
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px] pr-4 sm:h-[500px]">
                  <div className="space-y-4">
                    {filteredResults.map((result, index) => {
                      const isSelected = selectedResults.some((item) => item.id === result.id)
                      const authorsLabel =
                        result.authors.length > 0 ? result.authors.slice(0, 3).join(', ') : 'Autor no disponible'
                      return (
                        <Card
                          key={result.id || `result-${index + 1}`}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedArticle(result)}
                        >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <Checkbox
                              id={`select-${result.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleResultSelection(result)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <h3 className="font-medium leading-snug line-clamp-2">
                                  {result.title}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={
                                    result.evidenceLevel <= 2
                                      ? 'border-success text-success'
                                      : result.evidenceLevel <= 4
                                        ? 'border-warning text-warning'
                                        : ''
                                  }
                                >
                                  Nivel {result.evidenceLevel}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {authorsLabel}
                                {result.authors.length > 3 && ' et al.'}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex min-w-0 items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  <span className="truncate">{result.journal}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {result.year}
                                </span>
                                {result.sampleSize && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    n={result.sampleSize}
                                  </span>
                                )}
                                {result.source && (
                                  <Badge variant="secondary" className="text-[10px] h-5">
                                    {result.source}
                                  </Badge>
                                )}
                              </div>
                              {result.hasConflictOfInterest && (
                                <Badge variant="destructive" className="mt-2 text-xs">
                                  Conflicto de interes declarado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 xl:sticky xl:top-4 self-start">
          {/* AI Assistant */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Asistente IA
              </CardTitle>
              <CardDescription>Analiza tus terminos y propone mejoras aplicables</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-background/70 p-3 space-y-3">
                <div className="space-y-2 max-h-44 overflow-y-auto sm:max-h-52">
                  {assistantMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-md px-3 py-2 text-xs leading-relaxed ${
                        message.role === 'assistant'
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                  {assistantLoading && (
                    <div className="rounded-md px-3 py-2 text-xs bg-muted text-muted-foreground">
                      Generando respuesta...
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={assistantInput}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        submitAssistantInput()
                      }
                    }}
                    placeholder="Ej: optimiza mi query para evidencia reciente"
                    className="h-8 text-xs min-w-0"
                    disabled={assistantLoading}
                  />
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 px-3 w-full sm:w-auto"
                    disabled={assistantLoading || !assistantInput.trim()}
                    onClick={submitAssistantInput}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:flex-1"
                  onClick={requestAssistantSuggestions}
                  disabled={assistantLoading}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Generar sugerencias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:flex-1"
                  onClick={applyAssistantFilters}
                  disabled={assistantLoading || !assistantSuggestedFilters}
                >
                  Aplicar filtros IA
                </Button>
              </div>

              {assistantAutoPlan && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={applyAssistantAutoPlan}
                  disabled={assistantLoading}
                >
                  Aplicar plan IA completo
                </Button>
              )}

              {assistantStatus && (
                <p className="text-xs text-muted-foreground">{assistantStatus}</p>
              )}

              {assistantAutoPlan?.rationale && (
                <p className="text-xs text-muted-foreground">{assistantAutoPlan.rationale}</p>
              )}

              {assistantSuggestedTerms.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Terminos sugeridos:</p>
                  <div className="space-y-2">
                    {assistantSuggestedTerms.map((term) => (
                      <Button
                        key={term.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-transparent h-auto py-2"
                        onClick={() => applyAssistantTerm(term)}
                      >
                        <Plus className="h-3 w-3 mr-2 shrink-0" />
                        <span className="text-left whitespace-normal break-words">{term.term}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {assistantSuggestedOperators.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Operadores sugeridos:</p>
                  <div className="flex flex-wrap gap-2">
                    {assistantSuggestedOperators.map((operator) => (
                      <Button
                        key={`assistant-operator-${operator}`}
                        variant="secondary"
                        size="sm"
                        className="font-mono min-w-[64px]"
                        onClick={() => applyAssistantOperator(operator)}
                      >
                        {operator}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {assistantTips.length > 0 && (
                <div className="space-y-1">
                  {assistantTips.map((tip, index) => (
                    <p key={`assistant-tip-${index + 1}`} className="text-xs text-muted-foreground">
                      {tip}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Actividad de APIs externas
              </CardTitle>
              <CardDescription>
                Registro en tiempo real de las conexiones usadas para esta busqueda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={activeSearchRunId ? 'default' : 'secondary'} className="text-xs">
                  {activeSearchRunId ? 'Monitoreo activo' : 'Sin busqueda activa'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {externalApiEvents.length} eventos
                </Badge>
              </div>

              {externalApiProviders.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {externalApiProviders.map((provider) => (
                    <Badge
                      key={`api-provider-${provider.provider}`}
                      variant="outline"
                      className="text-[11px]"
                    >
                      {provider.provider} ({provider.count})
                    </Badge>
                  ))}
                </div>
              )}

              <ScrollArea className="h-56 rounded-md border bg-muted/20 p-2 sm:h-64">
                <div className="space-y-2 pr-2">
                  {externalApiEvents.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      Ejecuta una busqueda para ver en vivo que APIs externas estan respondiendo.
                    </p>
                  ) : (
                    externalApiEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`rounded-md border px-2.5 py-2 ${getActivityItemClassName(event.status)}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${getActivityDotClassName(event.status)}`}
                            />
                            <span className="truncate text-xs font-medium">{event.provider}</span>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatActivityTimestamp(event.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed">{event.message}</p>
                        {(typeof event.latencyMs === 'number' || typeof event.resultCount === 'number') && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {typeof event.resultCount === 'number' ? `${event.resultCount} resultados` : 'Sin conteo'}
                            {typeof event.latencyMs === 'number' ? ` - ${event.latencyMs} ms` : ''}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros avanzados</CardTitle>
              <CardDescription>
                Aplica estos parametros en todas las fuentes externas antes de mostrar resultados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="request-load-profile">Carga de documentacion</Label>
                  <p className="text-xs text-muted-foreground">
                    Controla cuanta evidencia se solicita por consulta para evitar sobrecarga.
                  </p>
                </div>
                <Select
                  value={requestLoadProfile}
                  onValueChange={(value) => setRequestLoadProfile(normalizeRequestLoadProfile(value))}
                >
                  <SelectTrigger id="request-load-profile">
                    <SelectValue placeholder="Selecciona nivel de carga" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REQUEST_LOAD_PROFILE_LABELS) as RequestLoadProfile[]).map((profile) => (
                      <SelectItem key={profile} value={profile}>
                        {REQUEST_LOAD_PROFILE_LABELS[profile]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {REQUEST_LOAD_PROFILE_DESCRIPTIONS[requestLoadProfile]}
                </p>
              </div>

              {/* Year Range */}
              <div className="space-y-3">
                <Label>
                  Rango anual: {yearRangeDraft[0]} - {yearRangeDraft[1]}
                </Label>
                <Slider
                  min={2000}
                  max={2026}
                  step={1}
                  value={yearRangeDraft}
                  onValueChange={(value) => {
                    if (!Array.isArray(value) || value.length < 2) return
                    setYearRangeDraft(normalizeYearRange([value[0], value[1]]))
                  }}
                  onValueCommit={(value) => {
                    if (!Array.isArray(value) || value.length < 2) return
                    updateYearRange([value[0], value[1]])
                  }}
                  className="mt-2"
                />
              </div>

              {/* Study Types */}
              <div className="space-y-3">
                <Label>Tipo de estudio</Label>
                <p className="text-xs text-muted-foreground">
                  Selecciona uno o mas disenos para filtrar evidencia clinica.
                </p>
                <div className="space-y-2">
                  {STUDY_TYPES.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        id={type.id}
                        checked={filters.studyTypes?.includes(type.id)}
                        onCheckedChange={(checked) => {
                          setFilters((prev) => ({
                            ...prev,
                            studyTypes: checked
                              ? Array.from(new Set([...(prev.studyTypes || []), type.id]))
                              : prev.studyTypes?.filter((t) => t !== type.id),
                          }))
                        }}
                      />
                      <Label htmlFor={type.id} className="text-sm font-normal cursor-pointer">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="language-filter">Idioma principal</Label>
                  <p className="text-xs text-muted-foreground">
                    Prioriza resultados indexados en el idioma seleccionado.
                  </p>
                </div>
                <Select
                  value={filters.languages[0] || 'eng'}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      languages: normalizeLanguages([value]),
                    }))
                  }
                >
                  <SelectTrigger id="language-filter">
                    <SelectValue placeholder="Selecciona un idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((language) => (
                      <SelectItem key={language.id} value={language.id}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="full-text-only"
                    checked={filters.hasFullText}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        hasFullText: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="full-text-only" className="text-sm font-normal cursor-pointer">
                    Solo resultados con texto completo
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Excluye registros sin enlace de acceso al contenido.
                </p>
              </div>

              {/* Sample Size */}
              <div className="space-y-3">
                <Label>Tamano muestral minimo: {minSampleDraft[0]}</Label>
                <p className="text-xs text-muted-foreground">
                  Util para priorizar estudios con mayor robustez estadistica.
                </p>
                <Slider
                  min={0}
                  max={1000}
                  step={10}
                  value={minSampleDraft}
                  onValueChange={(value) => {
                    if (!Array.isArray(value) || value.length === 0) return
                    setMinSampleDraft([clampNumber(Math.round(value[0] ?? 0), 0, 1000)])
                  }}
                  onValueCommit={([value]) => updateMinSampleSize(value ?? 0)}
                />
              </div>

              <div className="space-y-3">
                <Label>Maximo de resultados: {maxResultsDraft[0]}</Label>
                <p className="text-xs text-muted-foreground">
                  Limita la cantidad final mostrada y acelera la revision.
                </p>
                <Slider
                  min={5}
                  max={profileMaxResults}
                  step={5}
                  value={maxResultsDraft}
                  onValueChange={(value) => {
                    if (!Array.isArray(value) || value.length === 0) return
                    setMaxResultsDraft([
                      clampNumber(Math.round(value[0] ?? DEFAULT_FILTERS.maxResults), 5, profileMaxResults),
                    ])
                  }}
                  onValueCommit={([value]) => updateMaxResults(value ?? DEFAULT_FILTERS.maxResults)}
                />
                <p className="text-xs text-muted-foreground">
                  Tope del perfil actual: {profileMaxResults} resultados.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Search History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchHistory.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {searchHistory.slice(0, 5).map((search) => (
                    <AccordionItem key={search.id} value={search.id}>
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          {search.isFavorite && <Star className="h-3 w-3 text-warning" />}
                          <span className="truncate max-w-[180px] sm:max-w-[240px]">
                            {search.rawQuery || 'Consulta sin texto'}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {search.resultCount ?? 0} resultados
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 bg-transparent"
                              onClick={() => reuseSearch(search)}
                            >
                              Reutilizar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFavorite(search.id, !!search.isFavorite)}
                            >
                              {search.isFavorite ? (
                                <StarOff className="h-4 w-4" />
                              ) : (
                                <Star className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay busquedas recientes
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Article Detail Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selectedArticle.title}</DialogTitle>
                <DialogDescription>
                  {selectedArticle.authors.join(', ')} - {selectedArticle.journal} (
                  {selectedArticle.year})
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Nivel {selectedArticle.evidenceLevel}</Badge>
                  <Badge variant="secondary">{selectedArticle.studyType}</Badge>
                  {selectedArticle.source && (
                    <Badge variant="secondary">{selectedArticle.source}</Badge>
                  )}
                  {selectedArticle.sampleSize && (
                    <Badge variant="secondary">n={selectedArticle.sampleSize}</Badge>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Resumen</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedArticle.abstract}
                  </p>
                </div>

                {selectedArticle.hasConflictOfInterest && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Este articulo tiene conflictos de interes declarados
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="w-full sm:flex-1"
                    onClick={() => {
                      addResultSelection(selectedArticle)
                      setSelectedArticle(null)
                    }}
                  >
                    Anadir a bibliografia
                  </Button>
                  {selectedArticleExternalUrl && (
                    <Button variant="outline" asChild className="w-full sm:w-auto">
                      <a
                        href={selectedArticleExternalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {selectedArticle.source ? `Ver en ${selectedArticle.source}` : 'Ver fuente'}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
