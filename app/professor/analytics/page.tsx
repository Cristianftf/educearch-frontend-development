"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { professorAnalyticsApi } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"

const toPercent = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

type AnalyticsState = Awaited<ReturnType<typeof professorAnalyticsApi.getClassOverview>>
type PerformanceState = Awaited<ReturnType<typeof professorAnalyticsApi.getClassPerformance>>

export default function ProfessorAnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsState | null>(null)
  const [performance, setPerformance] = useState<PerformanceState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const [overviewResponse, performanceResponse] = await Promise.all([
        professorAnalyticsApi.getClassOverview(),
        professorAnalyticsApi.getClassPerformance(),
      ])
      setOverview(overviewResponse)
      setPerformance(performanceResponse)
    } catch (loadError) {
      console.error("[professor analytics] Error loading analytics:", loadError)
      setError("No se pudieron cargar las analíticas del profesor.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load("initial")
  }, [load])

  const averageProgress = useMemo(() => {
    if (!overview) return 0
    return Math.round(
      (toPercent(overview.averageProgress.access) +
        toPercent(overview.averageProgress.process) +
        toPercent(overview.averageProgress.communicate)) /
        3
    )
  }, [overview])

  if (isLoading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
        Cargando analíticas...
      </div>
    )
  }

  if (!overview || !performance) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error || "No hay datos analíticos disponibles."}</p>
        <Button className="mt-4" onClick={() => void load("initial")}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <BarChart3 className="h-7 w-7 text-primary" />
            Analíticas de clase
          </h1>
          <p className="mt-1 text-muted-foreground">
            Seguimiento de progreso, desempeño y patrones de búsqueda del grupo.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load("refresh")} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<Users className="h-5 w-5 text-primary" />} label="Estudiantes activos" value={overview.studentCount} />
        <MetricCard icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="Progreso promedio" value={`${averageProgress}%`} />
        <MetricCard icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />} label="Tasa de completitud" value={`${toPercent(performance.completionRate)}%`} />
        <MetricCard icon={<TrendingDown className="h-5 w-5 text-amber-600" />} label="En seguimiento" value={overview.lowProgressStudents.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribución por competencia</CardTitle>
            <CardDescription>Valores agregados reportados por el backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { key: "access", label: "Acceso", value: toPercent(performance.competencyDistribution.access) },
              { key: "process", label: "Procesamiento", value: toPercent(performance.competencyDistribution.process) },
              { key: "communicate", label: "Comunicación", value: toPercent(performance.competencyDistribution.communicate) },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Búsquedas docentes relevantes</CardTitle>
            <CardDescription>Términos más usados y conceptos con mayor fricción.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium">Términos más buscados</p>
              {overview.commonSearchTerms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay datos disponibles.</p>
              ) : (
                overview.commonSearchTerms.map((term) => (
                  <div key={term.term} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{term.term}</span>
                    <Badge variant="secondary">{term.count}</Badge>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Términos con más errores</p>
              {overview.problematicTerms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No se detectaron términos problemáticos.</p>
              ) : (
                overview.problematicTerms.map((term) => (
                  <div key={term.term} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{term.term}</span>
                    <Badge variant="outline" className="text-destructive">
                      {toPercent(term.errorRate)}%
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estudiantes con bajo progreso</CardTitle>
            <CardDescription>Prioriza acompañamiento individual o ajustes de caso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.lowProgressStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay estudiantes en seguimiento.</p>
            ) : (
              overview.lowProgressStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  <Badge variant="outline" className="text-amber-700">
                    {toPercent(student.averageScore)}%
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mejores desempeños</CardTitle>
            <CardDescription>Ranking consolidado desde métricas de clase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {performance.topStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay suficientes datos para ordenar estudiantes.</p>
            ) : (
              performance.topStudents.map((student, index) => (
                <div key={student.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {index + 1}. {student.name}
                    </p>
                    <p className="text-xs text-muted-foreground">ID: {student.id}</p>
                  </div>
                  <Badge>{toPercent(student.score)}%</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
