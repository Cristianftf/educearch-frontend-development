'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Loader2, TriangleAlert, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  subscribeExternalApiActivity,
  type ExternalApiActivityEvent,
} from '@/lib/external-api-activity'

const MAX_EVENTS = 80
const PANEL_EVENTS = 26
const ACTIVITY_WINDOW_MS = 180000
const THINKING_WINDOW_MS = 16000

function parseEventTime(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatActivityTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return '--:--:--'
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function getDotClassName(status: ExternalApiActivityEvent['status']): string {
  switch (status) {
    case 'success':
      return 'bg-emerald-500'
    case 'warning':
      return 'bg-amber-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-blue-500'
  }
}

function getRowClassName(status: ExternalApiActivityEvent['status']): string {
  switch (status) {
    case 'success':
      return 'border-emerald-200/80 bg-emerald-50/70'
    case 'warning':
      return 'border-amber-200/80 bg-amber-50/70'
    case 'error':
      return 'border-red-200/80 bg-red-50/70'
    default:
      return 'border-border bg-background'
  }
}

export function ExternalApiThinkingIndicator() {
  const [events, setEvents] = useState<ExternalApiActivityEvent[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeExternalApiActivity((event) => {
      setEvents((prev) => {
        const next = prev.some((entry) => entry.id === event.id) ? prev : [...prev, event]
        const cutoff = Date.now() - ACTIVITY_WINDOW_MS
        return next
          .filter((entry) => parseEventTime(entry.timestamp) >= cutoff)
          .slice(-MAX_EVENTS)
      })
      if (event.status === 'info') {
        setPanelOpen(true)
      }
    })
    return unsubscribe
  }, [])

  const recentEvents = useMemo(() => {
    const cutoff = now - ACTIVITY_WINDOW_MS
    return events.filter((entry) => parseEventTime(entry.timestamp) >= cutoff)
  }, [events, now])

  const latestEvent = recentEvents.length > 0 ? recentEvents[recentEvents.length - 1] : null
  const hasActiveThinking = useMemo(
    () =>
      recentEvents.some(
        (entry) =>
          entry.status === 'info' && now - parseEventTime(entry.timestamp) <= THINKING_WINDOW_MS
      ),
    [recentEvents, now]
  )

  const providers = useMemo(() => {
    const counter = new Map<string, number>()
    for (const event of recentEvents) {
      counter.set(event.provider, (counter.get(event.provider) ?? 0) + 1)
    }
    return Array.from(counter.entries())
      .map(([provider, count]) => ({ provider, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5)
  }, [recentEvents])

  const panelEvents = useMemo(
    () => recentEvents.slice(Math.max(0, recentEvents.length - PANEL_EVENTS)).reverse(),
    [recentEvents]
  )

  if (recentEvents.length === 0 && !panelOpen) {
    return null
  }

  const statusTone =
    hasActiveThinking
      ? 'thinking'
      : latestEvent?.status === 'error'
        ? 'error'
        : latestEvent?.status === 'warning'
          ? 'warning'
          : 'success'

  return (
    <div className="fixed bottom-20 right-4 z-40 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:bottom-24 sm:right-6">
      {panelOpen && (
        <Card className="w-[min(92vw,24rem)] border-border/80 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="inline-flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Estado de APIs externas
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPanelOpen(false)}
                aria-label="Cerrar panel de actividad"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={hasActiveThinking ? 'default' : 'secondary'} className="text-[11px]">
                {hasActiveThinking ? 'Pensando...' : 'En espera'}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                {recentEvents.length} eventos
              </Badge>
              {latestEvent?.status === 'error' && (
                <Badge variant="destructive" className="text-[11px]">
                  Último evento con error
                </Badge>
              )}
            </div>

            {providers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {providers.map((provider) => (
                  <Badge
                    key={`external-provider-${provider.provider}`}
                    variant="outline"
                    className="text-[11px]"
                  >
                    {provider.provider} ({provider.count})
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="h-56 rounded-md border bg-muted/20 p-2">
              <div className="space-y-2 pr-2">
                {panelEvents.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    Sin actividad reciente de APIs externas.
                  </p>
                ) : (
                  panelEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn('rounded-md border px-2.5 py-2', getRowClassName(event.status))}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', getDotClassName(event.status))} />
                          <span className="truncate text-xs font-medium">{event.provider}</span>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatActivityTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed">{event.message}</p>
                      {(typeof event.latencyMs === 'number' ||
                        typeof event.resultCount === 'number') && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {typeof event.resultCount === 'number'
                            ? `${event.resultCount} resultados`
                            : 'Sin conteo'}
                          {typeof event.latencyMs === 'number' ? ` - ${event.latencyMs} ms` : ''}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Button
        type="button"
        variant={statusTone === 'error' ? 'destructive' : 'default'}
        onClick={() => setPanelOpen((prev) => !prev)}
        className="h-11 w-fit gap-2 rounded-full px-3 shadow-lg"
      >
        {statusTone === 'thinking' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : statusTone === 'error' ? (
          <AlertCircle className="h-4 w-4" />
        ) : statusTone === 'warning' ? (
          <TriangleAlert className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span className="hidden text-xs sm:inline">
          {statusTone === 'thinking'
            ? 'Consultando APIs...'
            : statusTone === 'error'
              ? 'Ver errores de APIs'
              : 'Actividad de APIs'}
        </span>
      </Button>
    </div>
  )
}
