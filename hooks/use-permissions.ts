import { useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import type { UserRole } from '@/types'
import { ROLE_PERMISSIONS } from '@/types'

interface UsePermissionsReturn {
  role: UserRole | null
  permissions: string[]
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  isAdmin: () => boolean
  isProfessor: () => boolean
  isStudent: () => boolean
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth()

  const role = user?.role || null
  const permissions = role ? ROLE_PERMISSIONS[role] : []

  const hasPermission = useCallback(
    (permission: string) => {
      if (!role) return false
      if (permissions.includes('*')) return true // Admin can do everything
      return permissions.includes(permission)
    },
    [role, permissions]
  )

  const hasAnyPermission = useCallback(
    (perms: string[]) => {
      return perms.some((perm) => hasPermission(perm))
    },
    [hasPermission]
  )

  const hasAllPermissions = useCallback(
    (perms: string[]) => {
      return perms.every((perm) => hasPermission(perm))
    },
    [hasPermission]
  )

  const isAdmin = useCallback(() => {
    return role === 'admin'
  }, [role])

  const isProfessor = useCallback(() => {
    return role === 'professor'
  }, [role])

  const isStudent = useCallback(() => {
    return role === 'student'
  }, [role])

  return {
    role,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isProfessor,
    isStudent,
  }
}
