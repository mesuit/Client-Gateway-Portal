import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal, Code2 } from "lucide-react";

const CURL_EXAMPLE = `curl -X POST https://YOUR_DOMAIN/api/payments/stkpush \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 100,
    "accountReference": "INV-001",
    "transactionDesc": "Payment for order #001"
  }'`;

const NODE_EXAMPLE = `const response = await fetch('https://YOUR_DOMAIN/api/payments/stkpush', {
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

const data = await response.json();
console.log(data.checkoutRequestId);`;

export default function Docs() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">API Documentation</h2>
        <p className="text-muted-foreground">Integrate Makamesco Nexus Pay into your application.</p>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-lg">
          The Nexus Pay API uses REST principles and authenticates requests via an <code>X-API-Key</code> header. 
          Use your Secret Key for server-side API calls. Never expose your Secret Key in client-side code.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">Trigger an STK Push</h3>
        <p>
          The STK Push API triggers a payment prompt directly on the customer's phone. 
          They simply enter their M-Pesa PIN to complete the transaction.
        </p>

        <Card className="mt-6 border-gray-200 dark:border-gray-800">
          <CardHeader className="bg-gray-50 dark:bg-gray-900 border-b">
            <CardTitle className="text-sm font-medium font-mono text-primary flex items-center gap-2">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">POST</span>
              /v1/stkpush
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="curl" className="w-full">
              <div className="flex items-center justify-between px-4 border-b">
                <TabsList className="bg-transparent h-12 p-0 border-none">
                  <TabsTrigger 
                    value="curl" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12"
                  >
                    <Terminal className="w-4 h-4 mr-2" /> cURL
                  </TabsTrigger>
                  <TabsTrigger 
                    value="node"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12"
                  >
                    <Code2 className="w-4 h-4 mr-2" /> Node.js / Fetch
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="curl" className="p-4 m-0 bg-gray-950 text-gray-50 rounded-b-lg">
                <pre className="text-sm font-mono overflow-x-auto">
                  <code>{CURL_EXAMPLE}</code>
                </pre>
              </TabsContent>
              <TabsContent value="node" className="p-4 m-0 bg-gray-950 text-gray-50 rounded-b-lg">
                <pre className="text-sm font-mono overflow-x-auto">
                  <code>{NODE_EXAMPLE}</code>
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <h3 className="text-xl font-semibold mt-10 mb-4">Request Parameters</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Parameter</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-3 font-mono">phoneNumber</td>
                <td className="px-4 py-3 text-muted-foreground">string</td>
                <td className="px-4 py-3">Customer's phone number in format 2547XXXXXXXX</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">amount</td>
                <td className="px-4 py-3 text-muted-foreground">number</td>
                <td className="px-4 py-3">Amount to charge in KES (minimum 1)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">accountReference</td>
                <td className="px-4 py-3 text-muted-foreground">string</td>
                <td className="px-4 py-3">Your internal reference (e.g. Invoice ID or Order ID)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">transactionDesc</td>
                <td className="px-4 py-3 text-muted-foreground">string</td>
                <td className="px-4 py-3">Description shown to the user on their phone</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
