# WhatsApp Attendance System - Edge Functions Deployment

## Prerequisites

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link your project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

## Deployment Steps

### Option 1: Using Deploy Script (Recommended)

```bash
cd supabase/functions
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Manual Deployment

```bash
# Deploy function
supabase functions deploy whatsapp-webhook --no-verify-jwt

# Set environment secrets
supabase secrets set WHATSAPP_ACCESS_TOKEN=your_token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your_phone_id
supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
supabase secrets set GEMINI_API_KEY=your_gemini_key
```

## Configuration

### 1. Get Your Webhook URL

After deployment, your webhook URL will be:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook
```

You can find your project ref in the Supabase Dashboard URL.

### 2. Configure WhatsApp Webhook

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Select your WhatsApp Business App
3. Navigate to WhatsApp → Configuration
4. Set Callback URL to your webhook URL
5. Set Verify Token (use the same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`)
6. Subscribe to `messages` webhook field

### 3. Test Webhook Verification

```bash
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test"
```

Should return: `test`

## Local Development

```bash
# Start local function server
supabase functions serve whatsapp-webhook --env-file ../../.env.local

# Test locally
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "1234567890",
            "id": "msg_123",
            "type": "text",
            "text": {"body": "hello"}
          }]
        }
      }]
    }]
  }'
```

## Environment Variables

Required secrets for the edge function:

| Variable | Description | Where to get |
|----------|-------------|--------------|
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API token | Meta Developer Console → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp phone number ID | Meta Developer Console → WhatsApp → API Setup |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Custom token for verification | Create any secure string |
| `GEMINI_API_KEY` | Google Gemini API key | [Google AI Studio](https://makersuite.google.com/app/apikey) |

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in edge functions.

## Monitoring

View function logs:
```bash
supabase functions logs whatsapp-webhook
```

Or in Supabase Dashboard:
- Go to Edge Functions
- Select `whatsapp-webhook`
- View Logs tab

## Troubleshooting

### Function not receiving messages
1. Check webhook configuration in Meta Developer Console
2. Verify webhook URL is correct
3. Check function logs for errors
4. Ensure faculty WhatsApp number is registered in database

### Gemini API errors
1. Verify `GEMINI_API_KEY` is set correctly
2. Check API quota in Google AI Studio
3. Review function logs for specific error messages

### Database errors
1. Verify RLS policies are configured
2. Check service role key has proper permissions
3. Review SQL migration scripts

## Updates

To update the function after making changes:
```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

## Rollback

If you need to rollback:
```bash
supabase functions delete whatsapp-webhook
# Then redeploy previous version
```
