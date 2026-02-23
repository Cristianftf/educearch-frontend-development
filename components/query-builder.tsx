'use client'

import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Search,
  Plus,
  X,
  GripVertical,
  Parentheses,
  Hash,
} from 'lucide-react'
import type { MeshTerm } from '@/types'

interface QueryElement {
  id: string
  type: 'term' | 'operator' | 'group'
  value: string
  label: string
  color?: string
  termId?: string
}

interface QueryBuilderProps {
  availableTerms: MeshTerm[]
  onQueryChange: (data: { rawQuery: string; terms: MeshTerm[]; operators: BooleanOperator[] }) => void
}

const BOOLEAN_OPERATORS: QueryElement[] = [
  { id: 'and', type: 'operator', value: 'AND', label: 'Y', color: 'bg-blue-100 text-blue-800' },
  { id: 'or', type: 'operator', value: 'OR', label: 'O', color: 'bg-green-100 text-green-800' },
  { id: 'not', type: 'operator', value: 'NOT', label: 'NO', color: 'bg-red-100 text-red-800' },
]
type BooleanOperator = 'AND' | 'OR' | 'NOT'

function DraggableChip({ element, isDragging }: { element: QueryElement; isDragging?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: element.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        inline-flex max-w-full items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
        cursor-grab active:cursor-grabbing select-none
        ${element.color || 'bg-gray-100 text-gray-800'}
        ${isDragging ? 'opacity-50' : 'hover:shadow-md'}
        transition-shadow
      `}
    >
      <GripVertical className="h-3 w-3" />
      {element.type === 'term' && <Search className="h-3 w-3" />}
      {element.type === 'operator' && <Hash className="h-3 w-3" />}
      {element.type === 'group' && <Parentheses className="h-3 w-3" />}
      <span className="truncate max-w-[42vw] sm:max-w-[260px]">{element.label}</span>
    </div>
  )
}

function DroppableZone({
  id,
  title,
  elements,
  onRemove,
  className = ''
}: {
  id: string
  title: string
  elements: QueryElement[]
  onRemove: (elementId: string) => void
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <Card className={`min-h-[120px] ${className} ${isOver ? 'border-primary/50' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2" ref={setNodeRef}>
        {elements.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            Arrastra elementos aquí
          </div>
        ) : (
          <SortableContext items={elements.map(e => e.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {elements.map((element) => (
                <div key={element.id} className="relative group max-w-full">
                  <DraggableChip element={element} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(element.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </SortableContext>
        )}
      </CardContent>
    </Card>
  )
}

export default function QueryBuilder({ availableTerms, onQueryChange }: QueryBuilderProps) {
  const [queryElements, setQueryElements] = useState<QueryElement[]>([])
  const [draggedElement, setDraggedElement] = useState<QueryElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const element = [...availableTerms.map(t => ({
      id: t.id,
      type: 'term' as const,
      value: t.term,
      label: t.term,
      color: 'bg-purple-100 text-purple-800',
      termId: t.id
    })), ...BOOLEAN_OPERATORS].find(e => e.id === active.id)

    if (element) {
      setDraggedElement(element)
    }
  }, [availableTerms])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setDraggedElement(null)

    if (!over) return

    const element = [...availableTerms.map(t => ({
      id: t.id,
      type: 'term' as const,
      value: t.term,
      label: t.term,
      color: 'bg-purple-100 text-purple-800',
      termId: t.id
    })), ...BOOLEAN_OPERATORS].find(e => e.id === active.id)

    if (!element) return

    // Add to query elements if dropped in query zone
    if (over.id === 'query-zone') {
      setQueryElements(prev => [...prev, { ...element, id: `${element.id}-${Date.now()}` }])
    }
  }, [availableTerms])

  const removeElement = useCallback((elementId: string) => {
    setQueryElements(prev => prev.filter(e => e.id !== elementId))
  }, [])

  const buildQueryString = useCallback((): string => {
    if (queryElements.length === 0) return ''

    const orderedTerms: QueryElement[] = []
    const orderedOperators: QueryElement[] = []

    for (const element of queryElements) {
      if (element.type === 'term') {
        orderedTerms.push(element)
        continue
      }
      if (element.type === 'operator' && orderedTerms.length > 0) {
        orderedOperators.push(element)
      }
    }

    if (orderedTerms.length === 0) return ''

    let query = `[${orderedTerms[0].value}]`
    for (let i = 1; i < orderedTerms.length; i++) {
      const op = orderedOperators[i - 1]?.value || 'AND'
      query += ` ${op} [${orderedTerms[i].value}]`
    }

    return query
  }, [queryElements])

  // Update query string whenever elements change
  React.useEffect(() => {
    const query = buildQueryString()
    const orderedTerms: QueryElement[] = []
    const orderedOperators: QueryElement[] = []

    for (const element of queryElements) {
      if (element.type === 'term') {
        orderedTerms.push(element)
        continue
      }
      if (element.type === 'operator' && orderedTerms.length > 0) {
        orderedOperators.push(element)
      }
    }

    const terms = orderedTerms.map((e) => ({
      id: e.termId || e.id,
      term: e.value,
    }))
    const operators = orderedOperators.map((e) => e.value as BooleanOperator)

    onQueryChange({ rawQuery: query, terms, operators })
  }, [buildQueryString, onQueryChange, queryElements])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Available Elements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Elementos Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* MeSH Terms */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Términos MeSH</h4>
                <div className="flex flex-wrap gap-2">
                  {availableTerms.slice(0, 8).map((term) => (
                    <DraggableChip
                      key={term.id}
                      element={{
                        id: term.id,
                        type: 'term',
                        value: term.term,
                        label: term.term,
                        color: 'bg-purple-100 text-purple-800'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Boolean Operators */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Operadores Booleanos</h4>
                <div className="flex flex-wrap gap-2">
                  {BOOLEAN_OPERATORS.map((op) => (
                    <DraggableChip key={op.id} element={op} />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Query Construction Zone */}
        <DroppableZone
          id="query-zone"
          title="Zona de Construcción de Query"
          elements={queryElements}
          onRemove={removeElement}
          className="border-2 border-dashed border-muted-foreground/25"
        />

        {/* Query Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview de Query</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
              {buildQueryString() || 'La query aparecerá aquí...'}
            </div>
          </CardContent>
        </Card>
      </div>

      <DragOverlay>
        {draggedElement ? (
          <DraggableChip element={draggedElement} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
