'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import type {
  CaseStudy,
  CaseSubmission,
  StudentProgress,
  SearchHedge,
  Evaluation,
} from '@/types'

interface ProfessorAnalytics {
  totalStudents: number
  averageProgress: number
  submissionsThisWeek: number
  lowProgressCount: number
}

interface ProfessorContextType {
  // Casos
  cases: CaseStudy[]
  addCase: (caseStudy: CaseStudy) => void
  updateCase: (id: string, updates: Partial<CaseStudy>) => void
  deleteCase: (id: string) => void
  setCases: Dispatch<SetStateAction<CaseStudy[]>>

  // Entregas/Submissions
  submissions: CaseSubmission[]
  addSubmission: (submission: CaseSubmission) => void
  updateSubmissionStatus: (submissionId: string, status: CaseSubmission['status']) => void
  setSubmissions: (submissions: CaseSubmission[]) => void

  // Estudiantes
  students: StudentProgress[]
  setStudents: (students: StudentProgress[]) => void
  getStudentProgress: (studentId: string) => StudentProgress | undefined

  // Search Hedges
  hedges: SearchHedge[]
  addHedge: (hedge: SearchHedge) => void
  updateHedge: (id: string, updates: Partial<SearchHedge>) => void
  deleteHedge: (id: string) => void
  setHedges: (hedges: SearchHedge[]) => void

  // Evaluaciones
  evaluations: Evaluation[]
  addEvaluation: (evaluation: Evaluation) => void
  setEvaluations: (evaluations: Evaluation[]) => void

  // Anal?ticas
  analytics: ProfessorAnalytics
  updateAnalytics: (updates: Partial<ProfessorAnalytics>) => void

  // Filtros/Estado UI
  selectedCaseFilter: 'all' | 'draft' | 'active' | 'archived'
  setSelectedCaseFilter: (filter: 'all' | 'draft' | 'active' | 'archived') => void
}

const ProfessorContext = createContext<ProfessorContextType | undefined>(undefined)

export function ProfessorProvider({ children }: { children: ReactNode }) {
  const [cases, setCasesState] = useState<CaseStudy[]>([])
  const [submissions, setSubmissionsState] = useState<CaseSubmission[]>([])
  const [students, setStudentsState] = useState<StudentProgress[]>([])
  const [hedges, setHedgesState] = useState<SearchHedge[]>([])
  const [evaluations, setEvaluationsState] = useState<Evaluation[]>([])
  const [selectedCaseFilter, setSelectedCaseFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  const [analytics, setAnalytics] = useState<ProfessorAnalytics>({
    totalStudents: 0,
    averageProgress: 0,
    submissionsThisWeek: 0,
    lowProgressCount: 0,
  })

  const setCases = useCallback((updater: React.SetStateAction<CaseStudy[]>) => {
    setCasesState(updater)
  }, [])

  const addCase = useCallback((caseStudy: CaseStudy) => {
    setCasesState((prev) => [caseStudy, ...prev])
  }, [])

  const updateCase = useCallback((id: string, updates: Partial<CaseStudy>) => {
    setCasesState((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
  }, [])

  const deleteCase = useCallback((id: string) => {
    setCasesState((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const setSubmissions = useCallback((newSubmissions: CaseSubmission[]) => {
    setSubmissionsState(newSubmissions)
  }, [])

  const addSubmission = useCallback((submission: CaseSubmission) => {
    setSubmissionsState((prev) => [submission, ...prev])
  }, [])

  const updateSubmissionStatus = useCallback((submissionId: string, status: CaseSubmission['status']) => {
    setSubmissionsState((prev) =>
      prev.map((s) => (s.id === submissionId ? { ...s, status } : s))
    )
  }, [])

  const setStudents = useCallback((newStudents: StudentProgress[]) => {
    setStudentsState(newStudents)
  }, [])

  const getStudentProgress = useCallback(
    (studentId: string) => {
      return students.find((s) => s.userId === studentId)
    },
    [students]
  )

  const setHedges = useCallback((newHedges: SearchHedge[]) => {
    setHedgesState(newHedges)
  }, [])

  const addHedge = useCallback((hedge: SearchHedge) => {
    setHedgesState((prev) => [hedge, ...prev])
  }, [])

  const updateHedge = useCallback((id: string, updates: Partial<SearchHedge>) => {
    setHedgesState((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    )
  }, [])

  const deleteHedge = useCallback((id: string) => {
    setHedgesState((prev) => prev.filter((h) => h.id !== id))
  }, [])

  const setEvaluations = useCallback((newEvaluations: Evaluation[]) => {
    setEvaluationsState(newEvaluations)
  }, [])

  const addEvaluation = useCallback((evaluation: Evaluation) => {
    setEvaluationsState((prev) => [evaluation, ...prev])
  }, [])

  const updateAnalytics = useCallback((updates: Partial<ProfessorAnalytics>) => {
    setAnalytics((prev) => ({ ...prev, ...updates }))
  }, [])

  const value = useMemo<ProfessorContextType>(() => ({
    cases,
    addCase,
    updateCase,
    deleteCase,
    setCases,
    submissions,
    addSubmission,
    updateSubmissionStatus,
    setSubmissions,
    students,
    setStudents,
    getStudentProgress,
    hedges,
    addHedge,
    updateHedge,
    deleteHedge,
    setHedges,
    evaluations,
    addEvaluation,
    setEvaluations,
    analytics,
    updateAnalytics,
    selectedCaseFilter,
    setSelectedCaseFilter,
  }), [
    cases,
    addCase,
    updateCase,
    deleteCase,
    setCases,
    submissions,
    addSubmission,
    updateSubmissionStatus,
    setSubmissions,
    students,
    setStudents,
    getStudentProgress,
    hedges,
    addHedge,
    updateHedge,
    deleteHedge,
    setHedges,
    evaluations,
    addEvaluation,
    setEvaluations,
    analytics,
    updateAnalytics,
    selectedCaseFilter,
    setSelectedCaseFilter,
  ])

  return <ProfessorContext.Provider value={value}>{children}</ProfessorContext.Provider>
}

export function useProfessor() {
  const context = useContext(ProfessorContext)
  if (!context) {
    throw new Error('useProfessor must be used within ProfessorProvider')
  }
  return context
}
