"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Globe,
  MemoryStick,
} from "lucide-react"

type ServiceStatus = {
  name: string
  status: "online" | "warning" | "offline"
  latency: number
  uptime: string
  lastCheck: string
}

const services: ServiceStatus[] = [
  { name: "API Principal", status: "online", latency: 12, uptime: "99.99%", lastCheck: "Hace 30s" },
  { name: "Base de Datos PostgreSQL", status: "online", latency: 5, uptime: "99.95%", lastCheck: "Hace 30s" },
  { name: "PubMed Gateway", status: "online", latency: 145, uptime: "99.8%", lastCheck: "Hace 30s" },
  { name: "Servicio RAG (Meditron)", status: "online", latency: 230, uptime: "99.5%", lastCheck: "Hace 30s" },
  { name: "Redis Cache", status: "online", latency: 2, uptime: "99.99%", lastCheck: "Hace 30s" },
  { name: "Cola de Tareas (RabbitMQ)", status: "online", latency: 8, uptime: "99.9%", lastCheck: "Hace 30s" },
  { name: "Servicio de Email", status: "warning", latency: 450, uptime: "98.5%", lastCheck: "Hace 30s" },
  { name: "Almacenamiento S3", status: "online", latency: 35, uptime: "99.99%", lastCheck: "Hace 30s" },
]

export default function AdminHealthPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cpuUsage, setCpuUsage] = useState(45)
  const [memoryUsage, setMemoryUsage] = useState(62)
  const [diskUsage, setDiskUsage] = useState(38)

  // Simulated real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage((prev) => Math.min(100, Math.max(20, prev + (Math.random() - 0.5) * 10)))
      setMemoryUsage((prev) => Math.min(100, Math.max(40, prev + (Math.random() - 0.5) * 5)))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1500)
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

  const onlineServices = services.filter((s) => s.status === "online").length
  const totalServices = services.length

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

      {/* Overall Status */}
      <Card className={onlineServices === totalServices ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="flex items-center gap-4 py-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${onlineServices === totalServices ? "bg-green-100" : "bg-amber-100"}`}>
            {onlineServices === totalServices ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${onlineServices === totalServices ? "text-green-800" : "text-amber-800"}`}>
              {onlineServices === totalServices ? "Sistema Operativo" : "Sistema con Advertencias"}
            </p>
            <p className={`text-sm ${onlineServices === totalServices ? "text-green-600" : "text-amber-600"}`}>
              {onlineServices} de {totalServices} servicios funcionando correctamente
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">99.9%</p>
            <p className="text-xs text-muted-foreground">Uptime general</p>
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
              <p className="text-xs text-muted-foreground">8 núcleos disponibles</p>
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
              <p className="text-xs text-muted-foreground">12.4 GB de 20 GB usados</p>
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
                <span className="text-3xl font-bold">{diskUsage}%</span>
                <Badge variant="outline">Normal</Badge>
              </div>
              <Progress value={diskUsage} className="h-2" />
              <p className="text-xs text-muted-foreground">190 GB de 500 GB usados</p>
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
              <p className="text-3xl font-bold text-foreground">42ms</p>
              <p className="text-sm text-muted-foreground">P50 (Mediana)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-foreground">89ms</p>
              <p className="text-sm text-muted-foreground">P75</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-foreground">128ms</p>
              <p className="text-sm text-muted-foreground">P95</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-foreground">256ms</p>
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
                      Última verificación: {service.lastCheck}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{service.latency}ms</p>
                    <p className="text-xs text-muted-foreground">Latencia</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{service.uptime}</p>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                  </div>
                  {getStatusBadge(service.status)}
                </div>
              </div>
            ))}
          </div>
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
              <p className="text-sm text-muted-foreground">Límite diario: 10,000</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">7,850</p>
              <p className="text-sm text-muted-foreground">78.5% utilizado</p>
            </div>
          </div>
          <Progress value={78.5} className="h-3" />
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-700">
              Se recomienda aumentar el límite o activar el modo de caché agresivo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
