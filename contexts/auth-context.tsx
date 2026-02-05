'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User, UserRole } from '@/types'
import { authApi, api } from '@/lib/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password']

const ROLE_ROUTES: Record<UserRole, string> = {
  student: '/student',
  professor: '/professor',
  admin: '/admin',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setIsLoading(false)
      return
    }

    api.setToken(token)

    try {
      const userData = await authApi.me()
      setUser(userData)
      api.setUserRole(userData.role)
    } catch {
      localStorage.removeItem('auth_token')
      api.setToken(null)
      api.setUserRole(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isLoading) return

    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

    if (!user && !isPublicRoute) {
      router.push('/login')
      return
    }

    if (user && isPublicRoute) {
      router.push(ROLE_ROUTES[user.role])
      return
    }

    // Check role-based route access
    if (user) {
      const currentRoleRoute = ROLE_ROUTES[user.role]
      const isAccessingOtherRole = Object.entries(ROLE_ROUTES).some(
        ([role, route]) => role !== user.role && pathname.startsWith(route)
      )

      if (isAccessingOtherRole) {
        router.push(currentRoleRoute)
      }
    }
  }, [user, isLoading, pathname, router])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { user: userData, token } = await authApi.login(email, password)
      localStorage.setItem('auth_token', token)
      api.setToken(token)
      api.setUserRole(userData.role)
      setUser(userData)
      router.push(ROLE_ROUTES[userData.role])
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('auth_token')
      api.setToken(null)
      api.setUserRole(null)
      setUser(null)
      router.push('/login')
    }
  }, [router])

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false

      const rolePermissions: Record<UserRole, string[]> = {
        student: [
          'search:execute',
          'search:save',
          'verify:claim',
          'export:bibliography',
          'progress:view_own',
          'case:view_assigned',
          'case:submit',
        ],
        professor: [
          'search:execute',
          'search:save',
          'verify:claim',
          'export:bibliography',
          'case:create',
          'case:edit',
          'case:assign',
          'case:evaluate',
          'hedge:manage',
          'student:view_progress',
          'analytics:view_class',
        ],
        admin: ['*'],
      }

      const permissions = rolePermissions[user.role]
      return permissions.includes('*') || permissions.includes(permission)
    },
    [user]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
