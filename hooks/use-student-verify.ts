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
  const { addActivity, addVerification, verificationHistory, setVerificationHistory, clearVerificationHistory } = useStudent()
  const queryClient = useQueryClient()
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null)

  const verifyClaim = useCallback(
    async (claim: string, sourceUrl?: string) => {
      // 1. Mostrar skeleton inmediatamente
      setIsVerifying(true)
      setError(null)

      // 2. Fetch optimista con timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos

      try {
        const result = await verifyApi.verifyClaim(claim, sourceUrl, {
          signal: controller.signal,
          headers: {
            'X-Student-Level': 'intermediate', // Podría venir del contexto del estudiante
            'X-Prefer-Fast': 'true' // Priorizar velocidad sobre precisión
          }
        })

        clearTimeout(timeoutId)
        setLastResult(result)

        // Guardar en historial
        addVerification(result)
        queryClient.invalidateQueries({ queryKey: ['student', 'verifyHistory'] })

        // Registrar actividad
        addActivity({
          id: `activity-${Date.now()}`,
          type: 'verification',
          description: `Verificación realizada: "${claim.substring(0, 50)}..."`,
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
          // 3. Fallback a versión simplificada si timeout
          console.warn('[useStudentVerify]: Timeout, intentando versión simplificada')
          try {
            const simplifiedResult = await fetchSimplifiedVerification(claim, sourceUrl)
            setLastResult(simplifiedResult)
            addVerification(simplifiedResult)
            queryClient.invalidateQueries({ queryKey: ['student', 'verifyHistory'] })
            return simplifiedResult
          } catch (fallbackErr) {
            const errorMessage = 'Timeout en verificación completa. Intenta con un claim más corto.'
            setError(errorMessage)
            console.error('[useStudentVerify fallback]:', fallbackErr)
            return null
          }
        } else {
          const errorMessage = err instanceof Error ? err.message : 'Error al verificar claim'
          setError(errorMessage)
          console.error('[useStudentVerify]:', err)
          return null
        }
      } finally {
        setIsVerifying(false)
      }
    },
    [addActivity, addVerification, queryClient]
  )

  const loadHistory = useCallback(async (page = 1, limit = 10) => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['student', 'verifyHistory', page, limit],
        queryFn: () => verifyApi.getHistory(page, limit),
      })
      setVerificationHistory(data.verifications)
    } catch (err) {
      console.error('[useStudentVerify loadHistory]:', err)
    }
  }, [queryClient, setVerificationHistory])

  // Función de fallback para verificación simplificada
  const fetchSimplifiedVerification = useCallback(async (claim: string, _sourceUrl?: string) => {
    // Simular una verificación básica (esto debería ser un endpoint real)
    const mockResult: VerificationResult = {
      id: `verification-${Date.now()}`,
      claim,
      supportingEvidence: [],
      status: 'pending',
      score: 50,
      contradictingEvidence: [],
      explanation: 'Análisis simplificado debido a timeout. Recomendamos verificar manualmente.',
      recommendations: [
        'Busca en PubMed con términos más específicos',
        'Consulta revisiones sistemáticas recientes',
        'Verifica la fuente original del claim'
      ],
      verifiedAt: new Date().toISOString()
    }

    // Simular delay de procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000))

    return mockResult
  }, [])

  const getRecommendations = useCallback(async (verificationId: string) => {
    try {
      const result = verificationHistory.find((v) => v.id === verificationId)
      return result?.recommendations || []
    } catch (err) {
      console.error('[useStudentVerify getRecommendations]:', err)
      return []
    }
  }, [verificationHistory])

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
