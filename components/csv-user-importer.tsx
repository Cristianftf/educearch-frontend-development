"use client"

import { useState, useRef } from "react"
import { Upload, AlertCircle, CheckCircle, X, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { adminImportApi } from "@/lib/admin-import"

type ImportResult = "success" | "error" | "warning"

interface CSVRow {
  name: string
  email: string
  role: "student" | "professor" | "admin"
  faculty?: string
  status?: "active" | "inactive"
}

interface ImportedUser extends CSVRow {
  rowNumber: number
  status: "valid" | "error" | "warning"
  message?: string
}

interface ImportStats {
  total: number
  imported: number
  updated: number
  failed: number
  errors: { row: number; error: string }[]
}

const EXPECTED_HEADERS = ["name", "email", "role", "faculty", "status"]
const ALLOWED_ROLES = ["student", "professor", "admin"]
const ALLOWED_FACULTIES = [
  "Medicina",
  "Enfermería",
  "Estomatología",
  "Tecnología",
  "Administración",
]

export function CSVUserImporter() {
  const [step, setStep] = useState<"upload" | "preview" | "results">("upload")
  const [csvFile, setCSVFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [importedUsers, setImportedUsers] = useState<ImportedUser[]>([])
  const [importStats, setImportStats] = useState<ImportStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Parse CSV file
  const parseCSV = (file: File): Promise<CSVRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.trim().split("\n")

          if (lines.length < 2) {
            reject(new Error("CSV debe contener al menos headers + 1 fila de datos"))
            return
          }

          // Parse headers
          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
          const nameIndex = headers.indexOf("name")
          const emailIndex = headers.indexOf("email")
          const roleIndex = headers.indexOf("role")
          const facultyIndex = headers.indexOf("faculty")
          const statusIndex = headers.indexOf("status")

          if (nameIndex === -1 || emailIndex === -1 || roleIndex === -1) {
            reject(
              new Error('CSV debe contener columnas: "name", "email", "role"')
            )
            return
          }

          // Parse rows
          const rows: CSVRow[] = []
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            const values = line.split(",").map((v) => v.trim())
            const row: CSVRow = {
              name: values[nameIndex] || "",
              email: values[emailIndex] || "",
              role: (values[roleIndex] || "").toLowerCase() as any,
              faculty: facultyIndex !== -1 ? values[facultyIndex] : undefined,
              status: statusIndex !== -1 ? (values[statusIndex] as any) : undefined,
            }
            rows.push(row)
          }

          resolve(rows)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error("Error al leer archivo"))
      reader.readAsText(file)
    })
  }

  // Validate rows
  const validateAndParseRows = async (file: File): Promise<ImportedUser[]> => {
    try {
      const csvRows = await parseCSV(file)
      const validated: ImportedUser[] = csvRows.map((row, index) => {
        const imported: ImportedUser = {
          ...row,
          rowNumber: index + 2, // +2 because index 0 is headers, +1 for display
          status: "valid",
        }

        // Validate name
        if (!row.name || row.name.length < 3) {
          imported.status = "error"
          imported.message = "Nombre debe tener al menos 3 caracteres"
          return imported
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(row.email)) {
          imported.status = "error"
          imported.message = "Email inválido"
          return imported
        }

        // Validate role
        if (!ALLOWED_ROLES.includes(row.role)) {
          imported.status = "error"
          imported.message = `Rol debe ser: ${ALLOWED_ROLES.join(", ")}`
          return imported
        }

        // Validate faculty if provided
        if (
          row.faculty &&
          !ALLOWED_FACULTIES.includes(row.faculty) &&
          row.role !== "admin"
        ) {
          imported.status = "warning"
          imported.message = `Facultad no estándar: ${row.faculty}`
        }

        // Validate status if provided
        if (row.status && !["active", "inactive", "pending"].includes(row.status)) {
          imported.status = "warning"
          imported.message = `Estado será configurado como "pending"`
          imported.status = "active"
        }

        return imported
      })

      return validated
    } catch (error) {
      throw error
    }
  }

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setPreviewError("Por favor selecciona un archivo CSV válido")
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
      setPreviewError(
        error instanceof Error ? error.message : "Error al parsear CSV"
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Import users to backend
  const handleImport = async () => {
    const validUsers = importedUsers.filter((u) => u.status === "valid")

    if (validUsers.length === 0) {
      setPreviewError("No hay usuarios válidos para importar")
      return
    }

    setIsLoading(true)

    try {
      // Call backend API
      const response = await adminImportApi.importCsvUsers(
        validUsers.map(({ rowNumber, status, message, ...user }) => user)
      )

      const stats: ImportStats = {
        total: importedUsers.length,
        imported: response.imported || validUsers.length,
        updated: response.updated || 0,
        failed: response.failed || 0,
        errors: response.errors || [],
      }

      setImportStats(stats)
      setStep("results")
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Error al importar usuarios"
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Download template
  const downloadTemplate = () => {
    const template =
      "name,email,role,faculty,status\n" +
      "Juan Pérez,juan.perez@estudiante.uci.cu,student,Medicina,active\n" +
      "Dr. María López,maria.lopez@uci.cu,professor,Medicina,active\n" +
      "Admin Sistema,admin@uci.cu,admin,,active"

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "template_usuarios.csv")
    link.click()
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Importar Usuarios desde CSV</CardTitle>
          <CardDescription>
            Carga un archivo CSV con usuarios. Solo se importarán filas válidas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={step} onValueChange={(v: any) => setStep(v)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">1. Cargar</TabsTrigger>
              <TabsTrigger value="preview" disabled={importedUsers.length === 0}>
                2. Previsualizar
              </TabsTrigger>
              <TabsTrigger value="results" disabled={!importStats}>
                3. Resultados
              </TabsTrigger>
            </TabsList>

            {/* UPLOAD TAB */}
            <TabsContent value="upload" className="space-y-4">
              {/* Template Download */}
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-900">
                  📋 Necesitas ayuda con el formato? Descarga la plantilla
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Plantilla
                </Button>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center gap-2">
                  <Upload className={`w-8 h-8 ${dragActive ? "text-blue-500" : "text-gray-400"}`} />
                  <div className="text-base font-medium">
                    {csvFile ? csvFile.name : "Arrastra tu archivo CSV aquí"}
                  </div>
                  <div className="text-sm text-gray-500">
                    o haz click para seleccionar un archivo
                  </div>
                </div>
              </div>

              {/* File Requirements */}
              <Alert>
                <AlertCircle className="w-4 h-4" />
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
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando archivo...
                </div>
              )}
            </TabsContent>

            {/* PREVIEW TAB */}
            <TabsContent value="preview" className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="p-3">
                  <div className="text-2xl font-bold">{importedUsers.length}</div>
                  <div className="text-xs text-gray-600">Total de filas</div>
                </Card>
                <Card className="p-3 border-green-200 bg-green-50">
                  <div className="text-2xl font-bold text-green-700">
                    {importedUsers.filter((u) => u.status === "valid").length}
                  </div>
                  <div className="text-xs text-green-700">Válidas</div>
                </Card>
                <Card className="p-3 border-yellow-200 bg-yellow-50">
                  <div className="text-2xl font-bold text-yellow-700">
                    {importedUsers.filter((u) => u.status === "warning").length}
                  </div>
                  <div className="text-xs text-yellow-700">Advertencias</div>
                </Card>
                <Card className="p-3 border-red-200 bg-red-50">
                  <div className="text-2xl font-bold text-red-700">
                    {importedUsers.filter((u) => u.status === "error").length}
                  </div>
                  <div className="text-xs text-red-700">Errores</div>
                </Card>
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg overflow-auto max-h-96">
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
                      <TableRow
                        key={user.rowNumber}
                        className={
                          user.status === "error"
                            ? "bg-red-50"
                            : user.status === "warning"
                              ? "bg-yellow-50"
                              : ""
                        }
                      >
                        <TableCell className="text-xs text-gray-500">
                          {user.rowNumber}
                        </TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {user.faculty || "-"}
                        </TableCell>
                        <TableCell>
                          {user.status === "valid" && (
                            <Badge className="bg-green-100 text-green-800 gap-1">
                              <CheckCircle className="w-3 h-3" />
                              OK
                            </Badge>
                          )}
                          {user.status === "warning" && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              ⚠️ Aviso
                            </Badge>
                          )}
                          {user.status === "error" && (
                            <Badge className="bg-red-100 text-red-800 gap-1 cursor-help" title={user.message}>
                              <X className="w-3 h-3" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Error Messages */}
              {importedUsers.some((u) => u.message) && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {importedUsers
                        .filter((u) => u.message)
                        .map((u) => (
                          <div key={u.rowNumber} className="text-sm">
                            <strong>Fila {u.rowNumber}:</strong> {u.message}
                          </div>
                        ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload")
                    setCSVFile(null)
                    setImportedUsers([])
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    isLoading ||
                    importedUsers.filter((u) => u.status === "valid").length === 0
                  }
                  className="gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Importar {importedUsers.filter((u) => u.status === "valid").length} usuario
                  {importedUsers.filter((u) => u.status === "valid").length !== 1 ? "s" : ""}
                </Button>
              </div>
            </TabsContent>

            {/* RESULTS TAB */}
            <TabsContent value="results" className="space-y-4">
              {importStats && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <Card className="p-3">
                      <div className="text-2xl font-bold">{importStats.total}</div>
                      <div className="text-xs text-gray-600">Procesadas</div>
                    </Card>
                    <Card className="p-3 border-green-200 bg-green-50">
                      <div className="text-2xl font-bold text-green-700">
                        {importStats.imported}
                      </div>
                      <div className="text-xs text-green-700">Importadas</div>
                    </Card>
                    <Card className="p-3 border-blue-200 bg-blue-50">
                      <div className="text-2xl font-bold text-blue-700">
                        {importStats.updated}
                      </div>
                      <div className="text-xs text-blue-700">Actualizadas</div>
                    </Card>
                    <Card className="p-3 border-red-200 bg-red-50">
                      <div className="text-2xl font-bold text-red-700">
                        {importStats.failed}
                      </div>
                      <div className="text-xs text-red-700">Fallidas</div>
                    </Card>
                  </div>

                  {/* Success Alert */}
                  {importStats.imported > 0 && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="w-4 h-4 text-green-700" />
                      <AlertDescription className="text-green-800">
                        ✅ Se importaron exitosamente {importStats.imported} usuario
                        {importStats.imported !== 1 ? "s" : ""}.
                        {importStats.updated > 0 && (
                          <> Se actualizaron {importStats.updated} usuario{importStats.updated !== 1 ? "s" : ""}.</>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Error Summary */}
                  {importStats.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {importStats.failed} usuario{importStats.failed !== 1 ? "s" : ""} con error:
                          </p>
                          {importStats.errors.slice(0, 5).map((err) => (
                            <div key={err.row} className="text-sm">
                              <strong>Fila {err.row}:</strong> {err.error}
                            </div>
                          ))}
                          {importStats.errors.length > 5 && (
                            <p className="text-sm italic">
                              +{importStats.errors.length - 5} errores más
                            </p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep("upload")
                        setCSVFile(null)
                        setImportedUsers([])
                        setImportStats(null)
                      }}
                    >
                      Importar otro archivo
                    </Button>
                    <Button
                      onClick={() => {
                        window.location.reload()
                      }}
                    >
                      Cerrar
                    </Button>
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
