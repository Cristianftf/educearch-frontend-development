'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { professorAnalyticsApi, evaluationApi } from '@/lib/api'
import type { StudentSummary, CaseSubmission, CompetencyType } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  FolderKanban,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Search,
  Bell,
  Plus,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { StudentsCompetencyHeatmap } from '@/components/students-competency-heatmap-enhanced'

interface DashboardData {
  studentCount: number
  averageProgress: Record<string, number>
  lowProgressStudents: StudentSummary[]
  commonSearchTerms: { term: string; count: number }[]
  problematicTerms: { term: string; errorRate: number }[]
  studentCompetencies?: Array<{
    studentId: string
    studentName: string
    studentEmail: string
    avatar?: string
    scores: Record<CompetencyType, number>
    averageScore: number
  }>
}

const competencyLabels: Record<CompetencyType, string> = {
  access: 'Acceso',
  process: 'Procesamiento',
  communicate: 'Comunicación',
}

const toPercent = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [pendingSubmissions, setPendingSubmissions] = useState<CaseSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [analytics, submissions] = await Promise.all([
          professorAnalyticsApi.getClassOverview(),
          evaluationApi.getPending(),
        ])
        setDashboardData(analytics)
        setPendingSubmissions(submissions)
      } catch (err) {
        console.error('[v0] Error loading dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Bienvenido, Prof. {user?.name?.split(' ')[0] || 'Profesor'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Panel de monitoreo y gestión de tu clase
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/professor/cases/new">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo caso
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboardData?.studentCount || 0}</p>
                <p className="text-sm text-muted-foreground">Estudiantes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <ClipboardCheck className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingSubmissions.length}</p>
                <p className="text-sm text-muted-foreground">Entregas pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dashboardData?.lowProgressStudents?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Bajo rendimiento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dashboardData?.averageProgress?.access
                    ? Math.round(
                        (dashboardData.averageProgress.access +
                          dashboardData.averageProgress.process +
                          dashboardData.averageProgress.communicate) /
                          3
                      )
                    : 0}
                  %
                </p>
                <p className="text-sm text-muted-foreground">Progreso promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Competency Heatmap */}
      {dashboardData?.studentCompetencies && dashboardData.studentCompetencies.length > 0 && (
        <StudentsCompetencyHeatmap
          students={dashboardData.studentCompetencies}
          isLoading={isLoading}
          lowProgressThreshold={60}
          onStudentClick={(student) => {
            console.log('Ver detalles del estudiante:', student)
          }}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Class Progress Heatmap */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Progreso por competencia
                </CardTitle>
                <CardDescription>Promedio de la clase en cada área</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/professor/analytics">
                  Ver detalles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(Object.keys(competencyLabels) as CompetencyType[]).map((competency) => {
                const value = dashboardData?.averageProgress?.[competency] || 0
                return (
                  <div key={competency} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {competencyLabels[competency]}
                      </span>
                      <span className="text-sm text-muted-foreground">{value}%</span>
                    </div>
                    <Progress value={value} className="h-3" />
                  </div>
                )
              })}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-3">
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

        {/* Alerts - Low Progress Students */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Estudiantes con bajo progreso
            </CardTitle>
            <CardDescription>Progreso menor al 60%</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData?.lowProgressStudents && dashboardData.lowProgressStudents.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {dashboardData.lowProgressStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="text-xs">
                          {student.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{student.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {student.email}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Bell className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-sm">Todos los estudiantes van bien</p>
              </div>
            )}

            {dashboardData?.lowProgressStudents && dashboardData.lowProgressStudents.length > 0 && (
              <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm">
                Enviar recordatorio a todos
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Evaluations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Entregas por evaluar
                </CardTitle>
                <CardDescription>{pendingSubmissions.length} entregas pendientes</CardDescription>
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
            {pendingSubmissions.length > 0 ? (
              <div className="space-y-3">
                {pendingSubmissions.slice(0, 4).map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">ES</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">Caso #{submission.caseId}</p>
                        <p className="text-xs text-muted-foreground">
                          Enviado: {new Date(submission.submittedAt).toLocaleDateString('es')}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/professor/evaluations/${submission.id}`}>
                        Evaluar
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-sm">No hay entregas pendientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Insights de búsqueda
            </CardTitle>
            <CardDescription>Patrones de uso de tus estudiantes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Most Common Terms */}
            <div>
              <h4 className="text-sm font-medium mb-3">Términos más buscados</h4>
              <div className="flex flex-wrap gap-2">
                {dashboardData?.commonSearchTerms?.slice(0, 6).map((item) => (
                  <Badge key={item.term} variant="secondary" className="gap-1">
                    {item.term}
                    <span className="text-xs text-muted-foreground">({item.count})</span>
                  </Badge>
                )) || (
                  <p className="text-sm text-muted-foreground">Sin datos disponibles</p>
                )}
              </div>
            </div>

            {/* Problematic Terms */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Términos problemáticos
              </h4>
              {dashboardData?.problematicTerms && dashboardData.problematicTerms.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.problematicTerms.slice(0, 3).map((item) => (
                    <div
                      key={item.term}
                      className="flex items-center justify-between p-2 rounded-lg bg-destructive/5"
                    >
                      <span className="text-sm">{item.term}</span>
                      <Badge variant="destructive" className="text-xs">
                        {toPercent(item.errorRate)}% errores
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se detectaron problemas recurrentes
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
