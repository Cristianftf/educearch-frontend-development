'use client'

import React from "react"

import { useCallback, useEffect, useMemo, useReducer } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { EvidenceItem, VerificationResult, VerificationStatus } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ShieldCheck,
  ShieldQuestion,
  Link as LinkIcon,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  History,
  ExternalLink,
  Lightbulb,
  CheckCheck,
  CircleDashed,
  Bot,
} from 'lucide-react'
import { VerificationRecommendations } from '@/components/verification-recommendations'
import { useStudentVerify } from '@/hooks/use-student-verify'
import {
  type RequestLoadProfile,
  DEFAULT_REQUEST_LOAD_PROFILE,
  REQUEST_LOAD_PROFILE_LABELS,
  REQUEST_LOAD_PROFILE_DESCRIPTIONS,
  readStoredRequestLoadProfile,
  writeStoredRequestLoadProfile,
} from '@/lib/request-load-profile'
import { validateContentSourceUrl } from '@/lib/url-validation'

const statusConfig: Record<
  VerificationStatus,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  verified: {
    label: 'Evidencia solida encontrada',
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  conflicting: {
    label: 'Evidencia conflictiva',
    icon: ShieldQuestion,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  misinformation: {
    label: 'Posible desinformacion',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  pending: {
    label: 'Analizando...',
    icon: Loader2,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
}

const MAX_CLAIM_CHARACTERS = 1000

type EvidenceStance = 'support' | 'contradict' | 'neutral'

type EvidenceViewItem = EvidenceItem & {
  stance: EvidenceStance
  similarityPct: number
  reviewKey: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractClaimTerms(value: string, limit = 8): string[] {
  const terms = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
  const unique = new Set<string>()
  for (const term of terms) {
    unique.add(term)
    if (unique.size >= limit) break
  }
  return Array.from(unique)
}

function HighlightedSnippet({ snippet, terms }: { snippet: string; terms: string[] }): React.ReactNode {
  if (!snippet.trim()) {
    return 'Sin snippet disponible.'
  }
  if (terms.length === 0) {
    return snippet
  }
  const escapedTerms = terms.map((term) => escapeRegex(term))
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'ig')
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  for (const match of snippet.matchAll(regex)) {
    const matched = match[0]
    const start = match.index ?? -1
    if (start < 0) continue
    const end = start + matched.length
    if (start > lastIndex) {
      parts.push(
        <React.Fragment key={`snippet-part-${lastIndex}-${start}`}>
          {snippet.slice(lastIndex, start)}
        </React.Fragment>
      )
    }
    parts.push(
      <mark key={`snippet-match-${start}-${end}`} className="rounded-sm bg-warning/30 px-0.5">
        {snippet.slice(start, end)}
      </mark>
    )
    lastIndex = end
  }
  if (lastIndex < snippet.length) {
    parts.push(
      <React.Fragment key={`snippet-tail-${lastIndex}-${snippet.length}`}>
        {snippet.slice(lastIndex)}
      </React.Fragment>
    )
  }
  return <>{parts}</>
}

function getEvidenceStance(item: EvidenceItem): EvidenceStance {
  if (typeof item.supports === 'boolean') {
    return item.supports ? 'support' : 'contradict'
  }
  return 'neutral'
}

function getSemaphoreLevel(score: number): { label: 'Alto' | 'Medio' | 'Bajo'; className: string } {
  if (score >= 70) return { label: 'Alto', className: 'text-success border-success/40 bg-success/10' }
  if (score >= 40) return { label: 'Medio', className: 'text-warning border-warning/40 bg-warning/10' }
  return { label: 'Bajo', className: 'text-destructive border-destructive/40 bg-destructive/10' }
}

function hasUsefulAiExplanation(value: string): boolean {
  const normalized = value.replace(/\s+/g, ' ').trim().toLowerCase()
  if (!normalized || normalized.length < 40) return false
  return (
    !normalized.includes('no hay explicacion') &&
    !normalized.includes('no se pudo completar la verificacion') &&
    !normalized.includes('analizando') &&
    !normalized.includes('pending')
  )
}

type VerifyPageState = {
  requestLoadProfile: RequestLoadProfile
  inputMode: 'text' | 'url'
  claimText: string
  claimUrl: string
  error: string | null
  result: VerificationResult | null
  reviewedEvidenceKeys: string[]
}

type VerifyPageAction =
  | { type: 'patch'; patch: Partial<VerifyPageState> }
  | { type: 'toggle-reviewed'; reviewKey: string }
  | { type: 'reset-reviewed' }

const initialVerifyPageState: VerifyPageState = {
  requestLoadProfile: DEFAULT_REQUEST_LOAD_PROFILE,
  inputMode: 'text',
  claimText: '',
  claimUrl: '',
  error: null,
  result: null,
  reviewedEvidenceKeys: [],
}

function verifyPageReducer(state: VerifyPageState, action: VerifyPageAction): VerifyPageState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch }
    case 'toggle-reviewed':
      return state.reviewedEvidenceKeys.includes(action.reviewKey)
        ? {
            ...state,
            reviewedEvidenceKeys: state.reviewedEvidenceKeys.filter((value) => value !== action.reviewKey),
          }
        : {
            ...state,
            reviewedEvidenceKeys: [...state.reviewedEvidenceKeys, action.reviewKey],
          }
    case 'reset-reviewed':
      return { ...state, reviewedEvidenceKeys: [] }
    default:
      return state
  }
}

