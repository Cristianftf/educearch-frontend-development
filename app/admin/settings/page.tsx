"use client"

import { SystemConfigAdvanced } from "@/components/system-config-advanced"

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Configuración del Sistema
          </h1>
          <p className="text-muted-foreground">
            Administra las configuraciones globales de EDUCEARCH
          </p>
        </div>
      </div>

      {/* Configuration Component */}
      <SystemConfigAdvanced />
    </div>
  )
}
