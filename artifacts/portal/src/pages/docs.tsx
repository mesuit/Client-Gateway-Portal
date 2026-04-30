import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Terminal, Code2 } from "lucide-react";

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
  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">API Documentation</h2>
        <p className="text-muted-foreground mt-1">Integrate Makamesco Nexus Pay M-Pesa payments into your application.</p>
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
        <h3 className="text-xl font-bold">1. Trigger an STK Push</h3>
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
          ["settlementAccountId", "number", "Optional settlement account ID (uses default if omitted)", false],
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
          ["amount", "number", "Amount to charge in KES (minimum 10)"],
          ["description", "string", "Payment description shown to the customer"],
          ["phone", "string", "Customer's phone number (used for Airtel prompt)", false],
          ["email", "string", "Customer's email address", false],
          ["callbackUrl", "string", "Redirect URL after successful payment", false],
          ["cancellationUrl", "string", "Redirect URL if customer cancels", false],
          ["currency", "string", `Currency code — default "KES"`, false],
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

        <EndpointCard method="GET" path="/api/payments/pesapal/status/:orderTrackingId" description="Check the status of a PesaPal payment.">
          <CodeBlock
            curl={`curl ${BASE}/api/payments/pesapal/status/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
            node={`const res = await fetch(
  \`${BASE}/api/payments/pesapal/status/\${orderTrackingId}\`,
  { headers: { 'X-API-Key': 'YOUR_SECRET_KEY' } }
);

const { status, amount, netAmount, paymentMethod } = await res.json();
// status: 'pending' | 'completed' | 'failed' | 'cancelled'
if (status === 'completed') {
  console.log('Paid via:', paymentMethod); // e.g. "Airtel Money", "Visa"
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
      </section>

      {/* ── B2C ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-3">
          6. B2C — Send Money to a Phone
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5 font-medium">Live</Badge>
        </h3>
        <p className="text-muted-foreground text-sm">
          B2C (Business to Customer) lets you push money from the platform shortcode directly to any M-Pesa number — for refunds, commissions, salaries, or cashback. B2C uses a <strong>prepaid wallet</strong>: top up your B2C wallet first (via STK Push), then each outgoing payment deducts the send amount plus an <strong>8% platform fee</strong>.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">💰 Fee Structure</p>
          <p><strong>8% platform fee</strong> is charged per B2C transaction. Example: sending <strong>KES 1,000</strong> deducts <strong>KES 1,080</strong> from your wallet (KES 1,000 sent + KES 80 fee). Top up your wallet from the <strong>B2C Payments</strong> page in your dashboard.</p>
        </div>
        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Step 1 — Get your B2C wallet balance</div>
          <CodeBlock
            curl={`curl ${BASE}/api/b2c/wallet \\
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"`}
            node={`const res = await fetch('${BASE}/api/b2c/wallet', {
  headers: { 'Authorization': 'Bearer YOUR_SESSION_TOKEN' }
});
const { balance, totalFees, feeRate } = await res.json();
// balance — available to spend (KES)
// feeRate  — 0.08 (8%)`}
          />
        </div>

        <EndpointCard method="POST" path="/api/payments/b2c" description="Send money from your shortcode to a customer's M-Pesa number.">
          <CodeBlock
            curl={`curl -X POST ${BASE}/api/payments/b2c \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 500,
    "remarks": "Refund for order #123",
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
    amount: 500,
    remarks: 'Refund for order #123',
    commandId: 'BusinessPayment'   // or SalaryPayment, PromotionPayment
  })
});

const data = await res.json();
// data.conversationId — use to check status`}
          />
        </EndpointCard>

        <ParamTable rows={[
          ["phoneNumber", "string", "Recipient Safaricom number — format 254XXXXXXXXX"],
          ["amount", "number", "Amount to send in KES (minimum 10)"],
          ["remarks", "string", "Description of the payment (shown in Safaricom reports)"],
          ["commandId", "string", "BusinessPayment | SalaryPayment | PromotionPayment (default: BusinessPayment)", false],
          ["occasion", "string", "Optional occasion or reference label", false],
        ]} />

        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">B2C Initiation Response</div>
          <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "conversationId": "AG_20260425_...",           // use this to check status
  "originatorConversationId": "29115-...",
  "responseCode": "0",
  "responseDescription": "Accept the service request successfully.",
  "transactionId": 5
}`}</pre>
        </div>

        <EndpointCard method="GET" path="/api/payments/b2c/status/:conversationId" description="Check the status of a B2C payment using the conversationId from the initiation response.">
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
        </EndpointCard>

        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">B2C Status Response</div>
          <pre className="p-4 bg-gray-950 text-gray-50 text-xs overflow-x-auto">{`{
  "conversationId": "AG_20260425_...",
  "status": "completed",                         // pending | completed | failed
  "amount": "500.00",
  "phoneNumber": "254712345678",
  "mpesaReceiptNumber": "RCD6ABXXXXX",
  "receiverPartyPublicName": "254712345678 - John Doe",
  "commandId": "BusinessPayment",
  "remarks": "Refund for order #123",
  "createdAt": "2026-04-25T14:00:00Z",
  "updatedAt": "2026-04-25T14:01:10Z"
}`}</pre>
        </div>

        <EndpointCard method="GET" path="/api/payments/b2c" description="List all B2C transactions for your account." />

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">B2C Result URLs (auto-registered)</p>
          <p>Safaricom posts results to these URLs automatically — no configuration required on your end:</p>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex items-center gap-2"><span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">POST</span>{BASE}/api/payments/b2c/result</div>
            <div className="flex items-center gap-2"><span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">POST</span>{BASE}/api/payments/b2c/timeout</div>
          </div>
        </div>
      </section>

      {/* ── ERROR CODES ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold">6. Error Codes</h3>
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
                ["401", "Unauthorized", "Missing or invalid X-API-Key header"],
                ["403", "ACCOUNT_DISABLED", "Your merchant account has been disabled"],
                ["404", "NOT_FOUND", "Transaction or resource not found"],
                ["410", "EXPIRED", "Payment link has expired"],
                ["502", "MPESA_ERROR", "M-Pesa API returned an error (check message field)"],
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
  );
}
