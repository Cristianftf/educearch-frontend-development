import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStudent } from '@/contexts/student-context'
import { verifyApi } from '@/lib/api'
import type { VerificationResult } from '@/types'

interface UseStudentVerifyReturn {
  isVerifying: boolean
  error: string | null
  lastResult: VerificationResult | null
  verificationHistory: VerificationResult[]
  verifyClaim: (claim: string, sourceUrl?: string) => Promise<VerificationResult | null>
  loadHistory: (page?: number, limit?: number) => Promise<void>
  clearHistory: () => void
  clearError: () => void
  getRecommendations: (verificationId: string) => Promise<string[]>
}

export function useStudentVerify(): UseStudentVerifyReturn {
  const {
    addActivity,
    addVerification,
    verificationHistory,
    setVerificationHistory,
    clearVerificationHistory,
  } = useStudent()
  const queryClient = useQueryClient()
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null)

  const verifyClaim = useCallback(
    async (claim: string, sourceUrl?: string) => {
      setIsVerifying(true)
      setError(null)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000)

      try {
        const result = await verifyApi.verifyClaim(claim, sourceUrl, {
          signal: controller.signal,
          headers: {
            'X-Student-Level': 'intermediate',
          },
        })

        clearTimeout(timeoutId)
        setLastResult(result)

        addVerification(result)
        queryClient.invalidateQueries({ queryKey: ['student', 'verifyHistory'] })

        const activityClaim = (claim || sourceUrl || '').trim()
        addActivity({
          id: `activity-${Date.now()}`,
          type: 'verification',
          description: `Verificacion realizada: "${activityClaim.substring(0, 50)}..."`,
          timestamp: new Date().toISOString(),
          metadata: {
            verificationId: result.id,
            status: result.status,
            score: result.score,
          },
        })

        return result
      } catch (err) {
        clearTimeout(timeoutId)

        if (err instanceof Error && err.name === 'AbortError') {
          const errorMessage = 'La verificacion excedio el tiempo limite. Intenta nuevamente.'
          setError(errorMessage)
          console.error('[useStudentVerify timeout]:', err)
          return null
        }

        const errorMessage = err instanceof Error ? err.message : 'Error al verificar claim'
        setError(errorMessage)
        console.error('[useStudentVerify]:', err)
        return null
      } finally {
        setIsVerifying(false)
      }
    },
    [addActivity, addVerification, queryClient]
  )

  const loadHistory = useCallback(
    async (page = 1, limit = 10) => {
      try {
        const data = await queryClient.fetchQuery({
          queryKey: ['student', 'verifyHistory', page, limit],
          queryFn: () => verifyApi.getHistory(page, limit),
        })
        setVerificationHistory(data.verifications)
      } catch (err) {
        console.error('[useStudentVerify loadHistory]:', err)
      }
    },
    [queryClient, setVerificationHistory]
  )

  const getRecommendations = useCallback(
    async (verificationId: string) => {
      try {
        const result = verificationHistory.find((v) => v.id === verificationId)
        return result?.recommendations || []
      } catch (err) {
        console.error('[useStudentVerify getRecommendations]:', err)
        return []
      }
    },
    [verificationHistory]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isVerifying,
    error,
    lastResult,
    verificationHistory,
    verifyClaim,
    loadHistory,
    clearHistory: clearVerificationHistory,
    clearError,
    getRecommendations,
  }
}
