import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, Code2, BookOpen } from "lucide-react";

const BASE = typeof window !== "undefined" ? window.location.origin : "https://pay.makamesco-tech.co.ke";

function CodeBlock({ curl, node }: { curl: string; node: string }) {
  return (
    <Tabs defaultValue="curl" className="w-full">
      <div className="flex items-center px-4 border-b bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <TabsList className="bg-transparent h-12 p-0 border-none">
          <TabsTrigger value="curl" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12">
            <Terminal className="w-4 h-4 mr-2" /> cURL
          </TabsTrigger>
          <TabsTrigger value="node" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12">
            <Code2 className="w-4 h-4 mr-2" /> Node.js
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="curl" className="p-4 m-0 bg-gray-950 text-gray-50 rounded-b-lg">
        <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap"><code>{curl}</code></pre>
      </TabsContent>
      <TabsContent value="node" className="p-4 m-0 bg-gray-950 text-gray-50 rounded-b-lg">
        <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap"><code>{node}</code></pre>
      </TabsContent>
    </Tabs>
  );
}

function ParamTable({ rows }: { rows: [string, string, string, boolean?][] }) {
  return (
    <div className="border rounded-lg overflow-hidden text-sm">
      <table className="w-full text-left">
        <thead className="bg-gray-50 dark:bg-gray-900 border-b">
          <tr>
            <th className="px-4 py-3 font-medium">Parameter</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Required</th>
            <th className="px-4 py-3 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(([name, type, desc, required = true]) => (
            <tr key={name}>
              <td className="px-4 py-3 font-mono text-primary">{name}</td>
              <td className="px-4 py-3 text-muted-foreground">{type}</td>
              <td className="px-4 py-3">
                <Badge variant={required ? "default" : "secondary"}>{required ? "Yes" : "No"}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointCard({ method, path, description, children }: {
  method: "GET" | "POST" | "DELETE";
  path: string;
  description: string;
  children?: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-green-100 text-green-700",
    DELETE: "bg-red-100 text-red-700",
  };
  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium font-mono flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-1 rounded text-xs font-bold ${colors[method]}`}>{method}</span>
          <span className="text-muted-foreground">{BASE}</span>
          <span>{path}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function Docs() {
  const isHeistTech = typeof window !== "undefined" && window.location.hostname.includes("heisttech");
  const brandName = isHeistTech ? "HeistTech Pay" : "Nexus Pay";
  const brandInitial = isHeistTech ? "H" : "N";
  const brandColor = isHeistTech ? "bg-red-600" : "bg-green-600";

  return (
    <div className="min-h-screen bg-white">
      {/* Public Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:opacity-80 transition-opacity">
            <div className={`w-7 h-7 ${brandColor} rounded-md flex items-center justify-center text-white text-xs font-bold`}>{brandInitial}</div>
            <span className="text-sm">{brandName}</span>
            <Badge variant="outline" className="text-xs ml-1 hidden sm:inline-flex gap-1">
              <BookOpen className="w-3 h-3" /> Docs
            </Badge>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" className={`${brandColor} hover:opacity-90 text-white`} asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Docs Content */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">API Documentation</h2>
        <p className="text-muted-foreground mt-1">Integrate {brandName} M-Pesa payments into your application.</p>
      </div>

      {/* Sandbox Mode Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-sm text-purple-900 space-y-3">
        <p className="font-bold text-base flex items-center gap-2">🧪 Sandbox Mode</p>
        <p>All new accounts start in <strong>Sandbox Mode</strong>. You get <strong>2 free test transactions</strong> to verify your integration with live M-Pesa. The STK Push is real — use a small amount like <code className="bg-purple-100 px-1 rounded">KES 1</code> to test.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border border-purple-100 p-3 space-y-1">
            <p className="font-semibold">Sandbox Response</p>
            <p className="text-purple-700 text-xs">When in sandbox, responses include:</p>
            <pre className="text-xs bg-purple-950 text-purple-200 rounded p-2 mt-1 overflow-x-auto">{`{
  "sandboxMode": true,
  "sandboxTransactionsRemaining": 1,
  ...
}`}</pre>
          </div>
          <div className="bg-white rounded-lg border border-purple-100 p-3 space-y-1">
            <p className="font-semibold">After 2 transactions</p>
            <p className="text-purple-700 text-xs">Further calls return a 403 error:</p>
            <pre className="text-xs bg-purple-950 text-purple-200 rounded p-2 mt-1 overflow-x-auto">{`{
  "error": "SANDBOX_LIMIT_REACHED",
  "activationRequired": true
}`}</pre>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-purple-100 p-3">
          <p className="font-semibold mb-2">Activation Plans</p>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full" /><strong>Monthly — KES 100</strong>: Renews every 30 days. No transaction fees.</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full" /><strong>Yearly — KES 500</strong>: One-time payment. Full year access. Best value.</div>
          </div>
          <p className="text-xs text-purple-700 mt-2">Click <strong>Activate</strong> in the sidebar to pay via M-Pesa STK Push. Account is activated automatically upon payment.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
        <p className="font-semibold">Authentication</p>
        <p>All merchant API calls require an <code className="bg-amber-100 px-1 rounded">X-API-Key</code> header with your Secret Key. Generate API keys from the <strong>API Keys</strong> section. Never expose secret keys in client-side code.</p>
      </div>

      {/* ── STK PUSH ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold">1. Trigger an STK Push (C2B)</h3>
        <p className="text-muted-foreground text-sm">Sends a payment prompt directly to the customer's phone. They enter their M-Pesa PIN to complete the transaction.</p>

        <EndpointCard method="POST" path="/api/payments/stkpush" description="Initiate an M-Pesa STK Push payment to a customer's phone.">
          <CodeBlock
            curl={`curl -X POST ${BASE}/api/payments/stkpush \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 100,
    "accountReference": "INV-001",
    "transactionDesc": "Payment for order #001"
  }'`}
            node={`const res = await fetch('${BASE}/api/payments/stkpush', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    phoneNumber: '254712345678',
    amount: 100,
    accountReference: 'INV-001',
    transactionDesc: 'Payment for order #001'
  })
});

const data = await res.json();
// data.checkoutRequestId — use this to verify payment status`}
          />
        </EndpointCard>

        <ParamTable rows={[
          ["phoneNumber", "string", "Customer Safaricom number — format 254XXXXXXXXX"],
          ["amount", "number", "Amount to charge in KES (minimum 1)"],
          ["accountReference", "string", "Your internal reference, e.g. invoice or order ID"],
          ["transactionDesc", "string", "Description shown to the customer on their phone"],
          ["settlementAccountId", "number", "ID of the settlement account to receive funds (uses your default if omitted)", false],
          ["tenantCode", "string", "SaaS only: unique tenant code (e.g. tnnt_abc12345) — routes to that tenant's settlement account. Takes priority over settlementAccountId", false],
        ]} />

        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Response</div>
          <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "checkoutRequestId": "ws_CO_24042026_...",   // use this to verify status
  "merchantRequestId": "29115-...",
  "responseCode": "0",
  "responseDescription": "Success. Request accepted for processing",
  "customerMessage": "Success. Request accepted for processing",
  "transactionId": 42
}`}</pre>
        </div>
      </section>

      {/* ── VERIFY PAYMENT ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold">2. Verify a Payment</h3>
        <p className="text-muted-foreground text-sm">After sending an STK push, poll this endpoint to confirm the payment status. Poll every 3–5 seconds for up to 60 seconds.</p>

        <EndpointCard method="GET" path="/api/payments/status/:checkoutRequestId" description="Check the current status of an STK Push transaction.">
          <CodeBlock
            curl={`curl ${BASE}/api/payments/status/ws_CO_24042026_123456 \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
            node={`const checkoutRequestId = 'ws_CO_24042026_123456';

const res = await fetch(
  \`${BASE}/api/payments/status/\${checkoutRequestId}\`,
  { headers: { 'X-API-Key': 'YOUR_SECRET_KEY' } }
);

const data = await res.json();
// data.status: 'pending' | 'completed' | 'failed' | 'cancelled'
if (data.status === 'completed') {
  console.log('Receipt:', data.mpesaReceiptNumber);
}`}
          />
        </EndpointCard>

        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Response</div>
          <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "checkoutRequestId": "ws_CO_24042026_...",
  "status": "completed",           // pending | completed | failed | cancelled
  "mpesaReceiptNumber": "RBK71G...",
  "amount": "100.00",
  "phoneNumber": "254712345678",
  "createdAt": "2026-04-24T14:00:00Z",
  "updatedAt": "2026-04-24T14:01:05Z"
}`}</pre>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Polling recommendation</p>
          <p>Start polling 5 seconds after the STK push. Poll every 3–5 seconds. A status of <code className="bg-blue-100 px-1 rounded">pending</code> means the customer hasn't responded yet. After 60 seconds with no response, consider it timed out.</p>
        </div>
      </section>

      {/* ── PAYMENT LINKS ───────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold">3. Payment Links</h3>
        <p className="text-muted-foreground text-sm">Create shareable URLs your customers can open to pay without any API integration on their end. Ideal for invoices, social media, and WhatsApp.</p>

        <EndpointCard method="POST" path="/api/payment-links" description="Create a new payment link. Returns a shareable URL customers can open to pay.">
          <CodeBlock
            curl={`curl -X POST ${BASE}/api/payment-links \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "title": "Pay for Invoice #123",
    "description": "Website design project",
    "amount": 5000,
    "accountReference": "INV-123",
    "transactionDesc": "Invoice payment"
  }'`}
            node={`const res = await fetch('${BASE}/api/payment-links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    title: 'Pay for Invoice #123',
    description: 'Website design project',
    amount: 5000,                  // omit for variable amount
    accountReference: 'INV-123',
    transactionDesc: 'Invoice payment'
  })
});

const link = await res.json();
const shareUrl = \`${BASE}/pay/\${link.slug}\`;
console.log('Share this URL:', shareUrl);`}
          />
        </EndpointCard>

        <ParamTable rows={[
          ["title", "string", "Title shown to the customer on the payment page"],
          ["accountReference", "string", "Your internal reference for this payment"],
          ["transactionDesc", "string", "Description shown on the customer's M-Pesa prompt"],
          ["description", "string", "Optional subtitle/details shown on the payment page", false],
          ["amount", "number", "Fixed amount in KES. Omit to let customer enter their own amount", false],
          ["expiresAt", "string", "ISO date string when the link expires, e.g. 2026-12-31", false],
        ]} />

        <EndpointCard method="GET" path="/api/payment-links" description="List all payment links for the authenticated merchant." />
        <EndpointCard method="DELETE" path="/api/payment-links/:id" description="Deactivate a payment link. Customers who visit it will see an error." />
      </section>

      {/* ── CALLBACK ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold">4. Payment Callback (Webhook)</h3>
        <p className="text-muted-foreground text-sm">
          When a customer completes or cancels an M-Pesa payment, Safaricom automatically posts the result to the callback URL registered with your shortcode. This gateway handles the callback, verifies the payload, and updates the transaction status in real-time. <strong>You do not need to configure anything</strong> — it works automatically.
        </p>

        {/* Registered Callback URL */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-green-800">Registered Daraja Callback URL</p>
          <p className="text-xs text-green-700 mb-2">This URL is pre-registered with your M-Pesa shortcode in the Daraja portal. Safaricom posts payment results here automatically.</p>
          <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-4 py-2.5">
            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded">POST</span>
            <code className="text-sm font-mono text-gray-800 break-all">{BASE}/api/payments/callback</code>
          </div>
        </div>

        {/* What M-Pesa sends */}
        <div>
          <p className="text-sm font-semibold mb-2">M-Pesa Callback Payload (what Safaricom sends)</p>
          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium text-xs">Successful payment</div>
            <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_24042026_12345678",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount",              "Value": 100 },
          { "Name": "MpesaReceiptNumber",  "Value": "RBK71GXXXXX" },
          { "Name": "TransactionDate",     "Value": 20260424140105 },
          { "Name": "PhoneNumber",         "Value": 254712345678 }
        ]
      }
    }
  }
}`}</pre>
          </div>
          <div className="border rounded-lg overflow-hidden text-sm mt-3">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium text-xs">Failed / cancelled payment</div>
            <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_24042026_12345678",
      "ResultCode": 1032,
      "ResultDesc": "Request cancelled by user."
      // No CallbackMetadata when payment fails
    }
  }
}`}</pre>
          </div>
        </div>

        {/* ResultCode table */}
        <div>
          <p className="text-sm font-semibold mb-2">M-Pesa ResultCode Reference</p>
          <div className="border rounded-lg overflow-hidden text-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">ResultCode</th>
                  <th className="px-4 py-3 font-medium">Meaning</th>
                  <th className="px-4 py-3 font-medium">Transaction Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {[
                  ["0", "Success — payment completed", "completed"],
                  ["1032", "Request cancelled by user", "cancelled"],
                  ["1037", "DS timeout — user didn't respond in time", "failed"],
                  ["1", "Insufficient funds in the M-Pesa account", "failed"],
                  ["2001", "Wrong PIN entered", "failed"],
                  ["17", "Transaction limit reached for the day", "failed"],
                ].map(([code, meaning, status]) => (
                  <tr key={code}>
                    <td className="px-4 py-3 font-mono font-bold">{code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{meaning}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        status === "completed" ? "bg-green-100 text-green-700" :
                        status === "cancelled" ? "bg-gray-100 text-gray-600" :
                        "bg-red-100 text-red-600"
                      }`}>{status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommended verification flow */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Recommended Verification Flow</p>
          <ol className="text-xs text-blue-800 space-y-2 list-none">
            {[
              ["1", "Call POST /api/payments/stkpush", "Save the checkoutRequestId from the response."],
              ["2", "Show 'Waiting for payment' to your user", "The STK Push prompt is now on their phone."],
              ["3", "Poll GET /api/payments/status/:checkoutRequestId", "Poll every 3–5 seconds. The gateway updates status the moment M-Pesa calls back."],
              ["4", "Act on status", "completed → fulfil order. failed / cancelled → prompt user to retry."],
            ].map(([n, title, desc]) => (
              <li key={n} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{n}</span>
                <span><strong>{title}</strong> — {desc}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Server-side example */}
        <div>
          <p className="text-sm font-semibold mb-2">Server-side verification example (Node.js)</p>
          <CodeBlock
            curl={`# Poll until payment is confirmed (max 60s)
for i in $(seq 1 12); do
  STATUS=$(curl -s ${BASE}/api/payments/status/ws_CO_24042026_12345678 \\
    -H "X-API-Key: YOUR_SECRET_KEY" | jq -r '.status')

  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "cancelled" ]; then
    break
  fi
  sleep 5
done`}
            node={`async function waitForPayment(checkoutRequestId, apiKey, timeoutMs = 60000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(
      \`${BASE}/api/payments/status/\${checkoutRequestId}\`,
      { headers: { 'X-API-Key': apiKey } }
    );
    const data = await res.json();

    if (data.status === 'completed') {
      console.log('Payment confirmed:', data.mpesaReceiptNumber);
      return data;         // ✅ fulfil the order
    }

    if (data.status === 'failed' || data.status === 'cancelled') {
      throw new Error(\`Payment \${data.status}\`);  // ❌ notify user
    }

    // still pending — wait and retry
    await new Promise(r => setTimeout(r, 3000));
  }

  throw new Error('Payment timed out after 60s');
}

// Usage
try {
  const payment = await waitForPayment('ws_CO_...', 'YOUR_SECRET_KEY');
  await fulfillOrder(payment); // your fulfilment logic
} catch (err) {
  console.error(err.message);
}`}
          />
        </div>
      </section>

      {/* ── CARD & AIRTEL MONEY ─────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          5. Card & Airtel Money (PesaPal)
        </h3>
        <p className="text-muted-foreground text-sm">
          Accept Visa, Mastercard, and Airtel Money payments through PesaPal's hosted checkout. Customers are redirected to a secure PesaPal payment page — no card data ever touches your server.
          A <strong>10% platform fee</strong> is deducted automatically; the net 90% is credited to your withdrawable balance (visible in the <strong>Card &amp; Airtel Pay</strong> section).
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
          <p className="font-semibold">How it works</p>
          <ol className="space-y-1.5 list-none">
            {[
              ["1", "Call /api/payments/pesapal/initiate", "You get back a redirectUrl."],
              ["2", "Redirect your customer to redirectUrl", "They pay on PesaPal's hosted page (card, Airtel, etc.)."],
              ["3", "PesaPal notifies us automatically (IPN)", "No webhook setup needed — we handle it."],
              ["4", "Poll /api/payments/pesapal/status/:id", "Check when the payment is completed."],
              ["5", "Net amount credited to your balance", "Withdraw from the Card & Airtel Pay dashboard."],
            ].map(([n, title, desc]) => (
              <li key={n} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{n}</span>
                <span><strong>{title}</strong> — {desc}</span>
              </li>
            ))}
          </ol>
        </div>

        <EndpointCard method="POST" path="/api/payments/pesapal/initiate" description="Initiate a card or Airtel Money payment. Returns a hosted redirect URL.">
          <CodeBlock
            curl={`curl -X POST ${BASE}/api/payments/pesapal/initiate \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "amount": 500,
    "description": "Order #1234",
    "phone": "0712345678",
    "email": "customer@example.com",
    "callbackUrl": "https://yoursite.com/payment/success",
    "cancellationUrl": "https://yoursite.com/payment/cancel"
  }'`}
            node={`const res = await fetch('${BASE}/api/payments/pesapal/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    amount: 500,
    description: 'Order #1234',
    phone: '0712345678',
    email: 'customer@example.com',
    callbackUrl: 'https://yoursite.com/payment/success',
    cancellationUrl: 'https://yoursite.com/payment/cancel',
  })
});

const { redirectUrl, orderTrackingId, netAmount, platformFee } = await res.json();
// Redirect the customer to complete payment
window.location.href = redirectUrl;`}
          />
        </EndpointCard>

        <ParamTable rows={[
          ["amount", "number", "Amount to charge. In KES minimum is 10. For USD/EUR the equivalent minimum applies"],
          ["description", "string", "Payment description shown to the customer"],
          ["phone", "string", "Customer's phone number (used for Airtel Money prompt)", false],
          ["email", "string", "Customer's email address (used for card checkout)", false],
          ["callbackUrl", "string", "Redirect URL after successful payment", false],
          ["cancellationUrl", "string", "Redirect URL if customer cancels", false],
          ["currency", "string", `Currency code — defaults to "KES". Supports USD, EUR, GBP, and all PesaPal-accepted currencies`, false],
        ]} />

        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Response</div>
          <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "orderTrackingId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "merchantReference": "NEXUS-12-1234567890-ABCD",
  "redirectUrl": "https://pay.pesapal.com/v3/...",   // send customer here
  "amount": 500,
  "netAmount": 450,        // 90% credited to your balance
  "platformFee": 50,       // 10% platform fee
  "currency": "KES",
  "transactionId": 7
}`}</pre>
        </div>

        <EndpointCard method="GET" path="/api/payments/pesapal/status/:orderTrackingId" description="Check the status of a PesaPal payment. When status is still pending, the server queries PesaPal directly and returns the latest real-time result — no IPN delay.">
          <CodeBlock
            curl={`curl ${BASE}/api/payments/pesapal/status/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
            node={`// Poll until the payment reaches a terminal state (up to 90 seconds)
async function waitForPayment(orderTrackingId) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const res = await fetch(
      \`${BASE}/api/payments/pesapal/status/\${orderTrackingId}\`,
      { headers: { 'X-API-Key': 'YOUR_SECRET_KEY' } }
    );
    const data = await res.json();
    // status: 'pending' | 'completed' | 'failed' | 'cancelled'
    if (data.status === 'completed') {
      console.log('Paid via:', data.paymentMethod); // "Airtel Money", "Visa", etc.
      console.log('Net credited: KES', data.netAmount);
      return data;   // ✅ done
    }
    if (data.status === 'failed')    throw new Error('Payment failed: ' + data.statusDescription);
    if (data.status === 'cancelled') throw new Error('Payment cancelled by customer');
    await new Promise(r => setTimeout(r, 4000)); // wait 4 s, then try again
  }
  throw new Error('Payment timed out after 90 s');
}`}
          />
        </EndpointCard>

        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Status values</div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y">
              {[
                ["pending", "amber", "Awaiting customer payment"],
                ["completed", "green", "Payment successful — net amount credited to your balance"],
                ["failed", "red", "Payment was declined or could not be processed"],
                ["cancelled", "gray", "Customer closed the payment page"],
              ].map(([s, c, d]) => (
                <tr key={s}>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c === "green" ? "bg-green-100 text-green-700" :
                      c === "amber" ? "bg-amber-100 text-amber-700" :
                      c === "red" ? "bg-red-100 text-red-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>{s}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
          <p className="font-semibold">Fee structure</p>
          <p>Customer pays <strong>KES 1,000</strong> → Platform fee: <strong>KES 100 (10%)</strong> → Your net credit: <strong>KES 900</strong>. Withdraw your balance anytime from the <strong>Card &amp; Airtel Pay</strong> page in your dashboard.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">⚠ Active accounts only</p>
          <p>Card and Airtel Money payments are not available in sandbox mode. Activate your account first.</p>
        </div>

        {/* ── INTERNATIONAL / MULTI-CURRENCY ── */}
        <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-5 py-3">
            <h4 className="font-bold text-base flex items-center gap-2">🌍 International Payments — USD, EUR, GBP &amp; More</h4>
            <p className="text-blue-100 text-xs mt-0.5">Charge international customers in their own currency. Funds land in your platform wallet in KES.</p>
          </div>
          <div className="p-5 space-y-4 bg-white">
            <p className="text-sm text-muted-foreground">
              PesaPal supports multiple currencies — you can charge customers in <strong>USD, EUR, GBP, UGX, TZS</strong>, and all other PesaPal-accepted currencies.
              Simply pass a <code className="bg-gray-100 rounded px-1">currency</code> field in your initiate request.
              PesaPal handles the conversion automatically and settles the equivalent KES amount to your platform wallet, minus the <strong>10% platform fee</strong>.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-3">
              <p className="font-semibold text-blue-800">How the money flows</p>
              <ol className="space-y-2 list-none text-blue-800 text-xs">
                {[
                  ["1", "You initiate a USD payment (e.g. $10)", "Pass currency: 'USD' and amount: 10 in the API call."],
                  ["2", "Customer pays on PesaPal's hosted page", "They can pay with Visa, Mastercard, or their local wallet."],
                  ["3", "PesaPal converts to KES at the live rate", "The KES-equivalent is settled to the platform after PesaPal's own processing."],
                  ["4", "10% platform fee is deducted", "The net 90% (in KES) is credited to your platform wallet automatically."],
                  ["5", "You withdraw in KES via M-Pesa B2C", "Open the dashboard → Platform Wallet → Withdraw. A 2.5% withdrawal fee applies."],
                ].map(([n, title, desc]) => (
                  <li key={n} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{n}</span>
                    <span><strong>{title}</strong> — {desc}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Example — Charge $10 USD</p>
              <div className="rounded-lg overflow-hidden">
                <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">cURL</div>
                <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`curl -X POST ${BASE}/api/payments/pesapal/initiate \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "amount": 10,
    "currency": "USD",
    "description": "SaaS subscription — Basic plan",
    "email": "customer@example.com",
    "callbackUrl": "https://yoursite.com/payment/success"
  }'`}</pre>
              </div>
              <div className="rounded-lg overflow-hidden">
                <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">Node.js</div>
                <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`const res = await fetch('${BASE}/api/payments/pesapal/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    amount: 10,           // $10 USD
    currency: 'USD',      // or 'EUR', 'GBP', 'UGX', 'TZS', etc.
    description: 'SaaS subscription — Basic plan',
    email: 'customer@example.com',
    callbackUrl: 'https://yoursite.com/payment/success',
  })
});

const { redirectUrl, orderTrackingId, amount, currency } = await res.json();
// Redirect the customer to complete payment
window.location.href = redirectUrl;`}</pre>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden text-sm">
              <div className="bg-gray-50 px-4 py-2 border-b font-medium">Response</div>
              <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "orderTrackingId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "merchantReference": "NEXUS-12-1234567890-ABCD",
  "redirectUrl": "https://pay.pesapal.com/v3/...",  // send customer here
  "amount": 10,          // original amount in original currency
  "netAmount": 9,        // 90% after 10% platform fee (in original currency units)
  "platformFee": 1,      // 10% platform fee
  "currency": "USD",     // original charge currency
  "transactionId": 14
}`}</pre>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-green-800">Supported currencies (PesaPal)</p>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {["KES", "USD", "EUR", "GBP", "UGX", "TZS", "RWF", "ZAR", "GHS"].map(c => (
                    <span key={c} className="bg-green-100 text-green-700 rounded px-1.5 py-0.5 font-mono font-bold text-center">{c}</span>
                  ))}
                </div>
                <p className="text-green-700 mt-1">More currencies available — check PesaPal's documentation for the full list.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-amber-800">Important notes</p>
                <ul className="space-y-1 text-amber-700 list-disc list-inside">
                  <li>KES is always the withdrawal currency — PesaPal settles in KES regardless of the charge currency.</li>
                  <li>Exchange rate is determined by PesaPal at settlement time.</li>
                  <li>The 10% platform fee applies to all currencies equally.</li>
                  <li>The platform wallet and withdrawal use KES only.</li>
                </ul>
              </div>
            </div>

            <div className="bg-gray-50 border rounded-lg p-4 text-xs space-y-2">
              <p className="font-semibold text-gray-800">Fee example — $10 USD charge</p>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between"><span className="text-gray-600">Customer pays:</span><span className="font-bold">$10.00 USD</span></div>
                <div className="flex justify-between"><span className="text-gray-600">PesaPal converts (e.g. rate 130):</span><span>≈ KES 1,300</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Platform fee (10%):</span><span className="text-red-600">- KES 130</span></div>
                <div className="flex justify-between border-t pt-1 font-bold"><span>Credited to your wallet:</span><span className="text-green-700">≈ KES 1,170</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Withdrawal fee (2.5%):</span><span className="text-orange-600">- KES ~29</span></div>
                <div className="flex justify-between font-bold"><span>You receive via M-Pesa:</span><span className="text-green-700">≈ KES 1,141</span></div>
              </div>
              <p className="text-gray-500 italic">Exchange rates vary. The KES amount above is illustrative only.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM WALLET WITHDRAWAL ───────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold">6. Platform Wallet &amp; Withdrawal</h3>
        <p className="text-muted-foreground text-sm">
          If you have <strong>no till number, paybill, or bank account</strong> configured, your collected STK Push and Card/Airtel payments accumulate in your platform wallet. You can withdraw that balance to any Safaricom number at any time — the platform sends the money instantly via M-Pesa B2C.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-3">
          <p className="font-semibold">How it works</p>
          <ol className="space-y-2 list-none">
            {[
              ["1", "Customers pay you via STK Push (C2B) or Card/Airtel", "Funds are collected and held in your platform wallet automatically."],
              ["2", "Go to your dashboard → Withdrawal tab", "You can see your available balance at any time."],
              ["3", "Enter your Safaricom phone number and the amount", "No settlement account needed — just your M-Pesa number."],
              ["4", "Money sent instantly via M-Pesa B2C", "A 2.5% platform fee is deducted. The remaining 97.5% arrives on your phone."],
            ].map(([n, title, desc]) => (
              <li key={n} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{n}</span>
                <span><strong>{title}</strong> — {desc}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
          <p className="font-semibold">💰 Withdrawal Fee Structure</p>
          <p>A <strong>2.5% platform fee</strong> is deducted from every withdrawal. Because M-Pesa only accepts whole shilling amounts, the fee is always rounded in the platform's favour (<code className="bg-green-100 rounded px-1">Math.floor</code>).</p>
          <div className="mt-2 border border-green-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-green-100 border-b border-green-200">
                <tr>
                  <th className="px-3 py-2 font-medium">Amount Requested</th>
                  <th className="px-3 py-2 font-medium">Platform Fee</th>
                  <th className="px-3 py-2 font-medium text-green-900">You Receive (M-Pesa)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-100 bg-white">
                {[
                  ["KES 100", "KES 3", "KES 97"],
                  ["KES 500", "KES 13", "KES 487"],
                  ["KES 1,000", "KES 25", "KES 975"],
                  ["KES 5,000", "KES 125", "KES 4,875"],
                  ["KES 10,000", "KES 250", "KES 9,750"],
                ].map(([req, fee, recv]) => (
                  <tr key={req}>
                    <td className="px-3 py-2 font-mono">{req}</td>
                    <td className="px-3 py-2 text-red-600 font-mono">{fee}</td>
                    <td className="px-3 py-2 text-green-700 font-bold font-mono">{recv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">⚡ Instant &amp; Automatic</p>
          <p>Withdrawals are processed automatically — no manual approval needed. You'll receive an M-Pesa confirmation SMS the moment the transfer completes. Minimum withdrawal is <strong>KES 10</strong>.</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 space-y-1">
          <p className="font-semibold">🕐 Rate Limit — 1 Withdrawal Per Hour</p>
          <p>To protect your account and ensure stable B2C processing, <strong>only one platform wallet withdrawal is allowed per hour</strong>. After a successful withdrawal the Withdraw button is locked with a live countdown until the hour resets.</p>
          <p className="text-xs text-red-600 mt-1">If you try via the API directly, you will receive a <code className="bg-red-100 rounded px-1">429 RATE_LIMITED</code> response with a <code className="bg-red-100 rounded px-1">nextAllowedAt</code> timestamp.</p>
          <pre className="mt-2 bg-red-950 text-red-200 rounded p-3 text-xs overflow-x-auto">{`{
  "error": "RATE_LIMITED",
  "message": "One withdrawal per hour allowed. Next withdrawal available in 47 min.",
  "nextAllowedAt": "2026-05-15T15:30:00.000Z",
  "secondsRemaining": 2820
}`}</pre>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800 space-y-1">
          <p className="font-semibold">💡 Have a till or paybill?</p>
          <p>If you configure a settlement account (till or paybill) under <strong>Settlement Accounts</strong> in your dashboard, STK Push payments go directly to that account — no platform fee, no withdrawal step needed. The platform wallet is only used when no settlement account is set.</p>
        </div>
      </section>

      {/* ── B2C ─────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <h3 className="text-xl font-bold flex items-center gap-3">
          7. B2C — Collect &amp; Disburse Funds
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5 font-medium">Live</Badge>
        </h3>
        <p className="text-muted-foreground text-sm">
          B2C (Business to Customer) has two distinct flows — <strong>collecting funds in</strong> (funding your wallet via STK Push) and <strong>disbursing funds out</strong> (sending money to any M-Pesa number for refunds, commissions, salaries, or cashback). Both flows use your API key.
        </p>

        {/* Fund flow diagram */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-3">
          <p className="font-semibold text-gray-800">How funds move</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
            {[
              { icon: "📲", label: "Customer phone", sub: "pays via STK Push" },
              { arrow: true },
              { icon: "🏦", label: "Your B2C Wallet", sub: "holds the balance" },
              { arrow: true },
              { icon: "💸", label: "Recipient phone", sub: "receives via B2C" },
            ].map((item, i) =>
              "arrow" in item ? (
                <span key={i} className="text-gray-400 font-bold hidden sm:block">→</span>
              ) : (
                <div key={i} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
                  <div className="text-lg">{item.icon}</div>
                  <div className="font-semibold text-gray-800">{item.label}</div>
                  <div className="text-gray-500">{item.sub}</div>
                </div>
              )
            )}
          </div>
          <div className="text-xs">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="font-semibold text-blue-800 mb-1">💰 B2C Send Fee</p>
              <p className="text-blue-700">8% platform fee per outgoing B2C payment. Sending <strong>KES 1,000</strong> deducts <strong>KES 1,080</strong> from your wallet (KES 1,000 sent + KES 80 fee).</p>
            </div>
          </div>
        </div>

        {/* ── PART A: COLLECT FUNDS ── */}
        <div className="space-y-3">
          <h4 className="font-bold text-base border-b pb-2">Part A — Collect Funds (Top Up Wallet)</h4>
          <p className="text-sm text-muted-foreground">There are two ways to load funds into your B2C wallet. Choose whichever suits your workflow:</p>

          {/* Two top-up methods */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold text-blue-800">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">A</span>
                Via API (programmatic)
              </div>
              <p className="text-blue-700 text-xs">Use your <code className="bg-blue-100 px-1 rounded">X-API-Key</code> to trigger an STK Push from your server. Best for automated top-ups from your application.</p>
              <p className="text-blue-600 text-xs font-mono">POST /api/b2c/wallet/topup</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold text-green-800">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold shrink-0">B</span>
                Via Dashboard (manual)
              </div>
              <p className="text-green-700 text-xs">Log into your account, go to <strong>B2C Payments</strong> in the sidebar, and click <strong>Top Up Wallet</strong>. Enter an amount and your phone — an STK Push is sent to you instantly.</p>
              <p className="text-green-600 text-xs">No code needed — ideal for manual top-ups.</p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Method A — API: Send STK Push to fund your wallet</div>
            <CodeBlock
              curl={`curl -X POST ${BASE}/api/b2c/wallet/topup \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 5000
  }'`}
              node={`const res = await fetch('${BASE}/api/b2c/wallet/topup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    phoneNumber: '254712345678',   // phone that will pay
    amount: 5000                   // amount in KES to load into wallet
  })
});
const { checkoutRequestId } = await res.json();
// Save checkoutRequestId — use it to confirm the top-up`}
            />
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Step 2 — Confirm top-up status (poll every 3–5 s)</div>
            <CodeBlock
              curl={`curl ${BASE}/api/b2c/wallet/topup/status/ws_CO_24042026_123456 \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
              node={`// Poll until confirmed
async function waitForTopup(checkoutRequestId, apiKey) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      \`${BASE}/api/b2c/wallet/topup/status/\${checkoutRequestId}\`,
      { headers: { 'X-API-Key': apiKey } }
    );
    const { status, amount } = await res.json();
    if (status === 'completed') {
      console.log(\`KES \${amount} added to B2C wallet ✅\`);
      return;
    }
    if (status === 'failed') throw new Error('Top-up failed or cancelled');
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Timed out waiting for top-up');
}`}
            />
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Step 3 — Check your wallet balance</div>
            <CodeBlock
              curl={`curl ${BASE}/api/b2c/wallet \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
              node={`const res = await fetch('${BASE}/api/b2c/wallet', {
  headers: { 'X-API-Key': 'YOUR_SECRET_KEY' }
});
const { balance, totalTopups, totalSent, totalFees, feeRate } = await res.json();
// balance    — KES available to spend right now
// feeRate    — 0.08 (8% deducted per outgoing B2C send)
console.log(\`Wallet balance: KES \${balance}\`);`}
            />
          </div>
        </div>

        {/* ── PART B: DISBURSE FUNDS ── */}
        <div className="space-y-3">
          <h4 className="font-bold text-base border-b pb-2">Part B — Disburse Funds (Send to Phone)</h4>
          <p className="text-sm text-muted-foreground">Once your wallet has funds, send money to any Safaricom number instantly. Common uses: refunds, commissions, salaries, cashback.</p>

          <EndpointCard method="POST" path="/api/payments/b2c" description="Send money from your B2C wallet to a recipient's M-Pesa number.">
            <CodeBlock
              curl={`curl -X POST ${BASE}/api/payments/b2c \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 500,
    "remarks": "Commission for May",
    "commandId": "BusinessPayment"
  }'`}
              node={`const res = await fetch('${BASE}/api/payments/b2c', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    phoneNumber: '254712345678',
    amount: 500,                         // KES to send (wallet deducts 500 + 8% fee = 540)
    remarks: 'Commission for May',
    commandId: 'BusinessPayment'         // or SalaryPayment, PromotionPayment
  })
});
const { conversationId, feeAmount, totalDeducted } = await res.json();
// conversationId  — use to check delivery status
// feeAmount       — KES deducted as platform fee (8%)
// totalDeducted   — total deducted from wallet (amount + fee)`}
            />
          </EndpointCard>

          <ParamTable rows={[
            ["phoneNumber", "string", "Recipient Safaricom number — format 254XXXXXXXXX"],
            ["amount", "number", "Amount to send in KES (minimum 10). Wallet deducts amount + 8% fee"],
            ["remarks", "string", "Description (shown in Safaricom transaction reports)"],
            ["commandId", "string", "BusinessPayment | SalaryPayment | PromotionPayment (default: BusinessPayment)", false],
            ["occasion", "string", "Optional reference label attached to the transaction", false],
          ]} />

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Initiation Response</div>
            <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "conversationId": "AG_20260425_...",    // track delivery with this
  "responseCode": "0",
  "responseDescription": "Accept the service request successfully.",
  "feeAmount": 40,                        // KES platform fee (8%)
  "totalDeducted": 540,                   // amount + fee deducted from wallet
  "transactionId": 5
}`}</pre>
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Step 4 — Poll delivery status</div>
            <CodeBlock
              curl={`curl ${BASE}/api/payments/b2c/status/AG_20260425_123456 \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
              node={`const res = await fetch(
  \`${BASE}/api/payments/b2c/status/\${conversationId}\`,
  { headers: { 'X-API-Key': 'YOUR_SECRET_KEY' } }
);
const data = await res.json();
// data.status: 'pending' | 'completed' | 'failed'
if (data.status === 'completed') {
  console.log('Receipt:', data.mpesaReceiptNumber);
  console.log('Recipient:', data.receiverPartyPublicName);
}`}
            />
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Delivery Status Response</div>
            <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "conversationId": "AG_20260425_...",
  "status": "completed",                          // pending | completed | failed
  "amount": "500.00",
  "phoneNumber": "254712345678",
  "mpesaReceiptNumber": "RCD6ABXXXXX",
  "receiverPartyPublicName": "254712345678 - John Doe",
  "commandId": "BusinessPayment",
  "remarks": "Commission for May",
  "createdAt": "2026-04-25T14:00:00Z",
  "updatedAt": "2026-04-25T14:01:10Z"
}`}</pre>
          </div>

          <EndpointCard method="GET" path="/api/payments/b2c" description="List all B2C disbursement transactions for your account." />
        </div>

        {/* ── COMPLETE END-TO-END EXAMPLE ── */}
        <div className="space-y-3">
          <h4 className="font-bold text-base border-b pb-2">Complete End-to-End Example</h4>
          <CodeBlock
            curl={`# 1. Top up your wallet (KES 2,000)
TOPUP=$(curl -s -X POST ${BASE}/api/b2c/wallet/topup \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{"phoneNumber":"254712345678","amount":2000}')
CID=$(echo $TOPUP | jq -r '.checkoutRequestId')

# 2. Wait for payment confirmation
for i in $(seq 1 15); do
  STATUS=$(curl -s "${BASE}/api/b2c/wallet/topup/status/$CID" \\
    -H "X-API-Key: YOUR_SECRET_KEY" | jq -r '.status')
  [ "$STATUS" = "completed" ] && echo "Wallet funded ✅" && break
  [ "$STATUS" = "failed" ] && echo "Top-up failed ❌" && exit 1
  sleep 3
done

# 3. Send KES 500 to a recipient (wallet deducts KES 540 incl. 8% fee)
curl -X POST ${BASE}/api/payments/b2c \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{"phoneNumber":"254798765432","amount":500,"remarks":"Cashback"}'`}
            node={`const API_KEY = 'YOUR_SECRET_KEY';
const BASE = '${BASE}';

async function collectAndDisburse() {
  // ── Step 1: Fund your B2C wallet ──────────────────────────────
  const topupRes = await fetch(\`\${BASE}/api/b2c/wallet/topup\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ phoneNumber: '254712345678', amount: 2000 })
  });
  const { checkoutRequestId } = await topupRes.json();
  console.log('STK Push sent — waiting for payment...');

  // ── Step 2: Wait for customer to pay ─────────────────────────
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await fetch(
      \`\${BASE}/api/b2c/wallet/topup/status/\${checkoutRequestId}\`,
      { headers: { 'X-API-Key': API_KEY } }
    ).then(r => r.json());
    if (s.status === 'completed') { console.log('Wallet funded ✅'); break; }
    if (s.status === 'failed') throw new Error('Top-up failed');
  }

  // ── Step 3: Check balance ─────────────────────────────────────
  const wallet = await fetch(\`\${BASE}/api/b2c/wallet\`, {
    headers: { 'X-API-Key': API_KEY }
  }).then(r => r.json());
  console.log(\`Balance: KES \${wallet.balance}\`);

  // ── Step 4: Send money to recipient ───────────────────────────
  // Sending KES 500 → wallet deducts KES 540 (500 + 8% = 40 fee)
  const sendRes = await fetch(\`\${BASE}/api/payments/b2c\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      phoneNumber: '254798765432',
      amount: 500,
      remarks: 'Cashback reward',
      commandId: 'BusinessPayment'
    })
  });
  const { conversationId, feeAmount, totalDeducted } = await sendRes.json();
  console.log(\`Sent! Fee: KES \${feeAmount}, Total deducted: KES \${totalDeducted}\`);

  // ── Step 5: Confirm delivery ──────────────────────────────────
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const status = await fetch(
      \`\${BASE}/api/payments/b2c/status/\${conversationId}\`,
      { headers: { 'X-API-Key': API_KEY } }
    ).then(r => r.json());
    if (status.status === 'completed') {
      console.log('Delivered ✅ Receipt:', status.mpesaReceiptNumber);
      return status;
    }
    if (status.status === 'failed') throw new Error('B2C delivery failed');
  }
}

collectAndDisburse().catch(console.error);`}
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">B2C Result URLs (auto-registered)</p>
          <p>Safaricom posts delivery results to these URLs automatically — no configuration needed on your end:</p>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex items-center gap-2"><span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">POST</span>{BASE}/api/payments/b2c/result</div>
            <div className="flex items-center gap-2"><span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">POST</span>{BASE}/api/payments/b2c/timeout</div>
          </div>
        </div>
      </section>

      {/* ── SAAS MULTI-TENANT ────────────────────────────────────── */}
      <section className="space-y-5">
        <h3 className="text-xl font-bold">8. SaaS Multi-Tenant</h3>
        <p className="text-muted-foreground">
          The SaaS Multi-Tenant add-on lets you manage multiple clients (tenants) under a single merchant account.
          Each tenant has a unique <strong>tenant code</strong> that routes STK Push payments directly to that tenant's settlement account.
          Available on <strong>Nexus Pay</strong> only. Activate from the dashboard for <strong>KES 300/month</strong> or <strong>KES 1,000/year</strong>.
        </p>

        <div className="space-y-3">
          <h4 className="font-semibold">How it works</h4>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
            <li>Activate the SaaS plan from the <strong>SaaS Multi-Tenant</strong> section in your dashboard.</li>
            <li>Create tenants and assign each one a settlement account (till or paybill).</li>
            <li>Each tenant is automatically assigned a unique <code className="bg-gray-100 rounded px-1">tenantCode</code> (e.g. <code className="bg-gray-100 rounded px-1">tnnt_abc12345</code>).</li>
            <li>Pass the <code className="bg-gray-100 rounded px-1">tenantCode</code> in STK Push requests to route payments to that tenant.</li>
          </ol>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">STK Push with tenantCode</h4>
          <p className="text-sm text-muted-foreground">
            Include <code className="bg-gray-100 rounded px-1">tenantCode</code> in the request body. It takes priority over <code className="bg-gray-100 rounded px-1">settlementAccountId</code>.
          </p>
          <div className="rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">cURL</div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`curl -X POST ${BASE}/api/payments/stkpush \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 1500,
    "accountReference": "INV-001",
    "transactionDesc": "Order Payment",
    "tenantCode": "tnnt_abc12345"
  }'`}
            </pre>
          </div>
          <div className="rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">Node.js</div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`const res = await fetch('${BASE}/api/payments/stkpush', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    phoneNumber: '254712345678',
    amount: 1500,
    accountReference: 'INV-001',
    transactionDesc: 'Order Payment',
    tenantCode: 'tnnt_abc12345'   // tenant's unique code
  })
});
const data = await res.json();
// data.checkoutRequestId — poll to confirm payment`}
            </pre>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Look up a tenant (optional)</h4>
          <p className="text-sm text-muted-foreground">Resolve a tenant's details by code using your API key:</p>
          <div className="rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">cURL</div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`curl ${BASE}/api/saas/tenant/tnnt_abc12345 \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
            </pre>
          </div>
          <div className="rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">Node.js</div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`const res = await fetch('${BASE}/api/saas/tenant/tnnt_abc12345', {
  headers: { 'X-API-Key': 'YOUR_SECRET_KEY' }
});
const tenant = await res.json();
// tenant.tenantCode, tenant.settlementAccountName, tenant.isActive`}
            </pre>
          </div>
          <p className="text-sm text-muted-foreground">Response includes the tenant name, <code className="bg-gray-100 rounded px-1">isActive</code> flag, and settlement account info.</p>
        </div>

        <div className="border rounded-lg overflow-hidden text-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Error Code</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["TENANT_NOT_FOUND", "The tenantCode does not exist or is inactive"],
                ["SAAS_NOT_ACTIVE", "Your SaaS subscription is not active — activate from the dashboard"],
              ].map(([code, desc]) => (
                <tr key={code}>
                  <td className="px-4 py-3 font-mono text-red-600">{code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── WEBHOOKS ─────────────────────────────────────────────── */}
      <section className="space-y-5">
        <h3 className="text-xl font-bold">9. Webhooks</h3>
        <p className="text-muted-foreground">
          Webhooks let your server receive real-time HTTP POST notifications when payment events occur — no polling required.
          Register up to 5 webhook endpoints from the <strong>Webhooks</strong> section in your dashboard.
        </p>

        <div className="space-y-3">
          <h4 className="font-semibold">Available Events</h4>
          <div className="border rounded-lg overflow-hidden text-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">When it fires</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["payment.completed", "STK Push or tenant payment confirmed by Safaricom"],
                  ["payment.failed", "STK Push payment failed (wrong PIN, insufficient funds, etc.)"],
                  ["payment.cancelled", "Customer dismissed the M-Pesa PIN prompt"],
                  ["subscription.activated", "SaaS subscription payment confirmed (Nexus Pay only)"],
                ].map(([event, desc]) => (
                  <tr key={event}>
                    <td className="px-4 py-3 font-mono text-blue-700 text-xs">{event}</td>
                    <td className="px-4 py-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Webhook Payload</h4>
          <p className="text-sm text-muted-foreground">Your endpoint receives a signed JSON POST with this structure:</p>
          <div className="rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">JSON payload</div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`{
  "event": "payment.completed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "id": 42,
    "phoneNumber": "254712345678",
    "amount": "1500.00",
    "mpesaReceiptNumber": "QGH5XJK92L",
    "accountReference": "INV-001",
    "transactionDesc": "Order payment",
    "status": "completed",
    "statusDescription": "The service request is processed successfully.",
    "createdAt": "2025-01-15T10:29:45.000Z"
  }
}`}</pre>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Signature Verification</h4>
          <p className="text-sm text-muted-foreground">
            Every request includes an <code className="bg-gray-100 rounded px-1">X-Webhook-Signature</code> header.
            Verify it using HMAC-SHA256 with your webhook secret to ensure authenticity.
          </p>
          <div className="rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">Node.js — verify signature</div>
            <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto">{`import crypto from 'crypto';
import express from 'express';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = 'whsec_your_secret_from_dashboard';

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const body = JSON.stringify(req.body);

  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'payment.completed') {
    console.log(\`Payment \${data.mpesaReceiptNumber} — KES \${data.amount} ✅\`);
    // Fulfill order, send receipt, update DB, etc.
  }

  res.json({ received: true }); // Respond quickly — timeouts mark the delivery as failed
});`}</pre>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">API Endpoints</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {[
              ["GET", "/api/webhooks", "List all registered webhooks for your account"],
              ["POST", "/api/webhooks", "Register a new webhook (url, events)"],
              ["PATCH", "/api/webhooks/:id", "Enable or disable a webhook"],
              ["DELETE", "/api/webhooks/:id", "Remove a webhook permanently"],
            ].map(([method, path, desc]) => (
              <div key={path} className="flex items-start gap-3 border rounded-lg px-4 py-3">
                <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${method === "GET" ? "bg-blue-100 text-blue-700" : method === "POST" ? "bg-green-100 text-green-700" : method === "PATCH" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>{method}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{path}</span>
                <span className="text-muted-foreground text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Tips</p>
          <ul className="space-y-1 list-disc list-inside text-amber-700">
            <li>Respond with HTTP 200 as fast as possible. Slow endpoints (&gt;10 s) are marked as failed.</li>
            <li>Failed deliveries are retried up to 3 times with exponential backoff.</li>
            <li>Always verify the <code className="bg-amber-100 px-1 rounded">X-Webhook-Signature</code> before processing.</li>
            <li>SaaS tenant payments (via <code className="bg-amber-100 px-1 rounded">tenantCode</code>) fire <code className="bg-amber-100 px-1 rounded">payment.completed</code> to the owning merchant's webhooks.</li>
          </ul>
        </div>
      </section>

      {/* ── ERROR CODES ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold">10. Error Codes</h3>
        <div className="border rounded-lg overflow-hidden text-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">HTTP Status</th>
                <th className="px-4 py-3 font-medium">Error Code</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["400", "VALIDATION_ERROR", "Missing or invalid request parameters"],
                ["400", "INSUFFICIENT_BALANCE", "Withdrawal amount exceeds available platform wallet balance"],
                ["401", "Unauthorized", "Missing or invalid X-API-Key or session token"],
                ["403", "ACCOUNT_DISABLED", "Your merchant account has been suspended"],
                ["403", "ACTIVATION_REQUIRED", "Feature requires an active (paid) account — sandbox limit reached"],
                ["404", "NOT_FOUND", "Transaction or resource not found"],
                ["410", "EXPIRED", "Payment link has expired or has been deactivated"],
                ["429", "RATE_LIMITED", "Only 1 platform wallet withdrawal is allowed per hour. Check nextAllowedAt in the response"],
                ["502", "MPESA_ERROR", "M-Pesa API returned an error (check the message field for details)"],
                ["502", "PESAPAL_ERROR", "PesaPal API returned an error during payment initiation or status check"],
              ].map(([status, code, desc]) => (
                <tr key={code}>
                  <td className="px-4 py-3 font-mono">{status}</td>
                  <td className="px-4 py-3 font-mono text-red-600">{code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </div>
  );
}
