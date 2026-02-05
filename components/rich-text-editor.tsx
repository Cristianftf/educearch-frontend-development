'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Link2,
  Code,
  Undo2,
  Redo2,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe aquí...',
  maxHeight = 'h-[400px]',
}: RichTextEditorProps) {
  const [history, setHistory] = useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = useState(0)

  const updateValue = useCallback((newValue: string) => {
    onChange(newValue)
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), newValue])
    setHistoryIndex((prev) => prev + 1)
  }, [onChange, historyIndex])

  const applyFormat = useCallback((format: string) => {
    const textarea = document.querySelector('textarea[data-richtext]') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    let formattedText = ''
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        break
      case 'heading':
        formattedText = `## ${selectedText}`
        break
      case 'code':
        formattedText = `\`${selectedText}\``
        break
      case 'link':
        formattedText = `[${selectedText}](url)`
        break
      case 'bullet':
        formattedText = `• ${selectedText}`
        break
      case 'list':
        formattedText = `1. ${selectedText}`
        break
      default:
        return
    }

    const newValue = value.substring(0, start) + formattedText + value.substring(end)
    updateValue(newValue)

    setTimeout(() => {
      textarea.selectionStart = start + formattedText.length
      textarea.selectionEnd = start + formattedText.length
      textarea.focus()
    }, 0)
  }, [value, updateValue])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1)
      onChange(history[historyIndex - 1])
    }
  }, [history, historyIndex, onChange])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1)
      onChange(history[historyIndex + 1])
    }
  }, [history, historyIndex, onChange])

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Editor de Contenido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormat('bold')}
            title="Negrita (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormat('italic')}
            title="Cursiva"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormat('heading')}
            title="Encabezado"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormat('bullet')}
            title="Lista con viñetas"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormat('list')}
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormat('code')}
            title="Código"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormat('link')}
            title="Enlace"
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={historyIndex === 0}
            title="Deshacer"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            title="Rehacer"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Editor */}
        <textarea
          data-richtext
          value={value}
          onChange={(e) => updateValue(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${maxHeight} p-3 border rounded-lg resize-none font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary`}
        />

        {/* Preview */}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground mb-2">
            Vista previa
          </summary>
          <div className="p-3 bg-muted rounded-lg border text-sm space-y-2">
            {value ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {value.split('\n').map((line, idx) => {
                  if (line.startsWith('## ')) {
                    return <h3 key={idx} className="font-bold text-base mt-2">{line.substring(3)}</h3>
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <strong key={idx}>{line.substring(2, line.length - 2)}</strong>
                  }
                  if (line.startsWith('• ')) {
                    return <li key={idx}>{line.substring(2)}</li>
                  }
                  return <p key={idx}>{line}</p>
                })}
              </div>
            ) : (
              <p className="text-muted-foreground italic">La vista previa aparecerá aquí...</p>
            )}
          </div>
        </details>

        {/* Word count */}
        <div className="text-xs text-muted-foreground text-right">
          {value.split(/\s+/).filter(Boolean).length} palabras · {value.length} caracteres
        </div>
      </CardContent>
    </Card>
  )
}
