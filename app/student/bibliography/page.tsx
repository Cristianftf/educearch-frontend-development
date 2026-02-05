'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { bibliographyApi, searchApi } from '@/lib/api'
import type { Bibliography, BibliographyFormat, SearchResult, SearchQuery } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  FileText,
  Download,
  Share2,
  Copy,
  Check,
  Loader2,
  Plus,
  Search,
  BookOpen,
  Calendar,
  Trash2,
  History,
  QrCode,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useStudent } from '@/contexts/student-context'

const FORMAT_LABELS: Record<BibliographyFormat, string> = {
  apa: 'APA 7th Edition',
  vancouver: 'Vancouver',
  bibtex: 'BibTeX',
  xml: 'XML',
}

const FORMAT_EXAMPLES: Record<BibliographyFormat, string> = {
  apa: `Smith, J. A., & Johnson, B. C. (2024). Effects of exercise on cardiovascular health: A systematic review. Journal of Medical Research, 45(3), 234-251. https://doi.org/10.1234/jmr.2024.001`,
  vancouver: `1. Smith JA, Johnson BC. Effects of exercise on cardiovascular health: A systematic review. J Med Res. 2024;45(3):234-51. doi:10.1234/jmr.2024.001`,
  bibtex: `@article{smith2024effects,
  author = {Smith, John A. and Johnson, Brian C.},
  title = {Effects of exercise on cardiovascular health},
  journal = {Journal of Medical Research},
  year = {2024},
  volume = {45},
  pages = {234--251}
}`,
  xml: `<reference>
  <authors>
    <author>Smith, John A.</author>
    <author>Johnson, Brian C.</author>
  </authors>
  <title>Effects of exercise on cardiovascular health</title>
  <journal>Journal of Medical Research</journal>
  <year>2024</year>
</reference>`,
}

