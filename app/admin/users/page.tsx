"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CSVUserImporter } from "@/components/csv-user-importer"
import { adminUsersApi } from "@/lib/api"
import {
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Download,
  Upload,
  Filter,
  GraduationCap,
  BookOpen,
  Shield,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type UserRow = {
  id: string
  name: string
  email: string
  role: "student" | "professor" | "admin"
  status: "active" | "inactive" | "pending"
  faculty: string
  lastLogin: string
  createdAt: string
  avatar?: string
}

type UserFormState = {
  name: string
  email: string
  role: "student" | "professor" | "admin"
  faculty: string
}

/* const mockUsers: UserRow[] = [
  {
    id: "1",
    name: "María García López",
    email: "maria.garcia@estudiante.uci.cu",
    role: "student",
    status: "active",
    faculty: "Medicina",
    lastLogin: "Hace 2 horas",
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Dr. Carlos Rodríguez",
    email: "carlos.rodriguez@uci.cu",
    role: "professor",
    status: "active",
    faculty: "Medicina",
    lastLogin: "Hace 30 min",
    createdAt: "2023-09-01",
  },
  {
    id: "3",
    name: "Ana Torres Pérez",
    email: "ana.torres@estudiante.uci.cu",
    role: "student",
    status: "inactive",
    faculty: "Enfermería",
    lastLogin: "Hace 5 días",
    createdAt: "2024-02-20",
  },
  {
    id: "4",
    name: "Dr. Pedro Martínez",
    email: "pedro.martinez@uci.cu",
    role: "professor",
    status: "active",
    faculty: "Estomatología",
    lastLogin: "Hace 1 hora",
    createdAt: "2023-08-15",
  },
  {
    id: "5",
    name: "Laura Sánchez",
    email: "laura.sanchez@estudiante.uci.cu",
    role: "student",
    status: "pending",
    faculty: "Medicina",
    lastLogin: "Nunca",
    createdAt: "2024-03-10",
  },
 ] */

const PAGE_SIZE = 20

const toUserRow = (user: any): UserRow => {
  const name =
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Sin nombre"
  const status: UserRow["status"] =
    typeof user?.status === "string"
      ? user.status
      : typeof user?.isActive === "boolean"
        ? user.isActive
          ? "active"
          : "inactive"
        : "pending"

  const roleValue = String(user?.role ?? "student").toLowerCase()
  const role: UserRow["role"] = roleValue.includes("admin")
    ? "admin"
    : roleValue.includes("professor")
      ? "professor"
      : "student"

  return {
    id: String(user?.id ?? ""),
    name,
    email: String(user?.email ?? ""),
    role,
    status,
    faculty: String(user?.faculty ?? ""),
    lastLogin: String(user?.lastLogin ?? "Nunca"),
    createdAt: String(user?.createdAt ?? ""),
    avatar: user?.avatar,
  }
}

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [formState, setFormState] = useState<UserFormState>({
    name: "",
    email: "",
    role: "student",
    faculty: "",
  })

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await adminUsersApi.getAll(currentPage, PAGE_SIZE, {
        role: roleFilter !== "all" ? (roleFilter as any) : undefined,
        status:
          statusFilter !== "all" && statusFilter !== "pending"
            ? statusFilter
            : undefined,
      })
      const normalized = response.users.map(toUserRow)
      setUsers(normalized)
      setTotal(response.total)
      setTotalPages(response.totalPages || Math.max(1, Math.ceil(response.total / PAGE_SIZE)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios")
      setUsers([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, roleFilter, statusFilter])

  const resetForm = () => {
    setFormState({ name: "", email: "", role: "student", faculty: "" })
    setEditingUser(null)
  }

  const splitName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length === 0) return { firstName: "", lastName: "" }
    if (parts.length === 1) return { firstName: parts[0], lastName: "" }
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
  }

  const handleCreateUser = async () => {
    setError(null)
    setInfo(null)
    setIsMutating(true)
    try {
      if (!formState.name || !formState.email) {
        throw new Error("Nombre y correo son requeridos")
      }
      const { firstName, lastName } = splitName(formState.name)
      await adminUsersApi.create({
        email: formState.email,
        role: formState.role,
        faculty: formState.faculty,
        firstName,
        lastName,
        isActive: true,
      } as any)
      setIsCreateDialogOpen(false)
      resetForm()
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario")
    } finally {
      setIsMutating(false)
    }
  }

  const handleOpenEdit = (user: UserRow) => {
    setEditingUser(user)
    setFormState({
      name: user.name,
      email: user.email,
      role: user.role,
      faculty: user.faculty || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return
    setError(null)
    setInfo(null)
    setIsMutating(true)
    try {
      const { firstName, lastName } = splitName(formState.name)
      await adminUsersApi.update(editingUser.id, {
        email: formState.email,
        role: formState.role,
        faculty: formState.faculty,
        firstName,
        lastName,
        isActive: editingUser.status === "active",
      } as any)
      setIsEditDialogOpen(false)
      resetForm()
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar usuario")
    } finally {
      setIsMutating(false)
    }
  }

  const handleToggleStatus = async (user: UserRow, active: boolean) => {
    setError(null)
    setInfo(null)
    setIsMutating(true)
    try {
      await adminUsersApi.changeStatus(user.id, active)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar estado")
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteUser = async (user: UserRow) => {
    const confirmed = window.confirm(`Eliminar al usuario ${user.name}?`)
    if (!confirmed) return
    setError(null)
    setInfo(null)
    setIsMutating(true)
    try {
      await adminUsersApi.delete(user.id)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar usuario")
    } finally {
      setIsMutating(false)
    }
  }

  const handleBulkStatus = async (active: boolean) => {
    setError(null)
    setInfo(null)
    setIsMutating(true)
    try {
      await Promise.all(selectedUsers.map((id) => adminUsersApi.changeStatus(id, active)))
      setSelectedUsers([])
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar usuarios")
    } finally {
      setIsMutating(false)
    }
  }

  const handleBulkDelete = async () => {
    const confirmed = window.confirm(`Eliminar ${selectedUsers.length} usuario(s)?`)
    if (!confirmed) return
    setError(null)
    setInfo(null)
    setIsMutating(true)
    try {
      await Promise.all(selectedUsers.map((id) => adminUsersApi.delete(id)))
      setSelectedUsers([])
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar usuarios")
    } finally {
      setIsMutating(false)
    }
  }

  const handleBulkEmail = () => {
    setInfo("Funcionalidad de correo masivo no disponible en backend.")
  }

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    setCurrentPage(1)
  }, [roleFilter, statusFilter, searchQuery])

  useEffect(() => {
    setSelectedUsers((prev) => prev.filter((id) => users.some((u) => u.id === id)))
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesStatus = statusFilter === "all" || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const pages = useMemo(() => {
    const maxPages = 5
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - maxPages + 1))
    const end = Math.min(totalPages, start + maxPages - 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [currentPage, totalPages])

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map((u) => u.id))
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "student":
        return <GraduationCap className="h-4 w-4" />
      case "professor":
        return <BookOpen className="h-4 w-4" />
      case "admin":
        return <Shield className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      student: { label: "Estudiante", className: "bg-blue-100 text-blue-700" },
      professor: { label: "Profesor", className: "bg-purple-100 text-purple-700" },
      admin: { label: "Admin", className: "bg-red-100 text-red-700" },
    }
    const { label, className } = variants[role] || variants.student
    return <Badge className={className}>{label}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      active: { label: "Activo", className: "bg-green-100 text-green-700" },
      inactive: { label: "Inactivo", className: "bg-gray-100 text-gray-700" },
      pending: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
    }
    const { label, className } = variants[status] || variants.pending
    return <Badge className={className}>{label}</Badge>
  }

  const totalOnPage = filteredUsers.length
  const displayTotal = searchQuery ? filteredUsers.length : total
  const stats = useMemo(() => {
    return filteredUsers.reduce(
      (acc, user) => {
        acc[user.role] += 1
        acc[user.status] += 1
        return acc
      },
      {
        student: 0,
        professor: 0,
        admin: 0,
        active: 0,
        inactive: 0,
        pending: 0,
      }
    )
  }, [filteredUsers])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground">
            Administra todos los usuarios del sistema EDUCEARCH
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Importar Usuarios desde CSV</DialogTitle>
                <DialogDescription>
                  Carga un archivo CSV con usuarios para importarlos al sistema en masa.
                </DialogDescription>
              </DialogHeader>
              <CSVUserImporter />
            </DialogContent>
          </Dialog>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open)
              if (open) {
                resetForm()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Completa los datos para registrar un nuevo usuario en el sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    placeholder="Nombre y apellidos"
                    value={formState.name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@uci.cu"
                    value={formState.email}
                    onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    value={formState.role}
                    onValueChange={(value: any) => setFormState((prev) => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Estudiante</SelectItem>
                      <SelectItem value="professor">Profesor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faculty">Facultad</Label>
                  <Select
                    value={formState.faculty}
                    onValueChange={(value: any) => setFormState((prev) => ({ ...prev, faculty: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar facultad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicina">Medicina</SelectItem>
                      <SelectItem value="enfermeria">Enfermería</SelectItem>
                      <SelectItem value="estomatologia">Estomatología</SelectItem>
                      <SelectItem value="tecnologia">Tecnología de la Salud</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} disabled={isMutating}>
                  {isMutating ? "Creando..." : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Usuario</DialogTitle>
                <DialogDescription>
                  Actualiza los datos del usuario seleccionado.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre Completo</Label>
                  <Input
                    id="edit-name"
                    placeholder="Nombre y apellidos"
                    value={formState.name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Correo Electrónico</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="correo@uci.cu"
                    value={formState.email}
                    onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Rol</Label>
                  <Select
                    value={formState.role}
                    onValueChange={(value: any) => setFormState((prev) => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Estudiante</SelectItem>
                      <SelectItem value="professor">Profesor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-faculty">Facultad</Label>
                  <Select
                    value={formState.faculty}
                    onValueChange={(value: any) => setFormState((prev) => ({ ...prev, faculty: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar facultad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicina">Medicina</SelectItem>
                      <SelectItem value="enfermeria">Enfermería</SelectItem>
                      <SelectItem value="estomatologia">Estomatología</SelectItem>
                      <SelectItem value="tecnologia">Tecnología de la Salud</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateUser} disabled={isMutating}>
                  {isMutating ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.student}</p>
              <p className="text-sm text-muted-foreground">Estudiantes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.professor}</p>
              <p className="text-sm text-muted-foreground">Profesores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.admin}</p>
              <p className="text-sm text-muted-foreground">Administradores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pendientes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o correo..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="student">Estudiante</SelectItem>
                  <SelectItem value="professor">Profesor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selectedUsers.length} usuario(s) seleccionado(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkStatus(true)} disabled={isMutating}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Activar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatus(false)} disabled={isMutating}>
                  <UserX className="mr-2 h-4 w-4" />
                  Desactivar
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar correo
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isMutating}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            {displayTotal} usuarios encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 text-sm text-muted-foreground">
              {info}
            </div>
          )}
          {isLoading && (
            <div className="mb-4 text-sm text-muted-foreground">
              Cargando usuarios...
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">
                    <Checkbox
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={toggleAllUsers}
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Usuario
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Rol
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Facultad
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Ãšltimo acceso
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        {getRoleBadge(user.role)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{user.faculty}</td>
                    <td className="py-3 px-4">{getStatusBadge(user.status)}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {user.lastLogin}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkEmail()}>
                            <Mail className="mr-2 h-4 w-4" />
                            Enviar correo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(user, user.status !== "active")}>
                            {user.status === "active" ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(user)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {totalOnPage === 0
                ? "Mostrando 0 usuarios"
                : `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, displayTotal)} de ${displayTotal} usuarios`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pages.map((page) => (
                <Button
                  key={page}
                  variant="outline"
                  size="sm"
                  className={page === currentPage ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => setCurrentPage(page)}
                  disabled={isLoading}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
