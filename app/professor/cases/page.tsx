'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { casesApi } from '@/lib/api'
import type { CaseStudy, CaseStatus, CaseDifficulty } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  Archive,
  FolderKanban,
  FileText,
  Calendar,
  GripVertical,
  Eye,
  Copy,
  ArrowRight,
} from 'lucide-react'
// import { useRouter } from 'next/navigation'

const statusConfig: Record<CaseStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  active: { label: 'Activo', color: 'bg-success/10 text-success border-success/30' },
  archived: { label: 'Archivado', color: 'bg-secondary text-secondary-foreground' },
}

const difficultyConfig: Record<CaseDifficulty, { label: string; color: string }> = {
  novice: { label: 'Novato', color: 'bg-success/10 text-success border-success/30' },
  intermediate: { label: 'Intermedio', color: 'bg-warning/10 text-warning border-warning/30' },
  advanced: { label: 'Avanzado', color: 'bg-destructive/10 text-destructive border-destructive/30' },
}

export default function ProfessorCasesPage() {
  const [cases, setCases] = useState<CaseStudy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<CaseStudy | null>(null)
  const [draggedCase, setDraggedCase] = useState<CaseStudy | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadCases() {
      try {
        const allCases = await casesApi.getAll()
        setCases(allCases)
      } catch (err) {
        console.error('[v0] Error loading cases:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadCases()
  }, [])

  const handleStatusChange = useCallback(async (caseId: string, newStatus: CaseStatus) => {
    try {
      await casesApi.update(caseId, { status: newStatus })
      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c))
      )
    } catch (err) {
      console.error('[v0] Error updating case status:', err)
    }
  }, [])

  const handleDelete = useCallback(async () => {
    if (!deleteDialog) return

    try {
      await casesApi.delete(deleteDialog.id)
      setCases((prev) => prev.filter((c) => c.id !== deleteDialog.id))
      setDeleteDialog(null)
    } catch (err) {
      console.error('[v0] Error deleting case:', err)
    }
  }, [deleteDialog])

  const handleDragStart = (caseStudy: CaseStudy) => {
    setDraggedCase(caseStudy)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (status: CaseStatus) => {
    if (draggedCase && draggedCase.status !== status) {
      handleStatusChange(draggedCase.id, status)
    }
    setDraggedCase(null)
  }

  const filteredCases = useMemo(() => (
    cases.filter(
      (c) =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.scenario.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ), [cases, searchTerm])

  const casesByStatus = useMemo<Record<CaseStatus, CaseStudy[]>>(() => ({
    draft: filteredCases.filter((c) => c.status === 'draft'),
    active: filteredCases.filter((c) => c.status === 'active'),
    archived: filteredCases.filter((c) => c.status === 'archived'),
  }), [filteredCases])

  if (isLoading) {
    return <CasesSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <FolderKanban className="h-8 w-8 text-primary" />
            Casos de Estudio
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y organiza los casos de estudio para tus estudiantes
          </p>
        </div>
        <Button onClick={() => router.push('/professor/cases/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Crear caso
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar casos..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Kanban Board */}
      <div className="grid gap-6 lg:grid-cols-3">
        {(Object.keys(statusConfig) as CaseStatus[]).map((status) => (
          <div
            key={status}
            className="space-y-4"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(status)}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusConfig[status].color.split(' ')[0]}`} />
                {statusConfig[status].label}
                <Badge variant="secondary" className="ml-1">
                  {casesByStatus[status].length}
                </Badge>
              </h2>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-3 pr-4">
                {casesByStatus[status].map((caseStudy) => (
                  <Card
                    key={caseStudy.id}
                    className={`cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                      draggedCase?.id === caseStudy.id ? 'opacity-50' : ''
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(caseStudy)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium line-clamp-2">{caseStudy.title}</h3>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/professor/cases/${caseStudy.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver detalles
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/professor/cases/${caseStudy.id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      const duplicated = await casesApi.create({
                                        title: `${caseStudy.title} (Copia)`,
                                        scenario: caseStudy.scenario,
                                        difficulty: caseStudy.difficulty,
                                        status: 'draft',
                                        requiredArticles: caseStudy.requiredArticles,
                                        optionalArticles: caseStudy.optionalArticles,
                                        guidingQuestions: caseStudy.guidingQuestions,
                                        rubric: caseStudy.rubric,
                                        dueDate: caseStudy.dueDate,
                                        assignedStudents: [],
                                      })
                                      setCases((prev) => [duplicated, ...prev])
                                    } catch (err) {
                                      console.error('[v0] Error duplicating case:', err)
                                    }
                                  }}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {status !== 'active' && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(caseStudy.id, 'active')}
                                  >
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Activar
                                  </DropdownMenuItem>
                                )}
                                {status !== 'archived' && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(caseStudy.id, 'archived')}
                                  >
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archivar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteDialog(caseStudy)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {caseStudy.scenario}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Badge
                              variant="outline"
                              className={difficultyConfig[caseStudy.difficulty].color}
                            >
                              {difficultyConfig[caseStudy.difficulty].label}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {caseStudy.assignedStudents.length}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {caseStudy.requiredArticles.length}
                            </div>
                          </div>

                          {caseStudy.dueDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                              <Calendar className="h-3 w-3" />
                              {new Date(caseStudy.dueDate).toLocaleDateString('es', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {casesByStatus[status].length === 0 && (
                  <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <p className="text-sm">Sin casos en esta columna</p>
                    {status === 'draft' && (
                      <Button variant="link" size="sm" asChild className="mt-2">
                        <Link href="/professor/cases/new">Crear primer caso</Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar caso</DialogTitle>
            <DialogDescription>
              ?Estás seguro de que deseas eliminar el caso &ldquo;{deleteDialog?.title}&rdquo;? Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CasesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="h-10 w-64" />

      <div className="grid gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-32 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
