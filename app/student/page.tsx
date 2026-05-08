'use client'

import React from "react"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useStudent } from '@/contexts/student-context'
import { progressApi } from '@/lib/api'
import type { Activity, CompetencyType } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  ShieldCheck,
  FileText,
  TrendingUp,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

const competencyConfig: Record<
  CompetencyType,
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  access: {
    label: 'Acceso a la Información',
    description: 'Dominio de búsquedas MeSH y operadores booleanos',
    icon: Search,
    color: 'text-chart-1',
  },
  process: {
    label: 'Procesamiento de Información',
    description: 'Verificación de claims y evaluación de evidencia',
    icon: ShieldCheck,
    color: 'text-chart-2',
  },
  communicate: {
    label: 'Comunicación de Información',
    description: 'Generación de bibliografías y citación',
    icon: FileText,
    color: 'text-chart-3',
  },
}

const actionLabels: Record<CompetencyType, string> = {
  access: 'Practicar búsqueda',
  process: 'Verificar claim',
  communicate: 'Nueva bibliografía',
}

const actionLinks: Record<CompetencyType, string> = {
  access: '/student/search',
  process: '/student/verify',
  communicate: '/student/bibliography',
}

const levelColors = {
  novice: 'bg-warning/20 text-warning-foreground border-warning',
  intermediate: 'bg-chart-1/20 text-chart-1 border-chart-1',
  advanced: 'bg-success/20 text-success border-success',
}

const levelLabels = {
  novice: 'Novato',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

function CompetencyChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-6 w-48 mt-3" />
        <Skeleton className="h-4 w-full mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-10 w-full mt-4" />
      </CardContent>
    </Card>
  )
}

const CompetencyProgressChart = dynamic(
  () => import('@/components/competency-progress-chart-enhanced').then((m) => m.CompetencyProgressChart),
  { ssr: false, loading: () => <CompetencyChartSkeleton /> }
)

const ACTIVITY_FILTER_OPTIONS = ['all', 'search', 'verification', 'export', 'case_submission'] as const
type ActivityFilter = (typeof ACTIVITY_FILTER_OPTIONS)[number]

function getFirstName(name?: string | null): string {
  if (typeof name !== 'string') return 'Estudiante'
  const trimmed = name.trim()
  if (!trimmed) return 'Estudiante'
  return trimmed.split(/\s+/)[0] || 'Estudiante'
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  const now = new Date()
  const diff = Math.max(0, now.getTime() - date.getTime())
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Hace instantes'
  if (minutes < 60) return `Hace ${minutes} min`
  if (hours < 24) return `Hace ${hours}h`
  return `Hace ${days}d`
}

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'search':
      return Search
    case 'verification':
      return ShieldCheck
    case 'export':
      return FileText
    case 'case_submission':
      return BookOpen
    default:
      return CheckCircle2
  }
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const { recentActivities } = useStudent()

  const router = useRouter()
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')

  const { data: progress, isLoading, error, refetch } = useQuery({
    queryKey: ['student', 'progress'],
    queryFn: () => progressApi.getMyProgress(),
  })

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Error al cargar</h2>
        <p className="text-muted-foreground mb-4">No se pudo cargar tu progreso. Intenta de nuevo más tarde.</p>
        <Button onClick={() => refetch()}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Bienvenido, {getFirstName(user?.name)}
        </h1>
        <p className="text-muted-foreground mt-1">
          Continúa desarrollando tus competencias informacionales en salud
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-1/10">
                <Search className="h-6 w-6 text-chart-1" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress?.totalSearches || 0}</p>
                <p className="text-sm text-muted-foreground">Búsquedas realizadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-2/10">
                <ShieldCheck className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress?.totalVerifications || 0}</p>
                <p className="text-sm text-muted-foreground">Verificaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-3/10">
                <FileText className="h-6 w-6 text-chart-3" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress?.totalBibliographies || 0}</p>
                <p className="text-sm text-muted-foreground">Bibliografías</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competencies Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {(Object.keys(competencyConfig) as CompetencyType[]).map((type) => {
          const comp = progress?.competencies?.[type]

          return comp ? (
            <CompetencyProgressChart
              key={type}
              competencyType={type}
              competencyData={comp}
              onActionClick={() => {
                router.push(actionLinks[type])
              }}
              actionLabel={actionLabels[type]}
            />
          ) : null
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Actividad Reciente
              </CardTitle>
              <CardDescription>Tus últimas acciones en la plataforma</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrar:</span>
              <select
                value={activityFilter}
                onChange={(e) => {
                  const nextValue = e.target.value
                  setActivityFilter(
                    ACTIVITY_FILTER_OPTIONS.includes(nextValue as ActivityFilter)
                      ? (nextValue as ActivityFilter)
                      : 'all'
                  )
                }}
                className="px-3 py-1 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">Todas</option>
                <option value="search">Búsquedas</option>
                <option value="verification">Verificaciones</option>
                <option value="export">Exportaciones</option>
                <option value="case_submission">Entregas</option>
              </select>
              <Button variant="outline" size="sm">
                Ver todo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {((progress?.recentActivities && progress.recentActivities.length > 0) || recentActivities.length > 0) ? (
            <div className="space-y-4">
              {(progress?.recentActivities?.length ? progress.recentActivities : recentActivities)
                .filter((activity) => activityFilter === 'all' || activity.type === activityFilter)
                .slice(0, 5)
                .map((activity) => {
                  const ActivityIcon = getActivityIcon(activity.type)
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay actividad reciente</p>
              <p className="text-sm">Comienza explorando la búsqueda avanzada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-6 w-48 mt-3" />
              <Skeleton className="h-4 w-full mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
