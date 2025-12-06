import { createAdminClient } from "@/lib/supabase-admin"
import { sendWhatsAppMessage } from "@/lib/client"
import type { GeminiResponse } from "@/lib/database"

interface RouteHandlerContext {
  facultyId: string
  facultyPhone: string
  geminiResponse: GeminiResponse
}

// Helper to get faculty's class by name
async function getClassByName(facultyId: string, className: string) {
  const supabase = createAdminClient()

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("faculty_id", facultyId)
    .ilike("name", `%${className}%`)
    .limit(1)

  return classes?.[0] || null
}

// Create class handler
export async function handleCreateClass(ctx: RouteHandlerContext): Promise<string> {
  const supabase = createAdminClient()
  const data = ctx.geminiResponse.data as { className?: string; semester?: string; academicYear?: string }

  if (!data.className) {
    return "Please provide a class name to create."
  }

  // Check if class already exists
  const existing = await getClassByName(ctx.facultyId, data.className)
  if (existing) {
    return `A class named "${data.className}" already exists. Would you like to add students to it or create a different class?`
  }

  // Create the class
  const { error } = await supabase
    .from("classes")
    .insert({
      name: data.className,
      faculty_id: ctx.facultyId,
      semester: data.semester,
      academic_year: data.academicYear,
    })

  if (error) {
    return `Failed to create class: ${error.message}`
  }

  return `Class "${data.className}" created successfully!\n\nNow please send an Excel file with student data.\n\nRequired columns:\n- Register Number\n- Name\n- WhatsApp (optional)\n- Parent WhatsApp (optional)`
}

// Create students from Excel data
export async function handleCreateStudents(ctx: RouteHandlerContext): Promise<string> {
  const supabase = createAdminClient()
  const data = ctx.geminiResponse.data as {
    classId?: string
    className?: string
    students?: Array<{
      registerNumber: string
      name: string
      whatsappNumber?: string
      parentWhatsappNumber?: string
    }>
  }

  // Find class
  let classId = data.classId
  if (!classId && data.className) {
    const cls = await getClassByName(ctx.facultyId, data.className)
    classId = cls?.id
  }

  if (!classId) {
    return "I couldn't find the class. Please specify which class these students belong to."
  }

  if (!data.students || data.students.length === 0) {
    return "No student data found. Please send an Excel file with student information."
  }

  // Insert students
  const { data: inserted, error } = await supabase
    .from("students")
    .insert(
      data.students.map((s) => ({
        register_number: s.registerNumber,
        name: s.name,
        whatsapp_number: s.whatsappNumber,
        parent_whatsapp_number: s.parentWhatsappNumber,
        class_id: classId,
      })),
    )
    .select()

  if (error) {
    return `Failed to add students: ${error.message}`
  }

  return `Successfully added ${inserted.length} students to the class!\n\nYou can now start marking attendance.`
}

// Assign attendance
export async function handleAssignAttendance(ctx: RouteHandlerContext): Promise<string> {
  const supabase = createAdminClient()
  const data = ctx.geminiResponse.data as {
    className?: string
    date?: string
    startTime?: string
    endTime?: string
    subject?: string
    type?: "absentees" | "presentees"
    rollNumbers?: number[]
  }

  if (!data.className || !data.date || !data.startTime || !data.endTime) {
    return "Please provide complete attendance details: date, time, class name, subject, and absentees/presentees list."
  }

  // Find class
  const cls = await getClassByName(ctx.facultyId, data.className)
  if (!cls) {
    return `Class "${data.className}" not found. Please check the class name or create it first.`
  }

  // Get all students in the class
  const { data: students } = await supabase
    .from("students")
    .select("id, register_number")
    .eq("class_id", cls.id)
    .order("register_number")

  if (!students || students.length === 0) {
    return "No students found in this class. Please add students first."
  }

  // Create or find subject
  let subjectId = null
  if (data.subject) {
    const { data: existingSubject } = await supabase
      .from("subjects")
      .select("id")
      .eq("class_id", cls.id)
      .eq("faculty_id", ctx.facultyId)
      .ilike("name", `%${data.subject}%`)
      .single()

    if (existingSubject) {
      subjectId = existingSubject.id
    } else {
      const { data: newSubject } = await supabase
        .from("subjects")
        .insert({
          name: data.subject,
          class_id: cls.id,
          faculty_id: ctx.facultyId,
        })
        .select()
        .single()
      subjectId = newSubject?.id
    }
  }

  // Create attendance session
  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .insert({
      class_id: cls.id,
      subject_id: subjectId,
      faculty_id: ctx.facultyId,
      date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
    })
    .select()
    .single()

  if (sessionError) {
    return `Failed to create attendance session: ${sessionError.message}`
  }

  // Determine who is present/absent
  const rollNumbersSet = new Set(data.rollNumbers || [])
  const isAbsenteesList = data.type === "absentees"

  const records = students.map((student) => {
    // Extract numeric part from register number for comparison
    const regNumMatch = student.register_number.match(/(\d+)$/)
    const studentRollNum = regNumMatch ? Number.parseInt(regNumMatch[1]) : 0

    const isInList = rollNumbersSet.has(studentRollNum)
    const isPresent = isAbsenteesList ? !isInList : isInList

    return {
      session_id: session.id,
      student_id: student.id,
      is_present: isPresent,
    }
  })

  const { error: recordsError } = await supabase.from("attendance_records").insert(records)

  if (recordsError) {
    return `Failed to record attendance: ${recordsError.message}`
  }

  const presentCount = records.filter((r) => r.is_present).length
  const absentCount = records.filter((r) => !r.is_present).length

  return `Attendance recorded successfully!\n\nClass: ${cls.name}\nDate: ${data.date}\nTime: ${data.startTime} - ${data.endTime}\nSubject: ${data.subject || "N/A"}\n\nPresent: ${presentCount}\nAbsent: ${absentCount}`
}

