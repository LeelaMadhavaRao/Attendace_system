"use server"

/**
 * ADMIN SERVER ACTIONS
 * 
 * Key architectural decision: Multi-role per email support
 * - One email can have multiple profiles (admin, HOD, faculty) by using variant email addresses
 * - When a user logs in, we look up their profile by email and find all matching profiles
 * - Role-specific operations (like HOD creating faculty) need to:
 *   1. Find current user's email
 *   2. Look up ALL profiles with that email
 *   3. Find the role-specific record (e.g., HODs table) among those profiles
 *   4. Use that record's ID when setting foreign keys
 * 
 * IMPORTANT FIX (2024):
 * - OLD: `.eq("profile_id", currentUser.id)` - BROKEN because currentUser.id is auth user ID, not profile ID
 * - NEW: Get all profiles by email, filter for the specific role, then query that role's table
 * 
 * This ensures that when HOD creates faculty, the faculty.hod_id gets set correctly
 */

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

  console.log("[CREATE_HOD] Creating HOD. Current user auth ID:", currentUser.id)

  // Get the original email (handle variant emails)
  const originalEmail = currentUser.user_metadata?.original_email || currentUser.email || ""
  console.log("[CREATE_HOD] Original email for lookup:", originalEmail)

  // Get all profiles for current user
  const { data: currentUserProfiles } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", originalEmail)

  if (!currentUserProfiles || !currentUserProfiles.some(p => p.role === "admin")) {
    return { error: "Only admins can create HODs" }
  }

  const adminClient = createAdminClient()

  // Check if email + role combination already exists
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, name, phone")
    .eq("email", input.email)
    .eq("role", "hod")
    .single()

  if (existingProfile) {
    // Check if name AND phone are exactly the same
    if (existingProfile.name === input.name && existingProfile.phone === input.phone) {
      return { error: "This HOD already exists with the same email, name, and phone" }
    }
    
    // Different name/phone - need variant email, reuse existing auth if possible or create new one
    // First check if there's an auth user for this email with HOD metadata
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users.find(u => {
      const originalEmail = u.user_metadata?.original_email || u.email
      return originalEmail === input.email && u.user_metadata?.role === "hod"
    })

    let userId: string

    if (existingAuthUser) {
      // Reuse existing HOD auth user for this email
      userId = existingAuthUser.id
    } else {
      // Create new auth user with variant email
      const timestamp = Date.now()
      const variantEmail = `${input.email.split("@")[0]}+hod${timestamp}@${input.email.split("@")[1]}`

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: variantEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          role: "hod",
          original_email: input.email,
        },
      })

      if (authError) {
        return { error: authError.message }
      }

      if (!authData.user) {
        return { error: "Failed to create user" }
      }

      userId = authData.user.id
    }

    // Create new profile with different name/phone
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: userId,
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: "hod",
      department: input.department,
      created_by: currentUser.id,
    })

    if (profileError) {
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(userId)
      }
      return { error: profileError.message }
    }

    // Create HOD record
    const { error: hodError } = await adminClient.from("hods").insert({
      profile_id: userId,
      department: input.department,
      name: input.name,
      display_name: input.name,
      created_by: currentUser.id,
    })

    if (hodError) {
      await adminClient.from("profiles").delete().eq("id", userId)
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(userId)
      }
      return { error: hodError.message }
    }

    revalidatePath("/admin/hods")
    return { success: true, userId }
  } else {
    // Email + role combination doesn't exist, create fresh
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(u => u.email === input.email)

    let userId: string

    if (existingUser) {
      // Email exists for different role - create variant
      const timestamp = Date.now()
      const variantEmail = `${input.email.split("@")[0]}+hod${timestamp}@${input.email.split("@")[1]}`

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: variantEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          role: "hod",
          original_email: input.email,
        },
      })

      if (authError) {
        return { error: authError.message }
      }

      if (!authData.user) {
        return { error: "Failed to create user" }
      }

      userId = authData.user.id
    } else {
      // Email doesn't exist at all - create with original email
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

      userId = authData.user.id
    }

    // Create profile record
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: userId,
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: "hod",
      department: input.department,
      created_by: currentUser.id,
    })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId)
      return { error: profileError.message }
    }

    // Create HOD record
    const { error: hodError } = await adminClient.from("hods").insert({
      profile_id: userId,
      department: input.department,
      name: input.name,
      display_name: input.name,
      created_by: currentUser.id,
    })

    if (hodError) {
      await adminClient.from("profiles").delete().eq("id", userId)
      await adminClient.auth.admin.deleteUser(userId)
      return { error: hodError.message }
    }

    revalidatePath("/admin/hods")
    return { success: true, userId }
  }
}

