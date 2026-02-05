'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Lightbulb,
  ChevronRight,
  Send,
  X,
  Sparkles,
} from 'lucide-react'

interface SuggestionItem {
  id: string
  type: 'term' | 'operator' | 'filter'
  label: string
  description: string
  action: () => void
}

interface SearchAssistantProps {
  isOpen: boolean
  onClose: () => void
  onSuggestionClick: (suggestion: SuggestionItem) => void
  currentQuery?: string
  recentTerms?: string[]
}

export function SearchAssistant({
  isOpen,
  onClose,
  onSuggestionClick,
  currentQuery = '',
  recentTerms = [],
}: SearchAssistantProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de búsqueda MeSH. ¿Qué tópico médico deseas investigar hoy?',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const suggestions: SuggestionItem[] = [
    {
      id: 'diabetes',
      type: 'term',
      label: 'Diabetes Mellitus Type 2',
      description: 'Término ampliamente relevante para estudios metabólicos',
      action: () => onSuggestionClick({
        id: 'diabetes',
        type: 'term',
        label: 'Diabetes Mellitus Type 2',
        description: 'Término ampliamente relevante para estudios metabólicos',
        action: () => {},
      }),
    },
    {
      id: 'hypertension',
      type: 'term',
      label: 'Hypertension',
      description: 'Condición cardiovascular común en investigación',
      action: () => onSuggestionClick({
        id: 'hypertension',
        type: 'term',
        label: 'Hypertension',
        description: 'Condición cardiovascular común en investigación',
        action: () => {},
      }),
    },
    {
      id: 'and-operator',
      type: 'operator',
      label: 'Usar AND',
      description: 'Combina términos: ambos deben estar presentes',
      action: () => onSuggestionClick({
        id: 'and-operator',
        type: 'operator',
        label: 'Usar AND',
        description: 'Combina términos: ambos deben estar presentes',
        action: () => {},
      }),
    },
    {
      id: 'not-operator',
      type: 'operator',
      label: 'Usar NOT',
      description: 'Excluye términos de la búsqueda',
      action: () => onSuggestionClick({
        id: 'not-operator',
        type: 'operator',
        label: 'Usar NOT',
        description: 'Excluye términos de la búsqueda',
        action: () => {},
      }),
    },
    {
      id: 'recent-studies',
      type: 'filter',
      label: 'Filtrar por año (2020-2024)',
      description: 'Obtén solo investigaciones recientes',
      action: () => onSuggestionClick({
        id: 'recent-studies',
        type: 'filter',
        label: 'Filtrar por año (2020-2024)',
        description: 'Obtén solo investigaciones recientes',
        action: () => {},
      }),
    },
    {
      id: 'randomized-trials',
      type: 'filter',
      label: 'Solo Ensayos Clínicos Aleatorizados',
      description: 'Evidencia de alto nivel metodológico',
      action: () => onSuggestionClick({
        id: 'randomized-trials',
        type: 'filter',
        label: 'Solo Ensayos Clínicos Aleatorizados',
        description: 'Evidencia de alto nivel metodológico',
        action: () => {},
      }),
    },
  ]

  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return

    setIsLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: input }])

    // Simular respuesta del asistente
    setTimeout(() => {
      let response = ''
      const lowerInput = input.toLowerCase()

      if (lowerInput.includes('qué') || lowerInput.includes('como')) {
        response = 'Te recomiendo combinar términos MeSH específicos con operadores booleanos. Por ejemplo: "Diabetes Mellitus, Type 2" AND "Metformin" para resultados más precisos.'
      } else if (lowerInput.includes('filtro') || lowerInput.includes('año')) {
        response = 'Puedes usar los filtros de año para obtener estudios recientes (2020-2024) o seleccionar tipos específicos de estudios como ensayos clínicos aleatorizados.'
      } else {
        response = 'Esa es una buena pregunta. ¿Podrías ser más específico sobre qué aspecto de la búsqueda deseas mejorar?'
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
      setIsLoading(false)
      setInput('')
    }, 800)
  }, [input])

  if (!isOpen) return null

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[600px] flex flex-col shadow-lg z-50 bg-background">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <div>
            <CardTitle className="text-sm">Asistente de Búsqueda</CardTitle>
            <CardDescription className="text-xs">Sugerencias inteligentes para MeSH</CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <ScrollArea className="flex-1 p-4 max-h-[300px]">
        <div className="space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="space-y-3 border-t p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Sugerencias rápidas:</p>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {suggestions.map((sug) => (
              <Button
                key={sug.id}
                variant="outline"
                size="sm"
                className="h-auto py-2 px-2 text-xs justify-start whitespace-normal hover:bg-primary/10"
                onClick={() => {
                  sug.action()
                  setMessages((prev) => [...prev, { role: 'user', content: sug.label }])
                }}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{sug.label}</span>
                  <span className="text-muted-foreground">{sug.description}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Pregunta al asistente..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="h-8 text-sm"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
