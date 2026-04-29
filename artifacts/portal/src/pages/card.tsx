import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";
import {
  CreditCard, Smartphone, Wallet, ArrowDownToLine, Loader2,
  CheckCircle2, Clock, XCircle, Terminal, Code2, FlaskConical,
  ExternalLink, RefreshCw, Radio
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-600",
    cancelled: "bg-gray-100 text-gray-600",
    pending: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

interface WalletData {
  available: string;
  pesapalCollected: string;
  mpesaCollected: string;
  totalWithdrawn: string;
  totalCollected: string;
}

interface PesapalTx {
  id: number;
  orderTrackingId: string | null;
  orderMerchantRef: string;
  amount: string;
  netAmount: string;
  platformFee: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  phoneNumber: string | null;
  description: string | null;
  createdAt: string;
}

interface WithdrawalRequest {
  id: number;
  amount: string;
  phone: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface ApiKey {
  id: number;
  name: string;
  secretKey: string;
  prefix: string;
}

interface TestResult {
  orderTrackingId: string;
  merchantReference: string;
  redirectUrl: string;
  amount: number;
  netAmount: number;
  platformFee: number;
  currency: string;
}

interface PollResult {
  status: string;
  amount?: string;
  netAmount?: string;
  paymentMethod?: string;
  phoneNumber?: string;
  description?: string;
  updatedAt?: string;
}

/* ─── Test Playground ──────────────────────────────────────────── */
function TestPlayground() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [amount, setAmount] = useState("100");
  const [description, setDescription] = useState("Test payment");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [initiating, setInitiating] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollLog, setPollLog] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/keys`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        const keys = Array.isArray(d) ? d : [];
        setApiKeys(keys);
        if (keys.length > 0) setSelectedKey(keys[0].secretKey);
      })
      .catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [pollLog]);

  const addLog = (msg: string) =>
    setPollLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  };

  const startPolling = (trackingId: string, key: string) => {
    setPolling(true);
    setPollResult(null);
    setPollLog([]);
    addLog("Started polling every 5 seconds…");

    let count = 0;
    pollRef.current = setInterval(async () => {
      count++;
      try {
        const res = await fetch(`${API_BASE}/api/payments/pesapal/status/${trackingId}`, {
          headers: { "X-API-Key": key },
        });
        const data = await res.json();
        const method = data.paymentMethod ? ` via ${data.paymentMethod}` : "";
        addLog(`Poll #${count} — status: ${data.status}${method}`);
        setPollResult(data);

        if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
          addLog(`Final status reached: ${data.status.toUpperCase()}. Polling stopped.`);
          stopPolling();
          if (data.status === "completed") {
            toast({ title: "Payment completed!", description: `${data.paymentMethod ?? "Payment"} confirmed. Net KES ${Number(data.netAmount ?? 0).toLocaleString()} credited to your balance.` });
          }
        }
      } catch {
        addLog(`Poll #${count} — network error, retrying…`);
      }

      if (count >= 24) {
        addLog("Timed out after 2 minutes. Stop and check manually.");
        stopPolling();
      }
    }, 5000);
  };

  const handleInitiate = async () => {
    if (!selectedKey) { toast({ title: "No API key found", description: "Generate an API key first.", variant: "destructive" }); return; }
    if (!amount || Number(amount) < 10) { toast({ title: "Amount must be at least KES 10", variant: "destructive" }); return; }
    setInitiating(true);
    setResult(null);
    setPollResult(null);
    setPollLog([]);
    stopPolling();
    try {
      const body: Record<string, unknown> = {
        amount: Number(amount),
        description,
        callbackUrl: `${API_BASE}/api/payments/pesapal/callback`,
        cancellationUrl: `${window.location.origin}/card`,
      };
      if (phone) body.phone = phone;
      if (email) body.email = email;

      const res = await fetch(`${API_BASE}/api/payments/pesapal/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": selectedKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Failed");
      setResult(data);
      toast({ title: "Payment created", description: "Click 'Open Payment Page' to complete the test payment." });
      startPolling(data.orderTrackingId, selectedKey);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setInitiating(false);
    }
  };

  const handleManualPoll = async () => {
    if (!result || !selectedKey) return;
    try {
      const res = await fetch(`${API_BASE}/api/payments/pesapal/status/${result.orderTrackingId}`, {
        headers: { "X-API-Key": selectedKey },
      });
      const data = await res.json();
      setPollResult(data);
      addLog(`Manual refresh — status: ${data.status}${data.paymentMethod ? ` via ${data.paymentMethod}` : ""}`);
    } catch {
      addLog("Manual refresh failed.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
        <p className="font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Live Test — Real Money</p>
        <p>This creates a real PesaPal payment using your account. Use a small amount like <strong>KES 10</strong>. The 10% platform fee applies. After clicking "Open Payment Page", pay with any method — the status below updates automatically.</p>
      </div>

      {/* API Key selector */}
      <div className="space-y-1.5">
        <Label>API Key to use</Label>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-red-600">No API keys found. Generate one from the API Keys section first.</p>
        ) : (
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
          >
            {apiKeys.map(k => (
              <option key={k.id} value={k.secretKey}>{k.name} ({k.prefix}…)</option>
            ))}
          </select>
        )}
      </div>

      {/* Form */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Amount (KES) <span className="text-red-500">*</span></Label>
          <Input type="number" min={10} value={amount} onChange={e => setAmount(e.target.value)} placeholder="100" />
        </div>
        <div className="space-y-1.5">
          <Label>Description <span className="text-red-500">*</span></Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Test payment" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone <span className="text-muted-foreground text-xs">(for Airtel Money)</span></Label>
          <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712345678" />
        </div>
        <div className="space-y-1.5">
          <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@example.com" />
        </div>
      </div>

      <Button className="w-full" onClick={handleInitiate} disabled={initiating || !selectedKey}>
        {initiating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FlaskConical className="w-4 h-4 mr-2" />}
        Create Test Payment
      </Button>

      {/* Result */}
      {result && (
        <div className="space-y-4 border rounded-xl p-4 bg-gray-50">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Payment created</p>
            <div className="grid sm:grid-cols-3 gap-2 text-sm">
              <div className="bg-white border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Customer pays</p>
                <p className="font-bold text-lg">KES {result.amount}</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Platform fee (10%)</p>
                <p className="font-bold text-lg text-red-500">KES {result.platformFee}</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Your net credit</p>
                <p className="font-bold text-lg text-green-600">KES {result.netAmount}</p>
              </div>
            </div>
            <div className="bg-white border rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Order Tracking ID</p>
              <code className="text-xs font-mono break-all text-gray-700">{result.orderTrackingId}</code>
            </div>
            <a href={result.redirectUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                <ExternalLink className="w-4 h-4" /> Open Payment Page
              </Button>
            </a>
            <p className="text-xs text-center text-muted-foreground">Opens PesaPal — choose Card, Airtel Money, or any supported method</p>
          </div>

          {/* Live status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Radio className={`w-4 h-4 ${polling ? "text-green-500 animate-pulse" : "text-gray-400"}`} />
                Live Status {polling && <span className="text-xs text-green-600 font-normal">polling every 5s…</span>}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleManualPoll} className="h-7 text-xs gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
                {polling && (
                  <Button size="sm" variant="outline" onClick={stopPolling} className="h-7 text-xs">
                    Stop
                  </Button>
                )}
              </div>
            </div>

            {pollResult && (
              <div className="bg-white border rounded-lg p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusIcon status={pollResult.status} />
                  <StatusBadge status={pollResult.status} />
                  {pollResult.paymentMethod && (
                    <span className="text-xs text-muted-foreground">via {pollResult.paymentMethod}</span>
                  )}
                </div>
                {pollResult.status === "completed" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                    <p className="text-green-800 font-semibold text-sm">Payment confirmed!</p>
                    {pollResult.paymentMethod && (
                      <p className="text-xs text-green-700">
                        Method: <strong>{pollResult.paymentMethod}</strong>
                        {pollResult.paymentMethod?.toLowerCase().includes("airtel") && " — Airtel STK push was sent to the customer's phone"}
                        {(pollResult.paymentMethod?.toLowerCase().includes("visa") || pollResult.paymentMethod?.toLowerCase().includes("mastercard")) && " — Customer paid by card"}
                        {pollResult.paymentMethod?.toLowerCase().includes("safaricom") && " — M-Pesa STK push was sent"}
                      </p>
                    )}
                    <p className="text-xs text-green-700">Net credited: <strong>KES {Number(pollResult.netAmount ?? 0).toLocaleString()}</strong></p>
                  </div>
                )}
              </div>
            )}

            {/* Poll log */}
            {pollLog.length > 0 && (
              <div
                ref={logRef}
                className="bg-gray-950 rounded-lg p-3 max-h-36 overflow-y-auto"
              >
                {pollLog.map((line, i) => (
                  <p key={i} className="text-xs font-mono text-green-400">{line}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* How to detect payment method */}
      <div className="border rounded-xl p-4 space-y-3 text-sm">
        <p className="font-semibold">How payment method detection works</p>
        <p className="text-muted-foreground">When a customer pays, PesaPal tells us exactly which method they used. The <code className="bg-gray-100 px-1 rounded text-xs">paymentMethod</code> field in the status response tells you everything:</p>
        <div className="space-y-2">
          {[
            ["Airtel Money", "Airtel sends an STK push to the customer's Airtel SIM. PesaPal confirms when they approve it.", "text-red-600"],
            ["Visa / Mastercard", "Customer enters card details on PesaPal's secure page. No STK push involved.", "text-blue-600"],
            ["M-Pesa (via PesaPal)", "PesaPal sends an M-Pesa STK push via their own shortcode. Different from our STK push route.", "text-green-600"],
          ].map(([method, desc, color]) => (
            <div key={method} className="flex gap-3 items-start">
              <span className={`font-semibold shrink-0 ${color}`}>{method}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold mb-1">Status response example (Airtel Money payment)</p>
          <pre className="text-xs font-mono text-gray-700 overflow-x-auto">{JSON.stringify({
            status: "completed",
            paymentMethod: "Airtel Money",
            amount: "100.00",
            netAmount: "90.00",
            phoneNumber: "0712345678",
          }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */
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
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
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
      toast({ title: "Withdrawal requested", description: "Your request has been submitted and will be processed shortly." });
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
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
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
// Redirect customer to redirectUrl to complete payment
window.location.href = redirectUrl;`;

  const statusCurl = `curl ${API_BASE}/api/payments/pesapal/status/{orderTrackingId} \\
  -H "X-API-Key: YOUR_API_KEY"`;

  const statusNode = `const res = await fetch(
  \`${API_BASE}/api/payments/pesapal/status/\${orderTrackingId}\`,
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
);
const { status, amount, netAmount, paymentMethod } = await res.json();
// status: 'pending' | 'completed' | 'failed' | 'cancelled'
// paymentMethod: 'Airtel Money' | 'Visa' | 'Mastercard' | etc.`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-600" />
          Card & Airtel Money
        </h1>
        <p className="text-muted-foreground mt-1">
          Accept card payments and Airtel Money via PesaPal. A <strong>{PLATFORM_FEE}% platform fee</strong> is deducted — the net amount is credited to your balance for withdrawal.
        </p>
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
              <p className="text-xs text-muted-foreground mt-0.5">Net (after {PLATFORM_FEE}% fee)</p>
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

      {/* Main tabs */}
      <Tabs defaultValue="dashboard">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" /> Test Playground
          </TabsTrigger>
          <TabsTrigger value="docs">API Docs</TabsTrigger>
        </TabsList>

        {/* ── Dashboard tab ── */}
        <TabsContent value="dashboard">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Withdraw */}
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
                <p className="text-xs text-muted-foreground">Withdrawal will be processed manually by the platform admin.</p>
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

            {/* PesaPal transaction history */}
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
                    <p className="text-xs mt-1">Use the Test Playground tab to create your first test payment.</p>
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
        </TabsContent>

        {/* ── Test Playground tab ── */}
        <TabsContent value="test">
          <TestPlayground />
        </TabsContent>

        {/* ── API Docs tab ── */}
        <TabsContent value="docs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" /> API Integration
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Use your existing API key. Customers are redirected to a PesaPal-hosted payment page where they can pay with Visa, Mastercard, or Airtel Money.
                A <strong>{PLATFORM_FEE}% fee</strong> is deducted automatically — the net amount is added to your withdrawable balance.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Initiate */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
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
                        ["phone", "string", "No", "Customer phone number (for Airtel prompt)"],
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
                    amount: 500,
                    netAmount: 450,
                    platformFee: 50,
                    currency: "KES",
                    transactionId: 1,
                  }, null, 2)}</pre>
                </div>
              </div>

              <hr />

              {/* Status */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600 text-white text-xs">GET</Badge>
                  <code className="text-sm font-mono">/api/payments/pesapal/status/:orderTrackingId</code>
                  <Badge variant="outline" className="text-xs">X-API-Key</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Check payment status. Poll this after the customer returns from the redirect URL. The <code>paymentMethod</code> field tells you exactly how they paid.</p>
                <CodeBlock curl={statusCurl} node={statusNode} />

                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-semibold mb-1">Status values</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["pending", "amber", "Awaiting payment"],
                      ["completed", "green", "Payment successful — balance credited"],
                      ["failed", "red", "Payment failed"],
                      ["cancelled", "gray", "Customer cancelled"],
                    ].map(([s, c, d]) => (
                      <div key={s} className="flex items-center gap-2">
                        <StatusBadge status={s} />
                        <span className="text-muted-foreground text-xs">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <hr />

              {/* How fees work */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-blue-800">How the {PLATFORM_FEE}% fee works</p>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>1. Customer pays <strong>KES 1,000</strong> via card or Airtel Money</p>
                  <p>2. Platform fee: <strong>KES 100</strong> ({PLATFORM_FEE}%)</p>
                  <p>3. Your net credit: <strong>KES 900</strong> added to your withdrawable balance</p>
                  <p>4. Request a withdrawal from the Dashboard tab — admin processes it to your M-Pesa</p>
                </div>
              </div>

              {/* Supported methods */}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
