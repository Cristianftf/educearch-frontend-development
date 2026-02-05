"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  GraduationCap,
  Search,
  CheckCircle,
  BookOpen,
  Shield,
  ArrowRight,
  Brain,
  FileText,
  Users,
  Sparkles,
} from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.push(`/${user.role}`)
    }
  }, [isAuthenticated, isLoading, user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <GraduationCap className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-xl text-foreground">EDUCEARCH</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Iniciar Sesión</Button>
            </Link>
            <Link href="/login">
              <Button>Registrarse</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Plataforma Educativa para Ciencias de la Salud
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance">
              Desarrolla tus <span className="text-primary">Competencias Informacionales</span> en Salud
            </h1>
            <p className="text-xl text-muted-foreground mb-8 text-pretty max-w-2xl mx-auto">
              Aprende a buscar, evaluar y comunicar información científica médica con herramientas 
              avanzadas de búsqueda en PubMed, verificación de claims y generación de bibliografías.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Comenzar ahora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
                Ver demostración
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Tres Competencias Esenciales
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Domina las habilidades clave para navegar el mundo de la información médica
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Acceso a la Información</h3>
                <p className="text-muted-foreground mb-4">
                  Aprende a construir búsquedas efectivas con términos MeSH, operadores booleanos 
                  y filtros avanzados en bases de datos médicas.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Constructor visual de queries
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Autocompletado MeSH inteligente
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Historial de búsquedas
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Procesamiento Crítico</h3>
                <p className="text-muted-foreground mb-4">
                  Desarrolla habilidades para evaluar la calidad de la evidencia y detectar 
                  información médica errónea o desinformación.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Verificador de claims médicos
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Sistema de semáforo de evidencia
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Pirámide de evidencia interactiva
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Comunicación Científica</h3>
                <p className="text-muted-foreground mb-4">
                  Aprende a citar correctamente y generar bibliografías en múltiples formatos 
                  para tus trabajos académicos.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Formatos APA, Vancouver, BibTeX
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Exportación a gestores de citas
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Validación automática de formato
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Diseñado para Toda la Comunidad Educativa
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Herramientas especializadas para cada rol dentro del proceso de enseñanza-aprendizaje
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Estudiantes</h3>
                <p className="text-muted-foreground mb-4">
                  Practica búsquedas, verifica claims médicos, genera bibliografías y completa 
                  casos de estudio asignados por tus profesores.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full bg-transparent">
                    Acceder como Estudiante
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Profesores</h3>
                <p className="text-muted-foreground mb-4">
                  Crea casos de estudio, monitorea el progreso de tus estudiantes, configura 
                  search hedges y evalúa las entregas de forma integrada.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full bg-transparent">
                    Acceder como Profesor
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Administradores</h3>
                <p className="text-muted-foreground mb-4">
                  Gestiona usuarios, monitorea el sistema, configura parámetros y genera reportes 
                  de uso y rendimiento de la plataforma.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full bg-transparent">
                    Acceder como Admin
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4 text-center">
            <div>
              <p className="text-4xl font-bold mb-2">1,284</p>
              <p className="text-primary-foreground/80">Usuarios Activos</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">45,000+</p>
              <p className="text-primary-foreground/80">Búsquedas Realizadas</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">12,500+</p>
              <p className="text-primary-foreground/80">Claims Verificados</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">8,200+</p>
              <p className="text-primary-foreground/80">Bibliografías Generadas</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Comienza tu viaje hacia la alfabetización informacional
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Únete a nuestra comunidad de estudiantes y profesores de ciencias de la salud 
                y desarrolla las competencias que necesitas para tu carrera.
              </p>
              <Link href="/login">
                <Button size="lg">
                  Crear cuenta gratuita
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold text-foreground">EDUCEARCH</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Plataforma para el desarrollo de competencias informacionales en ciencias de la salud.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground">Términos</Link>
              <Link href="#" className="hover:text-foreground">Privacidad</Link>
              <Link href="#" className="hover:text-foreground">Contacto</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
