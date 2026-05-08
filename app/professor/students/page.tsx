"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  RefreshCw,
} from "lucide-react"
import { professorAnalyticsApi } from "@/lib/api"
import type { ProfessorAnalyticsOverview, StudentProgress } from "@/types"

type StudentTableRow = {
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
  lastActivityAt: number | null
  casesCompleted: number
  totalCases: number
  weeklyActivities: number
  status: "active" | "at-risk" | "inactive"
}

type StudentCompetency = NonNullable<ProfessorAnalyticsOverview["studentCompetencies"]>[number]

const AT_RISK_SCORE = 60
const INACTIVE_DAYS_THRESHOLD = 21
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const toScore = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return Math.max(0, Math.round(value <= 1 ? value * 100 : value))
}

const parseTimestamp = (value?: string) => {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

const formatLastActivity = (timestamp: number | null) => {
  if (!timestamp) return "Sin actividad reciente"
  const diff = Date.now() - timestamp
  if (diff < DAY_MS) {
    const hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)))
    return `Hace ${hours}h`
  }
  const days = Math.floor(diff / DAY_MS)
  if (days <= 30) return `Hace ${days}d`
  return new Date(timestamp).toLocaleDateString("es-ES")
}

const getLatestActivityAt = (progress?: StudentProgress) => {
  if (!progress?.recentActivities || progress.recentActivities.length === 0) return null
  return progress.recentActivities
    .map((activity) => parseTimestamp(activity.timestamp))
    .filter((timestamp): timestamp is number => typeof timestamp === "number")
    .sort((a, b) => b - a)[0] ?? null
}

const countWeeklyActivities = (progress?: StudentProgress) => {
  if (!progress?.recentActivities) return 0
  const cutoff = Date.now() - WEEK_MS
  return progress.recentActivities.filter((activity) => {
    const timestamp = parseTimestamp(activity.timestamp)
    return timestamp !== null && timestamp >= cutoff
  }).length
}

const determineStatus = (
  overallScore: number,
  lastActivityAt: number | null,
  casesCompleted: number,
  totalCases: number
): StudentTableRow["status"] => {
  if (!lastActivityAt || Date.now() - lastActivityAt > INACTIVE_DAYS_THRESHOLD * DAY_MS) {
    return "inactive"
  }
  if (overallScore < AT_RISK_SCORE) return "at-risk"
  if (totalCases > 0 && casesCompleted / totalCases < 0.4) return "at-risk"
  return "active"
}

const determineTrend = (
  overallScore: number,
  weeklyActivities: number
): StudentTableRow["trend"] => {
  if (overallScore < AT_RISK_SCORE) return "down"
  if (weeklyActivities > 0) return "up"
  return "stable"
}

const getStudentLabel = (studentId: string) => {
  const normalized = studentId.trim()
  return normalized ? `Estudiante ${normalized.slice(0, 8)}` : "Estudiante sin identificar"
}

const buildRow = (
  studentId: string,
  competency: StudentCompetency | undefined,
  progress: StudentProgress | undefined
): StudentTableRow => {
  const accessScore = toScore(competency?.scores?.access ?? progress?.competencies?.access?.score)
  const processingScore = toScore(competency?.scores?.process ?? progress?.competencies?.process?.score)
  const communicationScore = toScore(competency?.scores?.communicate ?? progress?.competencies?.communicate?.score)
  const overallScore = toScore(
    competency?.averageScore ?? (accessScore + processingScore + communicationScore) / 3
  )
  const lastActivityAt = getLatestActivityAt(progress)
  const weeklyActivities = countWeeklyActivities(progress)
  const casesCompleted = typeof progress?.casesCompleted === "number" ? progress.casesCompleted : 0
  const totalCases = typeof progress?.totalCases === "number" ? progress.totalCases : 0

  return {
    id: studentId,
    name: competency?.studentName ?? getStudentLabel(studentId),
    email: competency?.studentEmail ?? "",
    avatar: competency?.avatar || "/placeholder.svg",
    accessScore,
    processingScore,
    communicationScore,
    overallScore,
    trend: determineTrend(overallScore, weeklyActivities),
    lastActivity: formatLastActivity(lastActivityAt),
    lastActivityAt,
    casesCompleted,
    totalCases,
    weeklyActivities,
    status: determineStatus(overallScore, lastActivityAt, casesCompleted, totalCases),
  }
}

