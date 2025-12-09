import { createSupabaseClient, sendWhatsAppMessage, sendWhatsAppTemplate, downloadWhatsAppMedia, processWithGemini, parseExcelFile, generateAttendanceCSV, uploadAttendanceReport, sendWhatsAppDocument, sendWhatsAppCSVAsDocument, cleanupOldReports, generateUniqueFileName } from "../_shared/utils.ts"
import {
  handleCreateClass,
  handleAssignAttendance,
  handleAttendanceFetch,
  handleHelp,
  handleCreateStudents,
  handleAddStudent,
  handleParentMessage,
  handleEditAttendance
} from "../route-handlers/index.ts"

interface WebhookEntry {
  changes?: Array<{
    value?: {
      messages?: Array<{
        from: string
        id: string
        type: string
        text?: { body: string }
        document?: { id: string; mime_type: string }
        image?: { id: string; mime_type: string }
      }>
    }
  }>
}

// Helper function to detect attendance-related queries
// For these queries, we should NOT use chat history to prevent
// percentage filters from previous messages affecting the current request
function isAttendanceQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  const attendanceKeywords = [
    'show attendance',
    'get attendance',
    'attendance report',
    'attendance for',
    'students below',
    'below %',
    'less than %',
    'attendance of'
  ]
  return attendanceKeywords.some(keyword => lowerMessage.includes(keyword))
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    "Server": "Supabase Edge Function",
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    // Handle webhook verification (GET request)
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode")
      const token = url.searchParams.get("hub.verify_token")
      const challenge = url.searchParams.get("hub.challenge")

      const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "attendance_webhook_token"

      if (mode === "subscribe" && token === verifyToken) {
        console.log("✅ Webhook verified")
        return new Response(challenge, { status: 200, headers: corsHeaders })
      }

      console.error("❌ Webhook verification failed")
      return new Response("Forbidden", { status: 403, headers: corsHeaders })
    }

    // Handle webhook POST (incoming messages)
    if (req.method === "POST") {
      const bodyText = await req.text()
      const body = JSON.parse(bodyText)

      // Extract message data
      const entry = body.entry?.[0] as WebhookEntry
      const changes = entry?.changes?.[0]
      const message = changes?.value?.messages?.[0]

      if (!message) {
        return new Response(JSON.stringify({ status: "no message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const phoneNumber = message.from
      const messageText = message.text?.body || ""
      const messageId = message.id
      const hasDocument = !!(message.document || message.image)

      // Validate message text is not empty (unless it's a document upload)
      if (!hasDocument && (!messageText || messageText.trim().length === 0)) {
        return new Response(JSON.stringify({ status: "empty message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.log("📩 Message from:", phoneNumber, "|", hasDocument ? "[Document]" : messageText.substring(0, 50))

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

      const supabase = createSupabaseClient({ supabaseUrl, supabaseKey })

      // Get faculty by WhatsApp number
      const { data: faculty, error: facultyError } = await supabase
        .from("faculty")
        .select("id, profile_id, whatsapp_number")
        .or(`whatsapp_number.eq.${phoneNumber},whatsapp_number.eq.+${phoneNumber}`)
        .single()

      if (!faculty) {
        console.error("❌ Unauthorized:", phoneNumber)
        const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!
        const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!

        try {
          await sendWhatsAppMessage(
            {
              to: phoneNumber,
              message: "You are not registered as a faculty member. Please contact the administrator.",
            },
            accessToken,
            phoneNumberId,
          )
        } catch (sendError) {
          console.error("❌ Error sending not authorized message:", sendError)
        }

        return new Response(JSON.stringify({ status: "not authorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.log("✅ Faculty:", faculty.id)

      // Handle media if present
      let extractedData = null
      let mediaType = null

      if (message.document || message.image) {
        const mediaId = message.document?.id || message.image?.id
        mediaType = message.document?.mime_type || message.image?.mime_type
        const fileName = message.document?.filename || "unknown"

        if (mediaId && (mediaType?.includes("sheet") || fileName?.endsWith(".xlsx") || fileName?.endsWith(".xls"))) {
          console.log("📄 Processing Excel:", fileName)
          const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!

          try {
            const mediaBuffer = await downloadWhatsAppMedia(mediaId, accessToken)

            // Parse Excel file
            const students = await parseExcelFile(mediaBuffer)

            extractedData = {
              receivedDocument: true,
              fileName: fileName || "student_data.xlsx",
              fileSize: mediaBuffer.byteLength,
              mediaId: mediaId,
              students: students
            }
          } catch (downloadError) {
            console.error("❌ Error processing Excel:", downloadError)
            extractedData = {
              receivedDocument: true,
              fileName: fileName,
              error: "Failed to download or parse file"
            }
          }
        }
      }

      // Check if message was already processed (deduplication)
      const { data: existingMessage } = await supabase
        .from("chat_history")
        .select("id")
        .eq("whatsapp_message_id", messageId)
        .single()

      if (existingMessage) {
        console.log("⚠️ Duplicate message skipped:", messageId)
        return new Response(JSON.stringify({ status: "duplicate message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Get chat history
      const { data: history } = await supabase
        .from("chat_history")
        .select("message_type, message")
        .eq("faculty_id", faculty.id)
        .order("created_at", { ascending: false })
        .limit(10)

      // IMPORTANT: For attendance fetch queries, ignore chat history to prevent
      // previous percentage filters from affecting the current request
      let chatHistory: Array<{ role: string; content: string }> = []
      if (!isAttendanceQuery(messageText)) {
        chatHistory = (history || []).reverse().map((h: any) => ({
          role: h.message_type === "incoming" ? "user" : "assistant",
          content: h.message,
        }))
      }

      // Load all 5 Gemini API keys
      const geminiApiKeys = [
        Deno.env.get("GEMINI_API_KEY_1"),
        Deno.env.get("GEMINI_API_KEY_2"),
        Deno.env.get("GEMINI_API_KEY_3"),
        Deno.env.get("GEMINI_API_KEY_4"),
        Deno.env.get("GEMINI_API_KEY_5"),
      ].filter(key => key) as string[] // Remove any undefined keys

      let geminiResponse
      
      // DECISION POINT: Handle documents differently from text messages
      if (extractedData?.students && Array.isArray(extractedData.students)) {
        // DOCUMENT FLOW: Excel file with student data uploaded
        console.log("📊 Processing", extractedData.students.length, "students from Excel")
        
        // Prepare message for Gemini with extracted student data
        const documentMessage = `User uploaded an Excel file with ${extractedData.students.length} students. The student data has been extracted. Please process this student list and create their profiles.`
        
        try {
          geminiResponse = await processWithGemini(
            documentMessage,
            chatHistory,
            geminiApiKeys[0],
            mediaType || undefined,
            extractedData,
            geminiApiKeys,
          )
          
          // Override response to ensure createStudents route is used
          if (geminiResponse.route !== "createStudents") {
            geminiResponse = {
              route: "createStudents",
              message: geminiResponse.message || "Processing student data from Excel file...",
              data: {
                students: extractedData.students,
                fileName: extractedData.fileName
              }
            }
          } else if (!geminiResponse.data.students) {
            // Ensure students data is in the response
            geminiResponse.data.students = extractedData.students
          }
        } catch (geminiError) {
          console.error("❌ Gemini error (document):", geminiError)
          // Fallback: directly create students without Gemini
          geminiResponse = {
            route: "createStudents",
            message: "Processing student data from Excel file...",
            data: {
              students: extractedData.students,
              fileName: extractedData.fileName
            }
          }
        }
      } else {
        // TEXT MESSAGE FLOW: Normal text processing
        try {
          geminiResponse = await processWithGemini(
            messageText,
            chatHistory,
            geminiApiKeys[0],
            mediaType || undefined,
            extractedData,
            geminiApiKeys,
          )
        } catch (geminiError) {
          console.error("❌ Gemini error (text):", geminiError)
          // Fallback response when Gemini fails
          geminiResponse = {
            route: "help",
            message: "I apologize, but I encountered an error. Please try again.",
            data: {}
          }
        }
      }

      // Save incoming message to chat history
      await supabase.from("chat_history").insert({
        faculty_id: faculty.id,
        message_type: "incoming",
        message: messageText,
        media_type: mediaType,
        whatsapp_message_id: messageId,
        gemini_response: geminiResponse,
      })

      // Process the route and execute actions
      let responseMessage = geminiResponse.message

      const routeContext = {
        facultyId: faculty.id,
        geminiResponse,
        supabase,
        phoneNumber,
      }

      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!

      console.log("🔀 Route:", geminiResponse.route)

      try {
        switch (geminiResponse.route) {
          case "createClass":
            responseMessage = await handleCreateClass(routeContext)
            break

          case "assignAttendance":
            responseMessage = await handleAssignAttendance(routeContext)
            break

          case "attendanceFetch":
            responseMessage = await handleAttendanceFetch(routeContext)
            // Check if this is a document request
            if (responseMessage === "document") {
              const { studentStats, className } = geminiResponse.data
              try {
                // Clean up all old files first
                await cleanupOldReports(supabase)

                // Generate CSV
                const csvContent = generateAttendanceCSV(className, studentStats)
                const fileName = generateUniqueFileName(className)

                // Upload to storage to get public URL
                const documentUrl = await uploadAttendanceReport(supabase, fileName, csvContent, "text/csv")

                if (documentUrl) {
                  console.log("Document URL created:", documentUrl)
                  // Send as document via WhatsApp
                  await sendWhatsAppDocument(
                    {
                      to: phoneNumber,
                      documentUrl,
                      caption: `📊 Attendance Report - ${className}`,
                    },
                    accessToken,
                    phoneNumberId,
                  )
                  responseMessage = null // Document already sent
                } else {
                  console.error("Failed to get document URL")
                  responseMessage = "Failed to generate report. Please try again."
                }
              } catch (docError) {
                console.error("Document generation error:", docError)
                responseMessage = "Failed to generate report. Please try again."
              }
            }
            break

          case "help":
            responseMessage = await handleHelp()
            break

          case "createStudents":
            responseMessage = await handleCreateStudents(routeContext)
            break

          case "addStudent":
            responseMessage = await handleAddStudent(routeContext)
            break

          case "editAttendance":
            responseMessage = await handleEditAttendance(routeContext)
            break

          case "parentMessage":
            responseMessage = await handleParentMessage(routeContext, {
              sendMessage: async (params: { to: string; message: string }) => {
                return await sendWhatsAppMessage(params, accessToken, phoneNumberId)
              },
              sendTemplate: async (params: { 
                to: string
                templateName: string
                languageCode?: string
                parameters: Array<{ type: string; text: string }>
              }) => {
                return await sendWhatsAppTemplate(params, accessToken, phoneNumberId)
              },
            })
            break

          default:
            // Use Gemini's response for general, clarify, etc.
            responseMessage = geminiResponse.message
        }
      } catch (error) {
        console.error("Route handler error:", error)
        responseMessage = "An error occurred processing your request. Please try again."
      }

      // Send text response if not null
      if (responseMessage) {
        await sendWhatsAppMessage(
          {
            to: phoneNumber,
            message: responseMessage,
          },
          accessToken,
          phoneNumberId,
        )
      }

      // Save outgoing message
      await supabase.from("chat_history").insert({
        faculty_id: faculty.id,
        message_type: "outgoing",
        message: responseMessage,
      })

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  } catch (error) {
    console.error("Webhook error:", error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
