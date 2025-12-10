"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList, TrendingUp, AlertTriangle, CheckCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStudentAttendance, type StudentAttendanceData } from "@/lib/student-attendance"
import { clearStudentAuthData } from "@/lib/student-logout"

export default function StudentDashboard() {
  const router = useRouter()
  const [studentName, setStudentName] = useState("")
  const [registerNumber, setRegisterNumber] = useState("")
  const [className, setClassName] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper function to parse cookies
  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null
    return null
  }

  useEffect(() => {
    console.log("[STUDENT_PAGE] useEffect running at:", new Date().toLocaleTimeString())
    
    // Check URL for auth data (from redirect after login)
    const params = new URLSearchParams(window.location.search)
    const authenticated = params.get("authenticated")
    const name = params.get("name")
    const register = params.get("register")
    const classN = params.get("class")

    console.log("[STUDENT_PAGE] Query params - authenticated:", authenticated, "name:", name, "register:", register, "class:", classN)

    if (authenticated === "true" && name && register && classN) {
      // Store in all storage locations for persistence
      localStorage.setItem("userRole", "student")
      localStorage.setItem("studentName", name)
      localStorage.setItem("registerNumber", register)
      localStorage.setItem("className", classN)
      
      sessionStorage.setItem("userRole", "student")
      sessionStorage.setItem("studentName", name)
      sessionStorage.setItem("registerNumber", register)
      sessionStorage.setItem("className", classN)
      
      // Also store in cookie
      const authData = {
        userRole: "student",
        studentName: name,
        registerNumber: register,
        className: classN,
      }
      const expirationDate = new Date()
      expirationDate.setTime(expirationDate.getTime() + 10 * 24 * 60 * 60 * 1000)
      document.cookie = `studentAuth=${JSON.stringify(authData)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Strict`
      
      console.log("[STUDENT_PAGE] Stored auth from query params in all storage locations")
      setStudentName(name)
      setRegisterNumber(register)
      setClassName(classN)
      setIsAuthenticated(true)
      
      // Clean up URL - remove query params
      setTimeout(() => {
        console.log("[STUDENT_PAGE] Cleaning URL")
        window.history.replaceState({}, "", "/student")
      }, 0)
      return
    }
    
    // Try reading from cookie first
    const cookieAuth = getCookie("studentAuth")
    if (cookieAuth) {
      try {
        const authData = JSON.parse(cookieAuth)
        console.log("[STUDENT_PAGE] Authenticated from cookie")
        setStudentName(authData.studentName)
        setRegisterNumber(authData.registerNumber)
        setClassName(authData.className)
        setIsAuthenticated(true)
        return
      } catch (err) {
        console.error("[STUDENT_PAGE] Failed to parse cookie:", err)
      }
    }
    
    // Try reading from sessionStorage
    const sessionRole = sessionStorage.getItem("userRole")
    const sessionName = sessionStorage.getItem("studentName")
    const sessionRegNum = sessionStorage.getItem("registerNumber")
    const sessionClass = sessionStorage.getItem("className")

    if (sessionRole === "student" && sessionName && sessionRegNum && sessionClass) {
      console.log("[STUDENT_PAGE] Authenticated from sessionStorage")
      setStudentName(sessionName)
      setRegisterNumber(sessionRegNum)
      setClassName(sessionClass)
      setIsAuthenticated(true)
      return
    }
    
    // Check localStorage for existing session
    const role = localStorage.getItem("userRole")
    const localName = localStorage.getItem("studentName")
    const localRegNum = localStorage.getItem("registerNumber")
    const localClass = localStorage.getItem("className")

    console.log("[STUDENT_PAGE] Checking localStorage - Role:", role, "Name:", localName, "RegNum:", localRegNum, "Class:", localClass)

    if (role === "student" && localName && localRegNum && localClass) {
      // Authenticated
      console.log("[STUDENT_PAGE] Authenticated from localStorage")
      setStudentName(localName)
      setRegisterNumber(localRegNum)
      setClassName(localClass)
      setIsAuthenticated(true)
    } else {
      // Not authenticated - redirect to login
      console.log("[STUDENT_PAGE] Not authenticated, redirecting to login")
      setIsAuthenticated(false)
      router.push("/login")
    }
  }, [router])

  // Fetch attendance data once authenticated
  useEffect(() => {
    if (!isAuthenticated || !registerNumber || !className) return

    const fetchAttendance = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log("[STUDENT_PAGE] Fetching attendance for:", registerNumber, "Class:", className)

        const result = await getStudentAttendance(registerNumber, className)

        if (!result.success) {
          setError(result.error || "Failed to fetch attendance")
          return
        }

        setAttendanceData(result.data || null)
      } catch (err: any) {
        console.error("[STUDENT_PAGE] Error fetching attendance:", err)
        setError("Failed to fetch attendance data")
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [isAuthenticated, registerNumber, className])

  // Handle logout
  const handleLogout = () => {
    console.log("[STUDENT_PAGE] Logout initiated")
    clearStudentAuthData()
    setIsAuthenticated(false)
    setStudentName("")
    setRegisterNumber("")
    setClassName("")
    setAttendanceData(null)
    router.push("/login")
  }

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Checking authentication...</p>
      </div>
    )
  }

  // If not authenticated, show nothing (router.push will redirect)
  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      <Header title="Student Dashboard" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Welcome, {studentName}</CardTitle>
              <CardDescription>
                Register Number: {registerNumber} | Class: {className || "Loading..."}
              </CardDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading attendance data...</p>
              </div>
            ) : attendanceData ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{attendanceData.attendancePercentage}%</p>
                    <p className="text-sm text-muted-foreground">Overall Attendance</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{attendanceData.presentCount}</p>
                    <p className="text-sm text-muted-foreground">Classes Attended</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{attendanceData.absentCount}</p>
                    <p className="text-sm text-muted-foreground">Classes Missed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{attendanceData.totalSessions}</p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No attendance data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Details</CardTitle>
            <CardDescription>Session-wise attendance records</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : attendanceData && attendanceData.records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-left py-2 px-4">Subject</th>
                      <th className="text-left py-2 px-4">Timing</th>
                      <th className="text-left py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.records.map((record) => (
                      <tr key={record.sessionId} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="py-2 px-4">{record.subjectName || "N/A"}</td>
                        <td className="py-2 px-4">
                          {record.startTime && record.endTime
                            ? `${record.startTime} - ${record.endTime}`
                            : "N/A"}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              record.isPresent
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                          >
                            {record.isPresent ? "Present" : "Absent"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No attendance records available yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
