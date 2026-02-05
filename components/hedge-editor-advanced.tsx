'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Code, CheckCircle2, AlertCircle, Play, Copy, Check } from 'lucide-react'
import type { SearchHedge } from '@/types'

interface HedgeEditorProps {
  hedge?: SearchHedge | null
  categories: string[]
  onSave: (hedge: Partial<SearchHedge>) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const MESH_PATTERNS = [
  { label: 'Término MeSH básico', example: '"Diabetes Mellitus"[MeSH]' },
  { label: 'Búsqueda de texto', example: '"tipo 2"[tiab]' },
  { label: 'Rango de fechas', example: '("2019"[PDAT] : "2024"[PDAT])' },
  { label: 'Operador AND', example: 'AND' },
  { label: 'Operador OR', example: 'OR' },
  { label: 'Operador NOT', example: 'NOT' },
]

export function HedgeEditor({
  hedge,
  categories,
  onSave,
  onCancel,
  isLoading = false,
}: HedgeEditorProps) {
  const [formData, setFormData] = useState<Partial<SearchHedge>>({
    name: hedge?.name || '',
    category: hedge?.category || categories[0] || '',
    query: hedge?.query || '',
    description: hedge?.description || '',
  })

  const [queryStatus, setQueryStatus] = useState<'valid' | 'invalid' | null>(null)
  const [copied, setCopied] = useState(false)
  const [estimatedResults, setEstimatedResults] = useState<number | null>(
    hedge?.estimatedResults || null
  )

  const validateQuery = useCallback((query: string) => {
    // Check for basic MeSH syntax patterns
    const hasMeSHTerms = /\[MeSH\]/i.test(query)
    const hasOperators = /\b(AND|OR|NOT)\b/i.test(query)
    const hasMinLength = query.length > 10

    if (hasMeSHTerms || (hasOperators && hasMinLength)) {
      setQueryStatus('valid')
    } else if (query.length > 0) {
      setQueryStatus('invalid')
    } else {
      setQueryStatus(null)
    }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const query = e.target.value
    setFormData((prev) => ({ ...prev, query }))
    validateQuery(query)
  }

  const addMeSHPattern = (pattern: string) => {
    const currentQuery = formData.query || ''
    setFormData((prev) => ({
      ...prev,
      query: currentQuery ? `${currentQuery} ${pattern}` : pattern,
    }))
    validateQuery(currentQuery ? `${currentQuery} ${pattern}` : pattern)
  }

  const simulateResults = useCallback(() => {
    // Simulación de consulta a backend
    const estimated = Math.floor(Math.random() * 5000) + 100
    setEstimatedResults(estimated)
  }, [])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formData.query || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (queryStatus === 'valid' && formData.name && formData.query) {
      await onSave(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre del Hedge</Label>
          <Input
            id="name"
            placeholder="Ej: Diabetes Mellitus - Tratamiento"
            value={formData.name || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="category">Categoría</Label>
          <Select
            value={formData.category || ''}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, category: value }))
            }
            disabled={isLoading}
          >
            <SelectTrigger id="category">
              <SelectValue />
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

      {/* Description */}
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          placeholder="Describe brevemente para qué sirve este hedge..."
          value={formData.description || ''}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          disabled={isLoading}
          className="min-h-[80px]"
        />
      </div>

      {/* Query Builder Section */}
      <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <Label className="font-medium">Estrategia de Búsqueda (PubMed Query)</Label>
          </div>
          {queryStatus && (
            <div className="flex items-center gap-1 text-xs">
              {queryStatus === 'valid' ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-success">Válida</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">Sintaxis incompleta</span>
                </>
              )}
            </div>
          )}
        </div>

        <Textarea
          placeholder="Ej: Diabetes OR hypertension"
          value={formData.query || ''}
          onChange={handleQueryChange}
          disabled={isLoading}
          className="min-h-[120px] font-mono text-xs"
        />

        {/* Quick Patterns */}
        <div>
          <p className="text-xs font-medium mb-2">Patrones rápidos:</p>
          <div className="flex flex-wrap gap-2">
            {MESH_PATTERNS.map((pattern) => (
              <Button
                key={pattern.label}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => addMeSHPattern(pattern.example)}
                title={pattern.label}
                disabled={isLoading}
              >
                + {pattern.example.substring(0, 15)}...
              </Button>
            ))}
          </div>
        </div>

        {/* Copy and Validate */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            disabled={!formData.query || isLoading}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={simulateResults}
            disabled={!formData.query || queryStatus !== 'valid' || isLoading}
          >
            <Play className="h-3 w-3 mr-1" />
            Simular búsqueda
          </Button>
        </div>

        {/* Simulation Results */}
        {estimatedResults && (
          <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Búsqueda estimada retornaría aproximadamente <strong>{estimatedResults}</strong>{' '}
              artículos
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Statistics (if hedge exists) */}
      {hedge && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Precisión</p>
              <p className="text-2xl font-bold text-primary">{hedge.precision}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Cobertura (Recall)</p>
              <p className="text-2xl font-bold text-success">{hedge.recall}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Resultados típicos</p>
              <p className="text-2xl font-bold">{hedge.estimatedResults}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={queryStatus !== 'valid' || !formData.name || isLoading}
        >
          {isLoading ? 'Guardando...' : hedge ? 'Actualizar' : 'Crear'} Hedge
        </Button>
      </div>
    </form>
  )
}
