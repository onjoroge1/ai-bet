#!/bin/bash
# Bash script to test WhatsApp picks endpoint
# Usage: bash test-whatsapp-picks.sh

read -p "Enter your phone number (e.g., 6783929144): " phoneNumber
read -p "Enter your domain (e.g., snapbet.bet or localhost:3000): " domain

url="https://${domain}/api/whatsapp/send-test"
body="{\"to\": \"${phoneNumber}\", \"type\": \"picks\"}"

echo ""
echo "Sending request to: $url"
echo "Body: $body"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
  -H "Content-Type: application/json" \
  -d "$body")

http_code=$(echo "$response" | tail -n1)
body_response=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo ""
echo "Response:"
echo "$body_response" | jq '.' 2>/dev/null || echo "$body_response"

if [ "$http_code" -eq 200 ]; then
    echo ""
    echo "✅ Success! Check your WhatsApp for the picks message!"
else
    echo ""
    echo "❌ Error occurred. HTTP Status: $http_code"
    echo ""
    echo "💡 Tips:"
    echo "1. Make sure your server is running"
    echo "2. Check if the endpoint is deployed: $url"
    echo "3. Try using the test page instead: https://${domain}/whatsapp/test"
fi



