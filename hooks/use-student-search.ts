import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStudent } from '@/contexts/student-context'
import { searchApi } from '@/lib/api'
import type { SearchQuery, SearchSession, MeshTerm } from '@/types'

interface UseStudentSearchReturn {
  isSearching: boolean
  error: string | null
  currentSession: SearchSession | null
  searchHistory: SearchQuery[]
  
  loadHistory: (page?: number, limit?: number) => Promise<void>
  executeSearch: (query: SearchQuery) => Promise<SearchSession | null>
  saveSearch: (searchId: string, isFavorite: boolean) => Promise<void>
  deleteSearch: (searchId: string) => Promise<void>
  reuseSearch: (searchId: string) => Promise<SearchQuery | undefined>
  getSuggestions: (term: string) => Promise<MeshTerm[]>
  clearError: () => void
}

export function useStudentSearch(): UseStudentSearchReturn {
  const { addActivity, savedSearches, setSavedSearches, addSavedSearch, toggleSearchFavorite } = useStudent()
  const queryClient = useQueryClient()

  const searchHistory = savedSearches
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null)

  const loadHistory = useCallback(async (page = 1, limit = 10) => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['student', 'searchHistory', page, limit],
        queryFn: () => searchApi.getHistory(page, limit),
      })
      setSavedSearches(data.searches)
    } catch (err) {
      console.error('[useStudentSearch loadHistory]:', err)
    }
  }, [queryClient, setSavedSearches])

  const executeSearch = useCallback(
    async (query: SearchQuery) => {
      setIsSearching(true)
      setError(null)

      try {
        const session = await searchApi.execute(query)
        setCurrentSession(session)

        // Registrar actividad
        addActivity({
          id: `activity-${Date.now()}`,
          type: 'search',
          description: `Búsqueda ejecutada: ${query.rawQuery}`,
          timestamp: new Date().toISOString(),
          metadata: { queryId: query.id, resultCount: session.totalResults },
        })

        // Auto-guardar búsqueda
        addSavedSearch(query)
        queryClient.invalidateQueries({ queryKey: ['student', 'searchHistory'] })
        return session
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al ejecutar búsqueda'
        setError(errorMessage)
        console.error('[useStudentSearch]:', err)
        return null
      } finally {
        setIsSearching(false)
      }
    },
    [addActivity, addSavedSearch, queryClient]
  )

  const saveSearch = useCallback(
    async (searchId: string, isFavorite: boolean) => {
      try {
        await searchApi.saveSearch(searchId, isFavorite)
        toggleSearchFavorite(searchId)
        queryClient.invalidateQueries({ queryKey: ['student', 'searchHistory'] })
      } catch (err) {
        setError('No se pudo guardar la búsqueda')
        console.error('[useStudentSearch saveSearch]:', err)
      }
    },
    [toggleSearchFavorite, queryClient]
  )

  const deleteSearch = useCallback(async (searchId: string) => {
    try {
      await searchApi.deleteSearch(searchId)
      setSavedSearches((prev) => prev.filter((s) => s.id !== searchId))
      queryClient.invalidateQueries({ queryKey: ['student', 'searchHistory'] })
    } catch (err) {
      setError('No se pudo eliminar la búsqueda')
      console.error('[useStudentSearch deleteSearch]:', err)
    }
  }, [queryClient, setSavedSearches])

  const reuseSearch = useCallback(async (searchId: string) => {
    const search = searchHistory.find((s) => s.id === searchId)
    if (search) {
      await executeSearch(search)
    }
    return search
  }, [searchHistory, executeSearch])

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
