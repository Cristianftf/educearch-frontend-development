import type { CaseSubmission, Evaluation } from '@/types'
import { api } from './api-client'

export const evaluationApi = {
  getPending: () => api.get<CaseSubmission[]>('/evaluations/pending'),

  submit: (submissionId: string, evaluation: Omit<Evaluation, 'id' | 'evaluatedAt'>) =>
    api.post<Evaluation>(`/evaluations/${submissionId}`, evaluation),

  getBySubmission: (submissionId: string) =>
    api.get<Evaluation>(`/evaluations/submission/${submissionId}`),

  getSubmission: (submissionId: string) =>
    api.get<CaseSubmission>(`/submissions/${submissionId}`),
}
