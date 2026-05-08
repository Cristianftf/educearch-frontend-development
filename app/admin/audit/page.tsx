"use client"

import { useCallback, useEffect, useState } from "react"
import { adminAuditApi } from "@/lib/admin-audit"
import { exportAuditLogsClient } from "@/lib/admin-audit-export"
import { useAdmin } from "@/contexts/admin-context"
import type { AuditLog } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AuditReportGenerator } from "@/components/audit-report-generator"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  FileText,
  Globe,
  Info,
  RefreshCw,
  Search,
  User,
  XCircle,
} from "lucide-react"

export default function AdminAuditPage() {
  const { selectedLogLevel, setSelectedLogLevel, logSearchQuery, setLogSearchQuery } = useAdmin()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState({ total: 0, info: 0, warn: 0, error: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [showDateRange, setShowDateRange] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const pageSize = 20

  const loadLogs = useCallback(async () => {
    try {
      setError(null)
      setDateError(null)
      if (startDate && endDate && startDate > endDate) {
        setDateError("La fecha inicial debe ser anterior a la fecha final.")
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      const response = await adminAuditApi.getLogs(page, pageSize, {
        level: selectedLogLevel !== "all" ? selectedLogLevel : undefined,
        search: logSearchQuery || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })

      setLogs(response.logs)
      setTotal(response.total)
      setTotalPages(Math.max(1, response.totalPages || Math.ceil(response.total / pageSize)))
      setStats({
        total: response.total,
        info: response.stats?.info || 0,
        warn: response.stats?.warn || 0,
        error: response.stats?.error || 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los logs de auditoría.")
      setLogs([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [endDate, logSearchQuery, page, selectedLogLevel, startDate])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    setPage(1)
  }, [endDate, logSearchQuery, selectedLogLevel, startDate])

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
    return <Badge className={variants[level] ?? "bg-muted text-muted-foreground"}>{level}</Badge>
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
    loadLogs()
  }

  const handleQuickReport = async (days: number) => {
    setIsExporting(true)
    setError(null)
    try {
      const end = new Date()
      const start = new Date()
      start.setDate(end.getDate() - days)
      await exportAuditLogsClient({
        format: "pdf",
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        fileNamePrefix: `audit-${days}d`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el reporte.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoría del sistema</h1>
          <p className="text-muted-foreground">Monitorea actividades, seguridad y trazas operativas del sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <AuditReportGenerator />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Eventos totales</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.info.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">INFO</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.warn.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">WARN</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.error.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">ERROR</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar en logs, endpoint, usuario o detalle..."
                className="pl-9"
                value={logSearchQuery}
                onChange={(event) => setLogSearchQuery(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedLogLevel} onValueChange={(value) => setSelectedLogLevel(value as typeof selectedLogLevel)}>
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
              <Button variant="outline" onClick={() => setShowDateRange((prev) => !prev)}>
                <Calendar className="mr-2 h-4 w-4" />
                Fechas
              </Button>
            </div>
          </div>
          {showDateRange && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="audit-start-date" className="text-xs">
                  Desde
                </Label>
                <Input id="audit-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="audit-end-date" className="text-xs">
                  Hasta
                </Label>
                <Input id="audit-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
              {dateError && <div className="sm:col-span-2 text-xs text-destructive">{dateError}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registro de eventos
          </CardTitle>
          <CardDescription>{total} eventos encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 text-sm text-destructive">{error}</div>}
          {isLoading && <div className="mb-4 text-sm text-muted-foreground">Cargando eventos...</div>}
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`rounded-lg border transition-colors ${
                  log.level === "ERROR"
                    ? "border-red-200 bg-red-50/50"
                    : log.level === "WARN"
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-border bg-card"
                }`}
              >
                <button
                  type="button"
                  className="w-full p-4 text-left"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-center gap-4">
                    {getLevelIcon(log.level)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getLevelBadge(log.level)}
                        <span className="font-mono text-sm font-medium">{log.action}</span>
                        <span className="hidden text-sm text-muted-foreground sm:inline">- {log.details}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
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
                    <ChevronDown className={`h-4 w-4 text-muted-foreground ${expandedLog === log.id ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {expandedLog === log.id && (
                  <div className="mt-2 border-t px-4 pb-4 pt-0">
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Detalles</p>
                        <p className="mt-1 rounded bg-muted p-2 font-mono">{log.details}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">IP</p>
                        <p className="mt-1 flex items-center gap-2 rounded bg-muted p-2 font-mono">
                          <Globe className="h-3 w-3" />
                          {log.ip}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">User Agent</p>
                        <p className="mt-1 rounded bg-muted p-2 font-mono text-xs">{log.userAgent}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {logs.length === 0
                ? "Mostrando 0 eventos"
                : `Mostrando ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} de ${total} eventos`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reportes rápidos</CardTitle>
          <CardDescription>Genera reportes ejecutando el export real del backend con fallback local si falla.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => handleQuickReport(1)} disabled={isExporting}>
              <FileText className="h-5 w-5" />
              <span className="font-medium">Reporte diario</span>
              <span className="text-xs text-muted-foreground">Actividad de las últimas 24 h</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => handleQuickReport(7)} disabled={isExporting}>
              <FileText className="h-5 w-5" />
              <span className="font-medium">Reporte semanal</span>
              <span className="text-xs text-muted-foreground">Resumen de los últimos 7 días</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => handleQuickReport(30)} disabled={isExporting}>
              <FileText className="h-5 w-5" />
              <span className="font-medium">Reporte mensual</span>
              <span className="text-xs text-muted-foreground">Resumen de los últimos 30 días</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
