"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Server,
  Database,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  FileArchive,
  Shield,
  RotateCcw,
} from "lucide-react"

type Backup = {
  id: string
  date: string
  size: string
  type: "automatic" | "manual"
  status: "completed" | "in-progress" | "failed"
}

const recentBackups: Backup[] = [
  { id: "1", date: "2024-01-25 10:00", size: "15.2 GB", type: "automatic", status: "completed" },
  { id: "2", date: "2024-01-24 10:00", size: "15.1 GB", type: "automatic", status: "completed" },
  { id: "3", date: "2024-01-23 10:00", size: "14.9 GB", type: "automatic", status: "completed" },
  { id: "4", date: "2024-01-22 15:30", size: "14.8 GB", type: "manual", status: "completed" },
  { id: "5", date: "2024-01-22 10:00", size: "14.8 GB", type: "automatic", status: "completed" },
]

export default function AdminSystemPage() {
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
              <span>Ubuntu 22.04 LTS</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Node.js</span>
              <span>v20.10.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Uptime</span>
              <span className="text-green-600">45 días, 12 horas</span>
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
              <span>PostgreSQL 15.2</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tamaño</span>
              <span>12.4 GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Conexiones</span>
              <span>24 / 100</span>
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
              <span>2.1 GB / 4 GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hit Rate</span>
              <span className="text-green-600">94.5%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Keys</span>
              <span>45,892</span>
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
              <Button variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </Button>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Crear Backup
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Backup Status */}
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Backups automáticos activos</p>
                <p className="text-sm text-green-600">
                  Próximo backup programado: Hoy a las 22:00
                </p>
              </div>
            </div>
          </div>

          {/* Backup Storage */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Almacenamiento de backups</span>
              <span className="text-sm text-muted-foreground">75.5 GB / 100 GB</span>
            </div>
            <Progress value={75.5} className="h-2" />
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
            {recentBackups.map((backup) => (
              <div
                key={backup.id}
                className="grid grid-cols-5 gap-4 px-4 py-3 items-center rounded-lg hover:bg-muted/50"
              >
                <span className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {backup.date}
                </span>
                <span>
                  <Badge variant={backup.type === "automatic" ? "secondary" : "outline"}>
                    {backup.type === "automatic" ? "Automático" : "Manual"}
                  </Badge>
                </span>
                <span className="text-sm">{backup.size}</span>
                <span>
                  {backup.status === "completed" ? (
                    <Badge className="bg-green-100 text-green-700">Completado</Badge>
                  ) : backup.status === "in-progress" ? (
                    <Badge className="bg-blue-100 text-blue-700">En progreso</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">Fallido</Badge>
                  )}
                </span>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
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
              <Button variant="outline">
                <Trash2 className="mr-2 h-4 w-4" />
                Ejecutar
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Optimizar Base de Datos</p>
                <p className="text-sm text-muted-foreground">
                  Ejecuta VACUUM y reindex
                </p>
              </div>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Ejecutar
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Limpiar Logs Antiguos</p>
                <p className="text-sm text-muted-foreground">
                  Elimina logs de más de 30 días
                </p>
              </div>
              <Button variant="outline">
                <Trash2 className="mr-2 h-4 w-4" />
                Ejecutar
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Regenerar Índices de Búsqueda</p>
                <p className="text-sm text-muted-foreground">
                  Reconstruye índices FTS
                </p>
              </div>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Ejecutar
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
          <div className="space-y-3">
            {[
              { name: "Backup diario", schedule: "Todos los días a las 22:00", status: "active" },
              { name: "Limpieza de caché", schedule: "Cada 6 horas", status: "active" },
              { name: "Sincronización MeSH", schedule: "Cada domingo a las 03:00", status: "active" },
              { name: "Reporte semanal", schedule: "Cada lunes a las 08:00", status: "active" },
              { name: "Verificación de integridad", schedule: "Cada día a las 04:00", status: "active" },
            ].map((task, index) => (
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
                  Activo
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
