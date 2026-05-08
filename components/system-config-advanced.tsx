"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

const numberOr = (value: unknown, fallback: number) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

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
      const typed = existing as Partial<Record<"novice" | "intermediate" | "advanced", unknown>>
      return {
        novice: numberOr(typed.novice, value),
        intermediate: numberOr(typed.intermediate, value),
        advanced: value,
      }
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

  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await adminSystemApi.getSettings()
      setApiConfig(response)
      setConfig(toUiConfig(response))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la configuración.")
      setConfig(DEFAULT_CONFIG)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)
    try {
      if (config.models.temperature < 0 || config.models.temperature > 2) {
        throw new Error("La temperatura debe estar entre 0 y 2.")
      }
      if (config.models.topP < 0 || config.models.topP > 1) {
        throw new Error("Top P debe estar entre 0 y 1.")
      }
      Object.entries(config.pedagogy.competencyThresholds).forEach(([key, value]) => {
        if (value < 0 || value > 100) {
          throw new Error(`El umbral de ${key} debe estar entre 0 y 100.`)
        }
      })

      const payload = toApiConfig(config, apiConfig)
      await adminSystemApi.updateSettings(payload)
      setApiConfig(payload)
      setSuccess("Configuración guardada correctamente.")
      window.setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestPubMed = async () => {
    setError(null)
    setConfig((prev) => ({ ...prev, pubmed: { ...prev.pubmed, testStatus: "testing" } }))
    try {
      const response = await adminSystemApi.testPubmedConnection()
      if (!response.success) {
        throw new Error(response.message || "No fue posible validar la conexión con PubMed.")
      }
      setConfig((prev) => ({ ...prev, pubmed: { ...prev.pubmed, testStatus: "success" } }))
      setSuccess("Conexión a PubMed verificada correctamente.")
    } catch (err) {
      setConfig((prev) => ({ ...prev, pubmed: { ...prev.pubmed, testStatus: "failed" } }))
      setError(err instanceof Error ? err.message : "Error al probar la conexión con PubMed.")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        Cargando configuración...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-700" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>PubMed</CardTitle>
          <CardDescription>Gestiona la conexión con PubMed y los límites operativos del servicio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API key de PubMed</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={config.pubmed.apiKey}
                  onChange={(event) => setConfig((prev) => ({ ...prev, pubmed: { ...prev.pubmed, apiKey: event.target.value } }))}
                  placeholder="Ingresa tu API key"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((visible) => !visible)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" onClick={handleTestPubMed} disabled={!config.pubmed.apiKey || config.pubmed.testStatus === "testing"}>
                {config.pubmed.testStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {config.pubmed.testStatus === "success" && <CheckCircle className="mr-2 h-4 w-4 text-green-600" />}
                {config.pubmed.testStatus === "failed" && <AlertCircle className="mr-2 h-4 w-4 text-red-600" />}
                Probar conexión
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.pubmed.testStatus === "success" && "Conexión verificada."}
              {config.pubmed.testStatus === "failed" && "La validación falló. Revisa la API key o el backend."}
              {config.pubmed.testStatus === "pending" && "Usa el botón de prueba para validar la configuración actual."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Límite diario: <span className="font-semibold">{config.pubmed.rateLimitPerDay.toLocaleString()}</span></Label>
            <Slider value={[config.pubmed.rateLimitPerDay]} onValueChange={(value) => setConfig((prev) => ({ ...prev, pubmed: { ...prev.pubmed, rateLimitPerDay: value[0] } }))} min={1000} max={50000} step={1000} />
          </div>

          <div className="space-y-2">
            <Label>Horas de caché: <span className="font-semibold">{config.pubmed.cacheHours} h</span></Label>
            <Slider value={[config.pubmed.cacheHours]} onValueChange={(value) => setConfig((prev) => ({ ...prev, pubmed: { ...prev.pubmed, cacheHours: value[0] } }))} min={1} max={168} step={1} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de IA</CardTitle>
          <CardDescription>Ajusta proveedor y parámetros del motor RAG usado por la plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model">Proveedor / modelo</Label>
            <Select value={config.models.ragModel} onValueChange={(value) => setConfig((prev) => ({ ...prev, models: { ...prev.models, ragModel: value } }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona un modelo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Temperatura: <Badge variant="outline">{config.models.temperature.toFixed(2)}</Badge></Label>
            <Slider value={[config.models.temperature]} onValueChange={(value) => setConfig((prev) => ({ ...prev, models: { ...prev.models, temperature: value[0] } }))} min={0} max={2} step={0.1} />
          </div>

          <div className="space-y-2">
            <Label>Top P: <Badge variant="outline">{config.models.topP.toFixed(2)}</Badge></Label>
            <Slider value={[config.models.topP]} onValueChange={(value) => setConfig((prev) => ({ ...prev, models: { ...prev.models, topP: value[0] } }))} min={0} max={1} step={0.05} />
          </div>

          <div className="space-y-2">
            <Label>Ventana de contexto: <Badge variant="outline">{config.models.contextWindow.toLocaleString()} tokens</Badge></Label>
            <Slider value={[config.models.contextWindow]} onValueChange={(value) => setConfig((prev) => ({ ...prev, models: { ...prev.models, contextWindow: value[0] } }))} min={2048} max={128000} step={2048} />
          </div>

          <div className="space-y-2">
            <Label>Máximo de tokens de salida: <Badge variant="outline">{config.models.maxTokens.toLocaleString()}</Badge></Label>
            <Slider value={[config.models.maxTokens]} onValueChange={(value) => setConfig((prev) => ({ ...prev, models: { ...prev.models, maxTokens: value[0] } }))} min={256} max={4096} step={256} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas pedagógicas</CardTitle>
          <CardDescription>Define umbrales de competencias y mensajes globales de retroalimentación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Umbrales de competencia</h3>
            {Object.entries(config.pedagogy.competencyThresholds).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <Label>{key.charAt(0).toUpperCase() + key.slice(1)}: <Badge variant="outline">{value}%</Badge></Label>
                <Slider value={[value]} onValueChange={(newValue) => setConfig((prev) => ({ ...prev, pedagogy: { ...prev.pedagogy, competencyThresholds: { ...prev.pedagogy.competencyThresholds, [key]: newValue[0] } } }))} min={0} max={100} step={5} />
              </div>
            ))}
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Mensajes de retroalimentación</h3>
            {Object.entries(config.pedagogy.feedbackMessages).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`feedback-${key}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                <Textarea
                  id={`feedback-${key}`}
                  value={value}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      pedagogy: {
                        ...prev.pedagogy,
                        feedbackMessages: { ...prev.pedagogy.feedbackMessages, [key]: event.target.value },
                      },
                    }))
                  }
                  rows={2}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={loadConfig}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Recargar
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </div>
  )
}
