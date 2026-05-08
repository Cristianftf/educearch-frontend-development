"use client"

import { useRef, useState } from "react"
import { AlertCircle, CheckCircle, Download, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { adminImportApi } from "@/lib/admin-import"

interface CSVRow {
  name: string
  email: string
  role: "student" | "professor" | "admin"
  faculty?: string
  status?: "active" | "inactive" | "pending"
}

interface ImportedUser extends CSVRow {
  rowNumber: number
  importStatus: "valid" | "error" | "warning"
  message?: string
}

interface ImportStats {
  total: number
  imported: number
  updated: number
  failed: number
  errors: { row: number; error: string }[]
}

type ImportStep = "upload" | "preview" | "results"

const EXPECTED_HEADERS = ["name", "email", "role", "faculty", "status"]
const ALLOWED_ROLES: CSVRow["role"][] = ["student", "professor", "admin"]
const ALLOWED_STATUSES: NonNullable<CSVRow["status"]>[] = ["active", "inactive", "pending"]
const ALLOWED_FACULTIES = ["Medicina", "Enfermeria", "Estomatologia", "Tecnologia", "Administracion"]

function isAllowedRole(value: string): value is CSVRow["role"] {
  return ALLOWED_ROLES.includes(value as CSVRow["role"])
}

function isAllowedStatus(value: string): value is NonNullable<CSVRow["status"]> {
  return ALLOWED_STATUSES.includes(value as NonNullable<CSVRow["status"]>)
}

function normalizeCell(value: string | undefined) {
  return (value ?? "").replace(/\r/g, "").trim()
}

export function CSVUserImporter() {
  const [step, setStep] = useState<ImportStep>("upload")
  const [csvFile, setCSVFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [importedUsers, setImportedUsers] = useState<ImportedUser[]>([])
  const [importStats, setImportStats] = useState<ImportStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (file: File): Promise<CSVRow[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = String(event.target?.result ?? "")
          const lines = text
            .split("\n")
            .map((line) => line.replace(/\r/g, ""))
            .filter((line) => line.trim().length > 0)

          if (lines.length < 2) {
            reject(new Error("El CSV debe contener cabecera y al menos una fila de datos."))
            return
          }

          const headers = lines[0].split(",").map((header) => normalizeCell(header).toLowerCase())
          const missingHeaders = EXPECTED_HEADERS.slice(0, 3).filter((header) => !headers.includes(header))
          if (missingHeaders.length > 0) {
            reject(new Error('El CSV debe incluir al menos las columnas "name", "email" y "role".'))
            return
          }

          const nameIndex = headers.indexOf("name")
          const emailIndex = headers.indexOf("email")
          const roleIndex = headers.indexOf("role")
          const facultyIndex = headers.indexOf("faculty")
          const statusIndex = headers.indexOf("status")

          const rows: CSVRow[] = []
          for (let index = 1; index < lines.length; index += 1) {
            const values = lines[index].split(",").map((value) => normalizeCell(value))
            const rawRole = values[roleIndex]?.toLowerCase() ?? ""
            const rawStatus = statusIndex !== -1 ? values[statusIndex]?.toLowerCase() ?? "" : ""
            rows.push({
              name: values[nameIndex] ?? "",
              email: values[emailIndex] ?? "",
              role: isAllowedRole(rawRole) ? rawRole : "student",
              faculty: facultyIndex !== -1 ? values[facultyIndex] : undefined,
              status: isAllowedStatus(rawStatus) ? rawStatus : undefined,
            })
          }
          resolve(rows)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error("Error al leer el archivo."))
      reader.readAsText(file)
    })

  const validateAndParseRows = async (file: File): Promise<ImportedUser[]> => {
    const csvRows = await parseCSV(file)
    return csvRows.map((row, index) => {
      const imported: ImportedUser = {
        ...row,
        rowNumber: index + 2,
        importStatus: "valid",
      }

      if (!row.name || row.name.length < 3) {
        imported.importStatus = "error"
        imported.message = "El nombre debe tener al menos 3 caracteres."
        return imported
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(row.email)) {
        imported.importStatus = "error"
        imported.message = "Correo electrónico inválido."
        return imported
      }

      if (row.faculty && !ALLOWED_FACULTIES.includes(row.faculty) && row.role !== "admin") {
        imported.importStatus = "warning"
        imported.message = `Facultad no estándar: ${row.faculty}`
      }

      if (row.status && !isAllowedStatus(row.status)) {
        imported.importStatus = "warning"
        imported.message = 'El estado se ajustará a "pending".'
        imported.status = "pending"
      }

      return imported
    })
  }

  const handleFileSelect = async (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setPreviewError("Selecciona un archivo CSV válido.")
      return
    }

    setCSVFile(file)
    setPreviewError(null)
    setIsLoading(true)
    try {
      const validated = await validateAndParseRows(file)
      setImportedUsers(validated)
      setStep("preview")
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "No se pudo procesar el CSV.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(event.type === "dragenter" || event.type === "dragover")
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void handleFileSelect(file)
  }

  const handleImport = async () => {
    const validUsers = importedUsers.filter((user) => user.importStatus === "valid")
    if (validUsers.length === 0) {
      setPreviewError("No hay filas válidas para importar.")
      return
    }

    setIsLoading(true)
    try {
      const response = await adminImportApi.importCsvUsers(validUsers.map(({ rowNumber, importStatus, message, ...user }) => user))
      setImportStats({
        total: importedUsers.length,
        imported: response.created || validUsers.length,
        updated: response.updated || 0,
        failed: response.failed || 0,
        errors: response.errors || [],
      })
      setStep("results")
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "No se pudo importar el archivo.")
    } finally {
      setIsLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template =
      "name,email,role,faculty,status\n" +
      "Juan Perez,juan.perez@estudiante.uci.cu,student,Medicina,active\n" +
      "Dra. Maria Lopez,maria.lopez@uci.cu,professor,Medicina,active\n" +
      "Admin Sistema,admin@uci.cu,admin,,active"
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "template_usuarios.csv")
    link.click()
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Importar usuarios desde CSV</CardTitle>
          <CardDescription>Solo se enviarán al backend las filas que pasen la validación local.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={step} onValueChange={(value) => setStep(value as ImportStep)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">1. Cargar</TabsTrigger>
              <TabsTrigger value="preview" disabled={importedUsers.length === 0}>2. Revisar</TabsTrigger>
              <TabsTrigger value="results" disabled={!importStats}>3. Resultados</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="text-sm text-blue-900">Descarga la plantilla base si necesitas el formato estándar.</div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Plantilla
                </Button>
              </div>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && void handleFileSelect(event.target.files[0])} className="hidden" />
                <div className="flex flex-col items-center gap-2">
                  <Upload className={`h-8 w-8 ${dragActive ? "text-blue-500" : "text-gray-400"}`} />
                  <div className="text-base font-medium">{csvFile ? csvFile.name : "Arrastra tu archivo CSV aquí"}</div>
                  <div className="text-sm text-gray-500">o haz clic para seleccionarlo</div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1 text-sm">
                    <p>Columnas requeridas: <strong>name, email, role</strong></p>
                    <p>Columnas opcionales: faculty, status</p>
                    <p>Roles válidos: student, professor, admin</p>
                  </div>
                </AlertDescription>
              </Alert>

              {previewError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando archivo...
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <Card className="p-3"><div className="text-2xl font-bold">{importedUsers.length}</div><div className="text-xs text-gray-600">Filas</div></Card>
                <Card className="border-green-200 bg-green-50 p-3"><div className="text-2xl font-bold text-green-700">{importedUsers.filter((user) => user.importStatus === "valid").length}</div><div className="text-xs text-green-700">Válidas</div></Card>
                <Card className="border-yellow-200 bg-yellow-50 p-3"><div className="text-2xl font-bold text-yellow-700">{importedUsers.filter((user) => user.importStatus === "warning").length}</div><div className="text-xs text-yellow-700">Advertencias</div></Card>
                <Card className="border-red-200 bg-red-50 p-3"><div className="text-2xl font-bold text-red-700">{importedUsers.filter((user) => user.importStatus === "error").length}</div><div className="text-xs text-red-700">Errores</div></Card>
              </div>

              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Facultad</TableHead>
                      <TableHead className="w-24">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedUsers.map((user) => (
                      <TableRow key={user.rowNumber} className={user.importStatus === "error" ? "bg-red-50" : user.importStatus === "warning" ? "bg-yellow-50" : ""}>
                        <TableCell className="text-xs text-gray-500">{user.rowNumber}</TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                        <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                        <TableCell className="text-sm text-gray-600">{user.faculty || "-"}</TableCell>
                        <TableCell>
                          {user.importStatus === "valid" && <Badge className="gap-1 bg-green-100 text-green-800"><CheckCircle className="h-3 w-3" />OK</Badge>}
                          {user.importStatus === "warning" && <Badge className="bg-yellow-100 text-yellow-800">Aviso</Badge>}
                          {user.importStatus === "error" && <Badge className="gap-1 bg-red-100 text-red-800" title={user.message}><X className="h-3 w-3" />Error</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {importedUsers.some((user) => user.message) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {importedUsers.filter((user) => user.message).map((user) => (
                        <div key={user.rowNumber} className="text-sm"><strong>Fila {user.rowNumber}:</strong> {user.message}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setStep("upload"); setCSVFile(null); setImportedUsers([]) }}>Cancelar</Button>
                <Button onClick={handleImport} disabled={isLoading || importedUsers.filter((user) => user.importStatus === "valid").length === 0}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importar {importedUsers.filter((user) => user.importStatus === "valid").length} usuario(s)
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {importStats && (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <Card className="p-3"><div className="text-2xl font-bold">{importStats.total}</div><div className="text-xs text-gray-600">Procesadas</div></Card>
                    <Card className="border-green-200 bg-green-50 p-3"><div className="text-2xl font-bold text-green-700">{importStats.imported}</div><div className="text-xs text-green-700">Importadas</div></Card>
                    <Card className="border-blue-200 bg-blue-50 p-3"><div className="text-2xl font-bold text-blue-700">{importStats.updated}</div><div className="text-xs text-blue-700">Actualizadas</div></Card>
                    <Card className="border-red-200 bg-red-50 p-3"><div className="text-2xl font-bold text-red-700">{importStats.failed}</div><div className="text-xs text-red-700">Fallidas</div></Card>
                  </div>

                  {importStats.imported > 0 && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-700" />
                      <AlertDescription className="text-green-800">
                        Se importaron {importStats.imported} usuario(s).
                        {importStats.updated > 0 && <> Se actualizaron {importStats.updated} usuario(s).</>}
                      </AlertDescription>
                    </Alert>
                  )}

                  {importStats.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <p className="font-medium">{importStats.failed} fila(s) con error:</p>
                          {importStats.errors.slice(0, 5).map((error) => (
                            <div key={error.row} className="text-sm"><strong>Fila {error.row}:</strong> {error.error}</div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => { setStep("upload"); setCSVFile(null); setImportedUsers([]); setImportStats(null) }}>Importar otro archivo</Button>
                    <Button onClick={() => window.location.reload()}>Cerrar</Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
