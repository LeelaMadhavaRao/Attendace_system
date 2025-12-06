import { createSupabaseClient, sendWhatsAppMessage } from "../_shared/utils.ts"

interface RouteHandlerContext {
  facultyId: string
  geminiResponse: {
    route: string
    message: string
    data: Record<string, any>
  }
  supabase: any
  phoneNumber: string
}

export async function handleCreateClass(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as { className?: string; semester?: string; academicYear?: string }

  if (!data.className) {
    return "Please provide a class name to create."
  }

  // Check if class already exists
  const { data: existing } = await ctx.supabase
    .from("classes")
    .select("id, name")
    .eq("faculty_id", ctx.facultyId)
    .eq("name", data.className)
    .single()

  if (existing) {
    return `A class named "${data.className}" already exists.`
  }

  // Create the class
  const { error } = await ctx.supabase.from("classes").insert({
    name: data.className,
    faculty_id: ctx.facultyId,
    semester: data.semester,
    academic_year: data.academicYear,
  })

  if (error) {
    console.error("Error creating class:", error)
    return "Failed to create class. Please try again."
  }

  return `Class "${data.className}" created successfully!\n\nNow please send an Excel file with student data.\n\nRequired columns:\n- Register Number\n- Name\n- WhatsApp (optional)\n- Parent WhatsApp (optional)`
}

export async function handleAssignAttendance(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as {
    className: string
    date: string
    startTime: string
    endTime: string
    subject: string
    type: "absentees" | "presentees"
    rollNumbers: number[]
  }

  // Get class
  const { data: classData } = await ctx.supabase
    .from("classes")
    .select("id")
    .eq("faculty_id", ctx.facultyId)
    .eq("name", data.className)
    .single()

  if (!classData) {
    return `Class "${data.className}" not found.`
  }

  // Get or create subject
  let subjectId = null
  if (data.subject) {
    const { data: subject } = await ctx.supabase
      .from("subjects")
      .select("id")
      .eq("name", data.subject)
      .eq("class_id", classData.id)
      .single()

    if (subject) {
      subjectId = subject.id
    } else {
      const { data: newSubject } = await ctx.supabase
        .from("subjects")
        .insert({
          name: data.subject,
          class_id: classData.id,
          faculty_id: ctx.facultyId,
        })
        .select()
        .single()
      subjectId = newSubject?.id
    }
  }

  // Create attendance session
  const { data: session, error: sessionError } = await ctx.supabase
    .from("attendance_sessions")
    .insert({
      class_id: classData.id,
      subject_id: subjectId,
      faculty_id: ctx.facultyId,
      date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      total_periods: 1,
    })
    .select()
    .single()

  if (sessionError) {
    return "Failed to create attendance session."
  }

  // Get all students
  const { data: students } = await ctx.supabase
    .from("students")
    .select("id, register_number")
    .eq("class_id", classData.id)

  if (!students || students.length === 0) {
    return "No students found in this class."
  }

  // Mark attendance
  const attendanceRecords = students.map((student: any) => {
    const rollNumber = parseInt(student.register_number)
    const isPresent = data.type === "presentees"
      ? data.rollNumbers.includes(rollNumber)
      : !data.rollNumbers.includes(rollNumber)

    return {
      session_id: session.id,
      student_id: student.id,
      is_present: isPresent,
    }
  })

  const { error: recordError } = await ctx.supabase.from("attendance_records").insert(attendanceRecords)

  if (recordError) {
    return "Failed to record attendance."
  }

  const absentCount = data.type === "absentees" ? data.rollNumbers.length : students.length - data.rollNumbers.length

  return `✅ Attendance recorded successfully!\n\nClass: ${data.className}\nDate: ${data.date}\nSubject: ${data.subject}\nPresent: ${students.length - absentCount}\nAbsent: ${absentCount}`
}

