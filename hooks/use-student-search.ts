import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStudent } from '@/contexts/student-context'
import { searchApi } from '@/lib/api'
import {
  type RequestLoadProfile,
  normalizeRequestLoadProfile,
  SEARCH_COOLDOWN_MS_BY_PROFILE,
  SEARCH_TIMEOUT_MS_BY_PROFILE,
} from '@/lib/request-load-profile'
import type { SearchQuery, SearchSession, MeshTerm } from '@/types'

type ExecuteSearchOptions = {
  activityRunId?: string
  loadProfile?: RequestLoadProfile
}

interface UseStudentSearchReturn {
  isSearching: boolean
  error: string | null
  currentSession: SearchSession | null
  searchHistory: SearchQuery[]
  loadHistory: (page?: number, limit?: number) => Promise<void>
  executeSearch: (query: SearchQuery, options?: ExecuteSearchOptions) => Promise<SearchSession | null>
  saveSearch: (searchId: string, isFavorite: boolean) => Promise<void>
  deleteSearch: (searchId: string) => Promise<void>
  reuseSearch: (searchId: string) => Promise<SearchQuery | undefined>
  getSuggestions: (term: string) => Promise<MeshTerm[]>
  clearError: () => void
}

const MAX_HISTORY_PAGE_SIZE = 50
const MAX_LOCAL_RECENT_SEARCHES = 120

