import { useEffect, useCallback, useRef, useState } from 'react'
import { useAdmin } from '@/contexts/admin-context'
import { adminSystemApi, adminAuditApi } from '@/lib/api'
import type { SystemHealth, AuditLog } from '@/types'

interface UseSystemMonitorReturn {
  isMonitoring: boolean
  error: string | null
  health: SystemHealth | null
  recentLogs: AuditLog[]
  
  startMonitoring: (interval?: number) => void
  stopMonitoring: () => void
  fetchHealth: () => Promise<void>
  fetchLogs: (page?: number, limit?: number) => Promise<void>
  clearError: () => void
}

export function useSystemMonitor(): UseSystemMonitorReturn {
  const { isMonitoring, startMonitoring: startCtx, stopMonitoring: stopCtx, setSystemHealth, setAuditLogs, auditLogs } = useAdmin()
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const monitoringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const healthData = await adminSystemApi.getHealth()
      setSystemHealth(healthData)
      setHealth(healthData)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener salud del sistema'
      setError(errorMessage)
      console.error('[useSystemMonitor fetchHealth]:', err)
    }
  }, [setSystemHealth])

  const fetchLogs = useCallback(async (page = 1, limit = 100) => {
    try {
      const logsData = await adminAuditApi.getLogs(page, limit)
      setAuditLogs(logsData.logs)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener logs'
      setError(errorMessage)
      console.error('[useSystemMonitor fetchLogs]:', err)
    }
  }, [setAuditLogs])

  const startMonitoring = useCallback((interval = 5000) => {
    startCtx()
    
    // Fetch inmediato
    fetchHealth()
    fetchLogs()

    // Setup polling
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
    }

    const intervalId = setInterval(() => {
      fetchHealth()
      fetchLogs()
    }, interval)

    monitoringIntervalRef.current = intervalId
  }, [startCtx, fetchHealth, fetchLogs])

  const stopMonitoring = useCallback(() => {
    stopCtx()
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
      monitoringIntervalRef.current = null
    }
  }, [stopCtx])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current)
      }
    }
  }, [])

  return {
    isMonitoring,
    error,
    health,
    recentLogs: auditLogs,
    startMonitoring,
    stopMonitoring,
    fetchHealth,
    fetchLogs,
    clearError,
  }
}
