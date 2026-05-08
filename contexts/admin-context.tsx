'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Alert, AuditLog, SystemHealth, SystemSettings, User } from '@/types'

interface AdminContextType {
  users: User[]
  setUsers: (users: User[]) => void
  updateUser: (id: string, updates: Partial<User>) => void
  removeUser: (id: string) => void
  addUser: (user: User) => void
  systemHealth: SystemHealth | null
  setSystemHealth: (health: SystemHealth) => void
  auditLogs: AuditLog[]
  setAuditLogs: (logs: AuditLog[]) => void
  addAuditLog: (log: AuditLog) => void
  settings: SystemSettings | null
  setSettings: (settings: SystemSettings) => void
  alerts: Alert[]
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  updateAlert: (id: string, updates: Partial<Alert>) => void
  deleteAlert: (id: string) => void
  backups: Array<{ id: string; createdAt: string; size: number }>
  setBackups: (backups: Array<{ id: string; createdAt: string; size: number }>) => void
  isMonitoring: boolean
  startMonitoring: () => void
  stopMonitoring: () => void
  selectedLogLevel: 'all' | 'INFO' | 'WARN' | 'ERROR'
  setSelectedLogLevel: (level: 'all' | 'INFO' | 'WARN' | 'ERROR') => void
  logSearchQuery: string
  setLogSearchQuery: (query: string) => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)
const ADMIN_UI_STATE_KEY = 'admin_ui_state_v1'

export function AdminProvider({ children }: { children: ReactNode }) {
  const [users, setUsersState] = useState<User[]>([])
  const [systemHealth, setSystemHealthState] = useState<SystemHealth | null>(null)
  const [auditLogs, setAuditLogsState] = useState<AuditLog[]>([])
  const [settings, setSettingsState] = useState<SystemSettings | null>(null)
  const [alerts, setAlertsState] = useState<Alert[]>([])
  const [backups, setBackupsState] = useState<Array<{ id: string; createdAt: string; size: number }>>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [selectedLogLevel, setSelectedLogLevel] = useState<'all' | 'INFO' | 'WARN' | 'ERROR'>('all')
  const [logSearchQuery, setLogSearchQuery] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(ADMIN_UI_STATE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        isMonitoring: boolean
        selectedLogLevel: 'all' | 'INFO' | 'WARN' | 'ERROR'
        logSearchQuery: string
      }>
      if (typeof parsed.isMonitoring === 'boolean') setIsMonitoring(parsed.isMonitoring)
      if (
        parsed.selectedLogLevel === 'all' ||
        parsed.selectedLogLevel === 'INFO' ||
        parsed.selectedLogLevel === 'WARN' ||
        parsed.selectedLogLevel === 'ERROR'
      ) {
        setSelectedLogLevel(parsed.selectedLogLevel)
      }
      if (typeof parsed.logSearchQuery === 'string') {
        setLogSearchQuery(parsed.logSearchQuery)
      }
    } catch {
      // Ignore invalid persisted state.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      ADMIN_UI_STATE_KEY,
      JSON.stringify({
        isMonitoring,
        selectedLogLevel,
        logSearchQuery,
      })
    )
  }, [isMonitoring, selectedLogLevel, logSearchQuery])

  const setUsers = useCallback((newUsers: User[]) => {
    setUsersState(newUsers)
  }, [])

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsersState((prev) => prev.map((user) => (user.id === id ? { ...user, ...updates } : user)))
  }, [])

  const removeUser = useCallback((id: string) => {
    setUsersState((prev) => prev.filter((user) => user.id !== id))
  }, [])

  const addUser = useCallback((user: User) => {
    setUsersState((prev) => [user, ...prev])
  }, [])

  const setSystemHealth = useCallback((health: SystemHealth) => {
    setSystemHealthState(health)
  }, [])

  const setAuditLogs = useCallback((logs: AuditLog[]) => {
    setAuditLogsState(logs)
  }, [])

  const addAuditLog = useCallback((log: AuditLog) => {
    setAuditLogsState((prev) => [log, ...prev].slice(0, 1000))
  }, [])

  const setSettings = useCallback((newSettings: SystemSettings) => {
    setSettingsState(newSettings)
  }, [])

  const setAlerts = useCallback((newAlerts: Alert[]) => {
    setAlertsState(newAlerts)
  }, [])

  const addAlert = useCallback((alert: Alert) => {
    setAlertsState((prev) => [alert, ...prev])
  }, [])

  const updateAlert = useCallback((id: string, updates: Partial<Alert>) => {
    setAlertsState((prev) => prev.map((alert) => (alert.id === id ? { ...alert, ...updates } : alert)))
  }, [])

  const deleteAlert = useCallback((id: string) => {
    setAlertsState((prev) => prev.filter((alert) => alert.id !== id))
  }, [])

  const setBackups = useCallback((newBackups: Array<{ id: string; createdAt: string; size: number }>) => {
    setBackupsState(newBackups)
  }, [])

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true)
  }, [])

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false)
  }, [])

  const value: AdminContextType = {
    users,
    setUsers,
    updateUser,
    removeUser,
    addUser,
    systemHealth,
    setSystemHealth,
    auditLogs,
    setAuditLogs,
    addAuditLog,
    settings,
    setSettings,
    alerts,
    setAlerts,
    addAlert,
    updateAlert,
    deleteAlert,
    backups,
    setBackups,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    selectedLogLevel,
    setSelectedLogLevel,
    logSearchQuery,
    setLogSearchQuery,
  }

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider')
  }
  return context
}
