"use client"

import { useState } from "react"
import { format as formatDate } from "date-fns"
import { AlertCircle, CheckCircle, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { exportAuditLogsClient } from "@/lib/admin-audit-export"

type ReportFormat = "pdf" | "excel" | "json"
type ReportType = "daily" | "weekly" | "monthly" | "custom"

interface ReportResult {
  id: string
  fileName: string
  downloadUrl: string
  size: number
  generatedAt: string
  source: "backend" | "client-fallback"
}

const REPORT_TYPES = [
  { value: "daily", label: "Diario", description: "Últimas 24 horas" },
  { value: "weekly", label: "Semanal", description: "Últimos 7 días" },
  { value: "monthly", label: "Mensual", description: "Últimos 30 días" },
  { value: "custom", label: "Personalizado", description: "Rango de fechas" },
]

const EXPORT_FORMATS = [
  { value: "pdf", label: "PDF", description: "Documento formateado" },
  { value: "excel", label: "Excel", description: "Tabla descargable" },
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

  const getDateRange = () => {
    const today = new Date()
    const start = new Date()
    if (reportType === "daily") start.setDate(today.getDate() - 1)
    if (reportType === "weekly") start.setDate(today.getDate() - 7)
    if (reportType === "monthly") start.setDate(today.getDate() - 30)
    if (reportType === "custom") {
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
      if (reportType === "custom") {
        if (!startDate || !endDate) throw new Error("Debes seleccionar fecha inicial y final.")
        if (new Date(startDate) >= new Date(endDate)) {
          throw new Error("La fecha inicial debe ser anterior a la fecha final.")
        }
      }

      const response = await exportAuditLogsClient({
        format,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        level: logLevel !== "all" ? logLevel : undefined,
        userQuery: userFilter || undefined,
        fileNamePrefix: `audit-${reportType}`,
      })

      setResult({
        id: response.id,
        fileName: response.fileName,
        downloadUrl: response.downloadUrl,
        size: response.size,
        generatedAt: response.createdAt,
        source: response.source,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el reporte.")
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const units = ["B", "KB", "MB", "GB"]
    const exponent = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round((bytes / Math.pow(1024, exponent)) * 100) / 100} ${units[exponent]}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Generar reporte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generar reporte de auditoría</DialogTitle>
          <DialogDescription>Usa el export del backend y, si no responde, genera un fallback local para no cortar el flujo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Período</Label>
            <div className="grid grid-cols-2 gap-3">
              {REPORT_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setReportType(option.value as ReportType)}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    reportType === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {reportType === "custom" && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div>
                <Label htmlFor="start-date" className="text-xs">Desde</Label>
                <Input id="start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-xs">Hasta</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-base font-semibold">Formato</Label>
            <div className="grid grid-cols-3 gap-3">
              {EXPORT_FORMATS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value as ReportFormat)}
                  className={`rounded-lg border-2 p-3 text-center transition-all ${
                    format === option.value ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg bg-gray-50 p-3">
            <Label className="text-sm font-semibold">Filtros opcionales</Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="level" className="text-xs">Nivel</Label>
                <Select value={logLevel} onValueChange={(value) => setLogLevel(value as typeof logLevel)}>
                  <SelectTrigger><SelectValue placeholder="Todos los niveles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="INFO">INFO</SelectItem>
                    <SelectItem value="WARN">WARN</SelectItem>
                    <SelectItem value="ERROR">ERROR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="user" className="text-xs">Usuario</Label>
                <Input id="user" placeholder="Correo, nombre o identificador" value={userFilter} onChange={(event) => setUserFilter(event.target.value)} />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-700" />
              <AlertDescription className="text-green-800">
                <div className="space-y-2">
                  <div className="font-medium">Reporte generado correctamente</div>
                  <div className="text-sm">
                    <div><strong>Archivo:</strong> {result.fileName}</div>
                    <div><strong>Tamaño:</strong> {formatFileSize(result.size)}</div>
                    <div><strong>Generado:</strong> {formatDate(new Date(result.generatedAt), "PPpp")}</div>
                    <div><strong>Origen:</strong> {result.source === "backend" ? "Backend real" : "Fallback local"}</div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsOpen(false); setResult(null); setError(null) }}>
              Cerrar
            </Button>
            <Button onClick={handleGenerateReport} disabled={isLoading || (reportType === "custom" && (!startDate || !endDate))}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {result ? "Generar otro" : "Generar reporte"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
