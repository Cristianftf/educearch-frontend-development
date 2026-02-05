'use client'

import React from "react"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BookOpen, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import { authRegisterApi } from '@/lib/auth-register'
import type { UserRole } from '@/types'
import { evaluatePassword, PASSWORD_POLICY_HINT } from '@/lib/password-policy'

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'student',
    faculty: '',
    department: '',
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.email || !formData.username || !formData.password || !formData.firstName || !formData.lastName) {
      setError('Por favor, complete todos los campos requeridos')
      return false
    }

    if (!formData.email.includes('@')) {
      setError('Por favor, ingrese un correo electrónico válido')
      return false
    }

    if (formData.username.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres')
      return false
    }

    const policy = evaluatePassword(formData.password)
    if (!policy.isValid) {
      setError(PASSWORD_POLICY_HINT)
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const userData = {
        email: formData.email,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        password: formData.password,
        role: formData.role as UserRole,
        username: formData.username,
        faculty: formData.faculty || undefined,
        department: formData.department || undefined,
      }

      const response = await authRegisterApi.register(userData)
      
      if (response) {
        setSuccess(true)
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err: any) {
      const message =
        err instanceof Error ? err.message : 'Error al crear la cuenta. Por favor, intente de nuevo.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 text-primary-foreground">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary-foreground/10 rounded-xl">
              <BookOpen className="h-10 w-10" />
            </div>
            <span className="text-3xl font-bold tracking-tight">EDUCEARCH</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6 text-balance">
            Plataforma de Competencias Informacionales en Salud
          </h1>
          
          <p className="text-lg text-primary-foreground/80 leading-relaxed max-w-lg">
            Desarrolla habilidades críticas para buscar, evaluar y comunicar 
            información científica en el ámbito de las ciencias médicas.
          </p>
          
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">Aprende</div>
              <div className="text-sm text-primary-foreground/70 mt-1">Búsqueda MeSH</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">Practica</div>
              <div className="text-sm text-primary-foreground/70 mt-1">Verificación</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">Comunica</div>
              <div className="text-sm text-primary-foreground/70 mt-1">Bibliografías</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="p-2 bg-primary rounded-lg">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">EDUCEARCH</span>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold">Crear cuenta</CardTitle>
              <CardDescription>
                Regístrate para acceder a la plataforma de competencias informacionales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      ¡Cuenta creada exitosamente! Redirigiendo al login...
                    </AlertDescription>
                  </Alert>
                )}

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="Juan"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Pérez"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="usuario@institucion.edu"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-10"
                  />
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username">Nombre de usuario *</Label>
                  <Input
                    id="username"
                    name="username"
                    placeholder="juanperez"
                    value={formData.username}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-10"
                  />
                </div>
                {/* Faculty and Department */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="faculty">Facultad</Label>
                    <Input
                      id="faculty"
                      name="faculty"
                      placeholder="Informática"
                      value={formData.faculty}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Departamento</Label>
                    <Input
                      id="department"
                      name="department"
                      placeholder="Sistemas"
                      value={formData.department}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    {PASSWORD_POLICY_HINT}
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-10"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={isLoading || success}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    'Crear cuenta'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <a href="/login" className="text-primary font-medium hover:underline">
                  Inicia sesión aquí
                </a>
              </div>
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Al crear una cuenta, aceptas los términos de uso y la política de privacidad.
          </p>
        </div>
      </div>
    </div>
  )
}
