'use client'

import { useState, useEffect } from 'react'
import type { VerificationStatus } from '@/types'
import { cn } from '@/lib/utils'

interface TrafficLightSemaphoreProps {
  status: VerificationStatus
  score?: number
  animated?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
}

const statusToLight: Record<VerificationStatus, 'green' | 'yellow' | 'red' | 'none'> = {
  verified: 'green',
  conflicting: 'yellow',
  misinformation: 'red',
  pending: 'none',
}

const lightLabels = {
  green: 'Evidencia sólida',
  yellow: 'Evidencia conflictiva',
  red: 'Posible desinformación',
}

const sizeConfig = {
  sm: {
    container: 'w-12 p-1.5 rounded-lg',
    light: 'w-8 h-8',
    gap: 'gap-1.5',
  },
  md: {
    container: 'w-16 p-2 rounded-xl',
    light: 'w-10 h-10',
    gap: 'gap-2',
  },
  lg: {
    container: 'w-24 p-3 rounded-2xl',
    light: 'w-16 h-16',
    gap: 'gap-3',
  },
}

export function TrafficLightSemaphore({
  status,
  score,
  animated = true,
  size = 'md',
  showLabels = false,
}: TrafficLightSemaphoreProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const activeLight = statusToLight[status]
  const config = sizeConfig[size]

  useEffect(() => {
    if (animated && status !== 'pending') {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [status, animated])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Semaphore housing */}
      <div
        className={cn(
          'bg-zinc-800 dark:bg-zinc-900 flex flex-col items-center shadow-lg border-2 border-zinc-700',
          config.container,
          config.gap
        )}
      >
        {/* Red light */}
        <div
          className={cn(
            'rounded-full transition-all duration-500 relative',
            config.light,
            activeLight === 'red'
              ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)]'
              : 'bg-red-500/20',
            activeLight === 'red' && isAnimating && 'animate-pulse'
          )}
        >
          {activeLight === 'red' && (
            <div className="absolute inset-0 rounded-full bg-red-400/50 animate-ping" />
          )}
        </div>

        {/* Yellow light */}
        <div
          className={cn(
            'rounded-full transition-all duration-500 relative',
            config.light,
            activeLight === 'yellow'
              ? 'bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.7)]'
              : 'bg-yellow-400/20',
            activeLight === 'yellow' && 'animate-pulse'
          )}
        >
          {activeLight === 'yellow' && (
            <div className="absolute inset-0 rounded-full bg-yellow-300/50 animate-ping" style={{ animationDuration: '1.5s' }} />
          )}
        </div>

        {/* Green light */}
        <div
          className={cn(
            'rounded-full transition-all duration-500 relative',
            config.light,
            activeLight === 'green'
              ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.7)]'
              : 'bg-green-500/20',
            activeLight === 'green' && isAnimating && 'animate-pulse'
          )}
        >
          {activeLight === 'green' && (
            <div className="absolute inset-0 rounded-full bg-green-400/50 animate-ping" />
          )}
        </div>

        {/* Pending state - all lights blinking */}
        {status === 'pending' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
            <div className={cn('rounded-full bg-red-500/30', config.light, 'animate-pulse')} style={{ animationDelay: '0ms' }} />
            <div className={cn('rounded-full bg-yellow-400/30', config.light, 'animate-pulse')} style={{ animationDelay: '200ms' }} />
            <div className={cn('rounded-full bg-green-500/30', config.light, 'animate-pulse')} style={{ animationDelay: '400ms' }} />
          </div>
        )}
      </div>

      {/* Labels */}
      {showLabels && activeLight !== 'none' && (
        <div className="text-center">
          <p
            className={cn(
              'font-semibold',
              activeLight === 'green' && 'text-green-600 dark:text-green-400',
              activeLight === 'yellow' && 'text-yellow-600 dark:text-yellow-400',
              activeLight === 'red' && 'text-red-600 dark:text-red-400'
            )}
          >
            {lightLabels[activeLight]}
          </p>
          {score !== undefined && (
            <p className="text-sm text-muted-foreground mt-1">
              Score: {score}%
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Horizontal variant for inline use
export function TrafficLightHorizontal({
  status,
  size = 'sm',
}: {
  status: VerificationStatus
  size?: 'sm' | 'md'
}) {
  const activeLight = statusToLight[status]

  const lightSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  const gap = size === 'sm' ? 'gap-1' : 'gap-2'

  return (
    <div className={cn('flex items-center', gap)}>
      <div
        className={cn(
          'rounded-full transition-all',
          lightSize,
          activeLight === 'green'
            ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
            : 'bg-green-500/20'
        )}
      />
      <div
        className={cn(
          'rounded-full transition-all',
          lightSize,
          activeLight === 'yellow'
            ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]'
            : 'bg-yellow-400/20'
        )}
      />
      <div
        className={cn(
          'rounded-full transition-all',
          lightSize,
          activeLight === 'red'
            ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
            : 'bg-red-500/20'
        )}
      />
    </div>
  )
}
