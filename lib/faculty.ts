"use server"

import { createAdminClient } from "@/lib/supabase-admin"
import { createClient } from "@/lib/server"
import { revalidatePath } from "next/cache"

export interface CreateClassInput {
  name: string
  department?: string
}

export interface CreateStudentInput {
  registerNumber: string
  name: string
  whatsappNumber?: string
  parentWhatsappNumber?: string
  classId: string
}

export interface CreateSubjectInput {
  name: string
  code?: string
  classId: string
}

export async function createClass(input: CreateClassInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get faculty record - search by email since multiple profiles might exist
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", user.email || "")
  
  if (!profiles || profiles.length === 0) {
    return { error: "Profile not found" }
  }

  const profileIds = profiles.map(p => p.id)

  // Find faculty record
  const { data: faculty } = await supabase
    .from("faculty")
    .select("id, department")
    .in("profile_id", profileIds)
    .single()

  if (!faculty) {
    return { error: "Faculty profile not found" }
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from("classes")
    .insert({
      name: input.name,
      faculty_id: faculty.id,
      department: input.department || faculty.department,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/faculty/classes")
  return { success: true, data }
}

export async function createStudent(input: CreateStudentInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const adminClient = createAdminClient()

  // Get class details for username
  const { data: classData } = await adminClient
    .from("classes")
    .select("name")
    .eq("id", input.classId)
    .single()

  if (!classData) {
    return { error: "Class not found" }
  }

  // Create student record first
  const { data, error } = await adminClient
    .from("students")
    .insert({
      register_number: input.registerNumber,
      name: input.name,
      whatsapp_number: input.whatsappNumber,
      parent_whatsapp_number: input.parentWhatsappNumber,
      class_id: input.classId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Create auth account with username as [RegisterNumber-ClassName] and password as [RegisterNumber]
  const username = `${input.registerNumber}-${classData.name}`
  const password = input.registerNumber

  try {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: `${username.toLowerCase().replace(/[^a-z0-9-]/g, "")}@student.local`,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: input.name,
        role: "student",
        register_number: input.registerNumber,
        class_id: input.classId,
        username: username,
      },
    })

    if (authError) {
      console.error("[CREATE_STUDENT] Auth account creation failed:", authError.message)
      // Continue anyway - student record is created
    } else {
      // Create profile
      await adminClient.from("profiles").insert({
        id: authData.user.id,
        email: authData.user.email,
        name: input.name,
        role: "student",
      })

      console.log(`[CREATE_STUDENT] Created auth account - Username: ${username}, Password: ${password}`)
    }
  } catch (err) {
    console.error("[CREATE_STUDENT] Exception creating auth account:", err)
  }

  revalidatePath(`/faculty/classes/${input.classId}`)
  return { success: true, data, credentials: { username, password } }
}

export async function createStudentsBulk(students: CreateStudentInput[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const adminClient = createAdminClient()

  // Get class details for username
  let className = ""
  if (students.length > 0) {
    const { data: classData } = await adminClient
      .from("classes")
      .select("name")
      .eq("id", students[0].classId)
      .single()
    
    if (classData) {
      className = classData.name
    }
  }

  // Create student records first
  const { data, error } = await adminClient
    .from("students")
    .insert(
      students.map((s) => ({
        register_number: s.registerNumber,
        name: s.name,
        whatsapp_number: s.whatsappNumber,
        parent_whatsapp_number: s.parentWhatsappNumber,
        class_id: s.classId,
      })),
    )
    .select()

  if (error) {
    return { error: error.message }
  }

  // Create auth accounts for each student
  const credentials: Array<{ username: string; password: string; name: string }> = []
  
  for (const student of students) {
    const username = `${student.registerNumber}-${className}`
    const password = student.registerNumber

    try {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: `${username.toLowerCase().replace(/[^a-z0-9-]/g, "")}@student.local`,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: student.name,
          role: "student",
          register_number: student.registerNumber,
          class_id: student.classId,
          username: username,
        },
      })

      if (authError) {
        console.error(`[CREATE_STUDENTS_BULK] Auth failed for ${student.registerNumber}:`, authError.message)
      } else {
        // Create profile
        await adminClient.from("profiles").insert({
          id: authData.user.id,
          email: authData.user.email,
          name: student.name,
          role: "student",
        })

        credentials.push({ username, password, name: student.name })
        console.log(`[CREATE_STUDENTS_BULK] Created account - Username: ${username}, Password: ${password}`)
      }
    } catch (err) {
      console.error(`[CREATE_STUDENTS_BULK] Exception for ${student.registerNumber}:`, err)
    }
  }

  if (students.length > 0) {
    revalidatePath(`/faculty/classes/${students[0].classId}`)
  }
  
  return { success: true, count: data.length, credentials }
}

export async function createSubject(input: CreateSubjectInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get faculty record - search by email since multiple profiles might exist
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", user.email || "")
  
  if (!profiles || profiles.length === 0) {
    return { error: "Profile not found" }
  }

  const profileIds = profiles.map(p => p.id)

  // Find faculty record
  const { data: faculty } = await supabase
    .from("faculty")
    .select("id")
    .in("profile_id", profileIds)
    .single()

  if (!faculty) {
    return { error: "Faculty profile not found" }
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from("subjects")
    .insert({
      name: input.name,
      code: input.code,
      class_id: input.classId,
      faculty_id: faculty.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/faculty/classes/${input.classId}`)
  return { success: true, data }
}

export async function deleteClass(classId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient.from("classes").delete().eq("id", classId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/faculty/classes")
  return { success: true }
}

export async function deleteStudent(studentId: string, classId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient.from("students").delete().eq("id", studentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/faculty/classes/${classId}`)
  return { success: true }
}

export async function getFacultyClasses() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized", data: null }
  }

  // Get faculty record - search by email since multiple profiles might exist
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", user.email || "")
  
  if (!profiles || profiles.length === 0) {
    return { error: "Profile not found", data: null }
  }

  const profileIds = profiles.map(p => p.id)

  // Find faculty record
  const { data: faculty } = await supabase
    .from("faculty")
    .select("id")
    .in("profile_id", profileIds)
    .single()

  if (!faculty) {
    return { error: "Faculty not found", data: null }
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from("classes")
    .select("*")
    .eq("faculty_id", faculty.id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}
