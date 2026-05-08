'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lightbulb, ExternalLink } from 'lucide-react'
import type { VerificationResult } from '@/types'

interface VerificationRecommendationsProps {
  result: VerificationResult
  onSearchClick?: (term: string) => void
}

const buildRecommendations = (result: VerificationResult): string[] => {
  if (!Array.isArray(result.recommendations)) {
    return []
  }

  return result.recommendations
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 5)
}

const buildSuggestedSearchTerms = (result: VerificationResult): string[] => {
  const evidence = [...result.supportingEvidence, ...result.contradictingEvidence]
  const uniqueTerms = new Set<string>()

  for (const item of evidence) {
    if (uniqueTerms.size >= 5) break
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!title) continue
    uniqueTerms.add(title)
  }

  return Array.from(uniqueTerms)
}

export function VerificationRecommendations({
  result,
  onSearchClick,
}: VerificationRecommendationsProps) {
  const recommendations = buildRecommendations(result)
  const suggestedSearchTerms = buildSuggestedSearchTerms(result)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Recomendaciones para profundizar
        </CardTitle>
        <CardDescription>
          Sugerencias basadas en el análisis de verificación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-3">Acciones recomendadas:</h4>
          {recommendations.length > 0 ? (
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={`${rec}-${index}`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <p className="text-sm">{rec}</p>
                </li>
              ))}
            </ul>
          ) : (
              <p className="text-sm text-muted-foreground">
              No hay recomendaciones adicionales generadas para esta verificación.
              </p>
          )}
        </div>

        {suggestedSearchTerms.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Términos sugeridos para buscar:</h4>
            <div className="flex flex-wrap gap-2">
              {suggestedSearchTerms.map((term) => (
                <Button
                  key={term}
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => onSearchClick?.(term)}
                >
                  {term}
                  <ExternalLink className="h-3 w-3" />
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="font-medium mb-2">Próximos pasos:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Revisa los artículos citados en evidencia y prioriza las fuentes primarias.</li>
            <li>Contrasta los hallazgos con guías clínicas actualizadas.</li>
            <li>Documenta los hallazgos con referencias verificables.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
