import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  CreditCard, Smartphone, Wallet, ArrowDownToLine, Loader2,
  CheckCircle2, Clock, XCircle, Terminal, Code2, FlaskConical,
} from "lucide-react";

const API_BASE = "https://pay.makamesco-tech.co.ke";
const PLATFORM_FEE = 10;

function CodeBlock({ curl, node }: { curl: string; node: string }) {
  return (
    <Tabs defaultValue="curl" className="w-full">
      <div className="flex items-center px-4 border-b bg-gray-50 rounded-t-lg">
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

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-amber-500" />;
}

interface WalletData {
  available: string;
  pesapalCollected: string;
  mpesaCollected: string;
  totalWithdrawn: string;
}

interface PesapalTx {
  id: number;
  orderTrackingId: string | null;
  orderMerchantRef: string;
  amount: string;
  netAmount: string;
  status: string;
  paymentMethod: string | null;
  description: string | null;
  createdAt: string;
}

interface WithdrawalRequest {
  id: number;
  amount: string;
  phone: string;
  status: string;
  createdAt: string;
}

export default function CardPayments() {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txs, setTxs] = useState<PesapalTx[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const load = async () => {
    try {
      const [w, t, wr] = await Promise.all([
        fetch(`${API_BASE}/api/wallet/balance`, { headers: getAuthHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/api/wallet/pesapal-transactions`, { headers: getAuthHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/api/wallet/withdrawals`, { headers: getAuthHeaders() }).then(r => r.json()),
      ]);
      setWallet(w);
      setTxs(Array.isArray(t) ? t.reverse() : []);
      setWithdrawals(Array.isArray(wr) ? wr : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawPhone) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    setWithdrawing(true);
    try {
      const res = await fetch(`${API_BASE}/api/wallet/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ amount: Number(withdrawAmount), phone: withdrawPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Withdrawal failed");
      toast({ title: "Withdrawal requested", description: "Will be processed by the admin shortly." });
      setWithdrawAmount("");
      setWithdrawPhone("");
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  const initiateCurl = `curl -X POST ${API_BASE}/api/payments/pesapal/initiate \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 500,
    "description": "Order #1234",
    "phone": "0712345678",
    "email": "customer@example.com",
    "callbackUrl": "https://yoursite.com/payment/success",
    "cancellationUrl": "https://yoursite.com/payment/cancel"
  }'`;

  const initiateNode = `const response = await fetch('${API_BASE}/api/payments/pesapal/initiate', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 500,
    description: 'Order #1234',
    phone: '0712345678',
    email: 'customer@example.com',
    callbackUrl: 'https://yoursite.com/payment/success',
    cancellationUrl: 'https://yoursite.com/payment/cancel',
  }),
});
const { redirectUrl, orderTrackingId, netAmount, platformFee } = await response.json();
window.location.href = redirectUrl; // Redirect customer to pay`;

  const statusCurl = `curl ${API_BASE}/api/payments/pesapal/status/{orderTrackingId} \\
  -H "X-API-Key: YOUR_API_KEY"`;

  const statusNode = `const res = await fetch(
  \`${API_BASE}/api/payments/pesapal/status/\${orderTrackingId}\`,
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
);
const { status, netAmount, paymentMethod } = await res.json();
// status: 'pending' | 'completed' | 'failed' | 'cancelled'
// paymentMethod: 'Airtel Money' | 'Visa' | 'Mastercard' | etc.`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Card & Airtel Money
          </h1>
          <p className="text-muted-foreground mt-1">
            Accept Visa, Mastercard, and Airtel Money via PesaPal. A <strong>{PLATFORM_FEE}% platform fee</strong> is deducted — the net is added to your withdrawable balance.
          </p>
        </div>
        <Link href="/card-test">
          <Button variant="outline" className="gap-2 shrink-0">
            <FlaskConical className="w-4 h-4 text-blue-600" />
            Test Playground
          </Button>
        </Link>
      </div>

      {/* Balance cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading balance…
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">KES {Number(wallet?.available ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ready to withdraw</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Card / Airtel Collected</p>
              <p className="text-2xl font-bold">KES {Number(wallet?.pesapalCollected ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Net after {PLATFORM_FEE}% fee</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">M-Pesa Collected</p>
              <p className="text-2xl font-bold">KES {Number(wallet?.mpesaCollected ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Platform-collected</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Total Withdrawn</p>
              <p className="text-2xl font-bold">KES {Number(wallet?.totalWithdrawn ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-0.5">All time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Withdraw + Transactions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownToLine className="w-4 h-4" /> Request Withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount (KES)</Label>
              <Input type="number" min={10} value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="e.g. 1000" />
            </div>
            <div className="space-y-1.5">
              <Label>M-Pesa Phone</Label>
              <Input type="tel" value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)} placeholder="0712345678" />
            </div>
            <p className="text-xs text-muted-foreground">Processed manually by the platform admin.</p>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount || !withdrawPhone}>
              {withdrawing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
              Request Withdrawal
            </Button>
            {withdrawals.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Requests</p>
                {withdrawals.slice(0, 5).map(w => (
                  <div key={w.id} className="flex items-center justify-between text-sm">
                    <span>KES {Number(w.amount).toLocaleString()}</span>
                    <Badge variant={w.status === "completed" ? "default" : w.status === "rejected" ? "destructive" : "secondary"} className="text-xs">
                      {w.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" /> Card / Airtel Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No card or Airtel transactions yet.</p>
                <p className="text-xs mt-1">Use the <strong>Test Playground</strong> in the sidebar to create your first payment.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {txs.slice(0, 20).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusIcon status={tx.status} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{tx.description ?? tx.orderMerchantRef}</p>
                        <p className="text-xs text-muted-foreground">{tx.paymentMethod ?? "—"} · {new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-semibold">KES {Number(tx.netAmount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">of {Number(tx.amount).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* API Docs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" /> API Integration
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Use your existing API key. Customers are redirected to PesaPal's hosted checkout page.
            A <strong>{PLATFORM_FEE}% fee</strong> is deducted — the net is credited to your withdrawable balance.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-blue-600 text-white text-xs">POST</Badge>
              <code className="text-sm font-mono">/api/payments/pesapal/initiate</code>
              <Badge variant="outline" className="text-xs">X-API-Key</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Initiates a payment. Returns a <code>redirectUrl</code> — send the customer there to complete payment.</p>

            <div className="border rounded-lg overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 font-medium">Parameter</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Required</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["amount", "number", "Yes", "Amount in KES (min 10)"],
                    ["description", "string", "Yes", "Payment description shown to customer"],
                    ["phone", "string", "No", "Customer phone (for Airtel Money STK push)"],
                    ["email", "string", "No", "Customer email"],
                    ["callbackUrl", "string", "No", "Redirect URL after successful payment"],
                    ["cancellationUrl", "string", "No", "Redirect URL if customer cancels"],
                    ["currency", "string", "No", `Currency code (default: "KES")`],
                  ].map(([p, t, r, d]) => (
                    <tr key={p} className="border-b last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{p}</td>
                      <td className="px-4 py-2 text-muted-foreground">{t}</td>
                      <td className="px-4 py-2">
                        <Badge variant={r === "Yes" ? "default" : "secondary"} className="text-xs">{r}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <CodeBlock curl={initiateCurl} node={initiateNode} />

            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold mb-1">Response</p>
              <pre className="text-xs font-mono text-gray-700 overflow-x-auto">{JSON.stringify({
                orderTrackingId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
                merchantReference: "NEXUS-12-1234567890-ABCD",
                redirectUrl: "https://pay.pesapal.com/v3/api/...",
                amount: 500, netAmount: 450, platformFee: 50, currency: "KES", transactionId: 1,
              }, null, 2)}</pre>
            </div>
          </div>

          <hr />

          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-green-600 text-white text-xs">GET</Badge>
              <code className="text-sm font-mono">/api/payments/pesapal/status/:orderTrackingId</code>
              <Badge variant="outline" className="text-xs">X-API-Key</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Check payment status. The <code>paymentMethod</code> field tells you exactly how the customer paid (Airtel Money, Visa, Mastercard, etc.).</p>
            <CodeBlock curl={statusCurl} node={statusNode} />

            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold mb-1">Status values</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["pending", "amber", "Awaiting payment"],
                  ["completed", "green", "Payment successful — balance credited"],
                  ["failed", "red", "Payment failed"],
                  ["cancelled", "gray", "Customer cancelled"],
                ].map(([s, c, d]) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c === "green" ? "bg-green-100 text-green-700" :
                      c === "amber" ? "bg-amber-100 text-amber-700" :
                      c === "red" ? "bg-red-100 text-red-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>{s}</span>
                    <span className="text-muted-foreground text-xs">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <hr />

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-blue-800">How the {PLATFORM_FEE}% fee works</p>
            <div className="text-sm text-blue-700 space-y-1">
              <p>Customer pays <strong>KES 1,000</strong> → Platform fee: <strong>KES 100 (10%)</strong> → Your net credit: <strong>KES 900</strong></p>
              <p>Withdraw your balance anytime from this page — admin processes it to your M-Pesa.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: CreditCard, label: "Visa / Mastercard", color: "text-blue-600" },
              { icon: Smartphone, label: "Airtel Money", color: "text-red-500" },
              { icon: Wallet, label: "Mobile Wallets", color: "text-green-600" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="border rounded-lg p-3 space-y-1">
                <Icon className={`w-6 h-6 mx-auto ${color}`} />
                <p className="text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
