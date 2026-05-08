'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { ProfessorProvider } from '@/contexts/professor-context'
import { cn } from '@/lib/utils'
import { useDashboardSidebar } from '@/hooks/use-dashboard-sidebar'
import { ExternalApiThinkingIndicator } from '@/components/external-api-thinking-indicator'
import { RoleHelpPanel } from '@/components/role-help-panel'
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
  BarChart3,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  User,
  Users,
  X,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/professor', icon: LayoutDashboard },
  { name: 'Casos de estudio', href: '/professor/cases', icon: FolderKanban },
  { name: 'Evaluaciones', href: '/professor/evaluations', icon: ClipboardCheck },
  { name: 'Search Hedges', href: '/professor/hedges', icon: Layers },
  { name: 'Estudiantes', href: '/professor/students', icon: Users },
  { name: 'Analíticas', href: '/professor/analytics', icon: BarChart3 },
  { name: 'Búsqueda', href: '/professor/search', icon: Search },
  { name: 'Chat', href: '/professor/chat', icon: MessageCircle },
]

export default function ProfessorLayout({ children }: { children: ReactNode }) {
  const { user, logout, isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, setSidebarOpen, isDesktopSidebarCollapsed, toggleDesktopSidebar } =
    useDashboardSidebar({ storageKey: 'professor' })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login')
    if (!isLoading && isAuthenticated && user?.role !== 'professor') router.push(`/${user?.role}`)
  }, [isAuthenticated, isLoading, router, user?.role])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando panel de profesor...</p>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== 'professor') return null

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((item) => item[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const desktopSidebarWidthClass = isDesktopSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
  const desktopMainOffsetClass = isDesktopSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'

  return (
    <ProfessorProvider>
      <div className="min-h-screen bg-background">
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 ease-in-out lg:translate-x-0',
            desktopSidebarWidthClass,
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">
            <div className={cn('flex h-16 items-center gap-2 border-b border-sidebar-border px-6', isDesktopSidebarCollapsed && 'lg:justify-center lg:px-3')}>
              <div className="rounded-lg bg-primary p-2">
                <BookOpen className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className={cn('text-xl font-bold text-sidebar-foreground', isDesktopSidebarCollapsed && 'lg:hidden')}>EDUCEARCH</span>
              <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className={cn('border-b border-sidebar-border px-6 py-3', isDesktopSidebarCollapsed && 'lg:hidden')}>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Panel de profesor</span>
            </div>

            <nav className={cn('flex-1 space-y-1 overflow-y-auto px-4 py-6', isDesktopSidebarCollapsed && 'lg:px-2')}>
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isDesktopSidebarCollapsed && 'lg:justify-center lg:px-2',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className={cn('truncate', isDesktopSidebarCollapsed && 'lg:hidden')}>{item.name}</span>
                    {isActive && !isDesktopSidebarCollapsed && <ChevronRight className="ml-auto h-4 w-4" />}
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-sidebar-border p-4">
              <div className={cn('flex items-center gap-3 px-2', isDesktopSidebarCollapsed && 'lg:justify-center lg:px-0')}>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.avatar || '/placeholder.svg'} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user?.name ? getInitials(user.name) : 'P'}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('min-w-0 flex-1', isDesktopSidebarCollapsed && 'lg:hidden')}>
                  <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name || 'Profesor'}</p>
                  <p className="truncate text-xs text-sidebar-foreground/60">Profesor</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className={cn(desktopMainOffsetClass)}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={toggleDesktopSidebar}
              aria-label={isDesktopSidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              title={isDesktopSidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
              {isDesktopSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>

            <div className="flex-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatar || '/placeholder.svg'} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name ? getInitials(user.name) : 'P'}
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
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>

        <ExternalApiThinkingIndicator />
        <RoleHelpPanel role="professor" />
      </div>
    </ProfessorProvider>
  )
}
