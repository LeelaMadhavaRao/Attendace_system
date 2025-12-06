"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createStudentsBulk } from "@/lib/faculty"
import { toast } from "sonner"
import { Loader2, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import * as XLSX from "xlsx"

interface UploadStudentsDialogProps {
  classId: string
}

interface ParsedStudent {
  registerNumber: string
  name: string
  whatsappNumber?: string
  parentWhatsappNumber?: string
}

export function UploadStudentsDialog({ classId }: UploadStudentsDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const router = useRouter()

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        const students: ParsedStudent[] = jsonData
          .map((row: unknown) => {
            const r = row as Record<string, unknown>
            return {
              registerNumber: String(r["Register Number"] || r["register_number"] || r["Reg No"] || r["RegNo"] || ""),
              name: String(r["Name"] || r["Student Name"] || r["student_name"] || ""),
              whatsappNumber:
                r["WhatsApp"] || r["whatsapp_number"] || r["Student WhatsApp"]
                  ? String(r["WhatsApp"] || r["whatsapp_number"] || r["Student WhatsApp"])
                  : undefined,
              parentWhatsappNumber:
                r["Parent WhatsApp"] || r["parent_whatsapp_number"] || r["Parent Phone"]
                  ? String(r["Parent WhatsApp"] || r["parent_whatsapp_number"] || r["Parent Phone"])
                  : undefined,
            }
          })
          .filter((s) => s.registerNumber && s.name)

        if (students.length === 0) {
          setParseError("No valid student data found. Please ensure columns include: Register Number, Name")
          setParsedStudents([])
        } else {
          setParsedStudents(students)
          setParseError(null)
        }
      } catch {
        setParseError("Failed to parse Excel file. Please check the format.")
        setParsedStudents([])
      }
    }

    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
        parseExcel(file)
      } else {
        setParseError("Please upload an Excel file (.xlsx or .xls)")
      }
    },
    [parseExcel],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        parseExcel(file)
      }
    },
    [parseExcel],
  )

  const handleSubmit = async () => {
    if (parsedStudents.length === 0) return
    setIsLoading(true)

    try {
      const result = await createStudentsBulk(
        parsedStudents.map((s) => ({
          ...s,
          classId,
        })),
      )

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Successfully added ${result.count} students`)
        setOpen(false)
        setParsedStudents([])
        router.refresh()
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Students from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file with columns: Register Number, Name, WhatsApp (optional), Parent WhatsApp (optional)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">Drag and drop your Excel file here, or click to browse</p>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" id="excel-upload" />
            <label htmlFor="excel-upload">
              <Button type="button" variant="outline" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
          </div>

          {/* Parse Results */}
          {parseError && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{parseError}</p>
            </div>
          )}

          {parsedStudents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Found {parsedStudents.length} students</p>
              </div>
              <div className="max-h-48 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Reg No.</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">WhatsApp</th>
                      <th className="text-left p-2">Parent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedStudents.slice(0, 10).map((student, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 font-mono">{student.registerNumber}</td>
                        <td className="p-2">{student.name}</td>
                        <td className="p-2 text-muted-foreground">{student.whatsappNumber || "-"}</td>
                        <td className="p-2 text-muted-foreground">{student.parentWhatsappNumber || "-"}</td>
                      </tr>
                    ))}
                    {parsedStudents.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-center text-muted-foreground">
                          ... and {parsedStudents.length - 10} more students
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || parsedStudents.length === 0}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              `Add ${parsedStudents.length} Students`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
