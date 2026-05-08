'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { professorAnalyticsApi, evaluationApi } from '@/lib/api'
import type { CaseSubmission, CompetencyType, ProfessorAnalyticsOverview } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FolderKanban,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { StudentsCompetencyHeatmap } from '@/components/students-competency-heatmap-enhanced'

const competencyLabels: Record<CompetencyType, string> = {
  access: 'Acceso',
  process: 'Procesamiento',
  communicate: 'Comunicación',
}

const emptyDashboardData: ProfessorAnalyticsOverview = {
  studentCount: 0,
  averageProgress: { access: 0, process: 0, communicate: 0 },
  lowProgressStudents: [],
  commonSearchTerms: [],
  problematicTerms: [],
  studentCompetencies: [],
}

const toPercent = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

const formatSubmissionDate = (value?: string) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState<ProfessorAnalyticsOverview>(emptyDashboardData)
  const [pendingSubmissions, setPendingSubmissions] = useState<CaseSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [analyticsResult, submissionsResult] = await Promise.allSettled([
        professorAnalyticsApi.getClassOverview(),
        evaluationApi.getPending(),
      ])
      setDashboardData(analyticsResult.status === 'fulfilled' ? analyticsResult.value : emptyDashboardData)
      setPendingSubmissions(submissionsResult.status === 'fulfilled' ? submissionsResult.value : [])
      if (analyticsResult.status === 'rejected' || submissionsResult.status === 'rejected') {
        setError('Algunos datos del panel no se pudieron cargar completamente.')
      }
    } catch (loadError) {
      console.error('[professor dashboard] Error loading data:', loadError)
      setDashboardData(emptyDashboardData)
      setPendingSubmissions([])
      setError('No se pudo cargar el dashboard del profesor.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const averageProgress = useMemo(() => {
    return Math.round(
      (toPercent(dashboardData.averageProgress.access) +
        toPercent(dashboardData.averageProgress.process) +
        toPercent(dashboardData.averageProgress.communicate)) /
        3
    )
  }, [dashboardData])

  const firstName = useMemo(() => {
    const value = user?.name?.trim()
    if (!value) return 'Profesor'
    return value.split(/\s+/)[0] || 'Profesor'
  }, [user?.name])

  if (isLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bienvenido, Prof. {firstName}</h1>
          <p className="mt-1 text-muted-foreground">Panel de monitoreo, evaluación y seguimiento de tu grupo.</p>
        </div>
        <Button asChild>
          <Link href="/professor/cases/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo caso
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Users className="h-6 w-6 text-primary" />} label="Estudiantes" value={dashboardData.studentCount} />
        <MetricCard icon={<ClipboardCheck className="h-6 w-6 text-warning" />} label="Entregas pendientes" value={pendingSubmissions.length} />
        <MetricCard icon={<AlertTriangle className="h-6 w-6 text-destructive" />} label="Bajo progreso" value={dashboardData.lowProgressStudents.length} />
        <MetricCard icon={<TrendingUp className="h-6 w-6 text-success" />} label="Progreso promedio" value={`${averageProgress}%`} />
      </div>

      {dashboardData.studentCompetencies && dashboardData.studentCompetencies.length > 0 && (
        <StudentsCompetencyHeatmap
          students={dashboardData.studentCompetencies}
          isLoading={false}
          lowProgressThreshold={60}
          onStudentClick={() => undefined}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5" />
                  Progreso por competencia
                </CardTitle>
                <CardDescription>Promedio de la clase por área competencial.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/professor/analytics">
                  Ver analíticas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(Object.keys(competencyLabels) as CompetencyType[]).map((competency) => {
              const value = toPercent(dashboardData.averageProgress[competency])
              return (
                <div key={competency} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{competencyLabels[competency]}</span>
                    <span className="font-medium">{value}%</span>
                  </div>
                  <Progress value={value} className="h-3" />
                </div>
              )
            })}

            <div className="grid grid-cols-2 gap-3 border-t pt-6">
              <Button variant="outline" className="justify-start bg-transparent" asChild>
                <Link href="/professor/cases">
                  <FolderKanban className="mr-2 h-4 w-4" />
                  Gestionar casos
                </Link>
              </Button>
              <Button variant="outline" className="justify-start bg-transparent" asChild>
                <Link href="/professor/evaluations">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Evaluar entregas
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Estudiantes en seguimiento
            </CardTitle>
            <CardDescription>Progreso general inferior al umbral docente.</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData.lowProgressStudents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                <p className="text-sm">No hay estudiantes en alerta.</p>
              </div>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="space-y-3">
                  {dashboardData.lowProgressStudents.map((student) => (
                    <div key={student.id} className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {student.name.split(' ').map((item) => item[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{student.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                      </div>
                      <Badge variant="outline">{toPercent(student.averageScore)}%</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  Entregas por evaluar
                </CardTitle>
                <CardDescription>{pendingSubmissions.length} entregas pendientes.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/professor/evaluations">
                  Ver todas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingSubmissions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                <p className="text-sm">No hay entregas pendientes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSubmissions.slice(0, 4).map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Caso #{submission.caseId}</p>
                      <p className="text-xs text-muted-foreground">Enviado: {formatSubmissionDate(submission.submittedAt)}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/professor/evaluations/${submission.id}`}>Evaluar</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" />
              Señales de búsqueda
            </CardTitle>
            <CardDescription>Tendencias relevantes del trabajo de los estudiantes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="mb-3 text-sm font-medium">Términos más buscados</h4>
              <div className="flex flex-wrap gap-2">
                {dashboardData.commonSearchTerms.length > 0 ? (
                  dashboardData.commonSearchTerms.slice(0, 6).map((item) => (
                    <Badge key={item.term} variant="secondary">
                      {item.term} ({item.count})
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Términos problemáticos
              </h4>
              {dashboardData.problematicTerms.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.problematicTerms.slice(0, 3).map((item) => (
                    <div key={item.term} className="flex items-center justify-between rounded-lg bg-destructive/5 p-2">
                      <span className="text-sm">{item.term}</span>
                      <Badge variant="destructive">{toPercent(item.errorRate)}% error</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No se detectaron problemas recurrentes.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number | string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3">{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 w-full" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[360px] lg:col-span-2" />
        <Skeleton className="h-[360px]" />
      </div>
    </div>
  )
}
