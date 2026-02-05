"use client"

import { useState, useEffect, useCallback } from "react"
import { adminAuditApi } from "@/lib/api"
import type { AuditLog } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditReportGenerator } from "@/components/audit-report-generator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  Search,
  Download,
  Calendar,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  User,
  Globe,
  ChevronDown,
  RefreshCw,
  Activity,
  CheckCircle,
} from "lucide-react"

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState({ total: 0, info: 0, warn: 0, error: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadLogs = useCallback(async () => {
    try {
      const response = await adminAuditApi.getLogs(
        page,
        20,
        {
          level: levelFilter !== "all" ? levelFilter : undefined,
          search: searchQuery || undefined,
        }
      )
      setLogs(response.logs)
      setTotalPages(Math.ceil(response.total / 20))
      setStats({
        total: response.total,
        info: response.stats?.info || 0,
        warn: response.stats?.warn || 0,
        error: response.stats?.error || 0,
      })
    } catch (err) {
      console.error("[v0] Error loading audit logs:", err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [page, levelFilter, searchQuery])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // WebSocket for real-time logs
  // TODO: Implement subscribeToLogs in adminAuditApi
  // useEffect(() => {
  //   const ws = adminAuditApi.subscribeToLogs((newLog) => {
  //     setLogs((prev) => [newLog, ...prev.slice(0, 19)])
  //     setStats((prev) => ({
  //       ...prev,
  //       total: prev.total + 1,
  //       [newLog.level.toLowerCase()]: (prev[newLog.level.toLowerCase() as keyof typeof prev] as number) + 1,
  //     }))
  //   })

  //   return () => {
  //     ws?.close()
  //   }
  // }, [])

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLevel = levelFilter === "all" || log.level === levelFilter
    return matchesSearch && matchesLevel
  })

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "INFO":
        return <Info className="h-4 w-4 text-blue-500" />
      case "WARN":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getLevelBadge = (level: string) => {
    const variants: Record<string, string> = {
      INFO: "bg-blue-100 text-blue-700",
      WARN: "bg-amber-100 text-amber-700",
      ERROR: "bg-red-100 text-red-700",
    }
    return <Badge className={variants[level]}>{level}</Badge>
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Auditoría del Sistema
          </h1>
          <p className="text-muted-foreground">
            Monitorea todas las actividades y eventos del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <AuditReportGenerator />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">12,458</p>
              <p className="text-sm text-muted-foreground">Total eventos hoy</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">11,892</p>
              <p className="text-sm text-muted-foreground">Eventos INFO</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">523</p>
              <p className="text-sm text-muted-foreground">Advertencias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">43</p>
              <p className="text-sm text-muted-foreground">Errores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en logs..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="INFO">INFO</SelectItem>
                  <SelectItem value="WARN">WARN</SelectItem>
                  <SelectItem value="ERROR">ERROR</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                Rango de fechas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registro de Eventos
          </CardTitle>
          <CardDescription>
            {filteredLogs.length} eventos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`border rounded-lg transition-colors ${
                  log.level === "ERROR"
                    ? "border-red-200 bg-red-50/50"
                    : log.level === "WARN"
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-border bg-card"
                }`}
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getLevelBadge(log.level)}
                        <span className="font-mono text-sm font-medium">{log.action}</span>
                        <span className="text-sm text-muted-foreground hidden sm:inline">
                          - {log.details}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.user}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedLog === log.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {expandedLog === log.id && (
                  <div className="px-4 pb-4 pt-0 border-t mt-2">
                    <div className="grid gap-3 sm:grid-cols-2 text-sm mt-3">
                      <div>
                        <p className="text-muted-foreground">Detalles</p>
                        <p className="font-mono bg-muted p-2 rounded mt-1">{log.details}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">IP</p>
                        <p className="font-mono bg-muted p-2 rounded mt-1 flex items-center gap-2">
                          <Globe className="h-3 w-3" />
                          {log.ip}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">User Agent</p>
                        <p className="font-mono bg-muted p-2 rounded mt-1 text-xs">{log.userAgent}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando 1-8 de 12,458 eventos
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
              <Button variant="outline" size="sm">
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle>Reportes Automáticos</CardTitle>
          <CardDescription>
            Genera reportes detallados de actividad del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Reporte Diario</span>
              <span className="text-xs text-muted-foreground">Actividad últimas 24h</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Reporte Semanal</span>
              <span className="text-xs text-muted-foreground">Resumen de la semana</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Reporte Mensual</span>
              <span className="text-xs text-muted-foreground">Estadísticas del mes</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
