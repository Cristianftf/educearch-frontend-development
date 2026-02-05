import React from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ProtectedComponentProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requireAll?: boolean
  fallback?: React.ReactNode
  onUnauthorized?: () => void
}

export function ProtectedComponent({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
  fallback,
  onUnauthorized,
}: ProtectedComponentProps) {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissions()

  let hasAccess = true

  if (requiredPermission) {
    hasAccess = hasPermission(requiredPermission)
  } else if (requiredPermissions && requiredPermissions.length > 0) {
    hasAccess = requireAll ? hasAllPermissions(requiredPermissions) : hasAnyPermission(requiredPermissions)
  }

  if (!hasAccess) {
    if (onUnauthorized) {
      onUnauthorized()
    }

    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acceso denegado</AlertTitle>
        <AlertDescription>
          No tienes permiso para acceder a esta funcionalidad. Contacta a tu administrador si crees que es un error.
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}
