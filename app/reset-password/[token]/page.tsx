"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2, AlertCircle, ArrowLeft, Lock } from "lucide-react"
import { authApi } from "@/lib/auth"
import { evaluatePassword, PASSWORD_POLICY_HINT } from "@/lib/password-policy"

export default function ResetPasswordPage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params.token === "string" ? params.token : ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError("Token inválido o ausente.")
      return
    }

    const policy = evaluatePassword(password)
    if (!policy.isValid) {
      setError(PASSWORD_POLICY_HINT)
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => router.push("/login"), 1500)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo restablecer la contraseña. Intenta de nuevo."
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
            <CardTitle className="text-2xl font-bold">Nueva contraseña</CardTitle>
            <CardDescription>
              Crea una nueva contraseña para tu cuenta.
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
                  Contraseña actualizada. Redirigiendo al login...
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    disabled={isSubmitting || success}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting || success}
                />
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Requisitos:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{PASSWORD_POLICY_HINT}</li>
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || success}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Actualizar contraseña"
                )}
              </Button>
            </form>

            <Button variant="ghost" className="w-full" asChild>
              <Link href="/login" className="flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