export default function BibliographyPage() {
  const searchParams = useSearchParams()
  const [selectedArticles, setSelectedArticles] = useState<SearchResult[]>([])
  const [availableArticles, setAvailableArticles] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<SearchQuery[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<BibliographyFormat>('apa')
  const [bibliographyName, setBibliographyName] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedBibliography, setGeneratedBibliography] = useState<Bibliography | null>(null)
  const [savedBibliographies, setSavedBibliographies] = useState<Bibliography[]>([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingArticles, setIsLoadingArticles] = useState(false)
  const [isLoadingFromHistory, setIsLoadingFromHistory] = useState(false)
  const { addBibliography, setBibliographies, bibliographies } = useStudent()

  // Load saved bibliographies and available articles
  useEffect(() => {
    async function loadData() {
      try {
        const searchHistory = await searchApi.getHistory(1, 50)
        setRecentSearches(searchHistory.searches || [])
      } catch (err) {
        console.error('[v0] Error loading data:', err)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (bibliographies.length > 0) {
      setSavedBibliographies(bibliographies)
    }
  }, [bibliographies])

  useEffect(() => {
    const source = searchParams.get('source')
    if (!source) return

    const getSelection = (key: string) => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as SearchResult[]
        if (!Array.isArray(parsed) || parsed.length === 0) return null
        return parsed
      } catch {
        return null
      }
    }

    if (source === 'pyramid') {
      const parsed = getSelection('evidence_pyramid_selection')
      if (!parsed) return
      setAvailableArticles(parsed)
      setSelectedArticles(parsed)
      if (!bibliographyName) {
        setBibliographyName('Bibliografía desde pirámide de evidencia')
      }
    }

    if (source === 'search') {
      const parsed = getSelection('search_selection')
      if (!parsed) return
      setAvailableArticles(parsed)
      setSelectedArticles(parsed)
      if (!bibliographyName) {
        setBibliographyName('Bibliografía desde búsqueda avanzada')
      }
    }
  }, [searchParams, bibliographyName])

  const searchArticles = useCallback(async (term: string) => {
    if (term.length < 2) return

    setIsLoadingArticles(true)
    try {
      const session = await searchApi.execute({
        terms: [{ id: 'search', term, description: '' }],
        operators: [],
        filters: {},
        rawQuery: term,
      })
      setAvailableArticles(session.results)
      setSelectedArticles([])
    } catch (err) {
      console.error('[v0] Search error:', err)
      setError('No se pudieron cargar artículos. Intenta con otro término.')
    } finally {
      setIsLoadingArticles(false)
    }
  }, [])

  const loadFromHistory = useCallback(async (search: SearchQuery) => {
    setIsLoadingFromHistory(true)
    setError(null)
    try {
      const session = await searchApi.execute({
        terms: search.terms,
        operators: search.operators,
        filters: search.filters,
        rawQuery: search.rawQuery,
      })
      setAvailableArticles(session.results)
      setSelectedArticles([])
    } catch (err) {
      console.error('[v0] History load error:', err)
      setError('No se pudo cargar la búsqueda seleccionada.')
    } finally {
      setIsLoadingFromHistory(false)
    }
  }, [])

  const toggleArticle = useCallback((article: SearchResult) => {
    setSelectedArticles((prev) => {
      const exists = prev.some((a) => a.id === article.id)
      if (exists) {
        return prev.filter((a) => a.id !== article.id)
      }
      return [...prev, article]
    })
  }, [])

  const removeArticle = useCallback((articleId: string) => {
    setSelectedArticles((prev) => prev.filter((a) => a.id !== articleId))
  }, [])

  const selectAllHighEvidence = useCallback(() => {
    const highEvidence = availableArticles.filter((a) => a.evidenceLevel <= 3)
    setSelectedArticles((prev) => {
      const newArticles = highEvidence.filter((a) => !prev.some((p) => p.id === a.id))
      return [...prev, ...newArticles]
    })
  }, [availableArticles])

  const generateBibliography = useCallback(async () => {
    if (selectedArticles.length === 0) {
      setError('Selecciona al menos un artículo')
      return
    }

    if (!bibliographyName.trim()) {
      setError('Ingresa un nombre para la bibliografía')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const bibliography = await bibliographyApi.generate(
        selectedArticles.map((a) => a.id),
        selectedFormat,
        bibliographyName
      )
      setGeneratedBibliography(bibliography)
      addBibliography(bibliography)

      // Refresh saved bibliographies
      const bibHistory = await bibliographyApi.getHistory()
      setSavedBibliographies(bibHistory)
      setBibliographies(bibHistory)
    } catch (err) {
      setError('Error al generar la bibliografía. Intenta de nuevo.')
      console.error('[v0] Generation error:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [selectedArticles, selectedFormat, bibliographyName])

  const copyToClipboard = useCallback(async () => {
    if (!generatedBibliography) return

    try {
      await navigator.clipboard.writeText(generatedBibliography.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[v0] Copy error:', err)
    }
  }, [generatedBibliography])

  const downloadBibliography = useCallback(
    async (format: 'docx' | 'txt') => {
      if (!generatedBibliography) return

      try {
        const blob = await bibliographyApi.download(generatedBibliography.id, format)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${bibliographyName}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('[v0] Download error:', err)
      }
    },
    [generatedBibliography, bibliographyName]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          Generador de Bibliografías
        </h1>
        <p className="text-muted-foreground mt-1">
          Crea bibliografías en múltiples formatos a partir de tus artículos seleccionados
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Article Selection */}
        <div className="lg:col-span-2 space-y-6">
          {(searchParams.get('source') === 'pyramid' || searchParams.get('source') === 'search') && selectedArticles.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <p className="text-sm text-primary">
                  Importamos {selectedArticles.length} estudios desde la selección.
                </p>
              </CardContent>
            </Card>
          )}
          {/* Search for articles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Buscar artículos
              </CardTitle>
              <CardDescription>
                Busca artículos para añadirlos a tu bibliografía
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título, autor o término..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchArticles(searchTerm)}
                  />
                </div>
                <Button onClick={() => searchArticles(searchTerm)} disabled={isLoadingArticles}>
                  {isLoadingArticles ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Buscar'
                  )}
                </Button>
              </div>

              {availableArticles.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {availableArticles.length} artículos encontrados
                    </p>
                    <Button variant="outline" size="sm" onClick={selectAllHighEvidence}>
                      Seleccionar nivel 1-3
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px] border rounded-lg">
                    <div className="p-4 space-y-2">
                      {availableArticles.map((article) => {
                        const isSelected = selectedArticles.some((a) => a.id === article.id)
                        return (
                          <div
                            key={article.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-primary/5 border-primary/30'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => toggleArticle(article)}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2">{article.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {article.authors.slice(0, 2).join(', ')}
                                {article.authors.length > 2 && ' et al.'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {article.year}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    article.evidenceLevel <= 2
                                      ? 'border-success text-success'
                                      : article.evidenceLevel <= 4
                                        ? 'border-warning text-warning'
                                        : ''
                                  }`}
                                >
                                  Nivel {article.evidenceLevel}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>

          {/* Selected Articles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Artículos seleccionados ({selectedArticles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedArticles.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {selectedArticles.map((article) => (
                      <div
                        key={article.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{article.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {article.journal} ({article.year})
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeArticle(article.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay artículos seleccionados</p>
                  <p className="text-xs">Busca y selecciona artículos arriba</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Bibliography Preview */}
          {generatedBibliography && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      Bibliografía generada
                    </CardTitle>
                    <CardDescription>{generatedBibliography.name}</CardDescription>
                  </div>
                  <Badge>{FORMAT_LABELS[generatedBibliography.format]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[300px] border rounded-lg">
                  <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
                    {generatedBibliography.content}
                  </pre>
                </ScrollArea>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={copyToClipboard}>
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => downloadBibliography('docx')}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar .docx
                  </Button>
                  <Button variant="outline" onClick={() => downloadBibliography('txt')}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar .txt
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <QrCode className="mr-2 h-4 w-4" />
                        Compartir QR
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Compartir bibliografía</DialogTitle>
                        <DialogDescription>
                          Escanea el código QR para acceder a tu bibliografía
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
                        <div className="w-48 h-48 bg-foreground/10 rounded-lg flex items-center justify-center">
                          <QrCode className="h-24 w-24 text-muted-foreground" />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Format Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Formato de cita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecciona el formato</Label>
                <Select
                  value={selectedFormat}
                  onValueChange={(v) => setSelectedFormat(v as BibliographyFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORMAT_LABELS) as BibliographyFormat[]).map((format) => (
                      <SelectItem key={format} value={format}>
                        {FORMAT_LABELS[format]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vista previa del formato</Label>
                <ScrollArea className="h-[120px] border rounded-lg">
                  <pre className="p-3 text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                    {FORMAT_EXAMPLES[selectedFormat]}
                  </pre>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* Generate Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generar bibliografía</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bib-name">Nombre de la bibliografía</Label>
                <Input
                  id="bib-name"
                  placeholder="Mi bibliografía de investigación"
                  value={bibliographyName}
                  onChange={(e) => setBibliographyName(e.target.value)}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={generateBibliography}
                disabled={isGenerating || selectedArticles.length === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generar con {selectedArticles.length} artículos
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Saved Bibliographies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Mis bibliografías
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedBibliographies.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {savedBibliographies.map((bib) => (
                      <div
                        key={bib.id}
                        className="p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setGeneratedBibliography(bib)}
                      >
                        <p className="text-sm font-medium truncate">{bib.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {FORMAT_LABELS[bib.format]}
                          </Badge>
                  <span className="text-xs text-muted-foreground">
                    {(bib.articleCount ?? bib.articles.length)} artículos
                  </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay bibliografías guardadas</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Searches */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Búsquedas recientes
              </CardTitle>
              <CardDescription>Usa consultas previas para cargar artículos</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSearches.length > 0 ? (
                <ScrollArea className="h-[220px]">
                  <div className="space-y-2">
                    {recentSearches.slice(0, 8).map((search) => (
                      <div
                        key={search.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <p className="text-sm font-medium truncate">
                          {search.rawQuery}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {search.resultCount ?? '—'} resultados
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadFromHistory(search)}
                            disabled={isLoadingFromHistory}
                          >
                            {isLoadingFromHistory ? 'Cargando...' : 'Usar'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay búsquedas recientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
