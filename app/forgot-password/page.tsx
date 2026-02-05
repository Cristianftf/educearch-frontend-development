"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from "lucide-react"
import { authApi } from "@/lib/auth"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email || !email.includes("@")) {
      setError("Ingresa un correo electrónico válido.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await authApi.requestPasswordReset(email)
      setSuccess(true)
      setResetUrl(response?.resetUrl || null)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo solicitar el restablecimiento. Intenta de nuevo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Restablecer contraseña</CardTitle>
            <CardDescription>
              Te enviaremos un enlace seguro para recuperar tu acceso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-success/30 bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription className="text-success">
                  Si el correo existe, recibirás instrucciones en unos minutos.
                </AlertDescription>
              </Alert>
            )}

            {success && resetUrl && (
              <Alert className="border-primary/30 bg-primary/5">
                <AlertDescription className="text-primary">
                  Enlace de desarrollo:
                  <Link href={resetUrl} className="ml-1 underline">
                    Restablecer contraseña
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@institucion.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar enlace"
                )}
              </Button>
            </form>

            <Button variant="ghost" className="w-full" asChild>
              <Link href="/login" className="flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a inicio de sesión
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
