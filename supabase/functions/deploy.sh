#!/bin/bash

# WhatsApp Attendance System - Supabase Edge Function Deployment Script

echo "🚀 Deploying WhatsApp Webhook Edge Function..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if logged in
echo "📝 Checking Supabase authentication..."
supabase projects list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "🔐 Please login to Supabase:"
    supabase login
fi

# Deploy the function
echo "📦 Deploying whatsapp-webhook function..."
supabase functions deploy whatsapp-webhook --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
    
    # Set environment secrets
    echo ""
    echo "🔑 Setting environment variables..."
    echo "Please enter the following values:"
    
    read -p "WHATSAPP_ACCESS_TOKEN: " whatsapp_token
    read -p "WHATSAPP_PHONE_NUMBER_ID: " phone_id
    read -p "WHATSAPP_WEBHOOK_VERIFY_TOKEN: " verify_token
    read -p "GEMINI_API_KEY: " gemini_key
    
    supabase secrets set WHATSAPP_ACCESS_TOKEN="$whatsapp_token"
    supabase secrets set WHATSAPP_PHONE_NUMBER_ID="$phone_id"
    supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN="$verify_token"
    supabase secrets set GEMINI_API_KEY="$gemini_key"
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Get your webhook URL from Supabase Dashboard"
    echo "2. Configure it in Meta Developer Console"
    echo "3. Set up webhook verification"
    echo ""
    echo "Your webhook URL will be:"
    echo "https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook"
else
    echo "❌ Deployment failed!"
    exit 1
fi
