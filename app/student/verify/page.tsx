'use client'

import React from "react"

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { VerificationResult, VerificationStatus } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Link as LinkIcon,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  ArrowRight,
  History,
  ExternalLink,
  Lightbulb,
} from 'lucide-react'
import { VerificationRecommendations } from '@/components/verification-recommendations'
import { useStudentVerify } from '@/hooks/use-student-verify'

const statusConfig: Record<
  VerificationStatus,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  verified: {
    label: 'Evidencia sÃ³lida encontrada',
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
    label: 'Posible desinformaciÃ³n',
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

export default function VerifyPage() {
  const router = useRouter()
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text')
  const [claimText, setClaimText] = useState('')
  const [claimUrl, setClaimUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerificationResult | null>(null)
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

  const handleVerify = useCallback(async () => {
    const claim = inputMode === 'text' ? claimText : claimUrl

    if (!claim.trim()) {
      setError('Por favor, ingresa un claim o URL para verificar')
      return
    }

    if (inputMode === 'text' && claim.split(' ').length > 500) {
      setError('El claim no puede exceder 500 palabras')
      return
    }

    setError(null)
    setResult(null)

    try {
      const verificationResult = await verifyClaim(
        inputMode === 'text' ? claim : '',
        inputMode === 'url' ? claim : undefined
      )
      if (verificationResult) {
        setResult(verificationResult)
        await loadHistory(1, 10)
      }
    } catch (err) {
      setError('Error al verificar. Intenta de nuevo más tarde.')
      console.error('[v0] Verification error:', err)
    }
  }, [inputMode, claimText, claimUrl, verifyClaim, loadHistory])
  const wordCount = claimText.split(/\s+/).filter(Boolean).length

  const safeResult = result ? { ...result, supportingEvidence: Array.isArray(result.supportingEvidence) ? result.supportingEvidence : [], contradictingEvidence: Array.isArray(result.contradictingEvidence) ? result.contradictingEvidence : [], recommendations: Array.isArray(result.recommendations) ? result.recommendations : [] } : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          Infodemia Detector
        </h1>
        <p className="text-muted-foreground mt-1">
          Verifica claims mÃ©dicos contra la evidencia cientÃ­fica disponible
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verificar informaciÃ³n</CardTitle>
              <CardDescription>
                Ingresa el claim mÃ©dico que deseas verificar o proporciona una URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'url')}>
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
                      placeholder="Escribe o pega aquÃ­ el claim mÃ©dico que deseas verificar..."
                      className="min-h-[150px] resize-none"
                      value={claimText}
                      onChange={(e) => setClaimText(e.target.value)}
                      disabled={isVerifying}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                      {wordCount}/500 palabras
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="url" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>URL del artÃ­culo o publicaciÃ³n</Label>
                    <Input
                      type="url"
                      placeholder="https://ejemplo.com/articulo-salud"
                      value={claimUrl}
                      onChange={(e) => setClaimUrl(e.target.value)}
                      disabled={isVerifying}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Analizaremos el contenido de la pÃ¡gina para extraer claims verificables
                  </p>
                </TabsContent>
              </Tabs>

              {(error || verifyError) && (
                <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {error || verifyError}
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleVerify}
                disabled={
                  isVerifying ||
                  (inputMode === 'text' ? !claimText.trim() : !claimUrl.trim())
                }
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analizando claim...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verificar claim mÃ©dico
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          {safeResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resultado de la verificaciÃ³n</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Traffic Light */}
                <div className="flex justify-center">
                  <div className="flex flex-col items-center gap-4 p-6">
                    <div
                      className={`p-6 rounded-full ${statusConfig[safeResult.status].bgColor}`}
                    >
                      {(() => {
                        const StatusIcon = statusConfig[safeResult.status].icon

  return (
                          <StatusIcon
                            className={`h-16 w-16 ${statusConfig[safeResult.status].color} ${
                              safeResult.status === 'pending' ? 'animate-spin' : ''
                            }`}
                          />
                        )
                      })()}
                    </div>
                    <div className="text-center">
                      <h3
                        className={`text-xl font-semibold ${statusConfig[safeResult.status].color}`}
                      >
                        {statusConfig[safeResult.status].label}
                      </h3>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-muted-foreground">Score de veracidad:</span>
                        <span className="text-2xl font-bold">{safeResult.score}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Progress */}
                <div className="space-y-2">
                  <Progress value={safeResult.score} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Baja confiabilidad</span>
                    <span>Alta confiabilidad</span>
                  </div>
                </div>

                {/* Claim */}
                <div className="p-4 rounded-lg bg-muted">
                  <Label className="text-xs text-muted-foreground">Claim analizado</Label>
                  <p className="mt-1 text-sm">{safeResult.claim}</p>
                </div>

                {/* Evidence Breakdown */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Supporting Evidence */}
                  <Card className="border-success/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        Evidencia a favor ({safeResult.supportingEvidence.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-3">
                          {safeResult.supportingEvidence.map((evidence, idx) => (
                            <div
                              key={evidence.articleId}
                              className="p-3 rounded-lg bg-success/5 border border-success/20"
                            >
                              <p className="text-sm font-medium line-clamp-2">
                                {evidence.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                &ldquo;{evidence.snippet}&rdquo;
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <Badge variant="outline" className="text-xs">
                                  Relevancia: {evidence.relevanceScore}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                          {safeResult.supportingEvidence.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No se encontrÃ³ evidencia a favor
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Contradicting Evidence */}
                  <Card className="border-destructive/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" />
                        Evidencia en contra ({safeResult.contradictingEvidence.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-3">
                          {safeResult.contradictingEvidence.map((evidence) => (
                            <div
                              key={evidence.articleId}
                              className="p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                            >
                              <p className="text-sm font-medium line-clamp-2">
                                {evidence.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                &ldquo;{evidence.snippet}&rdquo;
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <Badge variant="outline" className="text-xs">
                                  Relevancia: {evidence.relevanceScore}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                          {safeResult.contradictingEvidence.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No se encontrÃ³ evidencia en contra
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                {/* Explanation */}
                <Accordion type="single" collapsible defaultValue="explanation">
                  <AccordionItem value="explanation">
                    <AccordionTrigger className="text-base">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Â¿Por quÃ© este resultado?
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {safeResult.explanation}
                        </p>

                        {safeResult.recommendations.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-warning" />
                              Para profundizar
                            </h4>
                            <ul className="space-y-1">
                              {safeResult.recommendations.map((rec, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-muted-foreground flex items-start gap-2"
                                >
                                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Verification Recommendations Component */}
                <VerificationRecommendations
                  result={safeResult}
                  onSearchClick={(term) => {
                    setClaimText(term)
                    router.push('/student/search')
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tips Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Consejos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Se especÃ­fico:</strong> Claims concretos
                generan mejores resultados.
              </p>
              <p>
                <strong className="text-foreground">Incluye contexto:</strong> Menciona
                condiciones, tratamientos o poblaciones especÃ­ficas.
              </p>
              <p>
                <strong className="text-foreground">Evita opiniones:</strong> EnfÃ³cate en
                afirmaciones verificables sobre hechos mÃ©dicos.
              </p>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Verificaciones recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {verificationHistory.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {verificationHistory.map((item) => {
                      const StatusIcon = statusConfig[item.status].icon
                      return (
                        <button
                          key={item.id}
                          className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                          onClick={() => setResult(item)}
                        >
                          <div className="flex items-start gap-3">
                            <StatusIcon
                              className={`h-4 w-4 mt-0.5 ${statusConfig[item.status].color}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm line-clamp-2">{item.claim}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Score: {item.score}%
                              </p>
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

          {/* Evidence Pyramid Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                PirÃ¡mide de evidencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span>Nivel 1-2: Revisiones sistemÃ¡ticas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-chart-1" />
                  <span>Nivel 3-4: Ensayos clÃ­nicos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span>Nivel 5-6: Estudios observacionales</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span>Nivel 7+: OpiniÃ³n de expertos</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm" asChild>
                <a href="/student/pyramid">
                  Ver pirÃ¡mide interactiva
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
