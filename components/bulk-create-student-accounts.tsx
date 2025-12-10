"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { createStudentAuthAccounts } from "@/lib/admin"
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"

export function BulkCreateStudentAccounts({ classId }: { classId?: string }) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const result = await createStudentAuthAccounts(classId)
      setResults(result)
    } catch (error: any) {
      setResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Student Login Accounts</CardTitle>
        <CardDescription>
          Generate login credentials for students. Username format: RegisterNumber-ClassName, Password: RegisterNumber
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleCreate} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {classId ? "Create Accounts for This Class" : "Create Accounts for All Students"}
        </Button>

        {results?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Error:</p>
            <p>{results.error}</p>
          </div>
        )}

        {results?.summary && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{results.summary.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Success</p>
                  <p className="text-2xl font-bold text-green-600">{results.summary.success}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{results.summary.failed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600">{results.summary.skipped}</p>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Register Number</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.results?.map((result: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {result.status === "success" && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Success
                          </Badge>
                        )}
                        {result.status === "failed" && (
                          <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                        {result.status === "skipped" && (
                          <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Skipped
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{result.studentName}</TableCell>
                      <TableCell className="font-mono">{result.registerNumber}</TableCell>
                      <TableCell className="font-mono text-blue-600">{result.username}</TableCell>
                      <TableCell className="font-mono text-green-600">{result.password}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {result.error || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                📋 Save these credentials! Share them with students for login.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
