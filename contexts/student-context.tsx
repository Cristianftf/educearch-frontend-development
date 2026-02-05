'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type {
  CompetencyType,
  CompetencyProgress,
  Activity,
  SearchQuery,
  VerificationResult,
  Bibliography,
} from '@/types'

interface StudentContextType {
  // Competencias
  competencies: Record<CompetencyType, CompetencyProgress>
  updateCompetency: (type: CompetencyType, progress: Partial<CompetencyProgress>) => void

  // Actividades
  recentActivities: Activity[]
  addActivity: (activity: Activity) => void
  clearActivities: () => void

  // Búsquedas guardadas
  savedSearches: SearchQuery[]
  addSavedSearch: (search: SearchQuery) => void
  removeSavedSearch: (searchId: string) => void
  toggleSearchFavorite: (searchId: string) => void

  // Verificaciones
  verificationHistory: VerificationResult[]
  addVerification: (verification: VerificationResult) => void
  clearVerificationHistory: () => void

  // Bibliografías
  bibliographies: Bibliography[]
  addBibliography: (bibliography: Bibliography) => void
  removeBibliography: (bibliographyId: string) => void

  // Estado de UI
  currentCompetencyFocus?: CompetencyType
  setCurrentCompetencyFocus: (competency?: CompetencyType) => void
}

const StudentContext = createContext<StudentContextType | undefined>(undefined)

export function StudentProvider({ children }: { children: ReactNode }) {
  const [competencies, setCompetencies] = useState<Record<CompetencyType, CompetencyProgress>>({
    access: {
      type: 'access',
      score: 0,
      level: 'novice',
      lastUpdated: new Date().toISOString(),
    },
    process: {
      type: 'process',
      score: 0,
      level: 'novice',
      lastUpdated: new Date().toISOString(),
    },
    communicate: {
      type: 'communicate',
      score: 0,
      level: 'novice',
      lastUpdated: new Date().toISOString(),
    },
  })

  const [recentActivities, setRecentActivities] = useState<Activity[]>([])
  const [savedSearches, setSavedSearches] = useState<SearchQuery[]>([])
  const [verificationHistory, setVerificationHistory] = useState<VerificationResult[]>([])
  const [bibliographies, setBibliographies] = useState<Bibliography[]>([])
  const [currentCompetencyFocus, setCurrentCompetencyFocus] = useState<CompetencyType>()

  const updateCompetency = useCallback(
    (type: CompetencyType, progress: Partial<CompetencyProgress>) => {
      setCompetencies((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          ...progress,
          lastUpdated: new Date().toISOString(),
        },
      }))
    },
    []
  )

  const addActivity = useCallback((activity: Activity) => {
    setRecentActivities((prev) => [activity, ...prev].slice(0, 50)) // Mantener últimas 50
  }, [])

  const clearActivities = useCallback(() => {
    setRecentActivities([])
  }, [])

  const addSavedSearch = useCallback((search: SearchQuery) => {
    setSavedSearches((prev) => [search, ...prev])
  }, [])

  const removeSavedSearch = useCallback((searchId: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== searchId))
  }, [])

  const toggleSearchFavorite = useCallback((searchId: string) => {
    setSavedSearches((prev) =>
      prev.map((s) => (s.id === searchId ? { ...s, isFavorite: !s.isFavorite } : s))
    )
  }, [])

  const addVerification = useCallback((verification: VerificationResult) => {
    setVerificationHistory((prev) => [verification, ...prev].slice(0, 100))
  }, [])

  const clearVerificationHistory = useCallback(() => {
    setVerificationHistory([])
  }, [])

  const addBibliography = useCallback((bibliography: Bibliography) => {
    setBibliographies((prev) => [bibliography, ...prev])
  }, [])

  const removeBibliography = useCallback((bibliographyId: string) => {
    setBibliographies((prev) => prev.filter((b) => b.id !== bibliographyId))
  }, [])

  const value: StudentContextType = {
    competencies,
    updateCompetency,
    recentActivities,
    addActivity,
    clearActivities,
    savedSearches,
    addSavedSearch,
    removeSavedSearch,
    toggleSearchFavorite,
    verificationHistory,
    addVerification,
    clearVerificationHistory,
    bibliographies,
    addBibliography,
    removeBibliography,
    currentCompetencyFocus,
    setCurrentCompetencyFocus,
  }

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>
}

export function useStudent() {
  const context = useContext(StudentContext)
  if (!context) {
    throw new Error('useStudent must be used within StudentProvider')
  }
  return context
}
