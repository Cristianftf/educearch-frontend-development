'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

import { cn } from '@/lib/utils'

function areArraysEqual(a?: number[], b?: number[]) {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function useStableArray(values?: number[]) {
  const ref = React.useRef<number[] | undefined>(values)
  if (!areArraysEqual(values, ref.current)) {
    ref.current = values ? [...values] : values
  }
  return ref.current
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueChange,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const isControlled = Array.isArray(value)
  const sliderValue = useStableArray(isControlled ? value : undefined)
  const sliderDefault = useStableArray(
    !isControlled
      ? Array.isArray(defaultValue)
        ? defaultValue
        : [min, max]
      : undefined
  )

  const _values = React.useMemo(
    () => {
      const resolved = sliderValue ?? sliderDefault ?? [min, max]
      return resolved.length > 0 ? resolved : [min]
    },
    [sliderValue, sliderDefault, min, max],
  )

  const handleValueChange = React.useCallback(
    (nextValue: number[]) => {
      if (!onValueChange) return
      if (areArraysEqual(nextValue, sliderValue)) {
        return
      }
      onValueChange(nextValue)
    },
    [onValueChange, sliderValue]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      {...(isControlled ? { value: sliderValue } : { defaultValue: sliderDefault })}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      onValueChange={handleValueChange}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={
          'bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
        }
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={
            'bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full'
          }
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
