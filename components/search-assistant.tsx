'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { searchAssistantApi } from '@/lib/search-assistant'
import type {
  AssistantConversationMessage,
  AssistantOperator,
  SearchAssistantRequest,
} from '@/lib/search-assistant'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, X, Sparkles } from 'lucide-react'

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
  selectedTerms?: string[]
  selectedOperators?: AssistantOperator[]
  currentFilters?: SearchAssistantRequest['filters']
}

const INITIAL_ASSISTANT_MESSAGE = 'Hola. Soy tu asistente IA de busqueda clinica en EDUSEARCH.'
const ASSISTANT_PROJECT_CONTEXT =
  'Proyecto EDUSEARCH: asistente de busqueda avanzada en salud para estudiantes y profesores. ' +
  'Objetivo: mejorar estrategias con terminos MeSH, operadores booleanos y filtros clinicos aplicables. ' +
  'Prioriza evidencia de alta calidad (revision sistematica, metaanalisis, ECA), evita inventar datos y entrega recomendaciones accionables listas para aplicar en la interfaz.'

const MAX_HISTORY_MESSAGES = 8

const FALLBACK_SUGGESTIONS: SuggestionItem[] = [
  {
    id: 'and-operator',
    type: 'operator',
    label: 'Usar AND',
    description: 'Combina terminos para acotar resultados.',
    action: () => {},
  },
  {
    id: 'or-operator',
    type: 'operator',
    label: 'Usar OR',
    description: 'Amplia resultados con sinonimos o conceptos relacionados.',
    action: () => {},
  },
  {
    id: 'not-operator',
    type: 'operator',
    label: 'Usar NOT',
    description: 'Excluye terminos irrelevantes.',
    action: () => {},
  },
  {
    id: 'recent-studies',
    type: 'filter',
    label: 'Filtrar evidencia reciente',
    description: 'Prioriza estudios de los ultimos anos.',
    action: () => {},
  },
]

const normalizeUniqueStrings = (values: string[] | undefined, limit: number): string[] => {
  if (!Array.isArray(values)) return []
  const unique = new Set<string>()
  for (const value of values) {
    const item = value.trim()
    if (!item) continue
    unique.add(item)
    if (unique.size >= limit) break
  }
  return Array.from(unique)
}

const extractQueryTokens = (query: string): { terms: string[]; operators: AssistantOperator[] } => {
  const safeQuery = query.trim()
  if (!safeQuery) return { terms: [], operators: [] }

  const termMatches = Array.from(safeQuery.matchAll(/\[([^\]]+)\]/g))
    .map((entry) => entry[1].trim())
    .filter((item) => {
      const lower = item.toLowerCase()
      if (!lower) return false
      if (/^\d{4}:\d{4}$/.test(lower)) return false
      if (lower === 'full-text') return false
      if (lower.startsWith('lang:')) return false
      if (lower.startsWith('max:')) return false
      return true
    })

  const operatorMatches = (safeQuery.match(/\b(AND|OR|NOT)\b/gi) ?? [])
    .map((entry) => entry.toUpperCase())
    .filter((entry): entry is AssistantOperator => entry === 'AND' || entry === 'OR' || entry === 'NOT')

  return {
    terms: normalizeUniqueStrings(termMatches, 8),
    operators: operatorMatches.slice(0, 3),
  }
}

const buildHistory = (
  messages: AssistantConversationMessage[],
  nextUserMessage: AssistantConversationMessage
): AssistantConversationMessage[] =>
  [...messages, nextUserMessage]
    .filter((entry) => entry.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)

