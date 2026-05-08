'use client'

import { useEffect, useState } from 'react'

type DashboardSidebarOptions = {
  storageKey: string
  defaultCollapsed?: boolean
}

const getSidebarStorageKey = (key: string) => `dashboard-sidebar:${key}:collapsed`

export function useDashboardSidebar({
  storageKey,
  defaultCollapsed = false,
}: DashboardSidebarOptions) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(defaultCollapsed)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedValue = window.localStorage.getItem(getSidebarStorageKey(storageKey))
    if (storedValue === null) return

    setIsDesktopSidebarCollapsed(storedValue === '1')
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(
      getSidebarStorageKey(storageKey),
      isDesktopSidebarCollapsed ? '1' : '0'
    )
  }, [isDesktopSidebarCollapsed, storageKey])

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed((currentValue) => !currentValue)
  }

  return {
    sidebarOpen,
    setSidebarOpen,
    isDesktopSidebarCollapsed,
    toggleDesktopSidebar,
  }
}
