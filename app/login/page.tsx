'use client'

import React from "react"

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BookOpen, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Por favor, complete todos los campos')
      return
    }

    try {
      await login(email, password)
    } catch (err) {
      setError('Credenciales inválidas. Por favor, intente de nuevo.')
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
              <div className="text-3xl font-bold">Acceso</div>
              <div className="text-sm text-primary-foreground/70 mt-1">Búsqueda MeSH</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">Proceso</div>
              <div className="text-sm text-primary-foreground/70 mt-1">Verificación</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">Comunica</div>
              <div className="text-sm text-primary-foreground/70 mt-1">Bibliografías</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
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
              <CardTitle className="text-2xl font-bold">Iniciar sesión</CardTitle>
              <CardDescription>
                Ingresa tus credenciales institucionales para acceder
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

                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@institucion.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <a
                      href="/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{' '}
                <a href="/register" className="text-primary font-medium hover:underline">
                  Contacta a tu administrador
                </a>
              </div>
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Al iniciar sesión, aceptas los términos de uso y la política de privacidad de la institución.
          </p>
        </div>
      </div>
    </div>
  )
}
