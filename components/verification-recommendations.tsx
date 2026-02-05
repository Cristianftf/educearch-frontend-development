'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lightbulb, ExternalLink } from 'lucide-react'
import type { VerificationResult } from '@/types'

interface VerificationRecommendationsProps {
  result: VerificationResult
  onSearchClick?: (term: string) => void
}

// Extracted recommended terms based on the claim - in production this would come from backend
const generateRecommendations = (result: VerificationResult): string[] => {
  if (Array.isArray(result.recommendations) && result.recommendations.length > 0) {
    return result.recommendations.slice(0, 5)
  }
  const recommendations: string[] = []

  // Sample recommendation logic
  if (result.score < 50) {
    recommendations.push('Revisar fuentes más recientes')
    recommendations.push('Buscar revisiones sistemáticas sobre el tema')
  }

  if (result.supportingEvidence.length === 0) {
    recommendations.push('Ampliar búsqueda con términos relacionados')
  }

  if (result.contradictingEvidence.length > 0) {
    recommendations.push('Investigar las razones de los conflictos encontrados')
    recommendations.push('Consultar guías de práctica clínica actualizadas')
  }

  // Add related terms based on claim keywords
  const keywords = result.claim.toLowerCase().split(/\s+/).slice(0, 3)
  recommendations.push(`Profundizar en: ${keywords.join(', ')}`)

  return recommendations.slice(0, 5) // Limit to 5 recommendations
}

export function VerificationRecommendations({
  result,
  onSearchClick,
}: VerificationRecommendationsProps) {
  const recommendations = generateRecommendations(result)
  const suggestedSearchTerms = [
    'Diabetes Mellitus',
    'Evidencia clínica',
    'Revisiones sistemáticas',
    'Metaanálisis',
    'Guías de práctica clínica',
  ]

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
        {/* Recommendations List */}
        <div>
          <h4 className="font-medium mb-3">Acciones recomendadas:</h4>
          <ul className="space-y-2">
            {recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <p className="text-sm">{rec}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Suggested Search Terms */}
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

        {/* Next Steps */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="font-medium mb-2">Próximos pasos:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Realiza búsquedas adicionales con los términos sugeridos</li>
            <li>Consulta fuentes de máxima confiabilidad (revisiones sistemáticas)</li>
            <li>Compara los hallazgos con guías de práctica clínica actuales</li>
            <li>Documenta tus conclusiones en una bibliografía formal</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
