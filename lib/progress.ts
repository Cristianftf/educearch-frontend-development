import type { StudentProgress } from '@/types'
import { api } from './api-client'

export const progressApi = {
  getMyProgress: () => api.get<StudentProgress>('/progress/me'),

  getStudentProgress: (studentId: string) =>
    api.get<StudentProgress>(`/progress/${studentId}`),
}
