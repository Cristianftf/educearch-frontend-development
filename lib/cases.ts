import type { CaseStudy, CaseSubmission } from '@/types'
import { api } from './api-client'

export const casesApi = {
  // Professor endpoints
  getAll: (status?: string) =>
    api.get<CaseStudy[]>(`/cases${status ? `?status=${status}` : ''}`),

  getById: (id: string) => api.get<CaseStudy>(`/cases/${id}`),

  create: (caseData: Omit<CaseStudy, 'id' | 'createdAt' | 'createdBy'>) =>
    api.post<CaseStudy>('/cases', caseData),

  update: (id: string, caseData: Partial<CaseStudy>) =>
    api.put<CaseStudy>(`/cases/${id}`, caseData),

  delete: (id: string) => api.delete<void>(`/cases/${id}`),

  assign: (id: string, studentIds: string[]) =>
    api.post<CaseStudy>(`/cases/${id}/assign`, { studentIds }),

  getSubmissions: (caseId: string) =>
    api.get<CaseSubmission[]>(`/cases/${caseId}/submissions`),

  // Student endpoints
  getAssigned: () => api.get<CaseStudy[]>('/cases/assigned'),

  submit: (caseId: string, submission: Omit<CaseSubmission, 'id' | 'submittedAt' | 'status'>) =>
    api.post<CaseSubmission>(`/cases/${caseId}/submit`, submission),
}