export async function handleAttendanceFetch(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as { className?: string; percentage?: number }

  // Get class
  const { data: classData } = await ctx.supabase
    .from("classes")
    .select("id, name")
    .eq("faculty_id", ctx.facultyId)
    .ilike("name", `%${data.className}%`)
    .single()

  if (!classData) {
    return `Class not found.`
  }

  // Get students with attendance
  const { data: students } = await ctx.supabase
    .from("students")
    .select("id, register_number, name")
    .eq("class_id", classData.id)

  if (!students || students.length === 0) {
    return "No students found."
  }

  const studentStats = []

  for (const student of students) {
    // Get session IDs for this class
    const { data: sessions } = await ctx.supabase
      .from("attendance_sessions")
      .select("id")
      .eq("class_id", classData.id)

    const sessionIds = sessions?.map((s: any) => s.id) || []

    if (sessionIds.length === 0) continue

    const { count: total } = await ctx.supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .in("session_id", sessionIds)

    const { count: present } = await ctx.supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("is_present", true)
      .in("session_id", sessionIds)

    const percentage = total > 0 ? Math.round(((present || 0) / total) * 100) : 0

    if (!data.percentage || percentage < data.percentage) {
      studentStats.push({
        registerNumber: student.register_number,
        name: student.name,
        percentage,
        attended: present || 0,
        total: total || 0,
      })
    }
  }

  if (studentStats.length === 0) {
    return "No students found matching the criteria."
  }

  let response = `📊 *Attendance Report - ${classData.name}*\n\n`

  studentStats
    .sort((a, b) => a.percentage - b.percentage)
    .forEach((s) => {
      response += `${s.registerNumber} - ${s.name}\n${s.percentage}% (${s.attended}/${s.total})\n\n`
    })

  return response
}

export async function handleHelp(): Promise<string> {
  return `*WhatsApp Attendance System Commands*

📚 *Class Management*
• "Create class [name]" - Create a new class
• "Add student" - Add a single student

📝 *Attendance*
Format: Date, Time, Class, Subject, Absentees/Presentees
Example: "06-12-2025, 9am-12pm, 3/4 CSIT, OOAD, Absentees: 1,2,3"

📊 *Reports*
• "Get attendance for [class]" - View all students
• "Students below 75% in [class]" - Low attendance

💬 *Parent Communication*
• "Send message to parents of [class] below [%]"

Need help? Just ask naturally!`
}

export async function handleCreateStudents(ctx: RouteHandlerContext): Promise<string> {
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

  if (!data.students || data.students.length === 0) {
    return "No student data found. Please send an Excel file with student information."
  }

  // Get class by name or ID
  let classData
  if (data.classId) {
    const { data: cls } = await ctx.supabase
      .from("classes")
      .select("id, name")
      .eq("id", data.classId)
      .single()
    classData = cls
  } else if (data.className) {
    const { data: cls } = await ctx.supabase
      .from("classes")
      .select("id, name")
      .eq("faculty_id", ctx.facultyId)
      .ilike("name", `%${data.className}%`)
      .single()
    classData = cls
  }

  if (!classData) {
    return "Class not found. Please create the class first."
  }

  // Insert students
  const studentsToInsert = data.students.map((s) => ({
    register_number: s.registerNumber,
    name: s.name,
    whatsapp_number: s.whatsappNumber,
    parent_whatsapp_number: s.parentWhatsappNumber,
    class_id: classData.id,
  }))

  const { error, data: inserted } = await ctx.supabase
    .from("students")
    .insert(studentsToInsert)
    .select()

  if (error) {
    console.error("Error inserting students:", error)
    return `Failed to add students. Error: ${error.message}`
  }

  return `✅ Successfully added ${inserted?.length || 0} students to class "${classData.name}"!`
}