// Fetch attendance data
export async function handleAttendanceFetch(ctx: RouteHandlerContext): Promise<string> {
  const supabase = createAdminClient()
  const data = ctx.geminiResponse.data as { className?: string; percentage?: number }

  if (!data.className) {
    return "Please specify which class attendance you want to view."
  }

  const cls = await getClassByName(ctx.facultyId, data.className)
  if (!cls) {
    return `Class "${data.className}" not found.`
  }

  // Get students with attendance
  const { data: students } = await supabase.from("students").select("*").eq("class_id", cls.id)

  const { data: sessions } = await supabase.from("attendance_sessions").select("id").eq("class_id", cls.id)

  const sessionIds = sessions?.map((s) => s.id) || []

  if (sessionIds.length === 0) {
    return `No attendance sessions recorded for ${cls.name} yet.`
  }

  // Calculate attendance for each student
  const studentsWithAttendance = await Promise.all(
    (students || []).map(async (student) => {
      const { count: total } = await supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .in("session_id", sessionIds)

      const { count: present } = await supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .in("session_id", sessionIds)
        .eq("is_present", true)

      const percentage = total && total > 0 ? Math.round(((present || 0) / total) * 100) : 0

      return {
        ...student,
        percentage,
        present: present || 0,
        total: total || 0,
      }
    }),
  )

  // Filter by percentage if specified
  let filtered = studentsWithAttendance
  if (data.percentage) {
    filtered = studentsWithAttendance.filter((s) => s.percentage < data.percentage!)
  }

  if (filtered.length === 0) {
    return data.percentage
      ? `No students below ${data.percentage}% attendance in ${cls.name}.`
      : `No attendance data found for ${cls.name}.`
  }

  // Format response
  let response = `*Attendance Report: ${cls.name}*\n`
  if (data.percentage) {
    response += `Students below ${data.percentage}%:\n\n`
  } else {
    response += `Total Sessions: ${sessionIds.length}\n\n`
  }

  filtered.sort((a, b) => a.percentage - b.percentage)

  filtered.forEach((s, idx) => {
    response += `${idx + 1}. ${s.register_number} - ${s.name}\n   Attendance: ${s.present}/${s.total} (${s.percentage}%)\n\n`
  })

  return response
}

