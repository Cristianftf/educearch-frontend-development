"use client"

import { useCallback, useEffect, useState } from "react"
import { professorAnalyticsApi } from "@/lib/api"
import type { ProfessorAnalyticsOverview } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, BarChart3, Users, TrendingDown, TrendingUp, RefreshCw } from "lucide-react"

const toPercent = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

export default function ProfessorAnalyticsPage() {
  const [data, setData] = useState<ProfessorAnalyticsOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const overview = await professorAnalyticsApi.getClassOverview()
      setData(overview)
    } catch (err) {
      setError("No se pudieron cargar las Analíticas.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
        Cargando Analíticas...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground">{error || "Error desconocido"}</p>
        <Button className="mt-4" onClick={load}>
          Reintentar
        </Button>
      </div>
    )
  }

  const access = toPercent(data.averageProgress.access)
  const process = toPercent(data.averageProgress.process)
  const communicate = toPercent(data.averageProgress.communicate)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Analíticas de Clase
          </h1>
          <p className="text-muted-foreground mt-1">
            Seguimiento de progreso, Búsqueda y desempeño estudiantil.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Estudiantes activos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold">{data.studentCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Acceso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Promedio</span>
              <span className="font-medium">{access}%</span>
            </div>
            <Progress value={access} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Proceso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Promedio</span>
              <span className="font-medium">{process}%</span>
            </div>
            <Progress value={process} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Comunicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Promedio</span>
              <span className="font-medium">{communicate}%</span>
            </div>
            <Progress value={communicate} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Términos más buscados
            </CardTitle>
            <CardDescription>Ayuda a orientar contenido y casos de estudio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.commonSearchTerms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay datos disponibles.</p>
            ) : (
              data.commonSearchTerms.map((term) => (
                <div key={term.term} className="flex items-center justify-between">
                  <span className="text-sm">{term.term}</span>
                  <Badge variant="secondary">{term.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Términos con más errores
            </CardTitle>
            <CardDescription>Detecta conceptos que requieren refuerzo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.problematicTerms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay datos disponibles.</p>
            ) : (
              data.problematicTerms.map((term) => (
                <div key={term.term} className="flex items-center justify-between">
                  <span className="text-sm">{term.term}</span>
                  <Badge variant="outline" className="text-destructive">
                    {toPercent(term.errorRate)}%
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estudiantes con bajo progreso</CardTitle>
          <CardDescription>Recomendado para seguimiento personalizado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.lowProgressStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay estudiantes en alerta.</p>
          ) : (
            data.lowProgressStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                </div>
                <Badge variant="outline" className="text-warning">
                  Seguimiento
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
