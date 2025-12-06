"use server"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/server"
import type { UserRole } from "@/lib/database"
import { revalidatePath } from "next/cache"

// Create admin client with service role key (internal use only)
function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export interface CreateUserInput {
  email: string
  password: string
  name: string
  phone?: string
  department: string
  role: UserRole
  whatsappNumber?: string
}

export async function createHOD(input: CreateUserInput) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: "Unauthorized" }
  }

  // Verify current user is admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()

  if (profile?.role !== "admin") {
    return { error: "Only admins can create HODs" }
  }

  const adminClient = createAdminClient()

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: "hod",
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: "Failed to create user" }
  }

  // Create profile
  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authData.user.id,
    email: input.email,
    name: input.name,
    phone: input.phone,
    role: "hod",
    department: input.department,
    created_by: currentUser.id,
  })

  if (profileError) {
    // Rollback: delete auth user
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  // Create HOD record
  const { error: hodError } = await adminClient.from("hods").insert({
    profile_id: authData.user.id,
    department: input.department,
    created_by: currentUser.id,
  })

  if (hodError) {
    // Rollback
    await adminClient.from("profiles").delete().eq("id", authData.user.id)
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: hodError.message }
  }

  revalidatePath("/admin/hods")
  return { success: true, userId: authData.user.id }
}

export async function createFaculty(input: CreateUserInput, hodId?: string) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: "Unauthorized" }
  }

  // Verify current user is admin or HOD
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()

  if (profile?.role !== "admin" && profile?.role !== "hod") {
    return { error: "Only admins and HODs can create faculty" }
  }

  const adminClient = createAdminClient()

  // If HOD is creating, get their HOD ID
  let assignedHodId = hodId
  if (profile?.role === "hod") {
    const { data: hod } = await supabase.from("hods").select("id").eq("profile_id", currentUser.id).single()
    assignedHodId = hod?.id
  }

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: "faculty",
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: "Failed to create user" }
  }

  // Create profile
  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authData.user.id,
    email: input.email,
    name: input.name,
    phone: input.phone,
    role: "faculty",
    department: input.department,
    created_by: currentUser.id,
  })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  // Create faculty record
  const { error: facultyError } = await adminClient.from("faculty").insert({
    profile_id: authData.user.id,
    department: input.department,
    hod_id: assignedHodId,
    whatsapp_number: input.whatsappNumber,
    created_by: currentUser.id,
  })

  if (facultyError) {
    await adminClient.from("profiles").delete().eq("id", authData.user.id)
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: facultyError.message }
  }

  revalidatePath("/admin/faculty")
  revalidatePath("/hod/faculty")
  return { success: true, userId: authData.user.id }
}

export async function deleteUser(userId: string) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: "Unauthorized" }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()

  if (profile?.role !== "admin") {
    return { error: "Only admins can delete users" }
  }

  const adminClient = createAdminClient()

  // Delete from auth (cascades to profiles, then to hods/faculty)
  const { error } = await adminClient.auth.admin.deleteUser(userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/admin/hods")
  revalidatePath("/admin/faculty")
  return { success: true }
}

export async function getHODs() {
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from("hods")
    .select(
      `
      *,
      profile:profiles(*)
    `,
    )
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getFaculty(hodId?: string) {
  const adminClient = createAdminClient()

  let query = adminClient.from("faculty").select(
    `
      *,
      profile:profiles(*),
      hod:hods(*, profile:profiles(name))
    `,
  )

  if (hodId) {
    query = query.eq("hod_id", hodId)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}
