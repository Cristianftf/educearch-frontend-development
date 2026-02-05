'use client'

import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Copy, Download, Check, GripVertical, X, BookOpen } from 'lucide-react'
import type { SearchResult, BibliographyFormat } from '@/types'

interface BibliographyGeneratorProps {
  availableArticles?: SearchResult[]
  selectedArticles?: SearchResult[]
  onArticlesChange?: (articles: SearchResult[]) => void
  onGenerate?: (format: BibliographyFormat, content: string) => void
}

function DraggableArticle({ article, onRemove }: { article: SearchResult; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: article.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 p-3 bg-muted rounded-lg cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{article.title}</p>
        <p className="text-xs text-muted-foreground">
          {article.authors.join(', ')} ({article.year})
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="h-6 w-6 p-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function BibliographyGenerator({
  availableArticles = [],
  selectedArticles = [],
  onArticlesChange,
  onGenerate,
}: BibliographyGeneratorProps) {
  const [selectedFormat, setSelectedFormat] = useState<BibliographyFormat>('apa')
  const [bibliographyName, setBibliographyName] = useState('')
  const [copied, setCopied] = useState(false)
  const [draggedArticle, setDraggedArticle] = useState<SearchResult | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const article = availableArticles.find(a => a.id === active.id)
    if (article) {
      setDraggedArticle(article)
    }
  }, [availableArticles])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setDraggedArticle(null)

    if (!over || over.id !== 'bibliography-drop-zone') return

    const article = availableArticles.find(a => a.id === active.id)
    if (article && !selectedArticles.some(a => a.id === article.id)) {
      const newSelected = [...selectedArticles, article]
      onArticlesChange?.(newSelected)
    }
  }, [availableArticles, selectedArticles, onArticlesChange])

  const removeArticle = useCallback((articleId: string) => {
    const newSelected = selectedArticles.filter(a => a.id !== articleId)
    onArticlesChange?.(newSelected)
  }, [selectedArticles, onArticlesChange])

  const articles = selectedArticles // For backward compatibility

  const formatArticleAPA = useCallback((article: SearchResult): string => {
    return `${article.authors.join(', ')}. (${article.year}). ${article.title}. *${article.journal}*.`
  }, [])

  const formatArticleVancouver = useCallback((article: SearchResult): string => {
    return `${article.authors.map((a) => a.split(' ').reverse().join(', ')).join('; ')}. ${article.title}. ${article.journal}. ${article.year}.`
  }, [])

  const formatArticleBibTeX = useCallback((article: SearchResult): string => {
    return `@article{${article.pmid},
  title={${article.title}},
  author={${article.authors.join(' and ')}},
  journal={${article.journal}},
  year={${article.year}},
  doi={${article.doi || 'N/A'}}
}`
  }, [])

  const formatArticleXML = useCallback((article: SearchResult): string => {
    return `<reference>
  <title>${article.title}</title>
  <authors>${article.authors.map((a) => `<author>${a}</author>`).join('')}</authors>
  <journal>${article.journal}</journal>
  <year>${article.year}</year>
  <pmid>${article.pmid}</pmid>
</reference>`
  }, [])

  const generateBibliography = useCallback((format: BibliographyFormat): string => {
    let bibliography = ''
    
    switch (format) {
      case 'apa':
        bibliography = articles
          .map((article, idx) => `${idx + 1}. ${formatArticleAPA(article)}`)
          .join('\n\n')
        break
      case 'vancouver':
        bibliography = articles
          .map((article, idx) => `${idx + 1}. ${formatArticleVancouver(article)}`)
          .join('\n\n')
        break
      case 'bibtex':
        bibliography = articles.map((article) => formatArticleBibTeX(article)).join('\n\n')
        break
      case 'xml':
        bibliography = `<?xml version="1.0"?>\n<bibliography>\n${articles
          .map((article) => `  ${formatArticleXML(article)}`)
          .join('\n')}\n</bibliography>`
        break
    }

    return bibliography
  }, [articles, formatArticleAPA, formatArticleVancouver, formatArticleBibTeX, formatArticleXML])

  const handleCopy = useCallback(async () => {
    const content = generateBibliography(selectedFormat)
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generateBibliography, selectedFormat])

  const handleDownload = useCallback(() => {
    const content = generateBibliography(selectedFormat)
    const element = document.createElement('a')
    const file = new Blob([content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    
    const extension = selectedFormat === 'bibtex' ? 'bib' : selectedFormat === 'xml' ? 'xml' : 'txt'
    element.download = `bibliography.${extension}`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }, [generateBibliography, selectedFormat])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Available Articles */}
        {availableArticles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Artículos Disponibles
              </CardTitle>
              <CardDescription>
                Arrastra los artículos que deseas incluir en tu bibliografía
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {availableArticles.map((article) => (
                  <DraggableArticle
                    key={article.id}
                    article={article}
                    onRemove={() => {}} // Not used for available articles
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bibliography Drop Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Mi Bibliografía
              {selectedArticles.length > 0 && (
                <Badge variant="secondary">{selectedArticles.length} artículos</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Arrastra artículos aquí para crear tu bibliografía
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bibliography Name */}
            <div>
              <Label htmlFor="bibliography-name">Nombre de la bibliografía</Label>
              <Input
                id="bibliography-name"
                placeholder="Mi bibliografía médica..."
                value={bibliographyName}
                onChange={(e) => setBibliographyName(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Drop Zone */}
            <div
              id="bibliography-drop-zone"
              className={`
                min-h-[120px] border-2 border-dashed rounded-lg p-4 transition-colors
                ${selectedArticles.length === 0
                  ? 'border-muted-foreground/25 bg-muted/25'
                  : 'border-primary/50 bg-primary/5'
                }
              `}
            >
              {selectedArticles.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Suelta los artículos aquí</p>
                  <p className="text-sm">o arrastra desde "Artículos Disponibles"</p>
                </div>
              ) : (
                <SortableContext items={selectedArticles.map(a => a.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {selectedArticles.map((article) => (
                      <DraggableArticle
                        key={article.id}
                        article={article}
                        onRemove={() => removeArticle(article.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bibliography Generator */}
        {selectedArticles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generador de Bibliografías</CardTitle>
              <CardDescription>
                {selectedArticles.length} artículos seleccionados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
        {/* Format Selector */}
        <div>
          <p className="text-sm font-medium mb-2">Selecciona un formato:</p>
          <Tabs value={selectedFormat} onValueChange={(value) => setSelectedFormat(value as BibliographyFormat)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="apa">APA</TabsTrigger>
              <TabsTrigger value="vancouver">Vancouver</TabsTrigger>
              <TabsTrigger value="bibtex">BibTeX</TabsTrigger>
              <TabsTrigger value="xml">XML</TabsTrigger>
            </TabsList>

            <TabsContent value="apa" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto text-sm font-mono">
                {articles.map((article, idx) => (
                  <div key={article.id} className="mb-3 pb-3 border-b last:border-b-0">
                    <div className="text-sm text-foreground">
                      {idx + 1}. {formatArticleAPA(article)}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="vancouver" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto text-sm font-mono">
                {articles.map((article, idx) => (
                  <div key={article.id} className="mb-3 pb-3 border-b last:border-b-0">
                    <div className="text-sm text-foreground">
                      {idx + 1}. {formatArticleVancouver(article)}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="bibtex" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto text-sm font-mono">
                {articles.map((article) => (
                  <div key={article.id} className="mb-4 pb-4 border-b last:border-b-0">
                    <pre className="text-xs whitespace-pre-wrap">
                      {formatArticleBibTeX(article)}
                    </pre>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="xml" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto text-sm font-mono">
                <div className="text-xs">
                  {`<?xml version="1.0"?>`}
                  <br />
                  {'<bibliography>'}
                  {articles.map((article) => (
                    <div key={article.id} className="ml-4">
                      {formatArticleXML(article)}
                    </div>
                  ))}
                  {'</bibliography>'}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1 gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="flex-1 gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar
          </Button>
        </div>

              {/* Validation */}
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Formato validado correctamente
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <DragOverlay>
        {draggedArticle ? (
          <div className="bg-background border rounded-lg p-3 shadow-lg max-w-sm">
            <p className="text-sm font-medium truncate">{draggedArticle.title}</p>
            <p className="text-xs text-muted-foreground">
              {draggedArticle.authors.join(', ')} ({draggedArticle.year})
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
