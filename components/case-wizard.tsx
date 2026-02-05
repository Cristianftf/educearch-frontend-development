'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronRight, ChevronLeft, AlertCircle, Check } from 'lucide-react'
import type { CaseStudy, CaseDifficulty } from '@/types'

interface CaseWizardProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (caseData: Partial<CaseStudy>) => Promise<void>
}

interface WizardStep {
  id: number
  title: string
  description: string
}

interface CaseFormData {
  title: string
  scenario: string
  difficulty: CaseDifficulty
  requiredArticles: string[]
  optionalArticles: string[]
  guidingQuestions: string[]
  dueDate?: string
}

const steps: WizardStep[] = [
  {
    id: 1,
    title: 'Información básica',
    description: 'Define el título, escenario y dificultad del caso',
  },
  {
    id: 2,
    title: 'Recursos',
    description: 'Selecciona artículos obligatorios y opcionales',
  },
  {
    id: 3,
    title: 'Preguntas guía',
    description: 'Define preguntas para guiar a los estudiantes',
  },
]

const difficultyOptions: { value: CaseDifficulty; label: string; description: string }[] = [
  { value: 'novice', label: 'Novato', description: 'Para estudiantes principiantes' },
  { value: 'intermediate', label: 'Intermedio', description: 'Para estudiantes con experiencia' },
  { value: 'advanced', label: 'Avanzado', description: 'Para estudiantes experimentados' },
]

export function CaseWizard({ isOpen, onClose, onSubmit }: CaseWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CaseFormData>({
    title: '',
    scenario: '',
    difficulty: 'intermediate',
    requiredArticles: [],
    optionalArticles: [],
    guidingQuestions: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!formData.title.trim()) {
        newErrors.title = 'El título es requerido'
      }
      if (!formData.scenario.trim()) {
        newErrors.scenario = 'El escenario es requerido'
      }
    }

    if (step === 2) {
      if (
        formData.requiredArticles.length === 0 &&
        formData.optionalArticles.length === 0
      ) {
        newErrors.articles =
          'Debes seleccionar al menos un artículo (obligatorio u opcional)'
      }
    }

    if (step === 3) {
      if (formData.guidingQuestions.length === 0) {
        newErrors.questions = 'Debes agregar al menos una pregunta guía'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length))
    }
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        ...formData,
        status: 'draft',
      })
      onClose()
      // Reset form
      setCurrentStep(1)
      setFormData({
        title: '',
        scenario: '',
        difficulty: 'intermediate',
        requiredArticles: [],
        optionalArticles: [],
        guidingQuestions: [],
      })
      setErrors({})
    } finally {
      setIsSubmitting(false)
    }
  }

  const addGuidingQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      guidingQuestions: [...prev.guidingQuestions, ''],
    }))
  }

  const updateGuidingQuestion = (index: number, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.guidingQuestions]
      updated[index] = value
      return { ...prev, guidingQuestions: updated }
    })
  }

  const removeGuidingQuestion = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      guidingQuestions: prev.guidingQuestions.filter((_, i) => i !== index),
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear nuevo caso de estudio</DialogTitle>
          <DialogDescription>
            Sigue los pasos para crear un nuevo caso para tus estudiantes
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${
                  step.id <= currentStep ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    step.id < currentStep
                      ? 'bg-green-500 text-white'
                      : step.id === currentStep
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.id < currentStep ? <Check className="h-4 w-4" /> : step.id}
                </div>
              </div>
            ))}
          </div>
          <Progress value={(currentStep / steps.length) * 100} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{steps[currentStep - 1].title}</h3>
            <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
          </div>

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título del caso</Label>
                <Input
                  id="title"
                  placeholder="Ej: Diabetes Mellitus y Complicaciones Cardiovasculares"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && (
                  <p className="text-xs text-destructive mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="scenario">Escenario clínico</Label>
                <Textarea
                  id="scenario"
                  placeholder="Describe el caso clínico en detalle. Incluye síntomas, antecedentes, y preguntas iniciales para el estudiante..."
                  value={formData.scenario}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, scenario: e.target.value }))
                  }
                  className={`min-h-[150px] ${errors.scenario ? 'border-destructive' : ''}`}
                />
                {errors.scenario && (
                  <p className="text-xs text-destructive mt-1">{errors.scenario}</p>
                )}
              </div>

              <div>
                <Label>Nivel de dificultad</Label>
                <div className="grid gap-2 mt-2">
                  {difficultyOptions.map((option) => (
                    <Card
                      key={option.value}
                      className={`cursor-pointer transition-colors ${
                        formData.difficulty === option.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, difficulty: option.value }))
                      }
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{option.label}</p>
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                          </div>
                          <Checkbox checked={formData.difficulty === option.value} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Resources */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Los artículos obligatorios deben ser revisados por los estudiantes.
                  Los opcionales son para profundizar.
                </AlertDescription>
              </Alert>

              <div>
                <Label>Artículos obligatorios</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {formData.requiredArticles.length} seleccionado(s)
                </p>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  + Buscar y agregar artículos
                </Button>
                {formData.requiredArticles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.requiredArticles.map((article) => (
                      <Badge key={article} variant="secondary">
                        {article}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Artículos opcionales</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {formData.optionalArticles.length} seleccionado(s)
                </p>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  + Buscar y agregar artículos
                </Button>
                {formData.optionalArticles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.optionalArticles.map((article) => (
                      <Badge key={article} variant="outline">
                        {article}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {errors.articles && (
                <Alert className="border-destructive bg-destructive/5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">{errors.articles}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 3: Guiding Questions */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Preguntas guía</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.guidingQuestions.length} pregunta(s)
                  </p>
                </div>

                {formData.guidingQuestions.map((question, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      placeholder={`Pregunta ${index + 1}...`}
                      value={question}
                      onChange={(e) => updateGuidingQuestion(index, e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeGuidingQuestion(index)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                  onClick={addGuidingQuestion}
                >
                  + Agregar pregunta
                </Button>

                {errors.questions && (
                  <Alert className="border-destructive bg-destructive/5 mt-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive">
                      {errors.questions}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div>
                <Label htmlFor="dueDate">Fecha de entrega (opcional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex justify-between">
          <div>
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>

            {currentStep < steps.length ? (
              <Button onClick={handleNext}>
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Creando...' : 'Crear caso'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
