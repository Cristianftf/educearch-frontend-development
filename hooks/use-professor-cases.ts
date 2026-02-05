import { useCallback, useState } from 'react'
import { useProfessor } from '@/contexts/professor-context'
import { casesApi, evaluationApi } from '@/lib/api'
import type { CaseStudy, CaseStatus, CaseSubmission } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

const buildApiUrl = (path: string) => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

interface UseProfessorCasesReturn {
  cases: CaseStudy[]
  isLoading: boolean
  error: string | null

  loadCases: () => Promise<void>
  createCase: (caseData: Omit<CaseStudy, 'id' | 'createdAt' | 'createdBy'>) => Promise<CaseStudy | null>
  updateCase: (id: string, updates: Partial<CaseStudy>) => Promise<CaseStudy | null>
  deleteCase: (id: string) => Promise<boolean>
  changeStatus: (id: string, status: CaseStatus) => Promise<boolean>
  assignToStudents: (caseId: string, studentIds: string[]) => Promise<boolean>
  getSubmissions: (caseId: string) => Promise<CaseSubmission[]>
  prefetchNextSubmission: (currentSubmissionId: string) => void
  prefetchCaseDetails: (caseId: string) => void
  clearError: () => void
}

export function useProfessorCases(): UseProfessorCasesReturn {
  const { cases, setCases, updateCase: updateCaseContext, deleteCase: deleteCaseContext } = useProfessor()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCases = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const allCases = await casesApi.getAll()
      setCases(allCases)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar casos'
      setError(errorMessage)
      console.error('[useProfessorCases loadCases]:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setCases])

  const createCase = useCallback(
    async (caseData: Omit<CaseStudy, 'id' | 'createdAt' | 'createdBy'>) => {
      setError(null)

      try {
        const newCase = await casesApi.create(caseData)
        setCases((prev) => [newCase, ...prev])
        return newCase
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al crear caso'
        setError(errorMessage)
        console.error('[useProfessorCases createCase]:', err)
        return null
      }
    },
    [setCases]
  )

  const updateCase = useCallback(
    async (id: string, updates: Partial<CaseStudy>) => {
      setError(null)

      try {
        const updated = await casesApi.update(id, updates)
        updateCaseContext(id, updated)
        return updated
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al actualizar caso'
        setError(errorMessage)
        console.error('[useProfessorCases updateCase]:', err)
        return null
      }
    },
    [updateCaseContext]
  )

  const deleteCase = useCallback(
    async (id: string) => {
      setError(null)

      try {
        await casesApi.delete(id)
        deleteCaseContext(id)
        return true
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al eliminar caso'
        setError(errorMessage)
        console.error('[useProfessorCases deleteCase]:', err)
        return false
      }
    },
    [deleteCaseContext]
  )

  const changeStatus = useCallback(
    async (id: string, status: CaseStatus) => {
      setError(null)

      try {
        const updated = await casesApi.update(id, { status })
        updateCaseContext(id, updated)
        return true
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cambiar estado'
        setError(errorMessage)
        console.error('[useProfessorCases changeStatus]:', err)
        return false
      }
    },
    [updateCaseContext]
  )

  const assignToStudents = useCallback(async (caseId: string, studentIds: string[]) => {
    setError(null)

    try {
      const updated = await casesApi.assign(caseId, studentIds)
      updateCaseContext(caseId, updated)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al asignar caso'
      setError(errorMessage)
      console.error('[useProfessorCases assignToStudents]:', err)
      return false
    }
  }, [updateCaseContext])

  const getSubmissions = useCallback(async (caseId: string) => {
    try {
      return await casesApi.getSubmissions(caseId)
    } catch (err) {
      console.error('[useProfessorCases getSubmissions]:', err)
      return []
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Prefetching functions for background loading
  const prefetchNextSubmission = useCallback(async (currentSubmissionId: string) => {
    try {
      // Get all pending submissions to find the next one
      const pendingSubmissions = await evaluationApi.getPending()

      // Find current submission index
      const currentIndex = pendingSubmissions.findIndex(sub => sub.id === currentSubmissionId)
      if (currentIndex === -1 || currentIndex >= pendingSubmissions.length - 1) return

      // Prefetch next submission
      const nextSubmission = pendingSubmissions[currentIndex + 1]

      // Prefetch submission details in background
      fetch(buildApiUrl(`/submissions/${nextSubmission.id}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-User-Role': 'professor',
          'X-UCI-Platform': 'competencia-informacional'
        }
      }).catch(err => {
        console.warn('[prefetchNextSubmission]: Failed to prefetch next submission', err)
      })

      // Prefetch case details if not already loaded
      const caseDetails = cases.find(c => c.id === nextSubmission.caseId)
      if (!caseDetails) {
        fetch(buildApiUrl(`/cases/${nextSubmission.caseId}`), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'X-User-Role': 'professor',
            'X-UCI-Platform': 'competencia-informacional'
          }
        }).catch(err => {
          console.warn('[prefetchNextSubmission]: Failed to prefetch case details', err)
        })
      }
    } catch (err) {
      console.warn('[prefetchNextSubmission]: Error in prefetching', err)
    }
  }, [cases])

  const prefetchCaseDetails = useCallback(async (caseId: string) => {
    try {
      // Prefetch case details
      fetch(buildApiUrl(`/cases/${caseId}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-User-Role': 'professor',
          'X-UCI-Platform': 'competencia-informacional'
        }
      }).catch(err => {
        console.warn('[prefetchCaseDetails]: Failed to prefetch case', err)
      })

      // Prefetch submissions for this case
      fetch(buildApiUrl(`/cases/${caseId}/submissions`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-User-Role': 'professor',
          'X-UCI-Platform': 'competencia-informacional'
        }
      }).catch(err => {
        console.warn('[prefetchCaseDetails]: Failed to prefetch submissions', err)
      })
    } catch (err) {
      console.warn('[prefetchCaseDetails]: Error in prefetching', err)
    }
  }, [])

  return {
    cases,
    isLoading,
    error,
    loadCases,
    createCase,
    updateCase,
    deleteCase,
    changeStatus,
    assignToStudents,
    getSubmissions,
    prefetchNextSubmission,
    prefetchCaseDetails,
    clearError,
  }
}
