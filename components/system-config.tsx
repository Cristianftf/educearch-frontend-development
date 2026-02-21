'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { SystemSettings } from '@/types'

interface SystemConfigProps {
  settings: SystemSettings | null
  onSave?: (settings: Partial<SystemSettings>) => Promise<void>
}

export function SystemConfig({ settings, onSave }: SystemConfigProps) {
  const [formData, setFormData] = useState(settings || {
    pubmedApiKey: '',
    pubmedRateLimit: 3,
    cacheDuration: 3600,
    aiModel: 'meditron',
    aiTemperature: 0.7,
    aiTopP: 0.9,
    competencyThresholds: {
      access: { novice: 40, intermediate: 70, advanced: 90 },
      process: { novice: 40, intermediate: 70, advanced: 90 },
      communicate: { novice: 40, intermediate: 70, advanced: 90 },
    },
  })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave?.(formData)
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar la configuración' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    // Simular prueba de conexión
    setTimeout(() => {
      setMessage({ type: 'success', text: 'Conexión con PubMed exitosa' })
      setTestingConnection(false)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de PubMed API</CardTitle>
          <CardDescription>Gestiona la conexión con PubMed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={formData.pubmedApiKey}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, pubmedApiKey: e.target.value }))
              }
              placeholder="Ingresa tu API key de PubMed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate-limit">
              Rate Limit (llamadas por segundo): {formData.pubmedRateLimit}
            </Label>
            <Slider
              id="rate-limit"
              min={1}
              max={10}
              step={0.5}
              value={[formData.pubmedRateLimit]}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, pubmedRateLimit: value[0] }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cache-duration">
              Cache Duration (segundos): {formData.cacheDuration}
            </Label>
            <Select
              value={formData.cacheDuration.toString()}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, cacheDuration: parseInt(value) }))
              }
            >
              <SelectTrigger id="cache-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">5 minutos</SelectItem>
                <SelectItem value="1800">30 minutos</SelectItem>
                <SelectItem value="3600">1 hora</SelectItem>
                <SelectItem value="86400">1 día</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleTestConnection}
              variant="outline"
              disabled={testingConnection}
            >
              {testingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Probando...
                </>
              ) : (
                'Probar Conexión'
              )}
            </Button>
            <Badge variant="outline" className="ml-auto">
              Llamadas disponibles: 9,850/10,000
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* AI Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Modelos IA</CardTitle>
          <CardDescription>Ajusta parámetros de los modelos de lenguaje</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-model">Modelo RAG</Label>
            <Select value={formData.aiModel} onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, aiModel: value }))
            }>
              <SelectTrigger id="ai-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meditron">Meditron (Especializado en Medicina)</SelectItem>
                <SelectItem value="llama2-med">Llama2-Med</SelectItem>
                <SelectItem value="biogpt">BioGPT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Temperature (Creatividad): {formData.aiTemperature.toFixed(2)}</Label>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={[formData.aiTemperature]}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, aiTemperature: value[0] }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Más alto = más creativo, más bajo = más determinístico
            </p>
          </div>

          <div className="space-y-2">
            <Label>Top-P (Diversidad): {formData.aiTopP.toFixed(2)}</Label>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={[formData.aiTopP]}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, aiTopP: value[0] }))
              }
            />
          </div>

          <Button variant="outline" className="w-full">
            Evaluar Modelo Actual
          </Button>
        </CardContent>
      </Card>

      {/* Pedagogical Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración Pedagógica</CardTitle>
          <CardDescription>Define umbrales de competencia y puntuaciones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(formData.competencyThresholds).map(([competency, thresholds]) => (
            <div key={competency} className="space-y-3 p-3 bg-muted rounded-lg">
              <h4 className="font-medium capitalize">
                {competency === 'access' && 'Acceso'}
                {competency === 'process' && 'Procesamiento'}
                {competency === 'communicate' && 'Comunicación'}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Novato</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.novice}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        competencyThresholds: {
                          ...prev.competencyThresholds,
                          [competency]: { ...thresholds, novice: parseInt(e.target.value) },
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Intermedio</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.intermediate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        competencyThresholds: {
                          ...prev.competencyThresholds,
                          [competency]: { ...thresholds, intermediate: parseInt(e.target.value) },
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Avanzado</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.advanced}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        competencyThresholds: {
                          ...prev.competencyThresholds,
                          [competency]: { ...thresholds, advanced: parseInt(e.target.value) },
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Messages */}
      {message && (
        <Card className={message.type === 'success' ? 'border-green-200 bg-green-50/10' : 'border-red-200 bg-red-50/10'}>
          <CardContent className="pt-6 flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span>{message.text}</span>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full">
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar Configuración'
        )}
      </Button>
    </div>
  )
}
