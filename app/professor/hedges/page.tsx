"use client"

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
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
  Filter,
  Code,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { hedgesApi } from "@/lib/api"
import type { SearchHedge } from "@/types"

type HedgeFormData = {
  name: string
  category: string
  query: string
  description: string
  isTemplate: boolean
  estimatedResults: number
  precision: number
  recall: number
}

type HedgeTestResult = {
  query?: string
  resultCount?: number
  estimatedPrecision?: number
  estimatedRecall?: number
  status?: string
  message?: string
}

const initialForm: HedgeFormData = {
  name: "",
  category: "",
  query: "",
  description: "",
  isTemplate: false,
  estimatedResults: 0,
  precision: 0.8,
  recall: 0.8,
}

const normalizePercent = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  const bounded = Math.max(0, Math.min(1, value))
  return Math.round(bounded * 100)
}

const normalizeHedge = (hedge: Partial<SearchHedge>, fallbackId?: string): SearchHedge => ({
  id: hedge.id ?? fallbackId ?? `local-${Date.now()}`,
  name: hedge.name ?? "Sin nombre",
  category: hedge.category ?? "General",
  query: hedge.query ?? "",
  description: hedge.description ?? "",
  estimatedResults: Number.isFinite(hedge.estimatedResults as number)
    ? Number(hedge.estimatedResults)
    : 0,
  precision: typeof hedge.precision === "number" ? hedge.precision : 0,
  recall: typeof hedge.recall === "number" ? hedge.recall : 0,
  createdAt: hedge.createdAt ?? new Date().toISOString(),
  isTemplate: Boolean(hedge.isTemplate),
  createdBy: hedge.createdBy ?? "local",
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

  const [formData, setFormData] = useState<HedgeFormData>(initialForm)
  const [queryValidation, setQueryValidation] = useState<"valid" | "invalid" | null>(null)
  const [testResult, setTestResult] = useState<HedgeTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const loadHedgesAndCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const [hedgesResult, categoriesResult] = await Promise.allSettled([
      hedgesApi.getAll(),
      hedgesApi.getCategories(),
    ])

    const hedgesOk = hedgesResult.status === "fulfilled" && Array.isArray(hedgesResult.value)
    const categoriesOk = categoriesResult.status === "fulfilled" && Array.isArray(categoriesResult.value)

    if (hedgesOk) {
      setHedges(hedgesResult.value.map((item) => normalizeHedge(item)))
    } else {
      setHedges([])
    }

    if (categoriesOk && categoriesResult.value.length > 0) {
      setCategories(Array.from(new Set(["General", ...categoriesResult.value])))
    } else {
      const localCategories = Array.from(
        new Set((hedgesOk ? hedgesResult.value : []).map((item) => item.category).filter(Boolean))
      )
      setCategories(localCategories.length > 0 ? localCategories : ["General"])
    }

    if (!hedgesOk || !categoriesOk) {
      setError("No se pudo completar la comunicación con API para hedges.")
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    void loadHedgesAndCategories()
  }, [loadHedgesAndCategories])

  const resetForm = useCallback(() => {
    setFormData(initialForm)
    setQueryValidation(null)
    setTestResult(null)
  }, [])

  const validateQuery = (query: string) => {
    if (!query.trim()) {
      setQueryValidation(null)
      return
    }
    if (query.length > 20 && query.toUpperCase().includes("[MESH]")) {
      setQueryValidation("valid")
      return
    }
    setQueryValidation("invalid")
  }

  const handleEditHedge = (hedge: SearchHedge) => {
    setEditingHedge(hedge)
    setFormData({
      name: hedge.name,
      category: hedge.category,
      query: hedge.query,
      description: hedge.description,
      isTemplate: Boolean(hedge.isTemplate),
      estimatedResults: hedge.estimatedResults ?? 0,
      precision: hedge.precision ?? 0,
      recall: hedge.recall ?? 0,
    })
    setTestResult(null)
    setQueryValidation(null)
    setIsEditDialogOpen(true)
  }

  const handleCreateHedge = async () => {
    if (!formData.name.trim() || !formData.category.trim() || !formData.query.trim()) {
      setError("Completa nombre, categoría y query.")
      return
    }

    const payload: Omit<SearchHedge, "id" | "createdAt" | "createdBy"> = {
      name: formData.name.trim(),
      category: formData.category.trim(),
      query: formData.query.trim(),
      description: formData.description.trim(),
      estimatedResults: formData.estimatedResults,
      precision: formData.precision,
      recall: formData.recall,
      isTemplate: formData.isTemplate,
    }

    try {
      const created = await hedgesApi.create(payload)
      setHedges((prev) => [normalizeHedge(created), ...prev])
      setError(null)
    } catch {
      setError("No se pudo crear el hedge en API.")
    }

    setIsCreateDialogOpen(false)
    resetForm()
  }

  const handleUpdateHedge = async () => {
    if (!editingHedge) return
    if (!formData.name.trim() || !formData.category.trim() || !formData.query.trim()) {
      setError("Completa nombre, categoría y query.")
      return
    }

    const payload: Partial<SearchHedge> = {
      name: formData.name.trim(),
      category: formData.category.trim(),
      query: formData.query.trim(),
      description: formData.description.trim(),
      estimatedResults: formData.estimatedResults,
      precision: formData.precision,
      recall: formData.recall,
      isTemplate: formData.isTemplate,
    }

    try {
      const updated = await hedgesApi.update(editingHedge.id, payload)
      setHedges((prev) =>
        prev.map((item) =>
          item.id === editingHedge.id ? normalizeHedge(updated, editingHedge.id) : item
        )
      )
      setError(null)
    } catch {
      setError("No se pudo actualizar el hedge en API.")
    }

    setIsEditDialogOpen(false)
    setEditingHedge(null)
    resetForm()
  }

  const handleDeleteHedge = async (id: string) => {
    const confirmed = window.confirm("¿Estás seguro de que deseas eliminar este hedge?")
    if (!confirmed) return

    try {
      await hedgesApi.delete(id)
      setHedges((prev) => prev.filter((item) => item.id !== id))
      setError(null)
    } catch {
      setError("No se pudo eliminar el hedge en API.")
    }
  }

  const handleTestQuery = async () => {
    if (!formData.query.trim()) {
      setError("Ingresa una query para probar.")
      return
    }

    setIsTesting(true)
    try {
      const result = await hedgesApi.test(formData.query.trim())
      const normalized: HedgeTestResult = {
        query: result.query ?? formData.query.trim(),
        resultCount: typeof result.resultCount === "number" ? result.resultCount : 0,
        estimatedPrecision:
          typeof result.estimatedPrecision === "number" ? result.estimatedPrecision : formData.precision,
        estimatedRecall:
          typeof result.estimatedRecall === "number" ? result.estimatedRecall : formData.recall,
        status: result.status ?? "SUCCESS",
        message: result.message ?? "Prueba completada",
      }
      setTestResult(normalized)
      setFormData((prev) => ({
        ...prev,
        estimatedResults: normalized.resultCount ?? 0,
        precision: normalized.estimatedPrecision ?? prev.precision,
        recall: normalized.estimatedRecall ?? prev.recall,
      }))
      setError(null)
      validateQuery(formData.query)
    } catch {
      setError("Falló la prueba de hedge en API.")
      validateQuery(formData.query)
    } finally {
      setIsTesting(false)
    }
  }

  const filteredHedges = useMemo(
    () =>
      hedges.filter((hedge) => {
        const matchesSearch = hedge.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "all" || hedge.category === selectedCategory
        return matchesSearch && matchesCategory
      }),
    [hedges, searchQuery, selectedCategory]
  )

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
          <h1 className="text-2xl font-bold text-foreground">Configurador de Search Hedges</h1>
          <p className="text-muted-foreground">
            Crea y gestiona estrategias de búsqueda predefinidas para tus estudiantes.
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo hedge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Search Hedge</DialogTitle>
              <DialogDescription>
                Define una estrategia reutilizable. Se intentará guardar en API primero.
              </DialogDescription>
            </DialogHeader>
            <HedgeForm
              formData={formData}
              setFormData={setFormData}
              categories={categories}
              queryValidation={queryValidation}
              testResult={testResult}
              isTesting={isTesting}
              onTestQuery={handleTestQuery}
              onValidateQuery={validateQuery}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateHedge}>Crear hedge</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
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
            <SelectValue placeholder="Filtrar por categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
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
                    <CardDescription>{hedge.description || "Sin descripción"}</CardDescription>
                  </div>
                  {hedge.isTemplate && <Badge variant="secondary">Plantilla</Badge>}
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
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Resultados</p>
                    <p className="text-lg font-bold text-blue-700">
                      {(Number.isFinite(hedge.estimatedResults) ? hedge.estimatedResults : 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Precisión</p>
                    <p className="text-lg font-bold text-green-700">{normalizePercent(hedge.precision)}%</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Recall</p>
                    <p className="text-lg font-bold text-orange-700">{normalizePercent(hedge.recall)}%</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Creado: {formatDate(hedge.createdAt)}</p>
              </CardContent>

              <div className="px-6 py-4 border-t flex gap-2">
                <Dialog
                  open={isEditDialogOpen && editingHedge?.id === hedge.id}
                  onOpenChange={setIsEditDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditHedge(hedge)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Editar Search Hedge</DialogTitle>
                      <DialogDescription>
                        Actualiza la estrategia. Si API falla, se aplica respaldo local.
                      </DialogDescription>
                    </DialogHeader>
                    <HedgeForm
                      formData={formData}
                      setFormData={setFormData}
                      categories={categories}
                      queryValidation={queryValidation}
                      testResult={testResult}
                      isTesting={isTesting}
                      onTestQuery={handleTestQuery}
                      onValidateQuery={validateQuery}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleUpdateHedge}>Guardar cambios</Button>
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

type HedgeFormProps = {
  formData: HedgeFormData
  setFormData: Dispatch<SetStateAction<HedgeFormData>>
  categories: string[]
  queryValidation: "valid" | "invalid" | null
  testResult: HedgeTestResult | null
  isTesting: boolean
  onTestQuery: () => Promise<void>
  onValidateQuery: (query: string) => void
}

function HedgeForm({
  formData,
  setFormData,
  categories,
  queryValidation,
  testResult,
  isTesting,
  onTestQuery,
  onValidateQuery,
}: HedgeFormProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del hedge *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Categoría *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
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
                  <span className="text-sm text-green-600">Válida</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">Inválida</span>
                </>
              )}
            </div>
          )}
        </div>
        <Textarea
          id="query"
          placeholder='("Term"[MeSH]) AND ("Filter"[MeSH])'
          className="font-mono text-sm min-h-[120px]"
          value={formData.query}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, query: e.target.value }))
            onValidateQuery(e.target.value)
          }}
        />
      </div>

      {testResult && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-medium">Resultado de prueba</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Resultados:</span>
              <p className="font-semibold">{testResult.resultCount ?? 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Precisión:</span>
              <p className="font-semibold">{normalizePercent(testResult.estimatedPrecision)}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Recall:</span>
              <p className="font-semibold">{normalizePercent(testResult.estimatedRecall)}%</p>
            </div>
          </div>
          {testResult.status && (
            <p className="text-xs text-muted-foreground">
              Estado: {testResult.status} {testResult.message ? `- ${testResult.message}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => void onTestQuery()}
          disabled={isTesting || !formData.query.trim()}
        >
          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {isTesting ? "Probando..." : "Probar query"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isTemplate"
          checked={formData.isTemplate}
          onChange={(e) => setFormData((prev) => ({ ...prev, isTemplate: e.target.checked }))}
          className="rounded border-gray-300"
        />
        <Label htmlFor="isTemplate" className="cursor-pointer">
          Marcar como plantilla reutilizable
        </Label>
      </div>
    </div>
  )
}