const mapAiSuggestions = (
  suggestedTerms: Array<{ id: string; term: string; description: string }>,
  suggestedOperators: AssistantOperator[],
  suggestedFilters?: SearchAssistantRequest['filters']
): SuggestionItem[] => {
  const items: SuggestionItem[] = []

  for (const term of suggestedTerms.slice(0, 4)) {
    items.push({
      id: term.id || `term-${term.term.toUpperCase().replace(/\s+/g, '_')}`,
      type: 'term',
      label: term.term,
      description: term.description || 'Termino sugerido por IA.',
      action: () => {},
    })
  }

  for (const operator of suggestedOperators.slice(0, 3)) {
    items.push({
      id: `operator-${operator.toLowerCase()}`,
      type: 'operator',
      label: `Usar ${operator}`,
      description: 'Operador booleano sugerido por IA.',
      action: () => {},
    })
  }

  if (suggestedFilters) {
    const parts: string[] = []
    if (typeof suggestedFilters.yearFrom === 'number' && typeof suggestedFilters.yearTo === 'number') {
      parts.push(`${suggestedFilters.yearFrom}-${suggestedFilters.yearTo}`)
    }
    if (Array.isArray(suggestedFilters.studyTypes) && suggestedFilters.studyTypes.length > 0) {
      parts.push(`studyTypes:${suggestedFilters.studyTypes.slice(0, 2).join(',')}`)
    }
    if (suggestedFilters.hasFullText === true) {
      parts.push('full-text')
    }
    if (typeof suggestedFilters.maxResults === 'number') {
      parts.push(`max:${suggestedFilters.maxResults}`)
    }
    if (parts.length > 0) {
      items.push({
        id: 'ai-filters',
        type: 'filter',
        label: 'Aplicar filtros IA',
        description: `Sugerencia: ${parts.join(' | ')}`,
        action: () => {},
      })
    }
  }

  return items.slice(0, 8)
}

export function SearchAssistant({
  isOpen,
  onClose,
  onSuggestionClick,
  currentQuery = '',
  recentTerms = [],
  selectedTerms = [],
  selectedOperators = [],
  currentFilters,
}: SearchAssistantProps) {
  const [messages, setMessages] = useState<AssistantConversationMessage[]>([
    {
      role: 'assistant',
      content: INITIAL_ASSISTANT_MESSAGE,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<SuggestionItem[]>([])

  const fallbackSuggestions = useMemo(() => {
    const recentItems: SuggestionItem[] = normalizeUniqueStrings(recentTerms, 4).map((term, index) => ({
      id: `recent-term-${index + 1}`,
      type: 'term',
      label: term,
      description: 'Termino reciente de tu historial.',
      action: () => {},
    }))
    return [...recentItems, ...FALLBACK_SUGGESTIONS].slice(0, 8)
  }, [recentTerms])

  const suggestions = aiSuggestions.length > 0 ? aiSuggestions : fallbackSuggestions

  const handleSendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMessage: AssistantConversationMessage = { role: 'user', content: trimmed }
    const history = buildHistory(messages, userMessage)
    const extractedQuery = extractQueryTokens(currentQuery)
    const request: SearchAssistantRequest = {
      message: trimmed,
      selectedTerms:
        selectedTerms.length > 0
          ? normalizeUniqueStrings(selectedTerms, 8)
          : extractedQuery.terms,
      operators:
        selectedOperators.length > 0
          ? selectedOperators.slice(0, 3)
          : extractedQuery.operators,
      recentTerms: normalizeUniqueStrings(recentTerms, 8),
      projectContext: ASSISTANT_PROJECT_CONTEXT,
      conversationHistory: history,
      filters: currentFilters,
    }

    setIsLoading(true)
    setStatus(null)
    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await searchAssistantApi.ask(request)
      setMessages((prev) => [...prev, { role: 'assistant', content: response.reply }])
      setAiSuggestions(
        mapAiSuggestions(
          response.suggestedTerms,
          response.suggestedOperators,
          response.suggestedFilters
        )
      )
      setStatus(
        response.usedAi
          ? 'Respuesta generada por IA en tiempo real.'
          : 'Asistente en modo fallback. Revisa configuracion de GEMINI_API_KEY.'
      )
      setInput('')
    } catch (err) {
      const message =
        err instanceof Error
          ? `No pude consultar la IA externa: ${err.message}`
          : 'No pude consultar la IA externa en este momento.'
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])
      setStatus('Fallo temporal del asistente.')
    } finally {
      setIsLoading(false)
    }
  }, [
    input,
    messages,
    currentQuery,
    recentTerms,
    selectedTerms,
    selectedOperators,
    currentFilters,
  ])

  if (!isOpen) return null

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[600px] flex flex-col shadow-lg z-50 bg-background">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <div>
            <CardTitle className="text-sm">Asistente de Busqueda</CardTitle>
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
              key={`${msg.role}-${idx}`}
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
        {status && <p className="text-xs text-muted-foreground">{status}</p>}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Sugerencias rapidas:</p>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {suggestions.map((sug) => (
              <Button
                key={sug.id}
                variant="outline"
                size="sm"
                className="h-auto py-2 px-2 text-xs justify-start whitespace-normal hover:bg-primary/10"
                onClick={() => {
                  onSuggestionClick({
                    ...sug,
                    action: () => {},
                  })
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSendMessage()
              }
            }}
            className="h-8 text-sm"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => void handleSendMessage()}
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
