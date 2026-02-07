import type { ProfessorAnalyticsOverview, StudentProgress } from '@/types'
import { api } from './api-client'

export const professorAnalyticsApi = {
  getClassOverview: () =>
    api.get<ProfessorAnalyticsOverview>('/professor/analytics/overview'),

  getStudentDetails: (studentId: string) =>
    api.get<StudentProgress>(`/professor/analytics/student/${studentId}`),
}
