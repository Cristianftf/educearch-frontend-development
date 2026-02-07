"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Play,
  Copy,
  BookOpen,
  Filter,
  Code,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { hedgesApi } from "@/lib/api"
import type { SearchHedge } from "@/types"

type HedgeTestResult = {
  query?: string
  resultCount?: number
  estimatedPrecision?: number
  estimatedRecall?: number
  status?: string
  message?: string
}

const mockHedges: SearchHedge[] = [
  {
    id: "1",
    name: "Diabetes Mellitus Tipo 2 - Tratamiento",
    category: "Enfermedades Metabólicas",
    query: '("Diabetes Mellitus, Type 2"[MeSH] OR "Type 2 Diabetes"[tiab]) AND ("Drug Therapy"[MeSH] OR "Treatment Outcome"[MeSH]) AND ("2019"[PDAT] : "2024"[PDAT])',
    description: "Hedge para Búsqueda de tratamientos farmacológicos en DM2",
    estimatedResults: 1250,
    precision: 0.85,
    recall: 0.78,
    createdAt: "2024-01-15T00:00:00Z",
    isTemplate: true,
  },
]

const normalizeHedge = (hedge: Partial<SearchHedge>): SearchHedge => ({
  id: hedge.id ? "",
  name: hedge.name ? "",
  category: hedge.category ? "General",
  query: hedge.query ? "",
  description: hedge.description ? "",
  estimatedResults: Number.isFinite(hedge.estimatedResults as number)
    ? (hedge.estimatedResults as number)
    : 0,
  precision: typeof hedge.precision === "number" ? hedge.precision : 0,
  recall: typeof hedge.recall === "number" ? hedge.recall : 0,
  createdAt: hedge.createdAt ? "",
  isTemplate: Boolean(hedge.isTemplate),
  createdBy: hedge.createdBy ? "",
})

const formatDate = (value?: string) => {
  if (!value) return "Sin fecha"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleDateString("es-ES")
}