// Send messages to parents
export async function handleParentMessage(ctx: RouteHandlerContext): Promise<string> {
  const supabase = createAdminClient()
  const data = ctx.geminiResponse.data as { className?: string; percentage?: number; message?: string }

  if (!data.className) {
    return "Please specify which class parents you want to notify."
  }

  const cls = await getClassByName(ctx.facultyId, data.className)
  if (!cls) {
    return `Class "${data.className}" not found.`
  }

  const threshold = data.percentage || 75

  // Get students below threshold
  const { data: students } = await supabase.from("students").select("*").eq("class_id", cls.id)

  const { data: sessions } = await supabase.from("attendance_sessions").select("id").eq("class_id", cls.id)

  const sessionIds = sessions?.map((s) => s.id) || []

  if (sessionIds.length === 0) {
    return "No attendance sessions recorded yet."
  }

  // Find students below threshold with parent numbers
  const studentsToNotify: Array<{
    name: string
    parentPhone: string
    percentage: number
  }> = []

  for (const student of students || []) {
    if (!student.parent_whatsapp_number) continue

    const { count: total } = await supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .in("session_id", sessionIds)

    const { count: present } = await supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .in("session_id", sessionIds)
      .eq("is_present", true)

    const percentage = total && total > 0 ? Math.round(((present || 0) / total) * 100) : 0

    if (percentage < threshold) {
      studentsToNotify.push({
        name: student.name,
        parentPhone: student.parent_whatsapp_number,
        percentage,
      })
    }
  }

  if (studentsToNotify.length === 0) {
    return `No students below ${threshold}% attendance with parent contact in ${cls.name}.`
  }

  // Send messages
  let sentCount = 0
  for (const student of studentsToNotify) {
    const messageText =
      data.message ||
      `Dear Parent,\n\nThis is to inform you that your ward ${student.name} has an attendance of ${student.percentage}% in ${cls.name}, which is below the required ${threshold}%.\n\nPlease ensure regular attendance.\n\nRegards,\nAttendance System`

    const result = await sendWhatsAppMessage({
      to: student.parentPhone,
      message: messageText,
    })

    if (result.success) {
      sentCount++

      // Log the message
      await supabase.from("parent_messages").insert({
        student_id: (students || []).find((s) => s.name === student.name)?.id,
        parent_phone: student.parentPhone,
        message: messageText,
      })
    }
  }

  return `Sent notifications to ${sentCount} out of ${studentsToNotify.length} parents regarding low attendance.`
}

// Add single student
export async function handleAddStudent(ctx: RouteHandlerContext): Promise<string> {
  const supabase = createAdminClient()
  const data = ctx.geminiResponse.data as {
    className?: string
    registerNumber?: string
    name?: string
    whatsappNumber?: string
    parentWhatsappNumber?: string
  }

  if (!data.className || !data.registerNumber || !data.name) {
    return "Please provide class name, register number, and student name to add a student."
  }

  const cls = await getClassByName(ctx.facultyId, data.className)
  if (!cls) {
    return `Class "${data.className}" not found. Please create the class first.`
  }

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      register_number: data.registerNumber,
      name: data.name,
      whatsapp_number: data.whatsappNumber,
      parent_whatsapp_number: data.parentWhatsappNumber,
      class_id: cls.id,
    })
    .select()
    .single()

  if (error) {
    return `Failed to add student: ${error.message}`
  }

  return `Student added successfully!\n\nName: ${student.name}\nRegister Number: ${student.register_number}\nClass: ${cls.name}`
}

// Help command
export async function handleHelp(): Promise<string> {
  return `*WhatsApp Attendance System Commands*

*Class Management:*
- "Create class [name]" - Create a new class
- Send Excel file after creating class to add students

*Attendance:*
- "DD-MM-YYYY, HH:MMam - HH:MMpm, Class, Subject, Absentees: 1,2,3"
- "DD-MM-YYYY, HH:MMam - HH:MMpm, Class, Subject, Presentees: 1,2,3"

*Reports:*
- "Get attendance of [class]" - Full attendance report
- "Students below 75% in [class]" - Low attendance students

*Parent Notifications:*
- "Send message to parents of students below 75% in [class]"

*Slash Commands:*
/help - Show this help
/createclass - Create new class
/myclasses - List your classes
/attendance [class] - View attendance
/addstudent - Add a student

Type your request naturally - I'll understand and help!`
}

// Main route handler dispatcher
export async function handleGeminiRoute(ctx: RouteHandlerContext): Promise<string> {
  const route = ctx.geminiResponse.route

  switch (route) {
    case "createClass":
      return handleCreateClass(ctx)
    case "createStudents":
      return handleCreateStudents(ctx)
    case "assignAttendance":
      return handleAssignAttendance(ctx)
    case "attendanceFetch":
      return handleAttendanceFetch(ctx)
    case "parentMessage":
      return handleParentMessage(ctx)
    case "addStudent":
      return handleAddStudent(ctx)
    case "help":
      return handleHelp()
    case "askClassName":
    case "askStudentData":
    case "clarify":
    case "general":
    default:
      return ctx.geminiResponse.message || "How can I help you with attendance management?"
  }
}
