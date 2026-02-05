"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Users,
  Search,
  Download,
  Mail,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Filter,
  Eye,
  BarChart3,
  Loader2,
} from "lucide-react"
import { professorAnalyticsApi } from "@/lib/api"

type StudentProgress = {
  id: string
  name: string
  email: string
  avatar?: string
  accessScore: number
  processingScore: number
  communicationScore: number
  overallScore: number
  trend: "up" | "down" | "stable"
  lastActivity: string
  casesCompleted: number
  totalCases: number
  status: "active" | "at-risk" | "inactive"
}

const mockStudents: StudentProgress[] = [
  {
    id: "1",
    name: "María García López",
    email: "maria.garcia@estudiante.uci.cu",
    accessScore: 85,
    processingScore: 72,
    communicationScore: 78,
    overallScore: 78,
    trend: "up",
    lastActivity: "Hace 2 horas",
    casesCompleted: 4,
    totalCases: 5,
    status: "active",
  },
]

export default function ProfessorStudentsPage() {
  const [students, setStudents] = useState<StudentProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")

  // Cargar datos del API
  useEffect(() => {
    async function loadStudents() {
      try {
        setIsLoading(true)
        setError(null)
        const data = await professorAnalyticsApi.getClassOverview()
        
        // Transformar studentCompetencies a formato de tabla
        if (data.studentCompetencies) {
          const transformedStudents = data.studentCompetencies.map((student: any) => ({
            id: student.studentId,
            name: student.studentName,
            email: student.studentEmail,
            avatar: student.avatar || "/placeholder.svg",
            accessScore: Math.round(student.scores?.access || 0),
            processingScore: Math.round(student.scores?.process || 0),
            communicationScore: Math.round(student.scores?.communicate || 0),
            overallScore: Math.round(student.averageScore || 0),
            trend: determineTrend(student.averageScore || 0),
            lastActivity: "Recientemente",  // TODO: Obtener del backend
            casesCompleted: 0,  // TODO: Obtener del backend
            totalCases: 5,      // TODO: Obtener del backend
            status: determineStatus(student.averageScore || 0),
          }))
          setStudents(transformedStudents)
        }
      } catch (err) {
        console.error("Error loading students:", err)
        setError("No se pudo cargar los datos de estudiantes")
        // Fallback a mockStudents
        setStudents(mockStudents)
      } finally {
        setIsLoading(false)
      }
    }

    loadStudents()
  }, [])

  const filteredStudents = students
    .filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || student.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "score") return b.overallScore - a.overallScore
      if (sortBy === "activity") return 0 // Would need proper date comparison
      return 0
    })

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700">Activo</Badge>
      case "at-risk":
        return <Badge className="bg-red-100 text-red-700">En riesgo</Badge>
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-700">Inactivo</Badge>
      default:
        return null
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-amber-600"
    return "text-red-600"
  }

  // Funciones auxiliares
  const determineTrend = (score: number): "up" | "down" | "stable" => {
    if (score >= 80) return "up"
    if (score < 60) return "down"
    return "stable"
  }

  const determineStatus = (score: number): "active" | "at-risk" | "inactive" => {
    if (score < 60) return "at-risk"
    if (score === 0) return "inactive"
    return "active"
  }

  const atRiskCount = students.filter((s) => s.status === "at-risk").length
  const averageScore = students.length > 0 
    ? Math.round(students.reduce((sum, s) => sum + s.overallScore, 0) / students.length)
    : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando datos de estudiantes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Progreso de Estudiantes
          </h1>
          <p className="text-muted-foreground">
            Monitorea el avance de tus estudiantes en las competencias
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Enviar recordatorio
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-sm text-muted-foreground">Estudiantes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{averageScore}%</p>
              <p className="text-sm text-muted-foreground">Promedio general</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{atRiskCount}</p>
              <p className="text-sm text-muted-foreground">En riesgo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">+12%</p>
              <p className="text-sm text-muted-foreground">Mejora semanal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for at-risk students */}
      {atRiskCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">
                {atRiskCount} estudiante(s) requieren atención
              </p>
              <p className="text-sm text-amber-600">
                Estos estudiantes tienen bajo progreso o no han estado activos recientemente.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Ver detalles
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar estudiantes..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="at-risk">En riesgo</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="score">Puntuación</SelectItem>
                <SelectItem value="activity">Actividad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Estudiantes</CardTitle>
          <CardDescription>
            {filteredStudents.length} estudiantes encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead className="text-center">Acceso</TableHead>
                  <TableHead className="text-center">Procesamiento</TableHead>
                  <TableHead className="text-center">Comunicación</TableHead>
                  <TableHead className="text-center">General</TableHead>
                  <TableHead className="text-center">Casos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.avatar || "/placeholder.svg"} alt={student.name} />
                          <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.lastActivity}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-medium ${getScoreColor(student.accessScore)}`}>
                        {student.accessScore}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-medium ${getScoreColor(student.processingScore)}`}>
                        {student.processingScore}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-medium ${getScoreColor(student.communicationScore)}`}>
                        {student.communicationScore}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`font-bold ${getScoreColor(student.overallScore)}`}>
                          {student.overallScore}%
                        </span>
                        {getTrendIcon(student.trend)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <p className="text-sm">
                          {student.casesCompleted}/{student.totalCases}
                        </p>
                        <Progress
                          value={(student.casesCompleted / student.totalCases) * 100}
                          className="h-1.5 w-16 mx-auto"
                        />
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(student.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