export async function handleAddStudent(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as {
    className: string
    registerNumber: string
    name: string
    whatsappNumber?: string
    parentWhatsappNumber?: string
  }

  if (!data.className || !data.registerNumber || !data.name) {
    return "Please provide: class name, register number, and student name."
  }

  // Get class
  const { data: classData } = await ctx.supabase
    .from("classes")
    .select("id, name")
    .eq("faculty_id", ctx.facultyId)
    .ilike("name", `%${data.className}%`)
    .single()

  if (!classData) {
    return `Class "${data.className}" not found.`
  }

  // Insert student
  const { error } = await ctx.supabase.from("students").insert({
    register_number: data.registerNumber,
    name: data.name,
    whatsapp_number: data.whatsappNumber,
    parent_whatsapp_number: data.parentWhatsappNumber,
    class_id: classData.id,
  })

  if (error) {
    return `Failed to add student. ${error.message}`
  }

  return `✅ Student ${data.name} (${data.registerNumber}) added to ${classData.name}!`
}

export async function handleParentMessage(
  ctx: RouteHandlerContext,
  whatsappConfig: {
    sendMessage: (params: { to: string; message: string }) => Promise<any>
  },
): Promise<string> {
  const data = ctx.geminiResponse.data as {
    className: string
    percentage?: number
    message?: string
  }

  if (!data.className) {
    return "Please specify the class name."
  }

  // Get class
  const { data: classData } = await ctx.supabase
    .from("classes")
    .select("id, name")
    .eq("faculty_id", ctx.facultyId)
    .ilike("name", `%${data.className}%`)
    .single()

  if (!classData) {
    return `Class "${data.className}" not found.`
  }

  // Get students with attendance below threshold
  const threshold = data.percentage || 75
  const { data: sessions } = await ctx.supabase
    .from("attendance_sessions")
    .select("id")
    .eq("class_id", classData.id)

  const sessionIds = sessions?.map((s: any) => s.id) || []

  if (sessionIds.length === 0) {
    return "No attendance sessions found for this class."
  }

  const { data: students } = await ctx.supabase
    .from("students")
    .select("id, register_number, name, parent_whatsapp_number")
    .eq("class_id", classData.id)

  if (!students || students.length === 0) {
    return "No students found in this class."
  }

  const lowAttendanceStudents = []

  for (const student of students) {
    if (!student.parent_whatsapp_number) continue

    const { count: total } = await ctx.supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .in("session_id", sessionIds)

    const { count: present } = await ctx.supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("is_present", true)
      .in("session_id", sessionIds)

    const percentage = total && total > 0 ? Math.round(((present || 0) / total) * 100) : 0

    if (percentage < threshold) {
      lowAttendanceStudents.push({
        ...student,
        percentage,
        attended: present || 0,
        total: total || 0,
      })
    }
  }

  if (lowAttendanceStudents.length === 0) {
    return `No students found with attendance below ${threshold}%.`
  }

  // Send messages to parents
  let sentCount = 0
  const defaultMessage =
    data.message ||
    `Dear Parent,\n\nThis is to inform you that your child's attendance in ${classData.name} is below ${threshold}%.\n\nPlease ensure regular attendance.\n\nThank you.`

  for (const student of lowAttendanceStudents) {
    const personalizedMessage = `${defaultMessage}\n\nStudent: ${student.name} (${student.register_number})\nAttendance: ${student.percentage}% (${student.attended}/${student.total})`

    try {
      await whatsappConfig.sendMessage({
        to: student.parent_whatsapp_number,
        message: personalizedMessage,
      })

      // Log parent message
      await ctx.supabase.from("parent_messages").insert({
        student_id: student.id,
        parent_phone: student.parent_whatsapp_number,
        message: personalizedMessage,
        status: "sent",
      })

      sentCount++
    } catch (error) {
      console.error(`Failed to send message to parent of ${student.name}:`, error)
    }
  }

  return `✅ Messages sent to ${sentCount} parent(s) out of ${lowAttendanceStudents.length} students with attendance below ${threshold}%.`
}
