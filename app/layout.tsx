import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/auth-context'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: '--font-inter' })
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: '--font-mono' })

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
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
