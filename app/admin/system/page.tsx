"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AdminExternalApisMonitor } from "@/components/admin-external-apis-monitor"
import { adminSystemApi } from "@/lib/admin-system"
import type { SystemOverview } from "@/types"
import {
  Server,
  Database,
  HardDrive,
  Download,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle,
  Calendar,
  FileArchive,
  Shield,
  RotateCcw,
} from "lucide-react"

type Backup = {
  id: string
  createdAt: string
  size: number
  status: string
  type?: string
  progress?: number
  downloadUrl?: string
}

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

export default function AdminSystemPage() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const [isOptimizingDb, setIsOptimizingDb] = useState(false)
  const [isCleaningLogs, setIsCleaningLogs] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<SystemOverview | null>(null)

  const loadBackups = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await adminSystemApi.getBackups()
      const normalized = response.backups.map((backup) => ({
        id: backup.id,
        createdAt: backup.createdAt,
        size: backup.size,
        status: backup.status,
        type: backup.type,
        progress: backup.progress,
        downloadUrl: backup.downloadUrl,
      }))
      setBackups(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar backups")
      setBackups([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadOverview = async () => {
    try {
      const response = await adminSystemApi.getSystemOverview()
      setOverview(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos del sistema")
    }
  }

  useEffect(() => {
    loadBackups()
    loadOverview()
  }, [])

  const handleCreateBackup = async () => {
    setIsCreating(true)
    setError(null)
    try {
      await adminSystemApi.createBackup({ includeUsers: true, includeLogs: true })
      await loadBackups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear backup")
    } finally {
      setIsCreating(false)
    }
  }

  const latestCompletedBackup = useMemo(() => {
    return backups.find((b) => String(b.status).toUpperCase() === "COMPLETED")
  }, [backups])

  const latestBackup = useMemo(() => {
    if (backups.length === 0) return null
    return backups.reduce((latest, current) =>
      new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
    )
  }, [backups])

  const handleRestoreLatest = async () => {
    if (!latestCompletedBackup) return
    setIsRestoring(true)
    setError(null)
    try {
      await adminSystemApi.restoreBackup(latestCompletedBackup.id)
      await loadBackups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restaurar backup")
    } finally {
      setIsRestoring(false)
    }
  }

  const handleDeleteBackup = async (backupId: string) => {
    const confirmed = window.confirm("Eliminar este backup?")
    if (!confirmed) return
    setIsDeleting(backupId)
    setError(null)
    try {
      await adminSystemApi.deleteBackup(backupId)
      await loadBackups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar backup")
    } finally {
      setIsDeleting(null)
    }
  }

  const handleClearCache = async () => {
    setIsClearingCache(true)
    setError(null)
    try {
      await adminSystemApi.clearCache(["all"])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar cache")
    } finally {
      setIsClearingCache(false)
    }
  }

  const handleOptimizeDb = async () => {
    setIsOptimizingDb(true)
    setError(null)
    try {
      await adminSystemApi.optimizeDatabase()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al optimizar base de datos")
    } finally {
      setIsOptimizingDb(false)
    }
  }

  const handleCleanupLogs = async () => {
    setIsCleaningLogs(true)
    setError(null)
    try {
      await adminSystemApi.cleanupLogs(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar logs")
    } finally {
      setIsCleaningLogs(false)
    }
  }

  const handleReindexSearch = async () => {
    setIsReindexing(true)
    setError(null)
    try {
      await adminSystemApi.rebuildSearchIndexes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al regenerar indices")
    } finally {
      setIsReindexing(false)
    }
  }

  const backupTotalBytes = useMemo(
    () => backups.reduce((sum, b) => sum + (b.size || 0), 0),
    [backups]
  )
  const storageTotalBytes = overview?.storage?.totalBytes ?? 0
  const backupsStorageUsage = useMemo(() => {
    if (!storageTotalBytes) return 0
    return Math.min(100, Math.round((backupTotalBytes / storageTotalBytes) * 100))
  }, [backupTotalBytes, storageTotalBytes])

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${sizes[i]}`
  }

  const formatDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const normalizeStatus = (status: string) => {
    const upper = String(status).toUpperCase()
    if (upper.includes("IN_PROGRESS") || upper.includes("RUNNING")) return "in-progress"
    if (upper.includes("FAIL")) return "failed"
    if (upper.includes("RESTOR")) return "restoring"
    return "completed"
  }

  const server = overview?.server
  const database = overview?.database
  const redis = overview?.redis
  const tasks = overview?.scheduledTasks ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Gestión del Sistema
          </h1>
          <p className="text-muted-foreground">
            Administra backups, caché y mantenimiento del sistema
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      <AdminExternalApisMonitor />

      {/* System Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              Servidor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sistema Operativo</span>
              <span>{server?.os ?? "Sin datos"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Runtime</span>
              <span>{server?.runtime ?? "Java"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Uptime</span>
              <span className="text-green-600">{formatUptime(server?.uptimeMs)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Base de Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Motor</span>
              <span>{database?.engine ?? "Sin datos"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tamaño</span>
              <span>{formatBytes(database?.sizeBytes ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Conexiones</span>
              <span>{database ? `${database.connections} / ${database.maxConnections}` : "Sin datos"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" />
              Caché Redis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Memoria usada</span>
              <span>{formatBytes(redis?.usedBytes ?? 0)} / {formatBytes(redis?.maxBytes ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hit Rate</span>
              <span className="text-green-600">{redis?.hitRate ?? 0}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Keys</span>
              <span>{redis?.keys ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backups Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5" />
                Backups del Sistema
              </CardTitle>
              <CardDescription>
                Gestiona las copias de seguridad de la base de datos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRestoreLatest}
                disabled={!latestCompletedBackup || isRestoring}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {isRestoring ? "Restaurando..." : "Restaurar"}
              </Button>
              <Button onClick={handleCreateBackup} disabled={isCreating}>
                <Download className="mr-2 h-4 w-4" />
                {isCreating ? "Creando..." : "Crear Backup"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {/* Backup Status */}
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">
                  {latestBackup ? "Último backup registrado" : "Sin backups registrados"}
                </p>
                <p className="text-sm text-green-600">
                  {latestBackup
                    ? `Último backup: ${formatDate(latestBackup.createdAt)}`
                    : "Aún no se ha generado un backup"}
                </p>
              </div>
            </div>
          </div>

          {/* Backup Storage */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Almacenamiento de backups</span>
              <span className="text-sm text-muted-foreground">
                {formatBytes(backupTotalBytes)} / {storageTotalBytes ? formatBytes(storageTotalBytes) : "Sin datos"}
              </span>
            </div>
            <Progress value={backupsStorageUsage} className="h-2" />
          </div>

          {/* Backups List */}
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
              <span>Fecha</span>
              <span>Tipo</span>
              <span>Tamaño</span>
              <span>Estado</span>
              <span className="text-right">Acciones</span>
            </div>
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="grid grid-cols-5 gap-4 px-4 py-3 items-center rounded-lg hover:bg-muted/50"
              >
                <span className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatDate(backup.createdAt)}
                </span>
                <span>
                  <Badge variant="secondary">
                    {backup.type ?? "Sistema"}
                  </Badge>
                </span>
                <span className="text-sm">{formatBytes(backup.size)}</span>
                <span>
                  {normalizeStatus(backup.status) === "completed" ? (
                    <Badge className="bg-green-100 text-green-700">Completado</Badge>
                  ) : normalizeStatus(backup.status) === "in-progress" ? (
                    <Badge className="bg-blue-100 text-blue-700">En progreso</Badge>
                  ) : normalizeStatus(backup.status) === "restoring" ? (
                    <Badge className="bg-amber-100 text-amber-700">Restaurando</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">Fallido</Badge>
                  )}
                </span>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={!backup.downloadUrl} onClick={() => backup.downloadUrl && window.open(backup.downloadUrl, "_blank")}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDeleteBackup(backup.id)}
                    disabled={isDeleting === backup.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {backups.length === 0 && !isLoading && (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No hay backups disponibles.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Acciones de Mantenimiento
          </CardTitle>
          <CardDescription>
            Tareas de optimización y limpieza del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Limpiar Caché</p>
                <p className="text-sm text-muted-foreground">
                  Elimina datos en caché obsoletos
                </p>
              </div>
              <Button variant="outline" onClick={handleClearCache} disabled={isClearingCache}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isClearingCache ? "Ejecutando..." : "Ejecutar"}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Optimizar Base de Datos</p>
                <p className="text-sm text-muted-foreground">
                  Ejecuta VACUUM y reindex
                </p>
              </div>
              <Button variant="outline" onClick={handleOptimizeDb} disabled={isOptimizingDb}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {isOptimizingDb ? "Ejecutando..." : "Ejecutar"}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Limpiar Logs Antiguos</p>
                <p className="text-sm text-muted-foreground">
                  Elimina logs de más de 30 días
                </p>
              </div>
              <Button variant="outline" onClick={handleCleanupLogs} disabled={isCleaningLogs}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isCleaningLogs ? "Ejecutando..." : "Ejecutar"}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Regenerar Índices de Búsqueda</p>
                <p className="text-sm text-muted-foreground">
                  Reconstruye índices FTS
                </p>
              </div>
              <Button variant="outline" onClick={handleReindexSearch} disabled={isReindexing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {isReindexing ? "Ejecutando..." : "Ejecutar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tareas Programadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay tareas programadas.</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">{task.name}</p>
                      <p className="text-sm text-muted-foreground">{task.schedule}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    {task.status ?? "Activo"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
