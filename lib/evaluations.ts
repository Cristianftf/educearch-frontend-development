import type { CaseSubmission, Evaluation } from '@/types'
import { api } from './api-client'

type EvaluationsResponse = {
  evaluations?: Array<Record<string, any>>
  count?: number
}

type SubmissionResponse = {
  submission?: Record<string, any>
}

type EvaluationResponse = {
  evaluation?: Record<string, any>
}

function normalizeStatus(status: unknown): CaseSubmission['status'] {
  if (typeof status !== 'string') return 'pending'
  const normalized = status.toLowerCase()
  if (normalized === 'evaluated') return 'reviewed'
  if (normalized === 'reviewed' || normalized === 'pending' || normalized === 'returned') {
    return normalized as CaseSubmission['status']
  }
  return 'pending'
}

function normalizeSubmission(raw: Record<string, any>): CaseSubmission {
  const id = raw.id ?? raw.submissionId ?? ''
  return {
    id,
    caseId: raw.caseId ?? '',
    studentId: raw.studentId ?? '',
    submittedAt: raw.submittedAt ?? '',
    content: raw.content ?? '',
    selectedArticles: raw.selectedArticles ?? [],
    bibliography: raw.bibliography ?? '',
    status: normalizeStatus(raw.status),
    evaluation: raw.evaluation,
  }
}

export const evaluationApi = {
  getPending: async () => {
    const res = await api.get<EvaluationsResponse>('/evaluations/pending')
    const items = res?.evaluations ?? []
    return items.map(normalizeSubmission)
  },

  getReviewed: async () => {
    const res = await api.get<EvaluationsResponse>('/evaluations/reviewed')
    const items = res?.evaluations ?? []
    return items.map(normalizeSubmission)
  },

  submit: async (submissionId: string, evaluation: Omit<Evaluation, 'id' | 'evaluatedAt'>) => {
    const res = await api.post<{ evaluation?: Evaluation }>(`/evaluations/${submissionId}`, evaluation)
    return res?.evaluation as Evaluation
  },

  getBySubmission: async (submissionId: string) => {
    const res = await api.get<EvaluationResponse>(`/evaluations/submission/${submissionId}`)
    return res?.evaluation as Evaluation
  },

  getSubmission: async (submissionId: string) => {
    const res = await api.get<SubmissionResponse>(`/submissions/${submissionId}`)
    return normalizeSubmission(res?.submission ?? {})
  },
}
