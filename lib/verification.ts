import type { VerificationResult } from '@/types'
import { api } from './api-client'

export const verifyApi = {
  verifyClaim: (claim: string, url?: string, options?: RequestInit) =>
    api.post<VerificationResult>('/verify/claim', { claim, url }, options),

  getHistory: (page = 1, limit = 10) =>
    api.get<{ verifications: VerificationResult[]; total: number }>(
      `/verify/history?page=${page}&limit=${limit}`
    ),
}
