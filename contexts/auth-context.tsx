'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User, UserRole } from '@/types'
import { authApi, api } from '@/lib/api'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split('=')[1] ?? null
}

function setCookie(name: string, value: string, maxAgeSeconds = 3600) {
  if (typeof document === 'undefined') return
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

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
    let token = localStorage.getItem('auth_token')
    let userRole = localStorage.getItem('user_role')

    if (!token) {
      token = getCookieValue('auth_token')
      if (token) {
        localStorage.setItem('auth_token', token)
      }
    }

    if (!userRole) {
      userRole = getCookieValue('user_role')
      if (userRole) {
        localStorage.setItem('user_role', userRole)
      }
    }

    if (!token) {
      setIsLoading(false)
      return
    }

    api.setToken(token)
    if (userRole) {
      api.setUserRole(userRole)
    }

    try {
      const userData = await authApi.me()
      setUser(userData)
      api.setUserRole(userData.role)
    } catch {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_role')
      clearCookie('auth_token')
      clearCookie('user_role')
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
      localStorage.setItem('user_role', userData.role)
      setCookie('auth_token', token)
      setCookie('user_role', userData.role)
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
      localStorage.removeItem('user_role')
      clearCookie('auth_token')
      clearCookie('user_role')
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
