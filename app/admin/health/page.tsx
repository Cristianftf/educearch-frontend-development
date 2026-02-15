"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { adminSystemApi } from "@/lib/admin-system"
import type { SystemServiceStatus } from "@/types"
import {
  Server,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  Globe,
  MemoryStick,
} from "lucide-react"

const formatRelative = (iso?: string) => {
  if (!iso) return "Sin datos"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Sin datos"

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return "hace segundos"
  if (diffMinutes < 60) return `hace ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `hace ${diffHours} h`

  const diffDays = Math.floor(diffHours / 24)
  return `hace ${diffDays} dia${diffDays === 1 ? "" : "s"}`
}

export default function AdminHealthPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cpuUsage, setCpuUsage] = useState(0)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const [diskUsage, setDiskUsage] = useState(0)
  const [health, setHealth] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<SystemServiceStatus[]>([])

  const loadHealth = async () => {
    setError(null)
    try {
      const response = await adminSystemApi.getHealth()
      setHealth(response)
      if (typeof response?.cpu === "number") setCpuUsage(response.cpu)
      if (typeof response?.memory === "number") setMemoryUsage(response.memory)
      if (typeof response?.disk === "number") setDiskUsage(response.disk)
      if (Array.isArray(response?.services)) setServices(response.services)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar salud del sistema")
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadHealth()
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadHealth()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case "offline":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      online: "bg-green-100 text-green-700",
      warning: "bg-amber-100 text-amber-700",
      offline: "bg-red-100 text-red-700",
    }
    return <Badge className={variants[status]}>{status.toUpperCase()}</Badge>
  }

  const overallStatus = useMemo(() => {
    if (health?.status) {
      return String(health.status).toUpperCase() === "UP" ? "online" : "warning"
    }
    return "warning"
  }, [health])

  const overallOk = overallStatus === "online"
  const onlineServices = services.filter((s) => s.status === "online").length
  const totalServices = services.length
  const latency = health?.apiLatency
  const pubmedUsage = health?.pubmedUsage
  const pubmedPercent = pubmedUsage?.limit ? Math.min(100, pubmedUsage.percent) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Salud del Sistema
          </h1>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real de todos los servicios
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Overall Status */}
      <Card className={overallOk ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="flex items-center gap-4 py-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${overallOk ? "bg-green-100" : "bg-amber-100"}`}>
            {overallOk ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${overallOk ? "text-green-800" : "text-amber-800"}`}>
              {overallOk ? "Sistema Operativo" : "Sistema con Advertencias"}
            </p>
            <p className={`text-sm ${overallOk ? "text-green-600" : "text-amber-600"}`}>
              {totalServices > 0
                ? `${onlineServices} de ${totalServices} servicios funcionando correctamente`
                : "Sin datos de servicios"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              {latency?.p95 ? `${Math.round(latency.p95)}ms` : "--"}
            </p>
            <p className="text-xs text-muted-foreground">Latencia P95</p>
          </div>
        </CardContent>
      </Card>

      {/* System Resources */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              CPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{Math.round(cpuUsage)}%</span>
                <Badge variant={cpuUsage > 80 ? "destructive" : cpuUsage > 60 ? "secondary" : "outline"}>
                  {cpuUsage > 80 ? "Alto" : cpuUsage > 60 ? "Medio" : "Normal"}
                </Badge>
              </div>
              <Progress value={cpuUsage} className="h-2" />
              <p className="text-xs text-muted-foreground">Uso reportado por sistema</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MemoryStick className="h-4 w-4" />
              Memoria RAM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{Math.round(memoryUsage)}%</span>
                <Badge variant={memoryUsage > 80 ? "destructive" : memoryUsage > 60 ? "secondary" : "outline"}>
                  {memoryUsage > 80 ? "Alto" : memoryUsage > 60 ? "Medio" : "Normal"}
                </Badge>
              </div>
              <Progress value={memoryUsage} className="h-2" />
              <p className="text-xs text-muted-foreground">Uso reportado por JVM</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" />
              Almacenamiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{Math.round(diskUsage)}%</span>
                <Badge variant="outline">Normal</Badge>
              </div>
              <Progress value={diskUsage} className="h-2" />
              <p className="text-xs text-muted-foreground">Uso del disco principal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Tiempos de Respuesta
          </CardTitle>
          <CardDescription>Percentiles de latencia en las últimas 24 horas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-foreground">{latency?.p50 ? `${Math.round(latency.p50)}ms` : "--"}</p>
              <p className="text-sm text-muted-foreground">P50 (Mediana)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-foreground">{latency?.p75 ? `${Math.round(latency.p75)}ms` : "--"}</p>
              <p className="text-sm text-muted-foreground">P75</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-foreground">{latency?.p95 ? `${Math.round(latency.p95)}ms` : "--"}</p>
              <p className="text-sm text-muted-foreground">P95</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-foreground">{latency?.p99 ? `${Math.round(latency.p99)}ms` : "--"}</p>
              <p className="text-sm text-muted-foreground">P99</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Estado de Servicios
          </CardTitle>
          <CardDescription>
            Monitoreo detallado de cada componente del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay servicios reportados.</p>
          ) : (
            <div className="space-y-3">
              {services.map((service, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    service.status === "warning"
                      ? "border-amber-200 bg-amber-50/50"
                      : service.status === "offline"
                      ? "border-red-200 bg-red-50/50"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Última verificación: {service.lastCheck ? formatRelative(service.lastCheck) : "Sin datos"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">{service.latency ? `${Math.round(service.latency)}ms` : "--"}</p>
                      <p className="text-xs text-muted-foreground">Latencia</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">{service.uptime ?? "--"}</p>
                      <p className="text-xs text-muted-foreground">Uptime</p>
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Uso de API PubMed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Llamadas realizadas hoy</p>
              <p className="text-sm text-muted-foreground">Límite diario: {pubmedUsage?.limit ?? 0}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{pubmedUsage?.used ?? 0}</p>
              <p className="text-sm text-muted-foreground">{pubmedUsage?.percent ?? 0}% utilizado</p>
            </div>
          </div>
          <Progress value={pubmedPercent} className="h-3" />
          {pubmedUsage?.limit ? (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${pubmedPercent > 80 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
              <AlertTriangle className={`h-4 w-4 ${pubmedPercent > 80 ? "text-amber-600" : "text-green-600"}`} />
              <p className={`text-sm ${pubmedPercent > 80 ? "text-amber-700" : "text-green-700"}`}>
                {pubmedPercent > 80
                  ? "Se recomienda aumentar el límite o activar caché agresivo."
                  : "Uso dentro de límites normales."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin límite configurado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