const csvEscape = (value: string | number) => {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ProfessorStudentsPage() {
  const [students, setStudents] = useState<StudentTableRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")
  const [selectedStudent, setSelectedStudent] = useState<StudentTableRow | null>(null)
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<StudentProgress | null>(null)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const loadStudents = useCallback(async () => {
    setError(null)
    try {
      const [overview, studentsProgress] = await Promise.all([
        professorAnalyticsApi.getClassOverview(),
        professorAnalyticsApi.getStudentsProgress(),
      ])

      const competencyById = new Map<string, StudentCompetency>()
      for (const item of overview.studentCompetencies ?? []) {
        competencyById.set(item.studentId, item)
      }

      const progressById = new Map<string, StudentProgress>()
      for (const item of studentsProgress) {
        if (item.userId) progressById.set(item.userId, item)
      }

      const allIds = new Set<string>([
        ...(overview.studentCompetencies ?? []).map((item) => item.studentId),
        ...studentsProgress.map((item) => item.userId).filter(Boolean),
      ])

      const rows = Array.from(allIds).map((studentId) =>
        buildRow(studentId, competencyById.get(studentId), progressById.get(studentId))
      )

      setStudents(rows)
    } catch (loadError) {
      console.error("Error loading students:", loadError)
      setError("No se pudo cargar los datos reales de estudiantes.")
      setStudents([])
    }
  }, [])

  useEffect(() => {
    async function initialLoad() {
      setIsLoading(true)
      await loadStudents()
      setIsLoading(false)
    }
    void initialLoad()
  }, [loadStudents])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await loadStudents()
    setIsRefreshing(false)
  }, [loadStudents])

  const handleSendReminder = useCallback(() => {
    const targets = students.filter(
      (student) => student.status === "at-risk" || student.status === "inactive"
    )
    const emails = targets
      .map((student) => student.email)
      .filter((email) => typeof email === "string" && email.includes("@"))
    if (emails.length === 0) {
      setError("No hay estudiantes en riesgo o inactivos con correo válido.")
      return
    }
    const subject = encodeURIComponent("Recordatorio de seguimiento académico")
    const body = encodeURIComponent(
      "Hola,\n\nEste es un recordatorio para retomar tus actividades y mejorar tu progreso en las competencias informacionales.\n\nSaludos."
    )
    window.location.href = `mailto:${emails.join(",")}?subject=${subject}&body=${body}`
  }, [students])

  const handleViewStudent = useCallback(async (student: StudentTableRow) => {
    setSelectedStudent(student)
    setSelectedStudentDetails(null)
    setDetailsError(null)
    setIsDetailsLoading(true)
    try {
      const details = await professorAnalyticsApi.getStudentDetails(student.id)
      setSelectedStudentDetails(details)
    } catch (detailsLoadError) {
      console.error("Error loading student details:", detailsLoadError)
      setDetailsError("No se pudo cargar el detalle del estudiante.")
    } finally {
      setIsDetailsLoading(false)
    }
  }, [])

  const filteredStudents = useMemo(() => {
    return students
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
        if (sortBy === "activity") {
          const aActivity = a.lastActivityAt ?? 0
          const bActivity = b.lastActivityAt ?? 0
          return bActivity - aActivity
        }
        return 0
      })
  }, [students, searchQuery, sortBy, statusFilter])

  const handleExport = useCallback(() => {
    const rows: Array<Array<string | number>> = [
      [
        "id",
        "nombre",
        "email",
        "acceso",
        "procesamiento",
        "comunicación",
        "general",
        "estado",
        "casos_completados",
        "casos_totales",
        "actividad_semanal",
      ],
      ...filteredStudents.map((student) => [
        student.id,
        student.name,
        student.email,
        student.accessScore,
        student.processingScore,
        student.communicationScore,
        student.overallScore,
        student.status,
        student.casesCompleted,
        student.totalCases,
        student.weeklyActivities,
      ]),
    ]
    const timestamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`professor-students-${timestamp}.csv`, rows)
  }, [filteredStudents])

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

  const atRiskCount = useMemo(
    () => students.filter((student) => student.status === "at-risk").length,
    [students]
  )
  const averageScore = useMemo(
    () =>
      students.length > 0
        ? Math.round(students.reduce((sum, student) => sum + student.overallScore, 0) / students.length)
        : 0,
    [students]
  )
  const weeklyActivityCount = useMemo(
    () => students.reduce((sum, student) => sum + student.weeklyActivities, 0),
    [students]
  )

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Progreso de Estudiantes</h1>
          <p className="text-muted-foreground">
            Monitorea el avance real de tus estudiantes en las competencias
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filteredStudents.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" onClick={handleSendReminder}>
            <Mail className="mr-2 h-4 w-4" />
            Enviar recordatorio
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

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
              <p className="text-2xl font-bold">{weeklyActivityCount}</p>
              <p className="text-sm text-muted-foreground">Actividad semanal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {atRiskCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">{atRiskCount} estudiante(s) requieren atención</p>
              <p className="text-sm text-amber-600">
                Estos estudiantes tienen bajo progreso o poca actividad reciente.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Ver detalles
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar estudiantes..."
                className="pl-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
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

      <Card>
        <CardHeader>
          <CardTitle>Lista de Estudiantes</CardTitle>
          <CardDescription>{filteredStudents.length} estudiantes encontrados</CardDescription>
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
                          value={student.totalCases > 0 ? (student.casesCompleted / student.totalCases) * 100 : 0}
                          className="h-1.5 w-16 mx-auto"
                        />
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(student.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => void handleViewStudent(student)}>
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

      <Dialog
        open={selectedStudent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null)
            setSelectedStudentDetails(null)
            setDetailsError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.name ?? "Detalle del estudiante"}</DialogTitle>
            <DialogDescription>{selectedStudent?.email}</DialogDescription>
          </DialogHeader>

          {isDetailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Cargando detalle...
            </div>
          ) : detailsError ? (
            <p className="text-sm text-destructive">{detailsError}</p>
          ) : selectedStudentDetails ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Acceso</p>
                    <p className="text-xl font-bold">{toScore(selectedStudentDetails.competencies.access.score)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Procesamiento</p>
                    <p className="text-xl font-bold">{toScore(selectedStudentDetails.competencies.process.score)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Comunicación</p>
                    <p className="text-xl font-bold">{toScore(selectedStudentDetails.competencies.communicate.score)}%</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardContent className="pt-4 text-sm space-y-1">
                    <p>Búsquedas: {selectedStudentDetails.totalSearches}</p>
                    <p>Verificaciones: {selectedStudentDetails.totalVerifications}</p>
                    <p>Bibliografías: {selectedStudentDetails.totalBibliographies}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-sm space-y-1">
                    <p>Casos completados: {selectedStudentDetails.casesCompleted ?? 0}</p>
                    <p>Casos asignados: {selectedStudentDetails.totalCases ?? 0}</p>
                    <p>Promedio: {Math.round(selectedStudent?.overallScore ?? 0)}%</p>
                  </CardContent>
                </Card>
              </div>

              {selectedStudentDetails.recommendations && selectedStudentDetails.recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recomendaciones</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {selectedStudentDetails.recommendations.map((recommendation, index) => (
                      <p key={`${recommendation}-${index}`}>- {recommendation}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos detallados disponibles.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

