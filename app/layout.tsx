import React from "react"
import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/auth-context'
import { QueryProvider } from '@/components/query-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'EDUCEARCH - Competencias Informacionales en Salud',
  description: 'Plataforma educativa para el desarrollo de competencias informacionales en ciencias de la salud. Búsqueda avanzada, verificación de claims y generación de bibliografías.',
  generator: 'v0.app',
  keywords: ['educación médica', 'competencias informacionales', 'PubMed', 'MeSH', 'verificación', 'bibliografía'],
  authors: [{ name: 'EDUCEARCH' }],
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0d7377' },
    { media: '(prefers-color-scheme: dark)', color: '#14919b' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  )
}
