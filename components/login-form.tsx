"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/client"
import { verifyStudentLogin } from "@/lib/student-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleSelector } from "@/components/role-selector"
import { WhatsAppIcon } from "@/components/whatsapp-icon"
import type { UserRole } from "@/lib/database"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [selectedRole, setSelectedRole] = useState<UserRole>("faculty")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const isStudentRole = selectedRole === "student"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()

      // For student role, use server action to verify credentials
      if (isStudentRole) {
        console.log("[LOGIN] Student login attempt with username:", username)

        // Call server action to verify student login
        const result = await verifyStudentLogin(username, password)

        if (!result.success) {
          toast.error(result.error || "Login failed")
          setIsLoading(false)
          return
        }

        // Login successful - store student info in localStorage, sessionStorage, and cookies
        const student = result.student!
        const authData = {
          userRole: "student",
          studentName: student.name,
          registerNumber: student.register_number,
          studentUsername: username,
          studentId: student.id,
          classId: student.class_id,
          className: student.class_name,
        }

        // Store in localStorage for persistence across sessions
        Object.entries(authData).forEach(([key, value]) => {
          localStorage.setItem(key, value)
        })

        // Store in sessionStorage for current session
        Object.entries(authData).forEach(([key, value]) => {
          sessionStorage.setItem(key, value)
        })

        // Store in cookie for server-side access (10-day expiration)
        const expirationDate = new Date()
        expirationDate.setTime(expirationDate.getTime() + 10 * 24 * 60 * 60 * 1000)
        document.cookie = `studentAuth=${JSON.stringify(authData)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Strict`

        console.log("[LOGIN] Student logged in successfully:", {
          name: student.name,
          registerNumber: student.register_number,
          className: student.class_name,
          username,
        })
        
        // Verify localStorage was set
        console.log("[LOGIN] Verifying localStorage:", {
          userRole: localStorage.getItem("userRole"),
          studentName: localStorage.getItem("studentName"),
          registerNumber: localStorage.getItem("registerNumber"),
        })

        toast.success(`Welcome ${student.name}!`)
        
        // Navigate to student dashboard with auth data as query params
        const params = new URLSearchParams()
        params.set("authenticated", "true")
        params.set("name", student.name)
        params.set("register", student.register_number)
        params.set("class", student.class_name)
        
        router.replace(`/student?${params.toString()}`)
        return
      }

      // For non-student roles, use email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      if (data.user) {
        // Get the original email (either from metadata if variant, or use the auth email directly)
        const originalEmail = data.user.user_metadata?.original_email || data.user.email || ""
        
        console.log("[LOGIN] Auth user email:", data.user.email)
        console.log("[LOGIN] Original email:", originalEmail)

        // Find ALL profiles with this email (there might be multiple for different roles)
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", originalEmail)

        console.log("[LOGIN] User email:", data.user.email)
        console.log("[LOGIN] Profiles found:", profiles?.map(p => ({ id: p.id, role: p.role })))

        if (profileError || !profiles || profiles.length === 0) {
          toast.error("Could not verify your role. Please contact administrator.")
          await supabase.auth.signOut()
          return
        }

        // Check which roles are available for this email
        const availableRoles: UserRole[] = []
        const profileIds = profiles.map(p => p.id)
        console.log("[LOGIN] Profile IDs:", profileIds)

        // Check each profile for this email to see what roles exist
        for (const profile of profiles) {
          if (profile.role === "admin") {
            availableRoles.push("admin")
          }
        }

        // Check if user is in faculty table using profile IDs
        const { data: facultyRecord } = await supabase
          .from("faculty")
          .select("id")
          .in("profile_id", profileIds)
          .single()

        if (facultyRecord) {
          availableRoles.push("faculty")
          console.log("[LOGIN] Faculty role found")
        }

        // Check if user is in hod table using profile IDs
        const { data: hodRecord } = await supabase
          .from("hods")
          .select("id")
          .in("profile_id", profileIds)
          .single()

        if (hodRecord) {
          availableRoles.push("hod")
          console.log("[LOGIN] HOD role found")
        }

        // Remove duplicates
        const uniqueRoles = [...new Set(availableRoles)]
        console.log("[LOGIN] Available roles:", uniqueRoles)

        // Check if selected role is available
        if (!uniqueRoles.includes(selectedRole)) {
          const availableRolesList = uniqueRoles.join(", ")
          toast.error(`Your account has roles: ${availableRolesList}. Please select one of these roles.`)
          await supabase.auth.signOut()
          return
        }

        // Store the selected role and email for this login session
        localStorage.setItem("userRole", selectedRole)
        localStorage.setItem("userEmail", originalEmail)
        console.log("[LOGIN] Selected role:", selectedRole)

        toast.success("Login successful!")
        
        // Redirect directly to the selected role dashboard
        console.log("[LOGIN] Redirecting to role dashboard")
        if (selectedRole === "admin") {
          console.log("[LOGIN] Redirecting to /admin")
          router.push("/admin")
        } else if (selectedRole === "hod") {
          console.log("[LOGIN] Redirecting to /hod")
          router.push("/hod")
        } else if (selectedRole === "faculty") {
          console.log("[LOGIN] Redirecting to /faculty")
          router.push("/faculty")
        } else if (selectedRole === "student") {
          console.log("[LOGIN] Redirecting to /student")
          router.push("/student")
        } else {
          console.log("[LOGIN] Redirecting to /dashboard (default)")
          router.push("/dashboard")
        }
        
        router.refresh()
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-xl">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
          <WhatsAppIcon className="h-9 w-9 text-primary-foreground" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to WhatsApp Attendance System</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-6" suppressHydrationWarning>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Your Role</Label>
            <RoleSelector selectedRole={selectedRole} onRoleSelect={setSelectedRole} />
          </div>

          <div className="space-y-4">
            {isStudentRole ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="e.g., 23B91A0738-3/4CSIT"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                    suppressHydrationWarning
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: RegisterNumber-ClassName
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="student-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 pr-10"
                      suppressHydrationWarning
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      suppressHydrationWarning
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Default password is your register number
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                    suppressHydrationWarning
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 pr-10"
                      suppressHydrationWarning
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      suppressHydrationWarning
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <Button type="submit" className="w-full h-11 text-base font-medium" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {"Don't have an account? "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Contact Administrator
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
