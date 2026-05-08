"use client"

import { SystemConfigAdvanced } from "@/components/system-config-advanced"

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración del sistema</h1>
          <p className="text-muted-foreground">Administra parámetros globales, IA, PubMed y reglas pedagógicas de EDUCEARCH.</p>
        </div>
      </div>

      <SystemConfigAdvanced />
    </div>
  )
}
