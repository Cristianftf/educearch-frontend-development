"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminSystemApi } from "@/lib/admin-system"
import type { AdminSystemErrorMonitoring } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Bot, AlertTriangle, ShieldAlert, Clock, Wrench, Bug } from "lucide-react"

const AUTO_REFRESH_MS = 60000

const EMPTY_MONITORING: AdminSystemErrorMonitoring = {
  generatedAt: new Date().toISOString(),
  summary: {
    windowMinutes: 120,
    totalErrors: 0,
    totalWarnings: 0,
    trackedInsights: 0,
    criticalInsights: 0,
  },
  analysisStatus: {
    lastRun: undefined,
    lastProcessedErrors: 0,
    lastUpdatedInsights: 0,
  },
  insights: [],
  recentErrors: [],
}

function formatRelative(value?: string) {
  if (!value) return "Sin datos"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin datos"
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "hace segundos"
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  return `hace ${diffD} dia${diffD === 1 ? "" : "s"}`
}

function severityTone(severity: "critical" | "high" | "medium" | "low") {
  if (severity === "critical") return "bg-red-100 text-red-700 border-red-300"
  if (severity === "high") return "bg-orange-100 text-orange-700 border-orange-300"
  if (severity === "medium") return "bg-amber-100 text-amber-700 border-amber-300"
  return "bg-blue-100 text-blue-700 border-blue-300"
}

export function AdminErrorMonitor() {
  const [data, setData] = useState<AdminSystemErrorMonitoring>(EMPTY_MONITORING)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMonitoring = useCallback(async (refreshAnalysis = false) => {
    setError(null)
    try {
      const response = await adminSystemApi.getErrorMonitoring(
        data.summary.windowMinutes || 120,
        25,
        refreshAnalysis
      )
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar vigilancia de errores")
      setData(EMPTY_MONITORING)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [data.summary.windowMinutes])

  useEffect(() => {
    loadMonitoring(false)
  }, [loadMonitoring])

  useEffect(() => {
    const timer = setInterval(() => {
      loadMonitoring(false)
    }, AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [loadMonitoring])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadMonitoring(false)
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      await adminSystemApi.analyzeErrorsNow(data.summary.windowMinutes || 120, 40)
      await loadMonitoring(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar analisis IA")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const criticalCount = useMemo(
    () => data.insights.filter((item) => item.severity === "critical" || item.severity === "high").length,
    [data.insights]
  )

  return (
    <Card className="border-orange-200/80">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
              Vigilancia de Errores del Backend
            </CardTitle>
            <CardDescription>
              Registro continuo + analisis IA de errores para diagnostico y correcciones sugeridas.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing || isAnalyzing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              <Bot className="mr-2 h-4 w-4" />
              {isAnalyzing ? "Analizando..." : "Analizar con IA"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Errores (ventana)</p>
            <p className="text-2xl font-semibold">{data.summary.totalErrors}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Advertencias</p>
            <p className="text-2xl font-semibold">{data.summary.totalWarnings}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Insights activos</p>
            <p className="text-2xl font-semibold">{data.summary.trackedInsights}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Criticos / altos</p>
            <p className="text-2xl font-semibold text-destructive">{criticalCount}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Ultima corrida IA: {formatRelative(data.analysisStatus.lastRun)}</span>
          <span>Procesados: {data.analysisStatus.lastProcessedErrors}</span>
          <span>Insights actualizados: {data.analysisStatus.lastUpdatedInsights}</span>
          <span>Ventana: {data.summary.windowMinutes} min</span>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Errores Prioritarios
          </h4>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando errores...</p>
          ) : data.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No se detectaron errores en la ventana seleccionada.</p>
          ) : (
            data.insights.slice(0, 6).map((insight) => (
              <div key={insight.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityTone(insight.severity)}>
                    {insight.severity.toUpperCase()}
                  </Badge>
                  {insight.httpStatus && <Badge variant="outline">HTTP {insight.httpStatus}</Badge>}
                  <Badge variant="outline">Ocurrencias: {insight.occurrences}</Badge>
                  <span className="text-xs text-muted-foreground">{formatRelative(insight.lastSeen)}</span>
                </div>
                <p className="text-sm font-medium">{insight.endpoint || "Endpoint no identificado"}</p>
                {insight.errorMessage && <p className="text-sm text-muted-foreground">{insight.errorMessage}</p>}
                {insight.aiDiagnosis && (
                  <div className="rounded-md bg-muted/40 p-2 text-sm">
                    <p className="font-medium flex items-center gap-1">
                      <Bot className="h-3.5 w-3.5" />
                      Diagnostico IA
                    </p>
                    <p className="text-muted-foreground">{insight.aiDiagnosis}</p>
                  </div>
                )}
                {insight.recommendations.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5" />
                      Posibles correcciones
                    </p>
                    {insight.recommendations.slice(0, 4).map((rec, idx) => (
                      <p key={`${insight.id}-rec-${idx}`} className="text-xs text-muted-foreground">
                        - {rec}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Ultimos errores capturados
          </h4>
          {data.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin errores recientes.</p>
          ) : (
            <div className="space-y-2">
              {data.recentErrors.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{item.endpoint || "Endpoint no identificado"}</p>
                  <p className="text-muted-foreground">{item.errorMessage || "Sin mensaje de error"}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
                    <span>{formatRelative(item.timestamp)}</span>
                    {item.httpStatus && <span>HTTP {item.httpStatus}</span>}
                    {typeof item.responseTime === "number" && <span>{Math.round(item.responseTime)}ms</span>}
                    {item.correlationId && <span>Corr: {item.correlationId}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