function EvidenceCard(props: {
  evidence: EvidenceViewItem
  claimTerms: string[]
  isReviewed: boolean
  onToggleReviewed: (reviewKey: string) => void
}) {
  const { evidence, claimTerms, isReviewed, onToggleReviewed } = props
  const stanceConfig =
    evidence.stance === 'support'
      ? { label: 'A favor', className: 'text-success border-success/40 bg-success/10' }
      : evidence.stance === 'contradict'
        ? { label: 'En contra', className: 'text-destructive border-destructive/40 bg-destructive/10' }
        : { label: 'Neutral', className: 'text-muted-foreground border-muted bg-muted/60' }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{evidence.title}</p>
        <Badge variant="outline" className={stanceConfig.className}>
          {stanceConfig.label}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        <HighlightedSnippet snippet={evidence.snippet} terms={claimTerms} />
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          Similitud: {evidence.similarityPct}%
        </Badge>
        <Badge variant="outline" className="text-xs">
          Relevancia: {Math.round(evidence.relevanceScore)}%
        </Badge>
        {typeof evidence.evidenceLevel === 'number' && (
          <Badge variant="secondary" className="text-xs">
            Nivel EBM: {evidence.evidenceLevel}
          </Badge>
        )}
        {typeof evidence.year === 'number' && (
          <Badge variant="secondary" className="text-xs">
            Ano: {evidence.year}
          </Badge>
        )}
        {evidence.studyType && (
          <Badge variant="secondary" className="text-xs">
            Tipo: {evidence.studyType}
          </Badge>
        )}
        {evidence.source && (
          <Badge variant="secondary" className="text-xs">
            {evidence.source}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant={isReviewed ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 px-2"
          onClick={() => onToggleReviewed(evidence.reviewKey)}
        >
          <CheckCheck className="h-3 w-3 mr-1" />
          {isReviewed ? 'Revisado' : 'Marcar revisado'}
        </Button>
        {evidence.sourceUrl && (
          <a
            href={evidence.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Articulo original
          </a>
        )}
      </div>
    </div>
  )
}

function VerificationResultSection(props: {
  safeResult: NonNullable<VerificationResult>
  semaphoreLevel: { label: 'Alto' | 'Medio' | 'Bajo'; className: string }
  supportScore: number
  evidenceItems: EvidenceViewItem[]
  reviewedCount: number
  sourceProviders: string[]
  supportEvidence: EvidenceViewItem[]
  neutralEvidence: EvidenceViewItem[]
  contradictEvidence: EvidenceViewItem[]
  reviewedEvidenceKeys: string[]
  claimTerms: string[]
  aiExplanationReady: boolean
  onToggleReviewed: (reviewKey: string) => void
  onSearchClick: (term: string) => void
}) {
  const { safeResult } = props
  const StatusIcon = statusConfig[safeResult.status].icon
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resultado de la verificacion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-4 p-6">
            <div className={`p-6 rounded-full ${statusConfig[safeResult.status].bgColor}`}>
              <StatusIcon
                className={`h-16 w-16 ${statusConfig[safeResult.status].color} ${
                  safeResult.status === 'pending' ? 'animate-spin' : ''
                }`}
              />
            </div>
            <div className="text-center">
              <h3 className={`text-xl font-semibold ${statusConfig[safeResult.status].color}`}>
                {statusConfig[safeResult.status].label}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-muted-foreground">Puntaje de veracidad:</span>
                <span className="text-2xl font-bold">{safeResult.score}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={safeResult.score} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Baja confiabilidad</span>
            <span>Alta confiabilidad</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted">
          <Label className="text-xs text-muted-foreground">Afirmacion analizada</Label>
          <p className="mt-1 text-sm">{safeResult.claim}</p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={props.semaphoreLevel.className}>
              Semaforo: {props.semaphoreLevel.label}
            </Badge>
            <Badge variant="outline">Soporte: {props.supportScore}%</Badge>
            <Badge variant="outline">Articulos: {props.evidenceItems.length}</Badge>
            <Badge variant="outline">Revisados: {props.reviewedCount}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Deteccion de postura por clasificacion y similitud semantica.
          </p>
          {props.sourceProviders.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Fuentes activas: {props.sourceProviders.join(' + ')}.
            </p>
          )}
        </div>

        <Tabs defaultValue="classification" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="classification">Clasificacion</TabsTrigger>
            <TabsTrigger value="articles">Articulos 5-10</TabsTrigger>
            <TabsTrigger value="review">Revision</TabsTrigger>
          </TabsList>

          <TabsContent value="classification" className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="border-success/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    A favor ({props.supportEvidence.length})
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                  {props.supportEvidence.slice(0, 5).map((evidence) => (
                    <EvidenceCard
                      key={evidence.reviewKey}
                      evidence={evidence}
                      claimTerms={props.claimTerms}
                      isReviewed={props.reviewedEvidenceKeys.includes(evidence.reviewKey)}
                      onToggleReviewed={props.onToggleReviewed}
                    />
                  ))}
                  {props.supportEvidence.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin evidencia clasificada a favor.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <CircleDashed className="h-4 w-4" />
                    Neutral ({props.neutralEvidence.length})
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                  {props.neutralEvidence.slice(0, 5).map((evidence) => (
                    <EvidenceCard
                      key={evidence.reviewKey}
                      evidence={evidence}
                      claimTerms={props.claimTerms}
                      isReviewed={props.reviewedEvidenceKeys.includes(evidence.reviewKey)}
                      onToggleReviewed={props.onToggleReviewed}
                    />
                  ))}
                  {props.neutralEvidence.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin evidencia neutral.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    En contra ({props.contradictEvidence.length})
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                  {props.contradictEvidence.slice(0, 5).map((evidence) => (
                    <EvidenceCard
                      key={evidence.reviewKey}
                      evidence={evidence}
                      claimTerms={props.claimTerms}
                      isReviewed={props.reviewedEvidenceKeys.includes(evidence.reviewKey)}
                      onToggleReviewed={props.onToggleReviewed}
                    />
                  ))}
                  {props.contradictEvidence.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin evidencia clasificada en contra.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="articles" className="space-y-3">
            {props.evidenceItems.length < 5 && (
              <p className="text-xs text-warning">
                Solo hay {props.evidenceItems.length} articulos visibles. El objetivo esperado es 5-10.
              </p>
            )}
            <div className="space-y-3">
              {props.evidenceItems.map((evidence) => (
                <EvidenceCard
                  key={evidence.reviewKey}
                  evidence={evidence}
                  claimTerms={props.claimTerms}
                  isReviewed={props.reviewedEvidenceKeys.includes(evidence.reviewKey)}
                  onToggleReviewed={props.onToggleReviewed}
                />
              ))}
            </div>
            {props.evidenceItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">
                No se recuperaron articulos con evidencia util en este intento.
              </p>
            )}
          </TabsContent>

          <TabsContent value="review" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Revisados: {props.reviewedCount}</Badge>
              <Badge variant="outline">Pendientes: {Math.max(0, props.evidenceItems.length - props.reviewedCount)}</Badge>
            </div>
            <div className="space-y-3">
              {props.evidenceItems
                .filter((item) => props.reviewedEvidenceKeys.includes(item.reviewKey))
                .map((evidence) => (
                  <EvidenceCard
                    key={evidence.reviewKey}
                    evidence={evidence}
                    claimTerms={props.claimTerms}
                    isReviewed
                    onToggleReviewed={props.onToggleReviewed}
                  />
                ))}
              {props.reviewedCount === 0 && (
                <p className="text-sm text-muted-foreground">Aun no has marcado articulos como revisados.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="border-primary/25 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Explicacion de la IA
            </CardTitle>
            <CardDescription>
              Resumen del analisis despues de procesar la evidencia captada en la verificacion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={props.aiExplanationReady ? 'secondary' : 'outline'}>
                {props.aiExplanationReady ? 'IA completada' : 'IA procesando'}
              </Badge>
              <Badge variant="outline">Estado: {statusConfig[safeResult.status].label}</Badge>
            </div>
            <p className="text-sm leading-relaxed">{safeResult.explanation}</p>
            {!props.aiExplanationReady && (
              <p className="text-xs text-muted-foreground">
                La IA sigue procesando la evidencia. Se muestra el mejor resultado disponible y se
                actualiza cuando llega la respuesta final.
              </p>
            )}
          </CardContent>
        </Card>

        <VerificationRecommendations
          result={safeResult}
          onSearchClick={props.onSearchClick}
        />
      </CardContent>
    </Card>
  )
}

function VerifySidebar(props: {
  verificationHistory: VerificationResult[]
  onSelectResult: (item: VerificationResult) => void
}) {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Consejos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Se especifico:</strong> Afirmaciones concretas generan mejores resultados.</p>
          <p><strong className="text-foreground">Incluye contexto:</strong> Menciona condiciones, tratamientos o poblaciones especificas.</p>
          <p><strong className="text-foreground">Evita opiniones:</strong> Enfocate en afirmaciones verificables sobre hechos medicos.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Verificaciones recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {props.verificationHistory.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {props.verificationHistory.map((item) => {
                  const StatusIcon = statusConfig[item.status].icon
                  return (
                    <button
                      key={item.id}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                      onClick={() => props.onSelectResult(item)}
                    >
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-4 w-4 mt-0.5 ${statusConfig[item.status].color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2">{item.claim}</p>
                          <p className="text-xs text-muted-foreground mt-1">Puntaje: {item.score}%</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay verificaciones recientes</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Piramide de evidencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-success" /><span>Nivel 1-2: Revisiones sistematicas</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-chart-1" /><span>Nivel 3-4: Ensayos clinicos</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-warning" /><span>Nivel 5-6: Estudios observacionales</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-destructive" /><span>Nivel 7+: Opinion de expertos</span></div>
          </div>
          <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm" asChild>
            <Link href="/student/pyramid">
              Ver piramide interactiva
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function VerifyPageHeader() {
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        Detector de infodemia
      </h1>
      <p className="text-muted-foreground mt-1">
        Verifica afirmaciones medicas contra la evidencia cientifica disponible
      </p>
    </div>
  )
}

function VerifyInputSection(props: {
  inputMode: 'text' | 'url'
  claimText: string
  claimUrl: string
  claimLength: number
  requestLoadProfile: RequestLoadProfile
  isVerifying: boolean
  urlValidation: { normalizedUrl?: string; error?: string }
  errorMessage: string | null | undefined
  onInputModeChange: (mode: 'text' | 'url') => void
  onClaimTextChange: (value: string) => void
  onClaimUrlChange: (value: string) => void
  onRequestLoadProfileChange: (value: RequestLoadProfile) => void
  onVerify: () => void
}) {
  const isVerifyDisabled =
    props.isVerifying ||
    (props.inputMode === 'text'
      ? !props.claimText.trim() || props.claimLength > MAX_CLAIM_CHARACTERS
      : !props.claimUrl.trim() || Boolean(props.urlValidation.error))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Verificar informacion</CardTitle>
        <CardDescription>
          Ingresa la afirmacion medica que deseas verificar o proporciona una URL
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={props.inputMode} onValueChange={(value) => props.onInputModeChange(value as 'text' | 'url')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="gap-2">
              <FileText className="h-4 w-4" />
              Texto
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-4 space-y-3">
            <div className="relative">
              <Textarea
                placeholder="Escribe o pega aqui la afirmacion medica que deseas verificar..."
                className="min-h-[150px] resize-none"
                value={props.claimText}
                onChange={(event) => props.onClaimTextChange(event.target.value)}
                maxLength={MAX_CLAIM_CHARACTERS}
                disabled={props.isVerifying}
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {props.claimLength}/{MAX_CLAIM_CHARACTERS} caracteres
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>URL del articulo o publicacion</Label>
              <Input
                type="url"
                placeholder="https://ejemplo.com/articulo-salud"
                value={props.claimUrl}
                onChange={(event) => props.onClaimUrlChange(event.target.value)}
                disabled={props.isVerifying}
              />
              {props.claimUrl.trim() && props.urlValidation.error && (
                <p className="text-xs text-destructive">{props.urlValidation.error}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Analizaremos el contenido de la pagina para extraer afirmaciones verificables
            </p>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <Label htmlFor="verify-load-profile">Carga de documentacion</Label>
          <Select value={props.requestLoadProfile} onValueChange={props.onRequestLoadProfileChange}>
            <SelectTrigger id="verify-load-profile">
              <SelectValue placeholder="Selecciona nivel de carga" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REQUEST_LOAD_PROFILE_LABELS) as RequestLoadProfile[]).map((profile) => (
                <SelectItem key={profile} value={profile}>
                  {REQUEST_LOAD_PROFILE_LABELS[profile]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {REQUEST_LOAD_PROFILE_DESCRIPTIONS[props.requestLoadProfile]}
          </p>
        </div>

        {props.errorMessage && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            {props.errorMessage}
          </div>
        )}

        <Button className="w-full" size="lg" onClick={props.onVerify} disabled={isVerifyDisabled}>
          {props.isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {props.inputMode === 'url' ? 'Analizando contenido de URL...' : 'Analizando afirmacion...'}
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {props.inputMode === 'url' ? 'Verificar contenido de URL' : 'Verificar afirmacion medica'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function VerifyPage() {
  const router = useRouter()
  const [state, dispatch] = useReducer(verifyPageReducer, initialVerifyPageState)
  const { requestLoadProfile, inputMode, claimText, claimUrl, error, result, reviewedEvidenceKeys } = state
  const patchState = useCallback((patch: Partial<VerifyPageState>) => dispatch({ type: 'patch', patch }), [])
  const {
    verifyClaim,
    verificationHistory,
    loadHistory,
    isVerifying,
    error: verifyError,
  } = useStudentVerify()

  useEffect(() => {
    loadHistory(1, 10)
  }, [loadHistory])

  useEffect(() => {
    const stored = readStoredRequestLoadProfile()
    patchState({ requestLoadProfile: stored })
  }, [patchState])

  useEffect(() => {
    writeStoredRequestLoadProfile(requestLoadProfile)
  }, [requestLoadProfile])

  const claimLength = claimText.length
  const urlValidation =
    inputMode !== 'url' || !claimUrl.trim()
      ? { normalizedUrl: undefined, error: undefined }
      : validateContentSourceUrl(claimUrl)

  const handleVerify = useCallback(async () => {
    const trimmedClaim = claimText.trim()
    const trimmedUrl = claimUrl.trim()

    if (inputMode === 'text' && !trimmedClaim) {
      patchState({ error: 'Por favor, ingresa una afirmacion para verificar' })
      return
    }

    if (inputMode === 'url' && !trimmedUrl) {
      patchState({ error: 'Por favor, ingresa una URL para verificar' })
      return
    }

    if (inputMode === 'text' && claimLength > MAX_CLAIM_CHARACTERS) {
      patchState({ error: `La afirmacion no puede exceder ${MAX_CLAIM_CHARACTERS} caracteres` })
      return
    }

    const validatedUrl = inputMode === 'url' ? validateContentSourceUrl(trimmedUrl) : null
    if (inputMode === 'url' && (!validatedUrl?.normalizedUrl || validatedUrl.error)) {
      patchState({ error: validatedUrl?.error || 'La URL no es valida para verificacion' })
      return
    }

    patchState({ error: null, result: null })

    try {
      const activityRunId = `verify-run-${Date.now()}`
      const verificationResult = await verifyClaim(
        inputMode === 'text' ? trimmedClaim : '',
        inputMode === 'url' ? validatedUrl?.normalizedUrl : undefined,
        { activityRunId, loadProfile: requestLoadProfile }
      )
      if (verificationResult) {
        patchState({ result: verificationResult })
        await loadHistory(1, 10)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al verificar. Intenta de nuevo mas tarde.'
      patchState({ error: message })
      console.error('[v0] Verification error:', err)
    }
  }, [inputMode, claimLength, claimText, claimUrl, verifyClaim, loadHistory, requestLoadProfile, patchState])

  const safeResult = result
    ? {
        ...result,
        supportingEvidence: Array.isArray(result.supportingEvidence) ? result.supportingEvidence : [],
        contradictingEvidence: Array.isArray(result.contradictingEvidence) ? result.contradictingEvidence : [],
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      }
    : null

  useEffect(() => {
    dispatch({ type: 'reset-reviewed' })
  }, [safeResult?.id])

  const claimTerms = extractClaimTerms(safeResult?.claim ?? '')

  const evidenceItems = useMemo<EvidenceViewItem[]>(() => {
    if (!safeResult) return []
    const merged = [...safeResult.supportingEvidence, ...safeResult.contradictingEvidence]
      .map((item, index) => {
        const similarityBase =
          typeof item.similarityScore === 'number' ? item.similarityScore * 100 : item.relevanceScore
        const similarityPct = clamp(Math.round(similarityBase), 0, 100)
        const stance = getEvidenceStance(item)
        const reviewKey = `${item.articleId || 'article'}-${item.sourceUrl || item.title}-${index + 1}`
        return {
          ...item,
          similarityPct,
          stance,
          reviewKey,
        }
      })
      .sort((left, right) => right.similarityPct - left.similarityPct)

    const seen = new Set<string>()
    const deduped: EvidenceViewItem[] = []
    for (const item of merged) {
      const key = `${item.articleId}|${item.title.toLowerCase()}|${(item.sourceUrl || '').toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
      if (deduped.length >= 10) break
    }
    return deduped
  }, [safeResult])

  const supportEvidence = evidenceItems.filter((item) => item.stance === 'support')
  const contradictEvidence = evidenceItems.filter((item) => item.stance === 'contradict')
  const neutralEvidence = evidenceItems.filter((item) => item.stance === 'neutral')

  const reviewedCount = evidenceItems.filter((item) => reviewedEvidenceKeys.includes(item.reviewKey)).length

  const sourceProviders = Array.from(
    new Set(evidenceItems.map((item) => item.source).filter((value): value is string => Boolean(value)))
  )

  const supportScore = safeResult ? clamp(Math.round(safeResult.score), 0, 100) : 0
  const semaphoreLevel = getSemaphoreLevel(supportScore)
  const aiExplanationReady = safeResult
    ? hasUsefulAiExplanation(safeResult.explanation) && safeResult.status !== 'pending'
    : false

  const toggleReviewed = useCallback((reviewKey: string) => {
    dispatch({ type: 'toggle-reviewed', reviewKey })
  }, [])

  return (
    <div className="space-y-6">
      <VerifyPageHeader />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <VerifyInputSection
            inputMode={inputMode}
            claimText={claimText}
            claimUrl={claimUrl}
            claimLength={claimLength}
            requestLoadProfile={requestLoadProfile}
            isVerifying={isVerifying}
            urlValidation={urlValidation}
            errorMessage={error || verifyError}
            onInputModeChange={(mode) => patchState({ inputMode: mode })}
            onClaimTextChange={(value) => patchState({ claimText: value })}
            onClaimUrlChange={(value) => patchState({ claimUrl: value })}
            onRequestLoadProfileChange={(value) => patchState({ requestLoadProfile: value })}
            onVerify={handleVerify}
          />

          {safeResult && (
            <VerificationResultSection
              safeResult={safeResult}
              semaphoreLevel={semaphoreLevel}
              supportScore={supportScore}
              evidenceItems={evidenceItems}
              reviewedCount={reviewedCount}
              sourceProviders={sourceProviders}
              supportEvidence={supportEvidence}
              neutralEvidence={neutralEvidence}
              contradictEvidence={contradictEvidence}
              reviewedEvidenceKeys={reviewedEvidenceKeys}
              claimTerms={claimTerms}
              aiExplanationReady={aiExplanationReady}
              onToggleReviewed={toggleReviewed}
              onSearchClick={(term) => {
                patchState({ claimText: term })
                router.push('/student/search')
              }}
            />
          )}
        </div>

        <VerifySidebar
          verificationHistory={verificationHistory}
          onSelectResult={(item) => patchState({ result: item })}
        />
      </div>
    </div>
  )
}
