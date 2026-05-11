import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, Code2, BookOpen, Zap } from "lucide-react";

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
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Authentication</p>
          <p>All merchant API calls require an <code className="bg-amber-100 px-1 rounded">X-API-Key</code> header with your Secret Key. Generate API keys from the <strong>API Keys</strong> section. Never expose secret keys in client-side code.</p>
        </div>

        {/* ── STK PUSH ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold">1. Trigger an STK Push (C2B)</h3>
          <EndpointCard method="POST" path="/api/payments/stkpush" description="Initiate an M-Pesa STK Push payment.">
            <CodeBlock
              curl={`curl -X POST ${BASE}/api/payments/stkpush \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 100,
    "accountReference": "INV-001",
    "transactionDesc": "Order Payment"
  }'`}
              node={`const res = await fetch('${BASE}/api/payments/stkpush', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'YOUR_SECRET_KEY' },
  body: JSON.stringify({
    phoneNumber: '254712345678',
    amount: 100,
    accountReference: 'INV-001',
    transactionDesc: 'Order Payment'
  })
});`}
            />
          </EndpointCard>
          <ParamTable rows={[
            ["phoneNumber", "string", "Customer Safaricom number — format 254XXXXXXXXX"],
            ["amount", "number", "Amount to charge in KES"],
            ["accountReference", "string", "Your internal reference"],
            ["transactionDesc", "string", "Description shown on the customer's phone"],
          ]} />
        </section>

        {/* ── VERIFY PAYMENT ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold">2. Verify a Payment (Polling)</h3>
          <p className="text-muted-foreground text-sm">Ideal for beginners. Check status manually every 3-5 seconds.</p>
          <EndpointCard method="GET" path="/api/payments/status/:checkoutRequestId" description="Check transaction status.">
            <CodeBlock
              curl={`curl ${BASE}/api/payments/status/ws_CO_123 \\
  -H "X-API-Key: YOUR_SECRET_KEY"`}
              node={`const res = await fetch('${BASE}/api/payments/status/ws_CO_123', {
  headers: { 'X-API-Key': 'YOUR_SECRET_KEY' }
});`}
            />
          </EndpointCard>
        </section>

        {/* ── PAYMENT LINKS ───────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold">3. Payment Links</h3>
          <EndpointCard method="POST" path="/api/payment-links" description="Create a shareable payment URL.">
            <CodeBlock
              curl={`curl -X POST ${BASE}/api/payment-links \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{"title": "Invoice #123", "amount": 1000, "accountReference": "REF001"}'`}
              node={`// Returns { "slug": "abc-123" }. Share ${BASE}/pay/abc-123`}
            />
          </EndpointCard>
        </section>

        {/* ── CALLBACK & WEBHOOKS (THE UPDATE) ────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold">4. Webhooks & Callbacks</h3>
          <p className="text-muted-foreground text-sm">
            {brandName} provides a dual approach for transaction confirmation: <strong>Polling</strong> for simple integrations and <strong>Webhooks</strong> for real-time, event-driven applications.
          </p>

          {/* Webhooks for Pro Devs Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                <Badge className="bg-purple-600 text-white border-none">PRO</Badge> External Webhooks
              </p>
            </div>
            <p className="text-xs text-purple-700">
              Instead of polling our server, we can push the payment result directly to your server the moment it happens. 
              To enable this, enter your listener URL in the <strong>API Keys</strong> section of your dashboard.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-purple-900 mb-2 uppercase tracking-wider">Example Payload (POST)</p>
                <pre className="p-4 bg-gray-950 text-purple-300 text-[10px] rounded-lg overflow-x-auto shadow-inner">{`{
  "event": "payment.completed",
  "timestamp": "${new Date().toISOString()}",
  "data": {
    "transactionId": 1024,
    "receipt": "RBK71GXXXX",
    "amount": "100.00",
    "phone": "2547XXXXXXXX",
    "reference": "Order_#123",
    "status": "SUCCESS"
  }
}`}</pre>
              </div>
              <div>
                <p className="text-[10px] font-bold text-purple-900 mb-2 uppercase tracking-wider">Your Listener (Express.js)</p>
                <pre className="p-4 bg-gray-950 text-green-400 text-[10px] rounded-lg overflow-x-auto shadow-inner">{`app.post('/webhook', (req, res) => {
  const { event, data } = req.body;

  if (event === 'payment.completed') {
    console.log('Payment Verified:', data.receipt);
    // Add logic to fulfill order
  }

  res.sendStatus(200); // Always return 200
});`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-green-800">Internal System URL</p>
            <p className="text-xs text-green-700">
              This is the URL pre-registered with Safaricom. Our gateway uses this to process M-Pesa responses before forwarding to you.
            </p>
            <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-4 py-2">
              <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">POST</span>
              <code className="text-xs font-mono text-gray-800">{BASE}/api/payments/callback</code>
            </div>
          </div>
        </section>

        {/* ── CARD & AIRTEL MONEY ─────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold">5. Card & Airtel Money (PesaPal)</h3>
          <p className="text-muted-foreground text-sm">Accept Visa, Mastercard, and Airtel Money via PesaPal.</p>
          <EndpointCard method="POST" path="/api/payments/pesapal/initiate" description="Initiate a card payment.">
            <CodeBlock
              curl={`curl -X POST ${BASE}/api/payments/pesapal/initiate \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{"amount": 500, "description": "Order #123"}'`}
              node={`const { redirectUrl } = await res.json();
window.location.href = redirectUrl;`}
            />
          </EndpointCard>
        </section>

        {/* ── PLATFORM WALLET ───────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold">6. Platform Wallet & Withdrawal</h3>
          <p className="text-muted-foreground text-sm">Withdraw your accumulated balance to any Safaricom number via M-Pesa B2C.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold">Fee: 2.5% per withdrawal.</p>
            <p>Example: Withdraw KES 1,000 → Get KES 975 on your phone instantly.</p>
          </div>
        </section>

        {/* ── B2C ─────────────────────────────────────────────────── */}
        <section className="space-y-5">
          <h3 className="text-xl font-bold flex items-center gap-3">7. B2C — Collect & Disburse</h3>
          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b font-medium">Disburse Funds (Send to Phone)</div>
            <CodeBlock
              curl={`curl -X POST ${BASE}/api/payments/b2c \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{"phoneNumber": "254712345678", "amount": 500, "remarks": "Salary"}'`}
              node={`// Deducts amount + 8% platform fee from your B2C wallet.`}
            />
          </div>
        </section>

        {/* ── SAAS MULTI-TENANT ────────────────────────────────────── */}
        <section className="space-y-5">
          <h3 className="text-xl font-bold">8. SaaS Multi-Tenant</h3>
          <p className="text-muted-foreground text-sm">Route payments to different client settlement accounts using a <code className="bg-gray-100 rounded px-1">tenantCode</code>.</p>
          <EndpointCard method="POST" path="/api/payments/stkpush" description="STK Push with tenant routing.">
            <pre className="p-4 bg-gray-950 text-green-300 text-xs rounded-lg">{`{
  "amount": 100,
  "tenantCode": "tnnt_abc123"
}`}</pre>
          </EndpointCard>
        </section>

        {/* ── ERROR CODES ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold">9. Error Codes</h3>
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
                  ["400", "VALIDATION_ERROR", "Missing parameters"],
                  ["401", "Unauthorized", "Invalid X-API-Key"],
                  ["403", "ACCOUNT_DISABLED", "Account restricted"],
                  ["502", "MPESA_ERROR", "Daraja API failure"],
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
