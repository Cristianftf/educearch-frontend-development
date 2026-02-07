"use client"

import { useState, useCallback, useEffect } from "react"
import { Loader2, AlertCircle, CheckCircle, Eye, EyeOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { adminSystemApi } from "@/lib/admin-system"
import type { AdminSystemConfiguration } from "@/types"

interface SystemConfig {
  pubmed: {
    apiKey: string
    rateLimitPerDay: number
    cacheHours: number
    testStatus?: "pending" | "testing" | "success" | "failed"
  }
  models: {
    ragModel: string
    temperature: number
    topP: number
    contextWindow: number
    maxTokens: number
  }
  pedagogy: {
    competencyThresholds: {
      access: number
      process: number
      communicate: number
    }
    feedbackMessages: {
      excellent: string
      good: string
      fair: string
      poor: string
    }
  }
}

const DEFAULT_CONFIG: SystemConfig = {
  pubmed: {
    apiKey: "",
    rateLimitPerDay: 10000,
    cacheHours: 24,
    testStatus: "pending",
  },
  models: {
    ragModel: "gpt-4",
    temperature: 0.7,
    topP: 0.9,
    contextWindow: 4096,
    maxTokens: 2048,
  },
  pedagogy: {
    competencyThresholds: {
      access: 70,
      process: 75,
      communicate: 80,
    },
    feedbackMessages: {
      excellent: "Excelente desempeño",
      good: "Buen trabajo",
      fair: "Necesitas mejorar",
      poor: "Requiere atención",
    },
  },
}

const numberOr = (value: unknown, fallback: number) =>
  typeof value === "number" && !Number.isNaN(value) ? value : fallback

const pickThreshold = (value: unknown, fallback: number) => {
  if (typeof value === "number") return value
  if (value && typeof value === "object" && "advanced" in value) {
    const advanced = (value as { advanced?: number }).advanced
    return numberOr(advanced, fallback)
  }
  return fallback
}

const toUiConfig = (apiConfig?: AdminSystemConfiguration | null): SystemConfig => {
  const pubmed = apiConfig?.pubmed ?? {}
  const rag = apiConfig?.rag ?? {}
  const pedagogical = apiConfig?.pedagogical ?? {}
  const thresholds = (pedagogical.competencyThresholds ?? {}) as Record<string, unknown>
  const feedback = pedagogical.feedbackMessages ?? DEFAULT_CONFIG.pedagogy.feedbackMessages
  const cacheTTLSeconds = numberOr(pubmed.cacheTTL, DEFAULT_CONFIG.pubmed.cacheHours * 3600)

  return {
    pubmed: {
      apiKey: String(pubmed.apiKey ?? ""),
      rateLimitPerDay: numberOr(pubmed.rateLimitPerDay, DEFAULT_CONFIG.pubmed.rateLimitPerDay),
      cacheHours: Math.max(1, Math.round(cacheTTLSeconds / 3600)),
      testStatus: "pending",
    },
    models: {
      ragModel: String(rag.modelProvider ?? DEFAULT_CONFIG.models.ragModel),
      temperature: numberOr(rag.temperature, DEFAULT_CONFIG.models.temperature),
      topP: numberOr(rag.topP, DEFAULT_CONFIG.models.topP),
      contextWindow: numberOr(rag.contextWindow, DEFAULT_CONFIG.models.contextWindow),
      maxTokens: numberOr(rag.maxTokens, DEFAULT_CONFIG.models.maxTokens),
    },
    pedagogy: {
      competencyThresholds: {
        access: pickThreshold(thresholds.access, DEFAULT_CONFIG.pedagogy.competencyThresholds.access),
        process: pickThreshold(thresholds.process, DEFAULT_CONFIG.pedagogy.competencyThresholds.process),
        communicate: pickThreshold(thresholds.communicate, DEFAULT_CONFIG.pedagogy.competencyThresholds.communicate),
      },
      feedbackMessages: {
        excellent: feedback.excellent ?? DEFAULT_CONFIG.pedagogy.feedbackMessages.excellent,
        good: feedback.good ?? DEFAULT_CONFIG.pedagogy.feedbackMessages.good,
        fair: feedback.fair ?? DEFAULT_CONFIG.pedagogy.feedbackMessages.fair,
        poor: feedback.poor ?? DEFAULT_CONFIG.pedagogy.feedbackMessages.poor,
      },
    },
  }
}

const toApiConfig = (uiConfig: SystemConfig, base?: AdminSystemConfiguration | null): AdminSystemConfiguration => {
  const basePubmed = base?.pubmed ?? {}
  const baseRag = base?.rag ?? {}
  const basePedagogical = base?.pedagogical ?? {}
  const baseThresholds = (basePedagogical.competencyThresholds ?? {}) as Record<string, unknown>

  const mergeThreshold = (key: "access" | "process" | "communicate", value: number) => {
    const existing = baseThresholds[key]
    if (existing && typeof existing === "object") {
      return { ...(existing as object), advanced: value }
    }
    return value
  }

  return {
    ...base,
    pubmed: {
      ...basePubmed,
      apiKey: uiConfig.pubmed.apiKey,
      cacheTTL: Math.round(uiConfig.pubmed.cacheHours * 3600),
      rateLimitPerDay: uiConfig.pubmed.rateLimitPerDay,
    },
    rag: {
      ...baseRag,
      modelProvider: uiConfig.models.ragModel,
      temperature: uiConfig.models.temperature,
      topP: uiConfig.models.topP,
      maxTokens: uiConfig.models.maxTokens,
      contextWindow: uiConfig.models.contextWindow,
    },
    pedagogical: {
      ...basePedagogical,
      competencyThresholds: {
        ...baseThresholds,
        access: mergeThreshold("access", uiConfig.pedagogy.competencyThresholds.access),
        process: mergeThreshold("process", uiConfig.pedagogy.competencyThresholds.process),
        communicate: mergeThreshold("communicate", uiConfig.pedagogy.competencyThresholds.communicate),
      },
      feedbackMessages: {
        ...(basePedagogical.feedbackMessages ?? {}),
        ...uiConfig.pedagogy.feedbackMessages,
      },
    },
  }
}

export function SystemConfigAdvanced() {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG)
  const [apiConfig, setApiConfig] = useState<AdminSystemConfiguration | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load config from backend
  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await adminSystemApi.getSettings()
      setApiConfig(response)
      setConfig(toUiConfig(response))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar configuración"
      )
      setConfig(DEFAULT_CONFIG)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Save config to backend
  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      // Validate required fields
      if (!config.pubmed.apiKey) {
        throw new Error("API Key de PubMed es requerida")
      }
      if (config.models.temperature < 0 || config.models.temperature > 2) {
        throw new Error("Temperatura debe estar entre 0 y 2")
      }
      if (config.models.topP < 0 || config.models.topP > 1) {
        throw new Error("Top P debe estar entre 0 y 1")
      }

      // Validate thresholds
      Object.entries(config.pedagogy.competencyThresholds).forEach(([key, value]) => {
        if (value < 0 || value > 100) {
          throw new Error(`Threshold de ${key} debe estar entre 0 y 100`)
        }
      })

      const payload = toApiConfig(config, apiConfig)
      await adminSystemApi.updateSettings(payload)
      setApiConfig(payload)
      setSuccess("âœ… Configuración guardada exitosamente")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setIsSaving(false)
    }
  }

  // Test PubMed API
  const handleTestPubMed = async () => {
    setError(null)
    setConfig((prev) => ({
      ...prev,
      pubmed: { ...prev.pubmed, testStatus: "testing" },
    }))

    try {
      const response = await adminSystemApi.testPubmedConnection()

      if (response.success) {
        setConfig((prev) => ({
          ...prev,
          pubmed: { ...prev.pubmed, testStatus: "success" },
        }))
        setSuccess("âœ… Conexión a PubMed verificada")
      } else {
        throw new Error("Conexión fallida")
      }
    } catch (err) {
      setConfig((prev) => ({
        ...prev,
        pubmed: { ...prev.pubmed, testStatus: "failed" },
      }))
      setError(
        err instanceof Error ? err.message : "Error al probar conexión"
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        Cargando configuración...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-700" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* PubMed Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de PubMed API</CardTitle>
          <CardDescription>
            Gestiona la conexión a PubMed y límites de uso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key de PubMed *</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={config.pubmed.apiKey}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      pubmed: { ...prev.pubmed, apiKey: e.target.value },
                    }))
                  }
                  placeholder="Ingresa tu API Key"
                  className="pr-10"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                onClick={handleTestPubMed}
                disabled={!config.pubmed.apiKey || config.pubmed.testStatus === "testing"}
                className="gap-2"
              >
                {config.pubmed.testStatus === "testing" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {config.pubmed.testStatus === "success" && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
                {config.pubmed.testStatus === "failed" && (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                Probar
              </Button>
            </div>
            <p className="text-xs text-gray-600">
              {config.pubmed.testStatus === "success" && "âœ… Conexión verificada"}
              {config.pubmed.testStatus === "failed" && "âŒ Conexión fallida - revisa tu API Key"}
              {config.pubmed.testStatus === "pending" && "Haz click en Probar para verificar la conexión"}
            </p>
          </div>

          {/* Rate Limit */}
          <div className="space-y-2">
            <Label htmlFor="rate-limit">
              Límite de Llamadas por Día: <span className="font-semibold">{config.pubmed.rateLimitPerDay.toLocaleString()}</span>
            </Label>
            <Slider
              value={[config.pubmed.rateLimitPerDay]}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  pubmed: { ...prev.pubmed, rateLimitPerDay: value[0] },
                }))
              }
              min={1000}
              max={50000}
              step={1000}
              className="w-full"
            />
            <p className="text-xs text-gray-600">
              Establece un límite diario para evitar sobrecuotas
            </p>
          </div>

          {/* Cache Hours */}
          <div className="space-y-2">
            <Label htmlFor="cache-hours">
              Horas de Cache: <span className="font-semibold">{config.pubmed.cacheHours}h</span>
            </Label>
            <Slider
              value={[config.pubmed.cacheHours]}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  pubmed: { ...prev.pubmed, cacheHours: value[0] },
                }))
              }
              min={1}
              max={168}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-gray-600">
              Tiempo que se guardan resultados en caché (1-168 horas)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Models Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Modelos IA</CardTitle>
          <CardDescription>
            Ajusta parámetros de los modelos de lenguaje
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Modelo RAG</Label>
            <Select value={config.models.ragModel} onValueChange={(value) =>
              setConfig((prev) => ({
                ...prev,
                models: { ...prev.models, ragModel: value },
              }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4 (más preciso)</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo (balanceado)</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (rápido)</SelectItem>
                <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Label htmlFor="temperature">
              Temperature (Creatividad): <Badge variant="outline">{config.models.temperature.toFixed(2)}</Badge>
            </Label>
            <Slider
              value={[config.models.temperature]}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  models: { ...prev.models, temperature: value[0] },
                }))
              }
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-gray-600">
              0 = determinístico, 1 = balanceado, 2 = muy creativo
            </p>
          </div>

          {/* Top P */}
          <div className="space-y-2">
            <Label htmlFor="top-p">
              Top P (Diversidad): <Badge variant="outline">{config.models.topP.toFixed(2)}</Badge>
            </Label>
            <Slider
              value={[config.models.topP]}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  models: { ...prev.models, topP: value[0] },
                }))
              }
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
            <p className="text-xs text-gray-600">
              Controla la diversidad de respuestas (0-1)
            </p>
          </div>

          {/* Context Window */}
          <div className="space-y-2">
            <Label>
              Context Window: <Badge variant="outline">{config.models.contextWindow.toLocaleString()} tokens</Badge>
            </Label>
            <Slider
              value={[config.models.contextWindow]}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  models: { ...prev.models, contextWindow: value[0] },
                }))
              }
              min={2048}
              max={128000}
              step={2048}
              className="w-full"
            />
            <p className="text-xs text-gray-600">
              Máximo de tokens que el modelo puede procesar
            </p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label>
              Max Tokens de Salida: <Badge variant="outline">{config.models.maxTokens.toLocaleString()}</Badge>
            </Label>
            <Slider
              value={[config.models.maxTokens]}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  models: { ...prev.models, maxTokens: value[0] },
                }))
              }
              min={256}
              max={4096}
              step={256}
              className="w-full"
            />
            <p className="text-xs text-gray-600">
              Máximo de tokens que generará el modelo en respuestas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pedagogical Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración Pedagógica</CardTitle>
          <CardDescription>
            Define umbrales de competencia y mensajes de feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Competency Thresholds */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Umbrales de Competencia</h3>
            {Object.entries(config.pedagogy.competencyThresholds).map(
              ([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label>
                    {key.charAt(0).toUpperCase() + key.slice(1)}: <Badge variant="outline">{value}%</Badge>
                  </Label>
                  <Slider
                    value={[value]}
                    onValueChange={(newValue) =>
                      setConfig((prev) => ({
                        ...prev,
                        pedagogy: {
                          ...prev.pedagogy,
                          competencyThresholds: {
                            ...prev.pedagogy.competencyThresholds,
                            [key]: newValue[0],
                          },
                        },
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-600">
                    Puntuación mínima para considerar esta competencia como dominada
                  </p>
                </div>
              )
            )}
          </div>

          {/* Feedback Messages */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Mensajes de Feedback</h3>
            {Object.entries(config.pedagogy.feedbackMessages).map(
              ([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`feedback-${key}`}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Label>
                  <Textarea
                    id={`feedback-${key}`}
                    value={value}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pedagogy: {
                          ...prev.pedagogy,
                          feedbackMessages: {
                            ...prev.pedagogy.feedbackMessages,
                            [key]: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder={`Mensaje de feedback para ${key}`}
                    rows={2}
                  />
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={loadConfig}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Recargar
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>
    </div>
  )
}
