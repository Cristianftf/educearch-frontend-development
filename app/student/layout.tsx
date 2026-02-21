'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { StudentProvider } from '@/contexts/student-context'
import { bibliographyApi, searchApi, verifyApi } from '@/lib/api'
import { useStudent } from '@/contexts/student-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RoleHelpPanel } from '@/components/role-help-panel'
import {
  BookOpen,
  Search,
  ShieldCheck,
  FileText,
  BarChart3,
  FolderOpen,
  MessageCircle,
  Menu,
  X,
  LogOut,
  User,
  ChevronRight,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/student', icon: BarChart3 },
  { name: 'Búsqueda Avanzada', href: '/student/search', icon: Search },
  { name: 'Verificación', href: '/student/verify', icon: ShieldCheck },
  { name: 'Bibliografías', href: '/student/bibliography', icon: FileText },
  { name: 'Casos Asignados', href: '/student/cases', icon: FolderOpen },
  { name: 'Chat', href: '/student/chat', icon: MessageCircle },
]

function StudentDataProvider({ children }: { children: React.ReactNode }) {
  const { setSavedSearches, setVerificationHistory, setBibliographies } = useStudent()

  const searchHistoryQuery = useQuery({
    queryKey: ['student', 'searchHistory', 1, 10],
    queryFn: () => searchApi.getHistory(1, 10),
  })
  const verifyHistoryQuery = useQuery({
    queryKey: ['student', 'verifyHistory', 1, 10],
    queryFn: () => verifyApi.getHistory(1, 10),
  })
  const bibliographyHistoryQuery = useQuery({
    queryKey: ['student', 'bibliographyHistory'],
    queryFn: () => bibliographyApi.getHistory(),
  })

  useEffect(() => {
    if (searchHistoryQuery.data?.searches) {
      setSavedSearches(searchHistoryQuery.data.searches)
    }
  }, [searchHistoryQuery.data, setSavedSearches])

  useEffect(() => {
    if (verifyHistoryQuery.data?.verifications) {
      setVerificationHistory(verifyHistoryQuery.data.verifications)
    }
  }, [verifyHistoryQuery.data, setVerificationHistory])

  useEffect(() => {
    if (bibliographyHistoryQuery.data) {
      setBibliographies(bibliographyHistoryQuery.data)
    }
  }, [bibliographyHistoryQuery.data, setBibliographies])

  return <>{children}</>
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <StudentProvider>
    <StudentDataProvider>
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
            <div className="p-2 bg-primary rounded-lg">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">EDUCEARCH</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                  {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-2">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar || "/placeholder.svg"} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.name || 'Usuario'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  Estudiante
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.name ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                Mi Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <RoleHelpPanel role="student" />
    </div>
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mi Perfil</DialogTitle>
          <DialogDescription>
            Información básica de tu cuenta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Nombre: </span>
            <span className="font-medium">{user?.name || 'Usuario'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Correo: </span>
            <span className="font-medium">{user?.email || 'No disponible'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rol: </span>
            <span className="font-medium">Estudiante</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </StudentDataProvider>
    </StudentProvider>
  )
}