export async function createFaculty(input: CreateUserInput, hodId?: string) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: "Unauthorized" }
  }

  /**
   * FACULTY CREATION LOGIC - HOD ID Assignment
   * 
   * Key points:
   * 1. currentUser.email might be a variant email (e.g., admin+hod123@example.com)
   * 2. Actual email is stored in user_metadata.original_email for role-specific users
   * 3. currentUser.id is the auth user ID which also serves as profile ID
   * 4. We need to find the HOD's specific profile among potentially multiple profiles
   * 5. Then get the HOD record ID to assign to the new faculty's hod_id field
   * 
   * Flow:
   * - Get original email from auth metadata (handles variant emails)
   * - Find ALL profiles with that email
   * - Filter for HOD role profiles
   * - Query HODs table using HOD profile IDs
   * - Get the HOD record ID
   * - Insert faculty with this HOD record ID
   */

  console.log("[CREATE_FACULTY] Creating faculty with email:", input.email, "hodId param:", hodId)
  console.log("[CREATE_FACULTY] Current user auth ID:", currentUser.id, "Current user email:", currentUser.email)

  // Get the original email (handle variant emails)
  const originalEmail = currentUser.user_metadata?.original_email || currentUser.email || ""
  console.log("[CREATE_FACULTY] Original email for lookup:", originalEmail)

  // Get all profiles for current user (they might have multiple)
  const { data: currentUserProfiles } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", originalEmail)

  console.log("[CREATE_FACULTY] Current user profiles:", currentUserProfiles?.map(p => ({ id: p.id, role: p.role })))

  if (!currentUserProfiles || currentUserProfiles.length === 0) {
    return { error: "User profile not found" }
  }

  // Check if current user has admin or HOD role
  const isAdmin = currentUserProfiles.some(p => p.role === "admin")
  const isHod = currentUserProfiles.some(p => p.role === "hod")

  if (!isAdmin && !isHod) {
    return { error: "Only admins and HODs can create faculty" }
  }

  const adminClient = createAdminClient()

  // If HOD is creating, get their HOD ID
  let assignedHodId = hodId
  if (isHod) {
    const hodProfileIds = currentUserProfiles.filter(p => p.role === "hod").map(p => p.id)
    console.log("[CREATE_FACULTY] HOD profile IDs:", hodProfileIds)
    
    // Find HOD record by these profile IDs
    const { data: hod, error: hodError } = await supabase
      .from("hods")
      .select("id")
      .in("profile_id", hodProfileIds)
      .single()
    
    if (hodError) {
      console.log("[CREATE_FACULTY] Error finding HOD record:", hodError)
    }
    
    assignedHodId = hod?.id
    console.log("[CREATE_FACULTY] HOD creating faculty. HOD ID:", assignedHodId)
  }

  // Check if email + role combination already exists
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, name, phone")
    .eq("email", input.email)
    .eq("role", "faculty")
    .single()

  if (existingProfile) {
    // Check if name AND phone are exactly the same
    if (existingProfile.name === input.name && existingProfile.phone === input.phone) {
      return { error: "This faculty member already exists with the same email, name, and phone" }
    }
    
    // Different name/phone - need variant email, reuse existing auth if possible or create new one
    // First check if there's an auth user for this email with faculty metadata
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users.find(u => {
      const originalEmail = u.user_metadata?.original_email || u.email
      return originalEmail === input.email && u.user_metadata?.role === "faculty"
    })

    let userId: string

    if (existingAuthUser) {
      // Reuse existing faculty auth user for this email
      userId = existingAuthUser.id
    } else {
      // Create new auth user with variant email
      const timestamp = Date.now()
      const variantEmail = `${input.email.split("@")[0]}+faculty${timestamp}@${input.email.split("@")[1]}`

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: variantEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          role: "faculty",
          original_email: input.email,
        },
      })

      if (authError) {
        return { error: authError.message }
      }

      if (!authData.user) {
        return { error: "Failed to create user" }
      }

      userId = authData.user.id
    }

    // Create new profile with different name/phone
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: userId,
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: "faculty",
      department: input.department,
      created_by: currentUser.id,
    })

    if (profileError) {
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(userId)
      }
      return { error: profileError.message }
    }

    // Create faculty record
    console.log("[CREATE_FACULTY] Inserting faculty record (existing profile). Profile ID:", userId, "HOD ID:", assignedHodId, "Department:", input.department)
    const { error: facultyError } = await adminClient.from("faculty").insert({
      profile_id: userId,
      department: input.department,
      hod_id: assignedHodId,
      whatsapp_number: input.whatsappNumber,
      name: input.name,
      display_name: input.name,
      created_by: currentUser.id,
    })

    if (facultyError) {
      await adminClient.from("profiles").delete().eq("id", userId)
      if (!existingAuthUser) {
        await adminClient.auth.admin.deleteUser(userId)
      }
      return { error: facultyError.message }
    }

    revalidatePath("/admin/faculty")
    revalidatePath("/hod/faculty")
    return { success: true, userId }
  } else {
    // Email + role combination doesn't exist, create fresh
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(u => u.email === input.email)

    let userId: string

    if (existingUser) {
      // Email exists for different role - create variant
      const timestamp = Date.now()
      const variantEmail = `${input.email.split("@")[0]}+faculty${timestamp}@${input.email.split("@")[1]}`

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: variantEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          role: "faculty",
          original_email: input.email,
        },
      })

      if (authError) {
        return { error: authError.message }
      }

      if (!authData.user) {
        return { error: "Failed to create user" }
      }

      userId = authData.user.id
    } else {
      // Email doesn't exist at all - create with original email
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

      userId = authData.user.id
    }

    // Create profile
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: userId,
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: "faculty",
      department: input.department,
      created_by: currentUser.id,
    })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId)
      return { error: profileError.message }
    }

    // Create faculty record
    console.log("[CREATE_FACULTY] Inserting faculty record (new profile). Profile ID:", userId, "HOD ID:", assignedHodId, "Department:", input.department)
    const { error: facultyError } = await adminClient.from("faculty").insert({
      profile_id: userId,
      department: input.department,
      hod_id: assignedHodId,
      whatsapp_number: input.whatsappNumber,
      name: input.name,
      display_name: input.name,
      created_by: currentUser.id,
    })

    if (facultyError) {
      await adminClient.from("profiles").delete().eq("id", userId)
      await adminClient.auth.admin.deleteUser(userId)
      return { error: facultyError.message }
    }

    revalidatePath("/admin/faculty")
    revalidatePath("/hod/faculty")
    return { success: true, userId }
  }
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
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Get all HOD records
  const { data: hods, error } = await adminClient
    .from("hods")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  if (!hods || hods.length === 0) {
    return { data: [], error: null }
  }

  // Get profiles for all HODs
  const profileIds = hods.map((h: any) => h.profile_id)
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", profileIds)

  // Combine HOD and profile data
  const hodsWithProfiles = hods.map((h: any) => ({
    ...h,
    profile: profiles?.find((p: any) => p.id === h.profile_id),
  }))

  return { data: hodsWithProfiles, error: null }
}

export async function getFaculty(hodId?: string) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Get all faculty records
  let query = adminClient.from("faculty").select("*")

  if (hodId) {
    query = query.eq("hod_id", hodId)
  }

  const { data: faculty, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  if (!faculty || faculty.length === 0) {
    return { data: [], error: null }
  }

  // Get profiles for all faculty
  const profileIds = faculty.map((f: any) => f.profile_id)
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", profileIds)

  // Combine faculty and profile data
  const facultyWithProfiles = faculty.map((f: any) => ({
    ...f,
    profile: profiles?.find((p: any) => p.id === f.profile_id),
  }))

  return { data: facultyWithProfiles, error: null }
}
