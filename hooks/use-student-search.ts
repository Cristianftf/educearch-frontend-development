import { useCallback, useState } from 'react'
import { useStudent } from '@/contexts/student-context'
import { searchApi } from '@/lib/api'
import type { SearchQuery, SearchSession, MeshTerm } from '@/types'

interface UseStudentSearchReturn {
  isSearching: boolean
  error: string | null
  currentSession: SearchSession | null
  searchHistory: SearchQuery[]
  
  executeSearch: (query: SearchQuery) => Promise<void>
  saveSearch: (searchId: string, isFavorite: boolean) => Promise<void>
  deleteSearch: (searchId: string) => Promise<void>
  reuseSearch: (searchId: string) => Promise<SearchQuery | undefined>
  getSuggestions: (term: string) => Promise<MeshTerm[]>
  clearError: () => void
}

export function useStudentSearch(): UseStudentSearchReturn {
  const { addActivity, savedSearches, addSavedSearch, toggleSearchFavorite } = useStudent()
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null)
  const [searchHistory, setSearchHistory] = useState<SearchQuery[]>(savedSearches)

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
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al ejecutar búsqueda'
        setError(errorMessage)
        console.error('[useStudentSearch]:', err)
      } finally {
        setIsSearching(false)
      }
    },
    [addActivity, addSavedSearch]
  )

  const saveSearch = useCallback(
    async (searchId: string, isFavorite: boolean) => {
      try {
        await searchApi.saveSearch(searchId, isFavorite)
        toggleSearchFavorite(searchId)
      } catch (err) {
        setError('No se pudo guardar la búsqueda')
        console.error('[useStudentSearch saveSearch]:', err)
      }
    },
    [toggleSearchFavorite]
  )

  const deleteSearch = useCallback(async (searchId: string) => {
    try {
      await searchApi.deleteSearch(searchId)
      setSearchHistory((prev) => prev.filter((s) => s.id !== searchId))
    } catch (err) {
      setError('No se pudo eliminar la búsqueda')
      console.error('[useStudentSearch deleteSearch]:', err)
    }
  }, [])

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
    executeSearch,
    saveSearch,
    deleteSearch,
    reuseSearch,
    getSuggestions,
    clearError,
  }
}
