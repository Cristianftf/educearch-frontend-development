"use client"

import { useMemo, useState } from "react"
import { Activity, ExternalLink, RefreshCw, Search, ShieldAlert, ShieldCheck, ShieldX, Timer } from "lucide-react"
import { adminSystemApi } from "@/lib/admin-system"
import type { ExternalApiDiagnostics, ExternalApiProviderStatus } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

const DEFAULT_QUERY = "evidence based diabetes treatment"

function statusTone(status?: string) {
  if (status === "online" || status === "UP") {
    return "bg-emerald-100 text-emerald-700 border-emerald-300"
  }
  if (status === "warning" || status === "DEGRADED") {
    return "bg-amber-100 text-amber-700 border-amber-300"
  }
  return "bg-red-100 text-red-700 border-red-300"
}

function statusLabel(status?: string) {
  if (status === "online" || status === "UP") return "En linea"
  if (status === "warning" || status === "DEGRADED") return "Degradado"
  return "Fuera de linea"
}

function statusIcon(status?: string) {
  if (status === "online" || status === "UP") return ShieldCheck
  if (status === "warning" || status === "DEGRADED") return ShieldAlert
  return ShieldX
}

function relativeDateLabel(value?: string): string {
  if (!value) return "Sin fecha"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function providerHealthScore(provider: ExternalApiProviderStatus): number {
  if (provider.status === "offline") return 0
  if (provider.status === "warning") return 45
  const latencyScore = Math.max(10, 100 - Math.min(90, Math.round((provider.latencyMs / 1200) * 100)))
  return Math.min(100, latencyScore)
}

export function AdminExternalApisMonitor() {
  const [queryText, setQueryText] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<ExternalApiDiagnostics | null>(null)

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminSystemApi.checkExternalApis(queryText.trim() || DEFAULT_QUERY)
      setDiagnostics(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar el diagnostico")
    } finally {
      setLoading(false)
    }
  }

  const summary = diagnostics?.summary
  const providers = diagnostics?.providers ?? []
  const avgScore = useMemo(() => {
    if (!providers.length) return 0
    const total = providers.reduce((sum, provider) => sum + providerHealthScore(provider), 0)
    return Math.round(total / providers.length)
  }, [providers])

  const OverallIcon = statusIcon(diagnostics?.status)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Diagnostico de APIs externas
            </CardTitle>
            <CardDescription>
              Verifica conectividad y respuesta real de APIs usadas por busqueda en todos los roles.
            </CardDescription>
          </div>
          {diagnostics?.status && (
            <Badge variant="outline" className={statusTone(diagnostics.status)}>
              <OverallIcon className="mr-1 h-3.5 w-3.5" />
              Estado global: {statusLabel(diagnostics.status)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Consulta de prueba (ej: evidence based diabetes treatment)"
              className="pl-9"
            />
          </div>
          <Button onClick={runCheck} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Comprobando..." : "Ejecutar prueba"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          La misma consulta se ejecuta contra cada proveedor para validar disponibilidad y calidad de respuesta.
        </p>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {diagnostics && (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Proveedores en linea</p>
              <p className="text-xl font-semibold">{summary?.online ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Proveedores degradados</p>
              <p className="text-xl font-semibold">{summary?.warning ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Proveedores fuera de linea</p>
              <p className="text-xl font-semibold">{summary?.offline ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Salud promedio</p>
              <p className="text-xl font-semibold">{avgScore}%</p>
            </div>
          </div>
        )}

        {diagnostics && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ultima verificacion</span>
                <span>{relativeDateLabel(diagnostics.testedAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Consulta usada</span>
                <span className="font-mono text-xs">{diagnostics.query}</span>
              </div>
            </div>

            {providers.map((provider) => {
              const ProviderIcon = statusIcon(provider.status)
              const score = providerHealthScore(provider)
              return (
                <div key={provider.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                    </div>
                    <Badge variant="outline" className={statusTone(provider.status)}>
                      <ProviderIcon className="mr-1 h-3.5 w-3.5" />
                      {statusLabel(provider.status)}
                    </Badge>
                  </div>

                  <div className="mb-2 grid gap-2 text-sm md:grid-cols-4">
                    <p>
                      <span className="text-muted-foreground">HTTP:</span> {provider.httpStatus || "-"}
                    </p>
                    <p className="flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      {provider.latencyMs} ms
                    </p>
                    <p>
                      <span className="text-muted-foreground">Resultados:</span> {provider.resultCount}
                    </p>
                    <p className="text-muted-foreground">{provider.message}</p>
                  </div>

                  <Progress value={score} className="mb-3 h-2" />

                  <div className="flex flex-col gap-2 text-xs md:flex-row md:items-center md:justify-between">
                    <span className="truncate font-mono text-muted-foreground">{provider.requestUrl}</span>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Ver documentacion
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {provider.error && (
                    <p className="mt-2 text-xs text-red-600">Error: {provider.error}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
