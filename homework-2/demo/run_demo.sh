#!/usr/bin/env bash
# Demo script for Homework 2: Intelligent Customer Support System
# Start the server first: npm run dev
set -e

BASE="http://localhost:3000"

# Pretty-print if python3 is available, otherwise raw output
pprint() {
  if command -v python3 &>/dev/null; then
    python3 -m json.tool
  else
    cat
  fi
}

echo "=== Create ticket ==="
TICKET=$(curl -sf -X POST "$BASE/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "demo-1",
    "customer_email": "alice@example.com",
    "customer_name": "Alice",
    "subject": "Login issue",
    "description": "Cannot login to my account after password reset.",
    "metadata": { "source": "web_form", "browser": "Chrome 120", "device_type": "desktop" }
  }')
echo "$TICKET" | pprint
ID=$(echo "$TICKET" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null \
  || echo "$TICKET" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "=== Auto-classify on create ==="
curl -sf -X POST "$BASE/tickets?auto_classify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "demo-2",
    "customer_email": "bob@example.com",
    "customer_name": "Bob",
    "subject": "Critical login error",
    "description": "Cannot login, critical production down issue.",
    "metadata": { "source": "web_form", "browser": "Firefox", "device_type": "desktop" }
  }' | pprint

echo ""
echo "=== Auto-classify existing ticket ==="
curl -sf -X POST "$BASE/tickets/$ID/auto-classify" | pprint

echo ""
echo "=== List all tickets ==="
curl -sf "$BASE/tickets" | pprint

echo ""
echo "=== Bulk import CSV with auto-classification ==="
curl -sf -X POST "$BASE/tickets/import?auto_classify=true" \
  -F "file=@tests/fixtures/sample_tickets.csv" | pprint

echo ""
echo "=== Filter: category=account_access, priority=medium ==="
curl -sf "$BASE/tickets?category=account_access&priority=medium" | pprint

echo ""
echo "=== Update ticket status to resolved ==="
curl -sf -X PUT "$BASE/tickets/$ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved", "assigned_to": "agent-42"}' | pprint

echo ""
echo "=== Delete ticket ==="
curl -sf -X DELETE "$BASE/tickets/$ID" -w "HTTP %{http_code}\n"

echo ""
echo "Demo complete."