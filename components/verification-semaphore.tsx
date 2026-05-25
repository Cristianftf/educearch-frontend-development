"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from "lucide-react"

type VerificationStatus = "verified" | "conflicting" | "misinformation" | "unverified" | "pending"

type VerificationSemaphoreProps = {
  status: VerificationStatus
  score?: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  animated?: boolean
}

const statusConfig = {
  verified: {
    color: "bg-green-500",
    glowColor: "shadow-green-500/50",
    icon: CheckCircle,
    label: "Evidencia Sólida",
    description: "El claim está respaldado por evidencia científica confiable",
    textColor: "text-green-700",
    bgLight: "bg-green-50",
  },
  conflicting: {
    color: "bg-amber-500",
    glowColor: "shadow-amber-500/50",
    icon: AlertTriangle,
    label: "Evidencia Conflictiva",
    description: "Existen estudios con resultados contradictorios",
    textColor: "text-amber-700",
    bgLight: "bg-amber-50",
  },
  misinformation: {
    color: "bg-red-500",
    glowColor: "shadow-red-500/50",
    icon: XCircle,
    label: "Infodemia detectada",
    description: "El claim se considera desinformación basada en la evidencia disponible",
    textColor: "text-red-700",
    bgLight: "bg-red-50",
  },
  unverified: {
    color: "bg-red-500",
    glowColor: "shadow-red-500/50",
    icon: XCircle,
    label: "Posible Desinformación",
    description: "No se encontró evidencia que respalde este claim",
    textColor: "text-red-700",
    bgLight: "bg-red-50",
  },
  pending: {
    color: "bg-gray-400",
    glowColor: "shadow-gray-400/50",
    icon: HelpCircle,
    label: "Pendiente",
    description: "Esperando análisis de verificación",
    textColor: "text-gray-600",
    bgLight: "bg-gray-50",
  },
}

const sizeConfig = {
  sm: {
    light: "h-3 w-3",
    container: "gap-1 p-2",
    icon: "h-4 w-4",
    text: "text-xs",
  },
  md: {
    light: "h-4 w-4",
    container: "gap-2 p-3",
    icon: "h-5 w-5",
    text: "text-sm",
  },
  lg: {
    light: "h-6 w-6",
    container: "gap-3 p-4",
    icon: "h-6 w-6",
    text: "text-base",
  },
}

export function VerificationSemaphore({
  status,
  score,
  size = "md",
  showLabel = true,
  animated = true,
}: VerificationSemaphoreProps) {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-center rounded-lg border",
        config.bgLight,
        sizes.container
      )}
    >
      {/* Semaphore Light */}
      <div className="flex flex-col gap-1">
        {(["verified", "conflicting", "misinformation"] as const).map((s) => {
          const isActive = status === s || (status === "pending" && s === "conflicting")
          const lightConfig = statusConfig[s]

          return (
            <div
              key={s}
              className={cn(
                "rounded-full transition-all duration-300",
                sizes.light,
                isActive ? lightConfig.color : "bg-gray-200",
                isActive && animated && status !== "pending" && "animate-pulse",
                isActive && `shadow-lg ${lightConfig.glowColor}`
              )}
            />
          )
        })}
      </div>

      {/* Content */}
      {showLabel && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={cn(sizes.icon, config.textColor)} />
            <span className={cn("font-medium", sizes.text, config.textColor)}>
              {config.label}
            </span>
          </div>
          {score !== undefined && (
            <p className={cn("mt-1", sizes.text, "text-muted-foreground")}>
              Score de veracidad: <span className="font-semibold">{score}%</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function VerificationSemaphoreVertical({
  status,
  score,
  animated = true,
}: Omit<VerificationSemaphoreProps, "size" | "showLabel">) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className={cn("rounded-xl border p-6 text-center", config.bgLight)}>
      {/* Vertical Semaphore */}
      <div className="flex justify-center mb-4">
        <div className="bg-gray-800 rounded-lg p-2 flex flex-col gap-2">
          {(["verified", "conflicting", "misinformation"] as const).map((s) => {
            const isActive = status === s
            const lightConfig = statusConfig[s]

            return (
              <div
                key={s}
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-300",
                  isActive ? lightConfig.color : "bg-gray-600",
                  isActive && animated && "animate-pulse",
                  isActive && `shadow-lg ${lightConfig.glowColor}`
                )}
              />
            )
          })}
        </div>
      </div>

      {/* Icon and Label */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <Icon className={cn("h-6 w-6", config.textColor)} />
        <span className={cn("text-lg font-semibold", config.textColor)}>
          {config.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">{config.description}</p>

      {/* Score */}
      {score !== undefined && (
        <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full", config.bgLight)}>
          <span className="text-sm text-muted-foreground">Score de veracidad:</span>
          <span className={cn("text-2xl font-bold", config.textColor)}>{score}%</span>
        </div>
      )}
    </div>
  )
}

export function VerificationScoreBar({ score }: { score: number }) {
  let status: VerificationStatus = "unverified"
  if (score >= 70) status = "verified"
  else if (score >= 40) status = "conflicting"

  const config = statusConfig[status]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Score de veracidad</span>
        <span className={cn("font-semibold", config.textColor)}>{score}%</span>
      </div>
      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0% - No verificado</span>
        <span>100% - Verificado</span>
      </div>
    </div>
  )
}
