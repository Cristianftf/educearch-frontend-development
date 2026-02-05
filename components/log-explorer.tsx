'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Download, Filter } from 'lucide-react'
import type { AuditLog } from '@/types'

interface LogExplorerProps {
  logs: AuditLog[]
  onLevelChange?: (level: string) => void
  onSearchChange?: (query: string) => void
  isLoading?: boolean
}

export function LogExplorer({
  logs,
  onLevelChange,
  onSearchChange,
  isLoading = false,
}: LogExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel
      const matchesSearch =
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userEmail?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesLevel && matchesSearch
    })
  }, [logs, selectedLevel, searchQuery])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    onSearchChange?.(value)
  }

  const handleLevelChange = (value: string) => {
    setSelectedLevel(value)
    onLevelChange?.(value)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'WARN':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'INFO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Explorador de Logs
        </CardTitle>
        <CardDescription>Total: {filteredLogs.length} eventos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-col sm:flex-row">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en logs..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Select value={selectedLevel} onValueChange={handleLevelChange}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los niveles</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" title="Exportar logs">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[500px] border rounded-lg p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No hay logs que coincidan con los filtros
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpandedLogId(expandedLogId === log.id ? null : log.id)
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getLevelColor(log.level)}>
                          {log.level}
                        </Badge>
                        <span className="font-medium text-sm truncate">
                          {log.action}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {log.userEmail || 'Sistema'} • {log.details}
                      </p>
                    </div>
                  </div>

                  {expandedLogId === log.id && (
                    <div className="mt-3 pt-3 border-t space-y-2 text-xs">
                      <div>
                        <span className="font-medium">Usuario:</span> {log.userEmail || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">IP:</span> {log.ip}
                      </div>
                      <div>
                        <span className="font-medium">User-Agent:</span>{' '}
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {log.userAgent.substring(0, 60)}...
                        </code>
                      </div>
                      <div>
                        <span className="font-medium">Recurso:</span> {log.resource || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Detalles:</span>
                        <pre className="bg-muted p-2 rounded mt-1 overflow-x-auto max-h-[200px]">
                          {log.details}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Stats */}
        {filteredLogs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {filteredLogs.filter((l) => l.level === 'ERROR').length}
              </div>
              <div className="text-xs text-muted-foreground">Errores</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">
                {filteredLogs.filter((l) => l.level === 'WARN').length}
              </div>
              <div className="text-xs text-muted-foreground">Advertencias</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {filteredLogs.filter((l) => l.level === 'INFO').length}
              </div>
              <div className="text-xs text-muted-foreground">Información</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
