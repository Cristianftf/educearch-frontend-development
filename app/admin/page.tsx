"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  GraduationCap,
  BookOpen,
  Activity,
  TrendingUp,
  TrendingDown,
  Server,
  Database,
  Cpu,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  FileText,
  Shield,
  Zap,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { adminSystemApi } from "@/lib/admin-system"
import type { AdminDashboardData } from "@/types"

const formatUptime = (uptimeMs?: number) => {
  if (!uptimeMs || uptimeMs <= 0) return "Sin datos"
  const totalSeconds = Math.floor(uptimeMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const parts = []
  if (days > 0) parts.push(`${days} día${days === 1 ? "" : "s"}`)
  if (hours > 0) parts.push(`${hours} hora${hours === 1 ? "" : "s"}`)
  if (parts.length === 0) parts.push(`${minutes} min`)
  return parts.slice(0, 2).join(", ")
}

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
  return `hace ${diffDays} día${diffDays === 1 ? "" : "s"}`
}

const formatNumber = (value?: number) => (typeof value === "number" ? value.toLocaleString() : "0")

export default function AdminDashboard() {
  const { user } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null)

  const loadDashboard = async (manual = false) => {
    if (manual) setIsRefreshing(true)
    setIsLoading(true)
    setError(null)
    try {
      const response = await adminSystemApi.getDashboard()
      setDashboard(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar dashboard")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    loadDashboard(true)
  }

  useEffect(() => {
    loadDashboard(false)
  }, [])

  const stats = dashboard?.stats
  const resources = dashboard?.resources
  const systemStatus = dashboard?.systemStatus
  const services = dashboard?.services ?? []
  const alerts = dashboard?.alerts ?? []
  const activity = dashboard?.activity

  const searchesTrend = stats?.searchesChangePercent ?? 0
  const searchesTrendUp = searchesTrend >= 0
  const usersTrend = stats?.usersChangePercent ?? 0
  const usersTrendUp = usersTrend >= 0

  const cpuValue = Math.min(100, Math.max(0, resources?.cpu ?? 0))
  const memoryValue = Math.min(100, Math.max(0, resources?.memory ?? 0))
  const diskValue = Math.min(100, Math.max(0, resources?.disk ?? 0))
  const pubmedUsage = resources?.pubmedUsage
  const pubmedPercent = pubmedUsage?.limit ? Math.min(100, pubmedUsage.percent) : 0

  const overallOk = String(systemStatus?.status ?? "UP").toUpperCase() === "UP"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bienvenido, {user?.name}
          </h1>
          <p className="text-muted-foreground">
            Panel de control del sistema EDUCEARCH
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar datos
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      {/* System Status Banner */}
      <Card className={overallOk ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="flex items-center gap-4 py-4">
          <div className={`h-10 w-10 rounded-full ${overallOk ? "bg-green-100" : "bg-amber-100"} flex items-center justify-center`}>
            {overallOk ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${overallOk ? "text-green-800" : "text-amber-800"}`}>
              {overallOk ? "Sistema Operativo" : "Sistema con Advertencias"}
            </p>
            <p className={`text-sm ${overallOk ? "text-green-600" : "text-amber-600"}`}>
              Última verificación: {formatRelative(systemStatus?.lastCheck)}
            </p>
          </div>
          <Badge variant="outline" className={overallOk ? "border-green-300 text-green-700" : "border-amber-300 text-amber-700"}>
            Uptime: {formatUptime(systemStatus?.uptimeMs)}
          </Badge>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Usuarios
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalUsers)}</div>
            <div className={`flex items-center gap-1 text-xs ${usersTrendUp ? "text-green-600" : "text-red-600"}`}>
              {usersTrendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{Math.abs(usersTrend).toFixed(1)}% últimos 30 días</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estudiantes Activos
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.activeStudents)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatNumber(stats?.students)} estudiantes totales</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profesores
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.professors)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatNumber(stats?.admins)} administradores</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Búsquedas Hoy
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.searchesToday)}</div>
            <div className={`flex items-center gap-1 text-xs ${searchesTrendUp ? "text-green-600" : "text-red-600"}`}>
              {searchesTrendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{Math.abs(searchesTrend).toFixed(1)}% vs ayer</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Métricas del Sistema en Tiempo Real
            </CardTitle>
            <CardDescription>
              Monitoreo de recursos y rendimiento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span>CPU</span>
                </div>
                <span className="font-medium">{cpuValue.toFixed(1)}%</span>
              </div>
              <Progress value={cpuValue} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>Memoria RAM</span>
                </div>
                <span className="font-medium">{memoryValue.toFixed(1)}%</span>
              </div>
              <Progress value={memoryValue} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span>Almacenamiento</span>
                </div>
                <span className="font-medium">{diskValue.toFixed(1)}%</span>
              </div>
              <Progress value={diskValue} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span>API PubMed (Llamadas)</span>
                </div>
                <span className="font-medium">
                  {formatNumber(pubmedUsage?.used)}
                  {pubmedUsage?.limit ? ` / ${formatNumber(pubmedUsage.limit)}` : ""}
                </span>
              </div>
              <Progress value={pubmedPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {resources?.latency?.p50 ? `${Math.round(resources.latency.p50)}ms` : "--"}
                </p>
                <p className="text-xs text-muted-foreground">Latencia P50</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {resources?.latency?.p95 ? `${Math.round(resources.latency.p95)}ms` : "--"}
                </p>
                <p className="text-xs text-muted-foreground">Latencia P95</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {resources?.latency?.p99 ? `${Math.round(resources.latency.p99)}ms` : "--"}
                </p>
                <p className="text-xs text-muted-foreground">Latencia P99</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Estado de Servicios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos de servicios.</p>
            )}
            {services.map((service, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      service.status === "online"
                        ? "bg-green-500"
                        : service.status === "warning"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm">{service.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {service.latency ? `${Math.round(service.latency)}ms` : "--"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activity and Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alertas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alertas recientes.</p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      alert.type === "warning"
                        ? "bg-amber-50 border border-amber-200"
                        : alert.type === "error"
                        ? "bg-red-50 border border-red-200"
                        : alert.type === "success"
                        ? "bg-green-50 border border-green-200"
                        : "bg-blue-50 border border-blue-200"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 ${
                        alert.type === "warning"
                          ? "text-amber-500"
                          : alert.type === "error"
                          ? "text-red-500"
                          : alert.type === "success"
                          ? "text-green-500"
                          : "text-blue-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelative(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="users">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="users">Usuarios</TabsTrigger>
                <TabsTrigger value="system">Sistema</TabsTrigger>
                <TabsTrigger value="api">API</TabsTrigger>
              </TabsList>
              <TabsContent value="users" className="mt-4 space-y-3">
                {activity?.users?.length ? (
                  activity.users.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.action}</p>
                        <p className="text-xs text-muted-foreground">{item.user ?? "Sistema"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatRelative(item.timestamp)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
                )}
              </TabsContent>
              <TabsContent value="system" className="mt-4 space-y-3">
                {activity?.system?.length ? (
                  activity.system.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.action}</p>
                        <p className="text-xs text-muted-foreground">{item.user ?? "Sistema"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatRelative(item.timestamp)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin actividad del sistema.</p>
                )}
              </TabsContent>
              <TabsContent value="api" className="mt-4 space-y-3">
                {activity?.api?.length ? (
                  activity.api.map((apiItem, index) => (
                    <div key={`${apiItem.endpoint}-${index}`} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium font-mono">{apiItem.endpoint}</p>
                        <p className="text-xs text-muted-foreground">{apiItem.calls} llamadas hoy</p>
                      </div>
                      <Badge variant="outline" className={apiItem.status === "WARN" ? "text-amber-600 border-amber-300" : "text-green-600 border-green-300"}>
                        {apiItem.status === "WARN" ? "WARN" : "OK"}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin actividad de API.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent" asChild>
              <Link href="/admin/users">
                <Users className="h-5 w-5" />
                <span>Crear Usuario</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent" asChild>
              <Link href="/admin/system">
                <Database className="h-5 w-5" />
                <span>Backup Manual</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent" asChild>
              <Link href="/admin/audit">
                <Shield className="h-5 w-5" />
                <span>Ver Logs Seguridad</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent" asChild>
              <Link href="/admin/audit">
                <FileText className="h-5 w-5" />
                <span>Generar Reporte</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Cargando dashboard...</div>
      )}
    </div>
  )
}
