"use server"

import { createAdminClient } from "@/lib/supabase-admin"

export interface StudentLoginResult {
  success: boolean
  student?: {
    id: string
    name: string
    register_number: string
    class_id: string
    class_name: string
  }
  error?: string
}

/**
 * Verify student login credentials
 * This uses admin client to bypass RLS restrictions
 */
export async function verifyStudentLogin(
  username: string,
  password: string
): Promise<StudentLoginResult> {
  try {
    // Step 1: Parse username into registerNumber and className
    const parts = username.split("-")
    if (parts.length < 2) {
      return {
        success: false,
        error: "Invalid username format. Use: RegisterNumber-ClassName",
      }
    }

    const registerNumber = parts[0]
    const classNameFromUsername = parts.slice(1).join("-")

    console.log("[STUDENT_AUTH] Parsed - Register Number:", registerNumber, "Class Name:", classNameFromUsername)

    // Step 2: Check if student exists with that register number using admin client
    const adminClient = createAdminClient()

    const { data: students, error: studentError } = await adminClient
      .from("students")
      .select(`
        id,
        name,
        register_number,
        class_id,
        classes (
          name
        )
      `)
      .eq("register_number", registerNumber)

    if (studentError) {
      console.error("[STUDENT_AUTH] Database error:", studentError)
      return {
        success: false,
        error: "Database error. Please try again.",
      }
    }

    if (!students || students.length === 0) {
      console.log("[STUDENT_AUTH] Student not found with register number:", registerNumber)
      return {
        success: false,
        error: "Student not found. Please check your register number.",
      }
    }

    const student = students[0]
    const actualClassName = (student.classes as any)?.name || ""

    console.log("[STUDENT_AUTH] Student found:", {
      id: student.id,
      name: student.name,
      registerNumber: student.register_number,
      actualClassName,
      providedClassName: classNameFromUsername,
    })

    // Step 3: Verify class name matches
    if (actualClassName !== classNameFromUsername) {
      return {
        success: false,
        error: `Username should be: ${registerNumber}-${actualClassName}`,
      }
    }

    // Step 4: Verify if password matches register number
    if (password !== registerNumber) {
      console.log("[STUDENT_AUTH] Password does not match register number")
      return {
        success: false,
        error: "Invalid password. Default password is your register number.",
      }
    }

    // Step 5: Login successful
    console.log("[STUDENT_AUTH] Login successful for:", student.name)

    return {
      success: true,
      student: {
        id: student.id,
        name: student.name,
        register_number: student.register_number,
        class_id: student.class_id,
        class_name: actualClassName,
      },
    }
  } catch (error: any) {
    console.error("[STUDENT_AUTH] Exception:", error)
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    }
  }
}
