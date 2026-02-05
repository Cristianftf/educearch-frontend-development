'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type {
  User,
  SystemHealth,
  AuditLog,
  SystemSettings,
  Alert,
} from '@/types'

interface AdminContextType {
  // Usuarios
  users: User[]
  setUsers: (users: User[]) => void
  updateUser: (id: string, updates: Partial<User>) => void
  removeUser: (id: string) => void
  addUser: (user: User) => void

  // Salud del sistema
  systemHealth: SystemHealth | null
  setSystemHealth: (health: SystemHealth) => void

  // Logs de auditoría
  auditLogs: AuditLog[]
  setAuditLogs: (logs: AuditLog[]) => void
  addAuditLog: (log: AuditLog) => void

  // Configuración
  settings: SystemSettings | null
  setSettings: (settings: SystemSettings) => void

  // Alertas
  alerts: Alert[]
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  updateAlert: (id: string, updates: Partial<Alert>) => void
  deleteAlert: (id: string) => void

  // Backups
  backups: Array<{ id: string; createdAt: string; size: number }>
  setBackups: (backups: Array<{ id: string; createdAt: string; size: number }>) => void

  // Estado de monitoreo en vivo
  isMonitoring: boolean
  startMonitoring: () => void
  stopMonitoring: () => void

  // Filtros de UI
  selectedLogLevel: 'all' | 'INFO' | 'WARN' | 'ERROR'
  setSelectedLogLevel: (level: 'all' | 'INFO' | 'WARN' | 'ERROR') => void
  logSearchQuery: string
  setLogSearchQuery: (query: string) => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

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

  const setUsers = useCallback((newUsers: User[]) => {
    setUsersState(newUsers)
  }, [])

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsersState((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    )
  }, [])

  const removeUser = useCallback((id: string) => {
    setUsersState((prev) => prev.filter((u) => u.id !== id))
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
    setAuditLogsState((prev) => [log, ...prev].slice(0, 1000)) // Mantener últimos 1000
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
    setAlertsState((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    )
  }, [])

  const deleteAlert = useCallback((id: string) => {
    setAlertsState((prev) => prev.filter((a) => a.id !== id))
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