export default function ProfessorHedgesPage() {
  const [hedges, setHedges] = useState<SearchHedge[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingHedge, setEditingHedge] = useState<SearchHedge | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    query: "",
    description: "",
    isTemplate: false,
    estimatedResults: 0,
    precision: 0.8,
    recall: 0.8,
  })
  const [queryValidation, setQueryValidation] = useState<"valid" | "invalid" | null>(null)
  const [testResult, setTestResult] = useState<HedgeTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {\n    void loadHedgesAndCategories()\n  }, [loadHedgesAndCategories])

  const loadHedgesAndCategories = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const hedgesData = await hedgesApi.getAll()
      setHedges(hedgesData.map(normalizeHedge))

      const categoriesData = await hedgesApi.getCategories()
      setCategories(categoriesData)
    } catch (err) {
      console.error("Error loading hedges:", err)
      setError("No se pudieron cargar los hedges. Usando datos de demostración.")
      setHedges(mockHedges)
      setCategories([
        "Enfermedades Metabólicas",
        "Cardiología",
        "Enfermedades Infecciosas",
        "Oncología",
        "Neurología",
        "Pediatría",
        "Farmacología",
      ])
    } finally {
      setIsLoading(false)
    }\n  }, [])\n\n  const handleCreateHedge = async () => {
    try {
      if (!formData.name || !formData.category || !formData.query) {
        alert("Por favor completa todos los campos requeridos")
        return
      }

      const created = await hedgesApi.create({
        name: formData.name,
        category: formData.category,
        query: formData.query,
        description: formData.description,
        estimatedResults: formData.estimatedResults,
        precision: formData.precision,
        recall: formData.recall,
        isTemplate: formData.isTemplate,
      })
      setHedges([...hedges, normalizeHedge(created)])
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (err) {
      console.error("Error creating hedge:", err)
      alert("Error al crear el hedge")
    }
  }

  const handleUpdateHedge = async () => {
    if (!editingHedge) return

    try {
      if (!formData.name || !formData.category || !formData.query) {
        alert("Por favor completa todos los campos requeridos")
        return
      }

      const updated = await hedgesApi.update(editingHedge.id, {
        ...formData,
      })

      setHedges(
        hedges.map((h) =>
          h.id === editingHedge.id ? normalizeHedge(updated) : h
        )
      )
      setIsEditDialogOpen(false)
      resetForm()
      setEditingHedge(null)
    } catch (err) {
      console.error("Error updating hedge:", err)
      alert("Error al actualizar el hedge")
    }
  }

  const handleDeleteHedge = async (id: string) => {
    if (!confirm("?Estás seguro de que deseas eliminar este hedge?")) return

    try {
      await hedgesApi.delete(id)
      setHedges(hedges.filter(h => h.id !== id))
    } catch (err) {
      console.error("Error deleting hedge:", err)
      alert("Error al eliminar el hedge")
    }
  }

  const handleEditHedge = (hedge: SearchHedge) => {
    setEditingHedge(hedge)
    setFormData({
      name: hedge.name,
      category: hedge.category,
      query: hedge.query,
      description: hedge.description,
      isTemplate: hedge.isTemplate,
      estimatedResults: hedge.estimatedResults,
      precision: hedge.precision,
      recall: hedge.recall,
    })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      query: "",
      description: "",
      isTemplate: false,
      estimatedResults: 0,
      precision: 0.8,
      recall: 0.8,
    })
    setQueryValidation(null)
    setTestResult(null)
  }

  const validateQuery = (query: string) => {
    if (query.length > 20 && query.includes("[MeSH]")) {
      setQueryValidation("valid")
    } else if (query.length > 0) {
      setQueryValidation("invalid")
    } else {
      setQueryValidation(null)
    }
  }

  const handleTestQuery = async () => {
    if (!formData.query) {
      alert("Por favor ingresa una query")
      return
    }

    try {
      setIsTesting(true)
      const result = await hedgesApi.test(formData.query)
      setTestResult(result)
      validateQuery(formData.query)

      const resultCount = result?.resultCount ? 0
      const estimatedPrecision = result?.estimatedPrecision ? formData.precision
      const estimatedRecall = result?.estimatedRecall ? formData.recall

      setFormData(prev => ({
        ...prev,
        estimatedResults: resultCount,
        precision: estimatedPrecision,
        recall: estimatedRecall,
      }))
    } catch (err) {
      console.error("Error testing query:", err)
      alert("Error al probar la query")
    } finally {
      setIsTesting(false)
    }
  }

  const filteredHedges = useMemo(() => (
    hedges.filter((hedge) => {
      const matchesSearch = hedge.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === "all" || hedge.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  ), [hedges, searchQuery, selectedCategory])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando hedges...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Configurador de Search Hedges
          </h1>
          <p className="text-muted-foreground">
            Crea y gestiona estrategias de Búsqueda predefinidas para tus estudiantes
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Hedge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Search Hedge</DialogTitle>
              <DialogDescription>
                Define una estrategia de Búsqueda que los estudiantes podrán usar como plantilla.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Hedge *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Diabetes - Tratamiento"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  placeholder="Breve Descripción del propósito del hedge"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="query">Query PubMed *</Label>
                  {queryValidation && (
                    <div className="flex items-center gap-1">
                      {queryValidation === "valid" ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Query válida</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600">Query inválida</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Textarea
                  id="query"
                  placeholder='("Term"[MeSH] OR "Term"[tiab]) AND ("Filter"[MeSH])'
                  className="font-mono text-sm min-h-[120px]"
                  value={formData.query}
                  onChange={(e) => {
                    setFormData({ ...formData, query: e.target.value })
                    validateQuery(e.target.value)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Usa sintaxis PubMed con Términos MeSH y operadores booleanos
                </p>
              </div>

              {testResult && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md space-y-2">
                  <p className="text-sm font-medium">Resultados de la prueba:</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Resultados:</span>
                      <p className="font-semibold">
                        {testResult.resultCount ? 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Precisión:</span>
                      <p className="font-semibold">
                        {(((testResult.estimatedPrecision ? formData.precision) * 100) || 0).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Recall:</span>
                      <p className="font-semibold">
                        {(((testResult.estimatedRecall ? formData.recall) * 100) || 0).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleTestQuery}
                  disabled={isTesting || !formData.query}
                >
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {isTesting ? "Probando..." : "Probar Query"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isTemplate"
                  checked={formData.isTemplate}
                  onChange={(e) => setFormData({ ...formData, isTemplate: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isTemplate" className="cursor-pointer">
                  Marcar como plantilla reutilizable
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateHedge}>
                Crear Hedge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar hedges..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-64">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredHedges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <Code className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">No hay hedges disponibles</p>
              <p className="text-xs text-muted-foreground mt-1">Crea uno nuevo para comenzar</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredHedges.map((hedge) => (
            <Card key={hedge.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg break-words">{hedge.name}</CardTitle>
                    <CardDescription>{hedge.description}</CardDescription>
                  </div>
                  {hedge.isTemplate && (
                    <Badge variant="secondary" className="whitespace-nowrap">
                      Plantilla
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="w-fit">
                  {hedge.category}
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Query</p>
                  <code className="block bg-muted p-3 rounded text-xs break-words max-h-32 overflow-y-auto font-mono">
                    {hedge.query}
                  </code>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Resultados</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {(Number.isFinite(hedge.estimatedResults) ? hedge.estimatedResults : 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Precisión</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {Math.round((hedge.precision ? 0) * 100)}%
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Recall</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {Math.round((hedge.recall ? 0) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">
                    Creado: {formatDate(hedge.createdAt)}
                  </p>
                </div>
              </CardContent>
              <div className="px-6 py-4 border-t flex gap-2">
                <Dialog open={isEditDialogOpen && editingHedge?.id === hedge.id} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditHedge(hedge)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Editar Search Hedge</DialogTitle>
                      <DialogDescription>
                        Actualiza los detalles de tu estrategia de Búsqueda.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Nombre del Hedge *</Label>
                          <Input
                            id="edit-name"
                            placeholder="Ej: Diabetes - Tratamiento"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-category">Categoría *</Label>
                          <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-description">Descripción</Label>
                        <Input
                          id="edit-description"
                          placeholder="Breve Descripción del propósito del hedge"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="edit-query">Query PubMed *</Label>
                          {queryValidation && (
                            <div className="flex items-center gap-1">
                              {queryValidation === "valid" ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  <span className="text-sm text-green-600">Query válida</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                  <span className="text-sm text-red-600">Query inválida</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <Textarea
                          id="edit-query"
                          placeholder='("Term"[MeSH] OR "Term"[tiab]) AND ("Filter"[MeSH])'
                          className="font-mono text-sm min-h-[120px]"
                          value={formData.query}
                          onChange={(e) => {
                            setFormData({ ...formData, query: e.target.value })
                            validateQuery(e.target.value)
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Usa sintaxis PubMed con Términos MeSH y operadores booleanos
                        </p>
                      </div>

                      {testResult && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md space-y-2">
                          <p className="text-sm font-medium">Resultados de la prueba:</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Resultados:</span>
                              <p className="font-semibold">
                                {testResult.resultCount ? 0}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Precisión:</span>
                              <p className="font-semibold">
                                {(((testResult.estimatedPrecision ? formData.precision) * 100) || 0).toFixed(0)}%
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Recall:</span>
                              <p className="font-semibold">
                                {(((testResult.estimatedRecall ? formData.recall) * 100) || 0).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleTestQuery}
                          disabled={isTesting || !formData.query}
                        >
                          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          {isTesting ? "Probando..." : "Probar Query"}
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit-isTemplate"
                          checked={formData.isTemplate}
                          onChange={(e) => setFormData({ ...formData, isTemplate: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="edit-isTemplate" className="cursor-pointer">
                          Marcar como plantilla reutilizable
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleUpdateHedge}>
                        Guardar Cambios
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteHedge(hedge.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
