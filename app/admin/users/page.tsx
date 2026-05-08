"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { CSVUserImporter } from "@/components/csv-user-importer"
import { adminUsersApi, type AdminUserPayload } from "@/lib/admin-users"
import type { User, UserRole } from "@/types"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  GraduationCap,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  Users,
  UserX,
} from "lucide-react"

type UserRow = {
  id: string
  name: string
  email: string
  role: "student" | "professor" | "admin"
  status: "active" | "inactive"
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

type UserStats = {
  students: number
  professors: number
  admins: number
  active: number
  inactive: number
}

const PAGE_SIZE = 20
const USERS_UI_STATE_KEY = "admin_users_ui_v1"
const FACULTY_OPTIONS = [
  { value: "medicina", label: "Medicina" },
  { value: "enfermeria", label: "Enfermería" },
  { value: "estomatologia", label: "Estomatología" },
  { value: "tecnologia", label: "Tecnología de la Salud" },
] as const
const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "student", label: "Estudiante" },
  { value: "professor", label: "Profesor" },
  { value: "admin", label: "Administrador" },
]

const defaultStats: UserStats = {
  students: 0,
  professors: 0,
  admins: 0,
  active: 0,
  inactive: 0,
}

const defaultFormState: UserFormState = {
  name: "",
  email: "",
  role: "student",
  faculty: "",
}

const sanitizePersonName = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 160)
const sanitizeEmail = (value: string) => value.trim().toLowerCase()

const sanitizeFaculty = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (normalized === "medicina") return "Medicina"
  if (normalized === "enfermeria") return "Enfermería"
  if (normalized === "estomatologia") return "Estomatología"
  if (normalized === "tecnologia") return "Tecnología de la Salud"
  return value.trim().slice(0, 120)
}

