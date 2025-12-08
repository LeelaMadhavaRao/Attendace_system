"use server"

import { createAdminClient } from "@/lib/supabase-admin"
import { createClient } from "@/lib/server"
import { revalidatePath } from "next/cache"

export interface CreateClassInput {
  name: string
  semester?: string
  academicYear?: string
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
      semester: input.semester,
      academic_year: input.academicYear,
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

  revalidatePath(`/faculty/classes/${input.classId}`)
  return { success: true, data }
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

  if (students.length > 0) {
    revalidatePath(`/faculty/classes/${students[0].classId}`)
  }
  return { success: true, count: data.length }
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
