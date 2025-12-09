import { createSupabaseClient, sendWhatsAppMessage, downloadWhatsAppMedia, processWithGemini, parseExcelFile, generateAttendanceCSV, uploadAttendanceReport, sendWhatsAppDocument, sendWhatsAppCSVAsDocument, cleanupOldReports, generateUniqueFileName } from "../_shared/utils.ts"
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
  console.log("=== WEBHOOK REQUEST RECEIVED ===")
  console.log("Method:", req.method)
  console.log("URL:", req.url)

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
    console.log("OPTIONS request - returning ok")
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    // Handle webhook verification (GET request)
    if (req.method === "GET") {
      console.log("GET request for webhook verification")
      const mode = url.searchParams.get("hub.mode")
      const token = url.searchParams.get("hub.verify_token")
      const challenge = url.searchParams.get("hub.challenge")

      console.log("Verification params - mode:", mode, "token:", token, "challenge:", challenge)

      const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "attendance_webhook_token"
      console.log("Expected verify token:", verifyToken)

      if (mode === "subscribe" && token === verifyToken) {
        console.log("Webhook verified successfully!")
        return new Response(challenge, { status: 200, headers: corsHeaders })
      }

      console.log("Webhook verification failed - token mismatch")
      return new Response("Forbidden", { status: 403, headers: corsHeaders })
    }

    // Handle webhook POST (incoming messages)
    if (req.method === "POST") {
      console.log("POST request - processing incoming message")

      const bodyText = await req.text()
      console.log("Raw body:", bodyText)

      const body = JSON.parse(bodyText)
      console.log("Parsed body:", JSON.stringify(body, null, 2))

      // Extract message data
      const entry = body.entry?.[0] as WebhookEntry
      const changes = entry?.changes?.[0]
      const message = changes?.value?.messages?.[0]

      console.log("Entry:", entry ? "found" : "not found")
      console.log("Changes:", changes ? "found" : "not found")
      console.log("Message:", message ? JSON.stringify(message) : "not found")

      if (!message) {
        console.log("No message found in webhook payload - returning 'no message'")
        return new Response(JSON.stringify({ status: "no message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const phoneNumber = message.from
      const messageText = message.text?.body || ""
      const messageId = message.id
      const hasDocument = !!(message.document || message.image)

      console.log("Phone number:", phoneNumber)
      console.log("Message text:", messageText)
      console.log("Message ID:", messageId)
      console.log("Has document:", hasDocument)

      // Validate message text is not empty (unless it's a document upload)
      if (!hasDocument && (!messageText || messageText.trim().length === 0)) {
        console.log("Empty message text and no document - ignoring")
        return new Response(JSON.stringify({ status: "empty message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.log("Processing message...")
      console.log("Message type:", hasDocument ? "document" : "text")
      console.log("Message ID:", messageId)

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      console.log("Supabase URL:", supabaseUrl)
      console.log("Supabase key exists:", !!supabaseKey)

      const supabase = createSupabaseClient({ supabaseUrl, supabaseKey })

      // Get faculty by WhatsApp number
      console.log("Looking up faculty with WhatsApp number:", phoneNumber)
      const { data: faculty, error: facultyError } = await supabase
        .from("faculty")
        .select("id, profile_id, whatsapp_number")
        .or(`whatsapp_number.eq.${phoneNumber},whatsapp_number.eq.+${phoneNumber}`)
        .single()

      console.log("Faculty lookup result:", faculty ? JSON.stringify(faculty) : "null")
      console.log("Faculty lookup error:", facultyError ? JSON.stringify(facultyError) : "null")

      if (!faculty) {
        console.log("Faculty not found - sending not authorized message")
        const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!
        const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!

        console.log("Access token exists:", !!accessToken)
        console.log("Phone number ID:", phoneNumberId)

        try {
          const sendResult = await sendWhatsAppMessage(
            {
              to: phoneNumber,
              message: "You are not registered as a faculty member. Please contact the administrator.",
            },
            accessToken,
            phoneNumberId,
          )
          console.log("Send message result:", JSON.stringify(sendResult))
        } catch (sendError) {
          console.error("Error sending not authorized message:", sendError)
        }

        return new Response(JSON.stringify({ status: "not authorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Handle media if present
      let extractedData = null
      let mediaType = null

      if (message.document || message.image) {
        console.log("Document/Image detected")
        const mediaId = message.document?.id || message.image?.id
        mediaType = message.document?.mime_type || message.image?.mime_type
        const fileName = message.document?.filename || "unknown"

        console.log("Media ID:", mediaId)
        console.log("Media type:", mediaType)
        console.log("File name:", fileName)

        if (mediaId && (mediaType?.includes("sheet") || fileName?.endsWith(".xlsx") || fileName?.endsWith(".xls"))) {
          console.log("Excel file detected, downloading...")
          const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!

          try {
            const mediaBuffer = await downloadWhatsAppMedia(mediaId, accessToken)
            console.log("Excel file downloaded, size:", mediaBuffer.byteLength)

            // Parse Excel file
            const students = await parseExcelFile(mediaBuffer)

            extractedData = {
              receivedDocument: true,
              fileName: fileName || "student_data.xlsx",
              fileSize: mediaBuffer.byteLength,
              mediaId: mediaId,
              students: students
            }

            console.log("Excel data extracted:", JSON.stringify(extractedData))
          } catch (downloadError) {
            console.error("Error downloading/processing Excel:", downloadError)
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
        console.log("Message already processed, skipping to prevent duplicates. Message ID:", messageId)
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
      if (isAttendanceQuery(messageText)) {
        console.log("Attendance query detected - ignoring chat history to prevent percentage filter leakage")
      } else {
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
      
      console.log(`Loaded ${geminiApiKeys.length} Gemini API keys`)

      let geminiResponse
      
      // DECISION POINT: Handle documents differently from text messages
      if (extractedData?.students && Array.isArray(extractedData.students)) {
        // DOCUMENT FLOW: Excel file with student data uploaded
        console.log("=== DOCUMENT PROCESSING FLOW ===")
        console.log(`Extracted ${extractedData.students.length} students from Excel`)
        
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
          console.log("Gemini response for document:", JSON.stringify(geminiResponse))
          
          // Override response to ensure createStudents route is used
          if (geminiResponse.route !== "createStudents") {
            console.log("Gemini didn't return createStudents route, forcing it...")
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
          console.error("Gemini processing error for document:", geminiError)
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
        console.log("=== TEXT MESSAGE PROCESSING FLOW ===")
        
        try {
          geminiResponse = await processWithGemini(
            messageText,
            chatHistory,
            geminiApiKeys[0],
            mediaType || undefined,
            extractedData,
            geminiApiKeys,
          )
          console.log("Gemini response received:", JSON.stringify(geminiResponse))
        } catch (geminiError) {
          console.error("Gemini processing error:", geminiError)
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
