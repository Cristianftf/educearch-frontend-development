"use client"

import { useState } from "react"
import { format as formatDate } from "date-fns"
import { Download, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { exportAuditLogsClient } from "@/lib/admin-audit-export"

type ReportFormat = "pdf" | "excel" | "json"
type ReportType = "daily" | "weekly" | "monthly" | "custom"

interface ReportConfig {
  type: ReportType
  format: ReportFormat
  startDate?: string
  endDate?: string
  level?: "all" | "INFO" | "WARN" | "ERROR"
  user?: string
}

interface ReportResult {
  id: string
  fileName: string
  downloadUrl: string
  size: number
  generatedAt: string
}

const REPORT_TYPES = [
  { value: "daily", label: "Diario", description: "Últimas 24 horas" },
  { value: "weekly", label: "Semanal", description: "Últimos 7 días" },
  { value: "monthly", label: "Mensual", description: "Últimos 30 días" },
  { value: "custom", label: "Personalizado", description: "Rango de fechas" },
]

const EXPORT_FORMATS = [
  { value: "pdf", label: "PDF", description: "Reporte formateado con gráficos" },
  { value: "excel", label: "Excel", description: "Tabla con filtros y análisis" },
  { value: "json", label: "JSON", description: "Datos sin procesar" },
]

export function AuditReportGenerator() {
  const [isOpen, setIsOpen] = useState(false)
  const [reportType, setReportType] = useState<ReportType>("daily")
  const [format, setFormat] = useState<ReportFormat>("pdf")
  const [logLevel, setLogLevel] = useState<"all" | "INFO" | "WARN" | "ERROR">("all")
  const [userFilter, setUserFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)

  // Get date range based on report type
  const getDateRange = () => {
    const today = new Date()
    let start = new Date()

    switch (reportType) {
      case "daily":
        start.setDate(today.getDate() - 1)
        break
      case "weekly":
        start.setDate(today.getDate() - 7)
        break
      case "monthly":
        start.setDate(today.getDate() - 30)
        break
      case "custom":
        return { start: startDate, end: endDate }
    }

    return {
      start: formatDate(start, "yyyy-MM-dd"),
      end: formatDate(today, "yyyy-MM-dd"),
    }
  }

  const handleGenerateReport = async () => {
    setError(null)
    setResult(null)
    setIsLoading(true)

    try {
      const dateRange = getDateRange()

      // Validate custom dates
      if (reportType === "custom") {
        if (!startDate || !endDate) {
          throw new Error("Debes seleccionar fecha de inicio y fin")
        }
        if (new Date(startDate) >= new Date(endDate)) {
          throw new Error("La fecha de inicio debe ser antes de la fecha de fin")
        }
      }

      const config: ReportConfig = {
        type: reportType,
        format,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        level: logLevel !== "all" ? logLevel : undefined,
        user: userFilter || undefined,
      }

      const response = await exportAuditLogsClient({
        format: config.format,
        startDate: config.startDate,
        endDate: config.endDate,
        level: config.level,
        userId: config.user,
        fileNamePrefix: `audit-${config.type}`,
      })

      const reportResult: ReportResult = {
        id: response.id || `report-${Date.now()}`,
        fileName: response.fileName || `audit-report.${format}`,
        downloadUrl: response.downloadUrl || "#",
        size: response.size || 0,
        generatedAt: new Date().toISOString(),
      }

      setResult(reportResult)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al generar reporte"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Generar Reporte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generar Reporte de Auditoría</DialogTitle>
          <DialogDescription>
            Exporta logs de auditoría en el formato que necesites
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Tipo de Reporte</Label>
            <div className="grid grid-cols-2 gap-3">
              {REPORT_TYPES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setReportType(option.value as ReportType)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    reportType === option.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          {reportType === "custom" && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-sm font-semibold">Rango de Fechas</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start-date" className="text-xs">Desde</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs">Hasta</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Export Format Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Formato de Exportación</Label>
            <div className="grid grid-cols-3 gap-3">
              {EXPORT_FORMATS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormat(option.value as ReportFormat)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    format === option.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
            <Label className="text-sm font-semibold">Filtros Opcionales</Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="level" className="text-xs">Nivel de Log</Label>
                <Select value={logLevel} onValueChange={(v: any) => setLogLevel(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los niveles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los niveles</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARN">Advertencia</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="user" className="text-xs">Usuario (opcional)</Label>
                <Input
                  id="user"
                  placeholder="Filtrar por usuario"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Result */}
          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-700" />
              <AlertDescription className="text-green-800">
                <div className="space-y-2">
                  <div className="font-medium">Reporte generado exitosamente</div>
                  <div className="text-sm">
                    <div><strong>Archivo:</strong> {result.fileName}</div>
                    <div><strong>Tamaño:</strong> {formatFileSize(result.size)}</div>
                    <div><strong>Generado:</strong> {formatDate(new Date(result.generatedAt), "PPpp")}</div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                setResult(null)
                setError(null)
              }}
            >
              Cerrar
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={isLoading || (reportType === "custom" && (!startDate || !endDate))}
              className="gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {result ? "Generar Otro" : "Generar Reporte"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