const toUserRow = (user: User): UserRow => {
  const extended = user as User & Record<string, unknown>
  const name =
    String(extended.name || "").trim() ||
    [extended.firstName, extended.lastName].filter(Boolean).join(" ") ||
    String(extended.email || "").trim() ||
    "Sin nombre"

  const roleValue = String(extended.role ?? "student").toLowerCase()
  const role: UserRow["role"] = roleValue.includes("admin")
    ? "admin"
    : roleValue.includes("professor")
      ? "professor"
      : "student"

  const status: UserRow["status"] =
    typeof extended.status === "string" && extended.status.toLowerCase() === "active"
      ? "active"
      : typeof extended.isActive === "boolean"
        ? extended.isActive
          ? "active"
          : "inactive"
        : "inactive"

  return {
    id: String(extended.id ?? ""),
    name,
    email: String(extended.email ?? ""),
    role,
    status,
    faculty: String(extended.faculty ?? ""),
    lastLogin: String(extended.lastLogin ?? "Nunca"),
    createdAt: String(extended.createdAt ?? ""),
    avatar: typeof extended.avatar === "string" ? extended.avatar : undefined,
  }
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

function getRoleBadge(role: UserRow["role"]) {
  const variants: Record<UserRow["role"], { label: string; className: string }> = {
    student: { label: "Estudiante", className: "bg-blue-100 text-blue-700" },
    professor: { label: "Profesor", className: "bg-violet-100 text-violet-700" },
    admin: { label: "Administrador", className: "bg-red-100 text-red-700" },
  }
  return <Badge className={variants[role].className}>{variants[role].label}</Badge>
}

function getRoleIcon(role: UserRow["role"]) {
  if (role === "student") return <GraduationCap className="h-4 w-4" />
  if (role === "professor") return <BookOpen className="h-4 w-4" />
  return <Shield className="h-4 w-4" />
}

function getStatusBadge(status: UserRow["status"]) {
  return status === "active" ? (
    <Badge className="bg-green-100 text-green-700">Activo</Badge>
  ) : (
    <Badge className="bg-gray-100 text-gray-700">Inactivo</Badge>
  )
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
  const [stats, setStats] = useState<UserStats>(defaultStats)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [formState, setFormState] = useState<UserFormState>(defaultFormState)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(USERS_UI_STATE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        searchQuery: string
        roleFilter: string
        statusFilter: string
        currentPage: number
      }>
      if (typeof parsed.searchQuery === "string") setSearchQuery(parsed.searchQuery)
      if (typeof parsed.roleFilter === "string") setRoleFilter(parsed.roleFilter)
      if (typeof parsed.statusFilter === "string") setStatusFilter(parsed.statusFilter)
      if (typeof parsed.currentPage === "number" && parsed.currentPage > 0) setCurrentPage(parsed.currentPage)
    } catch {
      // Ignore invalid persisted state.
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      USERS_UI_STATE_KEY,
      JSON.stringify({ searchQuery, roleFilter, statusFilter, currentPage })
    )
  }, [currentPage, roleFilter, searchQuery, statusFilter])

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await adminUsersApi.getAll(currentPage, PAGE_SIZE, {
        role: roleFilter !== "all" ? (roleFilter as UserRole) : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
      })
      setUsers(response.users.map(toUserRow))
      setTotal(response.total)
      setTotalPages(response.totalPages || Math.max(1, Math.ceil(response.total / PAGE_SIZE)))
      setStats({
        students: Number(response.stats?.students ?? 0),
        professors: Number(response.stats?.professors ?? 0),
        admins: Number(response.stats?.admins ?? 0),
        active: Number(response.stats?.active ?? 0),
        inactive: Number(response.stats?.inactive ?? 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los usuarios.")
      setUsers([])
      setTotal(0)
      setTotalPages(1)
      setStats(defaultStats)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, roleFilter, searchQuery, statusFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    setCurrentPage(1)
  }, [roleFilter, statusFilter, searchQuery])

  useEffect(() => {
    setSelectedUsers((previous) => previous.filter((id) => users.some((user) => user.id === id)))
  }, [users])

  const resetForm = () => {
    setFormState(defaultFormState)
    setEditingUser(null)
  }

  const buildPayload = (active: boolean): AdminUserPayload => {
    const normalizedName = sanitizePersonName(formState.name)
    const normalizedEmail = sanitizeEmail(formState.email)
    if (!normalizedName || !normalizedEmail) {
      throw new Error("Nombre y correo son obligatorios.")
    }
    if (!normalizedEmail.includes("@")) {
      throw new Error("Correo electrónico inválido.")
    }
    const { firstName, lastName } = splitName(normalizedName)
    return {
      email: normalizedEmail,
      role: formState.role,
      faculty: sanitizeFaculty(formState.faculty),
      firstName,
      lastName,
      isActive: active,
    }
  }

  const handleCreateUser = async () => {
    setIsMutating(true)
    setError(null)
    setInfo(null)
    try {
      await adminUsersApi.create(buildPayload(true))
      setIsCreateDialogOpen(false)
      resetForm()
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.")
    } finally {
      setIsMutating(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return
    setIsMutating(true)
    setError(null)
    setInfo(null)
    try {
      await adminUsersApi.update(editingUser.id, buildPayload(editingUser.status === "active"))
      setIsEditDialogOpen(false)
      resetForm()
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario.")
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

  const handleToggleStatus = async (user: UserRow, active: boolean) => {
    setIsMutating(true)
    setError(null)
    setInfo(null)
    try {
      await adminUsersApi.changeStatus(user.id, active)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado.")
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteUser = async (user: UserRow) => {
    if (!window.confirm(`¿Eliminar al usuario ${user.name}?`)) return
    setIsMutating(true)
    setError(null)
    setInfo(null)
    try {
      await adminUsersApi.delete(user.id)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el usuario.")
    } finally {
      setIsMutating(false)
    }
  }

  const handleBulkStatus = async (active: boolean) => {
    setIsMutating(true)
    setError(null)
    setInfo(null)
    try {
      await Promise.all(selectedUsers.map((id) => adminUsersApi.changeStatus(id, active)))
      setSelectedUsers([])
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron actualizar los usuarios seleccionados.")
    } finally {
      setIsMutating(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`¿Eliminar ${selectedUsers.length} usuario(s)?`)) return
    setIsMutating(true)
    setError(null)
    setInfo(null)
    try {
      await Promise.all(selectedUsers.map((id) => adminUsersApi.delete(id)))
      setSelectedUsers([])
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron eliminar los usuarios seleccionados.")
    } finally {
      setIsMutating(false)
    }
  }

  const handleBulkEmail = (targetIds?: string[]) => {
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedUsers
    const emails = users
      .filter((user) => ids.includes(user.id))
      .map((user) => user.email)
      .filter(Boolean)

    if (emails.length === 0) {
      setInfo("No hay correos válidos seleccionados.")
      return
    }

    const bcc = encodeURIComponent(emails.join(","))
    const subject = encodeURIComponent("Comunicado del administrador")
    window.location.href = `mailto:?bcc=${bcc}&subject=${subject}`
    setInfo(`Se abrió el cliente de correo con ${emails.length} destinatario(s).`)
  }

  const pages = useMemo(() => {
    const maxPages = 5
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - maxPages + 1))
    const end = Math.min(totalPages, start + maxPages - 1)
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }, [currentPage, totalPages])

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((previous) =>
      previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId]
    )
  }

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) setSelectedUsers([])
    else setSelectedUsers(users.map((user) => user.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de usuarios</h1>
          <p className="text-muted-foreground">Administra cuentas, roles, activación y carga masiva de usuarios.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
              <DialogHeader>
                <DialogTitle>Importar usuarios desde CSV</DialogTitle>
                <DialogDescription>Carga un archivo CSV para crear o actualizar usuarios en lote.</DialogDescription>
              </DialogHeader>
              <CSVUserImporter />
            </DialogContent>
          </Dialog>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open)
              if (open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear usuario</DialogTitle>
                <DialogDescription>Completa los datos mínimos para registrar una nueva cuenta.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input id="name" value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input id="email" type="email" value={formState.email} onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select value={formState.role} onValueChange={(value) => setFormState((prev) => ({ ...prev, role: value as UserRole }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faculty">Facultad</Label>
                  <Select value={formState.faculty} onValueChange={(value) => setFormState((prev) => ({ ...prev, faculty: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una facultad" />
                    </SelectTrigger>
                    <SelectContent>
                      {FACULTY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} disabled={isMutating}>
                  {isMutating ? "Creando..." : "Crear usuario"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Editar usuario</DialogTitle>
                <DialogDescription>Actualiza los datos visibles del usuario seleccionado.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre completo</Label>
                  <Input id="edit-name" value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Correo electrónico</Label>
                  <Input id="edit-email" type="email" value={formState.email} onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Rol</Label>
                  <Select value={formState.role} onValueChange={(value) => setFormState((prev) => ({ ...prev, role: value as UserRole }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-faculty">Facultad</Label>
                  <Select value={formState.faculty} onValueChange={(value) => setFormState((prev) => ({ ...prev, faculty: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una facultad" />
                    </SelectTrigger>
                    <SelectContent>
                      {FACULTY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateUser} disabled={isMutating}>
                  {isMutating ? "Guardando..." : "Guardar cambios"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="flex items-center gap-4 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100"><GraduationCap className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.students}</p><p className="text-sm text-muted-foreground">Estudiantes</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100"><BookOpen className="h-5 w-5 text-violet-600" /></div><div><p className="text-2xl font-bold">{stats.professors}</p><p className="text-sm text-muted-foreground">Profesores</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100"><Shield className="h-5 w-5 text-red-600" /></div><div><p className="text-2xl font-bold">{stats.admins}</p><p className="text-sm text-muted-foreground">Administradores</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{stats.inactive}</p><p className="text-sm text-muted-foreground">Inactivos</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o correo..." className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Rol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="student">Estudiante</SelectItem>
                  <SelectItem value="professor">Profesor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedUsers.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{selectedUsers.length} usuario(s) seleccionados</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkStatus(true)} disabled={isMutating}><UserCheck className="mr-2 h-4 w-4" />Activar</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatus(false)} disabled={isMutating}><UserX className="mr-2 h-4 w-4" />Desactivar</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkEmail()}><Mail className="mr-2 h-4 w-4" />Enviar correo</Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isMutating}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de usuarios</CardTitle>
          <CardDescription>{total} usuarios encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 text-sm text-destructive">{error}</div>}
          {info && <div className="mb-4 text-sm text-muted-foreground">{info}</div>}
          {isLoading && <div className="mb-4 text-sm text-muted-foreground">Cargando usuarios...</div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left">
                    <Checkbox checked={selectedUsers.length === users.length && users.length > 0} onCheckedChange={toggleAllUsers} />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rol</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Facultad</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Último acceso</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Checkbox checked={selectedUsers.includes(user.id)} onCheckedChange={() => toggleUserSelection(user.id)} />
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        {getRoleBadge(user.role)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.faculty || "-"}</td>
                    <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{user.lastLogin}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleOpenEdit(user)}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkEmail([user.id])}><Mail className="mr-2 h-4 w-4" />Enviar correo</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(user, user.status !== "active")}>
                            {user.status === "active" ? <><UserX className="mr-2 h-4 w-4" />Desactivar</> : <><UserCheck className="mr-2 h-4 w-4" />Activar</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(user)}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {users.length === 0
                ? "Mostrando 0 usuarios"
                : `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, total)} de ${total} usuarios`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1 || isLoading} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              {pages.map((page) => (
                <Button key={page} variant="outline" size="sm" className={page === currentPage ? "bg-primary text-primary-foreground" : ""} onClick={() => setCurrentPage(page)} disabled={isLoading}>
                  {page}
                </Button>
              ))}
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages || isLoading} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
