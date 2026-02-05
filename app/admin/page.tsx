"use client"

import { useState } from "react"
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

export default function AdminDashboard() {
  const { user } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

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

      {/* System Status Banner */}
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-800">Sistema Operativo</p>
            <p className="text-sm text-green-600">
              Todos los servicios funcionando correctamente. Ãšltima verificación: hace 2 minutos.
            </p>
          </div>
          <Badge variant="outline" className="border-green-300 text-green-700">
            99.9% Uptime
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
            <div className="text-2xl font-bold">1,284</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>+12% este mes</span>
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
            <div className="text-2xl font-bold">1,156</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>423 activos hoy</span>
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
            <div className="text-2xl font-bold">98</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>+5 nuevos</span>
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
            <div className="text-2xl font-bold">3,842</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>+23% vs ayer</span>
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
                <span className="font-medium">45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>Memoria RAM</span>
                </div>
                <span className="font-medium">62%</span>
              </div>
              <Progress value={62} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span>Almacenamiento</span>
                </div>
                <span className="font-medium">38%</span>
              </div>
              <Progress value={38} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span>API PubMed (Llamadas)</span>
                </div>
                <span className="font-medium">7,850 / 10,000</span>
              </div>
              <Progress value={78.5} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">42ms</p>
                <p className="text-xs text-muted-foreground">Latencia P50</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">128ms</p>
                <p className="text-xs text-muted-foreground">Latencia P95</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">256ms</p>
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
            {[
              { name: "API Principal", status: "online", latency: "12ms" },
              { name: "Base de Datos", status: "online", latency: "5ms" },
              { name: "PubMed Gateway", status: "online", latency: "145ms" },
              { name: "Servicio RAG", status: "online", latency: "230ms" },
              { name: "Cache Redis", status: "online", latency: "2ms" },
              { name: "Cola de Tareas", status: "online", latency: "8ms" },
            ].map((service, index) => (
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
                  {service.latency}
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
            <div className="space-y-4">
              {[
                {
                  type: "warning",
                  message: "Alto uso de API PubMed (78.5%)",
                  time: "Hace 15 min",
                },
                {
                  type: "info",
                  message: "Backup automático completado",
                  time: "Hace 2 horas",
                },
                {
                  type: "warning",
                  message: "3 intentos de login fallidos - usuario@test.cu",
                  time: "Hace 3 horas",
                },
                {
                  type: "success",
                  message: "Actualización del modelo RAG completada",
                  time: "Hace 1 día",
                },
              ].map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.type === "warning"
                      ? "bg-amber-50 border border-amber-200"
                      : alert.type === "success"
                      ? "bg-green-50 border border-green-200"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 ${
                      alert.type === "warning"
                        ? "text-amber-500"
                        : alert.type === "success"
                        ? "text-green-500"
                        : "text-blue-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
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
                {[
                  { action: "Nuevo registro", user: "Maria Garcia", time: "Hace 5 min" },
                  { action: "Login exitoso", user: "Carlos Lopez", time: "Hace 12 min" },
                  { action: "Actualización perfil", user: "Ana Torres", time: "Hace 25 min" },
                  { action: "Cambio de contraseña", user: "Pedro Ruiz", time: "Hace 1 hora" },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="system" className="mt-4 space-y-3">
                {[
                  { action: "Backup completado", detail: "15.2 GB", time: "Hace 2 horas" },
                  { action: "Cache limpiado", detail: "2.1 GB liberados", time: "Hace 4 horas" },
                  { action: "Índices optimizados", detail: "Base de datos", time: "Hace 6 horas" },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.detail}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="api" className="mt-4 space-y-3">
                {[
                  { endpoint: "/api/search", calls: "1,234", status: "OK" },
                  { endpoint: "/api/verify", calls: "567", status: "OK" },
                  { endpoint: "/api/mesh", calls: "892", status: "OK" },
                  { endpoint: "/api/export", calls: "156", status: "OK" },
                ].map((api, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium font-mono">{api.endpoint}</p>
                      <p className="text-xs text-muted-foreground">{api.calls} llamadas hoy</p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      {api.status}
                    </Badge>
                  </div>
                ))}
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
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent">
              <Users className="h-5 w-5" />
              <span>Crear Usuario</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent">
              <Database className="h-5 w-5" />
              <span>Backup Manual</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent">
              <Shield className="h-5 w-5" />
              <span>Ver Logs Seguridad</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 bg-transparent">
              <FileText className="h-5 w-5" />
              <span>Generar Reporte</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