export function useStudentSearch(): UseStudentSearchReturn {
  const { addActivity, savedSearches, setSavedSearches, toggleSearchFavorite } = useStudent()
  const queryClient = useQueryClient()

  const searchHistory = savedSearches
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null)
  const activeSearchControllerRef = useRef<AbortController | null>(null)
  const activeSearchRunRef = useRef<number>(-1)
  const runSequenceRef = useRef(0)
  const lastSearchStartAtRef = useRef<number>(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      activeSearchControllerRef.current?.abort()
      activeSearchControllerRef.current = null
    }
  }, [])

  const loadHistory = useCallback(
    async (page = 1, limit = 10) => {
      const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1
      const safeLimit = Number.isFinite(limit)
        ? Math.max(1, Math.min(MAX_HISTORY_PAGE_SIZE, Math.trunc(limit)))
        : 10
      try {
        const data = await queryClient.fetchQuery({
          queryKey: ['student', 'searchHistory', safePage, safeLimit],
          queryFn: () => searchApi.getHistory(safePage, safeLimit),
        })
        if (!isMountedRef.current) return
        const nextSearches = Array.isArray(data.searches) ? data.searches : []
        setSavedSearches(nextSearches)
      } catch (err) {
        if (isMountedRef.current) {
          setError('No se pudo cargar el historial de busqueda.')
        }
        console.error('[useStudentSearch loadHistory]:', err)
      }
    },
    [queryClient, setSavedSearches]
  )

  const executeSearch = useCallback(
    async (query: SearchQuery, options?: ExecuteSearchOptions) => {
      const normalizedTerms = Array.isArray(query?.terms)
        ? query.terms
            .map((term, index) => {
              const rawTerm = typeof term?.term === 'string' ? term.term.trim() : ''
              if (!rawTerm) return null
              return {
                id: typeof term?.id === 'string' && term.id.trim() ? term.id.trim() : `term-${index + 1}`,
                term: rawTerm,
                description: typeof term?.description === 'string' ? term.description.trim() : undefined,
              }
            })
            .filter((term): term is NonNullable<typeof term> => Boolean(term))
        : []
      if (normalizedTerms.length === 0) {
        const invalidQueryMessage = 'Debes incluir al menos un termino valido para buscar.'
        if (isMountedRef.current) {
          setError(invalidQueryMessage)
        }
        throw new Error(invalidQueryMessage)
      }
      const normalizedOperators = Array.isArray(query.operators)
        ? query.operators
            .filter((operator): operator is 'AND' | 'OR' | 'NOT' => (
              operator === 'AND' || operator === 'OR' || operator === 'NOT'
            ))
            .slice(0, Math.max(0, normalizedTerms.length - 1))
        : []
      while (normalizedOperators.length < normalizedTerms.length - 1) {
        normalizedOperators.push('AND')
      }
      const normalizedQuery: SearchQuery = {
        ...query,
        terms: normalizedTerms,
        operators: normalizedOperators,
        rawQuery:
          typeof query.rawQuery === 'string' && query.rawQuery.trim().length > 0
            ? query.rawQuery.trim()
            : normalizedTerms.map((term) => term.term).join(' AND '),
      }

      const loadProfile = normalizeRequestLoadProfile(options?.loadProfile)
      const cooldownMs = SEARCH_COOLDOWN_MS_BY_PROFILE[loadProfile]
      const now = Date.now()
      const elapsed = now - lastSearchStartAtRef.current
      if (elapsed < cooldownMs) {
        const waitMs = cooldownMs - elapsed
        const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000))
        const cooldownMessage = `Espera ${waitSeconds}s antes de lanzar otra busqueda.`
        if (isMountedRef.current) {
          setError(cooldownMessage)
        }
        throw new Error(cooldownMessage)
      }

      activeSearchControllerRef.current?.abort()
      const controller = new AbortController()
      activeSearchControllerRef.current = controller
      const timeoutMs = SEARCH_TIMEOUT_MS_BY_PROFILE[loadProfile]
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      const runToken = runSequenceRef.current + 1
      runSequenceRef.current = runToken
      activeSearchRunRef.current = runToken
      lastSearchStartAtRef.current = now

      if (isMountedRef.current) {
        setIsSearching(true)
        setError(null)
      }

      try {
        const session = await searchApi.execute(normalizedQuery, {
          activityRunId: options?.activityRunId,
          loadProfile,
          signal: controller.signal,
        })

        if (!isMountedRef.current) return session
        if (activeSearchRunRef.current === runToken) {
          setCurrentSession(session)
        }

        addActivity({
          id: `activity-${Date.now()}`,
          type: 'search',
          description: `Busqueda ejecutada: ${normalizedQuery.rawQuery}`,
          timestamp: new Date().toISOString(),
          metadata: { queryId: normalizedQuery.id, resultCount: session.totalResults },
        })

        setSavedSearches((prev) =>
          [
            {
              ...normalizedQuery,
              resultCount: session.totalResults,
            },
            ...prev.filter((item) => item.id !== normalizedQuery.id),
          ].slice(0, MAX_LOCAL_RECENT_SEARCHES)
        )
        queryClient.invalidateQueries({ queryKey: ['student', 'searchHistory'] })
        return session
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          if (activeSearchControllerRef.current !== controller) {
            return null
          }
          const timeoutSeconds = Math.max(1, Math.round(timeoutMs / 1000))
          const timeoutMessage =
            `La busqueda supero ${timeoutSeconds}s. Prueba menos terminos o un perfil de carga menor.`
          if (isMountedRef.current && activeSearchRunRef.current === runToken) {
            setError(timeoutMessage)
          }
          throw new Error(timeoutMessage)
        }

        const errorMessage = err instanceof Error ? err.message : 'Error al ejecutar busqueda'
        if (isMountedRef.current && activeSearchRunRef.current === runToken) {
          setError(errorMessage)
        }
        console.error('[useStudentSearch]:', err)
        throw err instanceof Error ? err : new Error(errorMessage)
      } finally {
        clearTimeout(timeoutId)
        if (activeSearchControllerRef.current === controller) {
          activeSearchControllerRef.current = null
        }
        if (isMountedRef.current && activeSearchRunRef.current === runToken) {
          setIsSearching(false)
        }
      }
    },
    [addActivity, queryClient, setSavedSearches]
  )

  const saveSearch = useCallback(
    async (searchId: string, isFavorite: boolean) => {
      try {
        await searchApi.saveSearch(searchId, isFavorite)
        toggleSearchFavorite(searchId)
        queryClient.invalidateQueries({ queryKey: ['student', 'searchHistory'] })
      } catch (err) {
        setError('No se pudo guardar la busqueda')
        console.error('[useStudentSearch saveSearch]:', err)
      }
    },
    [toggleSearchFavorite, queryClient]
  )

  const deleteSearch = useCallback(
    async (searchId: string) => {
      try {
        await searchApi.deleteSearch(searchId)
        setSavedSearches((prev) => prev.filter((s) => s.id !== searchId))
        queryClient.invalidateQueries({ queryKey: ['student', 'searchHistory'] })
      } catch (err) {
        setError('No se pudo eliminar la busqueda')
        console.error('[useStudentSearch deleteSearch]:', err)
      }
    },
    [queryClient, setSavedSearches]
  )

  const reuseSearch = useCallback(
    async (searchId: string) => {
      const search = searchHistory.find((s) => s.id === searchId)
      if (search) {
        await executeSearch(search)
      }
      return search
    },
    [searchHistory, executeSearch]
  )

  const getSuggestions = useCallback(async (term: string) => {
    try {
      return await searchApi.getMeshSuggestions(term)
    } catch (err) {
      console.error('[useStudentSearch getSuggestions]:', err)
      return []
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isSearching,
    error,
    currentSession,
    searchHistory,
    loadHistory,
    executeSearch,
    saveSearch,
    deleteSearch,
    reuseSearch,
    getSuggestions,
    clearError,
  }
}
