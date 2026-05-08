import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStudent } from '@/contexts/student-context'
import { verifyApi } from '@/lib/api'
import {
  type RequestLoadProfile,
  normalizeRequestLoadProfile,
  VERIFICATION_TIMEOUT_MS_BY_PROFILE,
} from '@/lib/request-load-profile'
import type { VerificationResult } from '@/types'

const MIN_VERIFY_INTERVAL_MS = 1000

interface UseStudentVerifyReturn {
  isVerifying: boolean
  error: string | null
  lastResult: VerificationResult | null
  verificationHistory: VerificationResult[]
  verifyClaim: (
    claim: string,
    sourceUrl?: string,
    options?: { activityRunId?: string; loadProfile?: RequestLoadProfile }
  ) => Promise<VerificationResult | null>
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
  const activeVerifyControllerRef = useRef<AbortController | null>(null)
  const activeVerifyRunRef = useRef<number>(0)
  const lastVerifyStartAtRef = useRef<number>(0)

  const verifyClaim = useCallback(
    async (
      claim: string,
      sourceUrl?: string,
      options?: { activityRunId?: string; loadProfile?: RequestLoadProfile }
    ) => {
      const loadProfile = normalizeRequestLoadProfile(options?.loadProfile)
      const now = Date.now()
      const elapsed = now - lastVerifyStartAtRef.current
      if (elapsed < MIN_VERIFY_INTERVAL_MS) {
        setError('Espera 1 segundo antes de lanzar otra verificacion.')
        return null
      }

      activeVerifyControllerRef.current?.abort()
      const controller = new AbortController()
      activeVerifyControllerRef.current = controller
      const timeoutMs = VERIFICATION_TIMEOUT_MS_BY_PROFILE[loadProfile]
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      const runToken = activeVerifyRunRef.current + 1
      activeVerifyRunRef.current = runToken
      lastVerifyStartAtRef.current = now

      setIsVerifying(true)
      setError(null)

      try {
        const result = await verifyApi.verifyClaim(claim, sourceUrl, {
          activityRunId: options?.activityRunId,
          loadProfile,
          signal: controller.signal,
          headers: {
            'X-Student-Level': 'intermediate',
            'X-Load-Profile': loadProfile,
          },
        })
        if (!result) {
          if (activeVerifyRunRef.current === runToken) {
            setError('No se pudo completar la verificacion en este intento.')
          }
          return null
        }

        if (activeVerifyRunRef.current === runToken) {
          setLastResult(result)
        }

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
        if (err instanceof Error && err.name === 'AbortError') {
          if (activeVerifyControllerRef.current !== controller) {
            return null
          }
          const timeoutSeconds = Math.max(1, Math.round(timeoutMs / 1000))
          const errorMessage =
            `La verificacion excedio ${timeoutSeconds}s. Prueba el perfil de carga Ligera o simplifica el claim.`
          if (activeVerifyRunRef.current === runToken) {
            setError(errorMessage)
          }
          return null
        }

        const errorMessage = err instanceof Error ? err.message : 'Error al verificar claim'
        if (activeVerifyRunRef.current === runToken) {
          setError(errorMessage)
        }
        console.error('[useStudentVerify]:', err)
        return null
      } finally {
        clearTimeout(timeoutId)
        if (activeVerifyControllerRef.current === controller) {
          activeVerifyControllerRef.current = null
        }
        if (activeVerifyRunRef.current === runToken) {
          setIsVerifying(false)
        }
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
