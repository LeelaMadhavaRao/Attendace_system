import { createSupabaseClient, sendWhatsAppMessage, downloadWhatsAppMedia, processWithGemini } from "../_shared/utils.ts"
import { 
  handleCreateClass, 
  handleAssignAttendance, 
  handleAttendanceFetch, 
  handleHelp,
  handleCreateStudents,
  handleAddStudent,
  handleParentMessage 
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

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
        console.log("Webhook verified")
        return new Response(challenge, { status: 200, headers: corsHeaders })
      }

      return new Response("Forbidden", { status: 403, headers: corsHeaders })
    }

    // Handle webhook POST (incoming messages)
    if (req.method === "POST") {
      const body = await req.json()
      
      // Extract message data
      const entry = body.entry?.[0] as WebhookEntry
      const changes = entry?.changes?.[0]
      const message = changes?.value?.messages?.[0]

      if (!message) {
        return new Response(JSON.stringify({ status: "no message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const phoneNumber = message.from
      const messageText = message.text?.body || ""
      const messageId = message.id

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      const supabase = createSupabaseClient({ supabaseUrl, supabaseKey })

      // Get faculty by WhatsApp number
      const { data: faculty } = await supabase
        .from("faculty")
        .select("id, profile_id, whatsapp_number")
        .or(`whatsapp_number.eq.${phoneNumber},whatsapp_number.eq.+${phoneNumber}`)
        .single()

      if (!faculty) {
        const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!
        const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!
        
        await sendWhatsAppMessage(
          {
            to: phoneNumber,
            message: "You are not registered as a faculty member. Please contact the administrator.",
          },
          accessToken,
          phoneNumberId,
        )

        return new Response(JSON.stringify({ status: "not authorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Handle media if present
      let extractedData = null
      let mediaType = null

      if (message.document || message.image) {
        const mediaId = message.document?.id || message.image?.id
        mediaType = message.document?.mime_type || message.image?.mime_type

        if (mediaId && mediaType?.includes("sheet")) {
          const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!
          const mediaBuffer = await downloadWhatsAppMedia(mediaId, accessToken)
          
          // Parse Excel - simplified student data extraction
          // In production, you would use a proper XLSX parser
          // For now, mock the structure that would come from parsing
          extractedData = {
            students: [
              // This would be populated by actual Excel parsing
              // Example structure expected from Excel
            ],
          }
          
          // If we detect this is a document, prompt to use proper parsing
          if (extractedData.students.length === 0) {
            // Store that we received a document
            extractedData = {
              receivedDocument: true,
              fileName: "student_data.xlsx",
            }
          }
        }
      }

      // Get chat history
      const { data: history } = await supabase
        .from("chat_history")
        .select("message_type, message")
        .eq("faculty_id", faculty.id)
        .order("created_at", { ascending: false })
        .limit(10)

      const chatHistory = (history || []).reverse().map((h: any) => ({
        role: h.message_type === "incoming" ? "user" : "assistant",
        content: h.message,
      }))

      // Process with Gemini
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!
      const geminiResponse = await processWithGemini(
        messageText,
        chatHistory,
        geminiApiKey,
        mediaType || undefined,
        extractedData,
      )

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
      
      await sendWhatsAppMessage(
        {
          to: phoneNumber,
          message: responseMessage,
        },
        accessToken,
        phoneNumberId,
      )

      // Save outgoing message
      await supabase.from("chat_history").insert({
        faculty_id: faculty.id,
        message_type: "outgoing",
        message: responseMessage,
      })

      return new Response(JSON.stringify({ status: "success" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  } catch (error) {
    console.error("Webhook error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
