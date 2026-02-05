import type { StudentProgress, StudentSummary } from '@/types'
import { api } from './api-client'

export const professorAnalyticsApi = {
  getClassOverview: () =>
    api.get<{
      studentCount: number
      averageProgress: Record<string, number>
      lowProgressStudents: StudentSummary[]
      commonSearchTerms: { term: string; count: number }[]
      problematicTerms: { term: string; errorRate: number }[]
    }>('/professor/analytics/overview'),

  getStudentDetails: (studentId: string) =>
    api.get<StudentProgress>(`/professor/analytics/student/${studentId}`),
}
