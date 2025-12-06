import { type NextRequest, NextResponse } from "next/server"

// This route now proxies to Supabase Edge Function for better performance and scalability
// The edge function handles all WhatsApp webhook logic

// Webhook verification (GET)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  // Forward to edge function
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-webhook`
  
  try {
    const response = await fetch(
      `${edgeFunctionUrl}?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=${challenge}`,
      {
        method: "GET",
      },
    )

    const text = await response.text()
    return new NextResponse(text, { status: response.status })
  } catch (error) {
    console.error("Edge function proxy error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Message handling (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Forward to edge function
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-webhook`
    
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()
    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
