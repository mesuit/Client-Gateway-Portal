import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowUpRight, Send, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Phone, DollarSign, Wallet, Plus, Info, Terminal, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "https://pay.makamesco-tech.co.ke";
const FEE_RATE = 0.08;

interface WalletData {
  balance: string;
  totalToppedup: string;
  totalSpent: string;
  totalFees: string;
  feeRate: number;
  recentTopups: Topup[];
}
interface Topup {
  id: number;
  amount: string;
  status: string;
  phoneNumber: string;
  mpesaReceiptNumber: string | null;
  createdAt: string;
}
interface B2CTx {
  id: number;
  conversationId: string;
  status: string;
  amount: string;
  phoneNumber: string;
  mpesaReceiptNumber: string | null;
  receiverPartyPublicName: string | null;
  commandId: string;
  remarks: string;
  feeAmount: string | null;
  totalDeducted: string | null;
  resultDescription: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs"><CheckCircle className="w-3 h-3" />Completed</Badge>;
  if (status === "failed") return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs"><XCircle className="w-3 h-3" />Failed</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1 text-xs"><Clock className="w-3 h-3" />Pending</Badge>;
}

function fmt(n: string | number | null) {
  if (n === null || n === undefined) return "0.00";
  return Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function B2CPage() {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [transactions, setTransactions] = useState<B2CTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  // Top-up state
  const [topupPhone, setTopupPhone] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [topping, setTopping] = useState(false);
  const [topupCheckout, setTopupCheckout] = useState<string | null>(null);
  const topupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send state
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [occasion, setOccasion] = useState("");
  const [commandId, setCommandId] = useState("BusinessPayment");
  const [sending, setSending] = useState(false);
  const [sendPollId, setSendPollId] = useState<string | null>(null);

  // API Test state
  const [testApiKey, setTestApiKey] = useState("");
  const [showTestKey, setShowTestKey] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testAmount, setTestAmount] = useState("");
  const [testRemarks, setTestRemarks] = useState("Test payment");
  const [testCommandId, setTestCommandId] = useState("BusinessPayment");
  const [testRunning, setTestRunning] = useState(false);
  const [testResponse, setTestResponse] = useState<{ ok: boolean; status: number; data: unknown } | null>(null);

  const fetchWallet = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const res = await fetch(`${API_BASE}/api/b2c/wallet`, { headers: getAuthHeaders() });
      if (res.ok) setWallet(await res.json());
    } finally { setLoadingWallet(false); }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoadingTxs(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/b2c`, { headers: getAuthHeaders() });
      if (res.ok) setTransactions(await res.json());
    } finally { setLoadingTxs(false); }
  }, []);

  useEffect(() => { fetchWallet(); fetchTransactions(); }, [fetchWallet, fetchTransactions]);

  // Poll top-up status
  useEffect(() => {
    if (!topupCheckout) return;
    topupPollRef.current = setInterval(async () => {
      const res = await fetch(`${API_BASE}/api/b2c/wallet/topup/status/${topupCheckout}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== "pending") {
        clearInterval(topupPollRef.current!);
        setTopupCheckout(null);
        if (data.status === "completed") {
          toast({ title: "Wallet Topped Up!", description: `KES ${fmt(data.amount)} added to your B2C wallet.` });
          fetchWallet();
        } else {
          toast({ title: "Top-Up Failed", description: "Payment was not completed.", variant: "destructive" });
        }
      }
    }, 4000);
    return () => clearInterval(topupPollRef.current!);
  }, [topupCheckout, fetchWallet, toast]);

  // Poll B2C send status
  useEffect(() => {
    if (!sendPollId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`${API_BASE}/api/payments/b2c/status/${sendPollId}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== "pending") {
        clearInterval(interval);
        setSendPollId(null);
        fetchTransactions(); fetchWallet();
        toast({
          title: data.status === "completed" ? "Payment Sent!" : "Payment Failed",
          description: data.status === "completed"
            ? `KES ${fmt(data.amount)} sent to ${data.receiverPartyPublicName ?? data.phoneNumber}`
            : data.resultDescription ?? "Transaction failed",
          variant: data.status === "completed" ? "default" : "destructive",
        });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [sendPollId, fetchTransactions, fetchWallet, toast]);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!topupPhone || !topupAmount) {
      toast({ title: "Missing fields", description: "Phone and amount are required.", variant: "destructive" });
      return;
    }
    if (Number(topupAmount) < 10) {
      toast({ title: "Too low", description: "Minimum top-up is KES 10.", variant: "destructive" });
      return;
    }
    setTopping(true);
    try {
      const res = await fetch(`${API_BASE}/api/b2c/wallet/topup`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: topupPhone, amount: Number(topupAmount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Top-up failed");
      toast({ title: "STK Push Sent", description: data.customerMessage });
      setTopupCheckout(data.checkoutRequestId);
      setTopupPhone(""); setTopupAmount("");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setTopping(false); }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !amount || !remarks) {
      toast({ title: "Missing fields", description: "Phone, amount, and remarks are required.", variant: "destructive" });
      return;
    }
    const formatted = phone.replace(/^\+/, "").replace(/^0/, "254");
    if (!/^2547\d{8}$|^2541\d{8}$/.test(formatted)) {
      toast({ title: "Invalid phone", description: "Use format 2547XXXXXXXX or 07XXXXXXXX", variant: "destructive" });
      return;
    }
    const sendAmt = Number(amount);
    const total = parseFloat((sendAmt * 1.08).toFixed(2));
    const balance = Number(wallet?.balance ?? 0);
    if (balance < total) {
      toast({ title: "Insufficient Balance", description: `Need KES ${fmt(total)} (incl. 8% fee). Top up your wallet first.`, variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/b2c`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formatted, amount: sendAmt, remarks, occasion: occasion || undefined, commandId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "B2C failed");
      toast({ title: "Payment Initiated", description: `KES ${fmt(sendAmt)} queued. Checking status…` });
      setSendPollId(data.conversationId);
      setPhone(""); setAmount(""); setRemarks(""); setOccasion("");
      fetchTransactions(); fetchWallet();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally { setSending(false); }
  }

  async function handleApiTest() {
    if (!testApiKey || !testPhone || !testAmount || !testRemarks) return;
    setTestRunning(true);
    setTestResponse(null);
    try {
      const res = await fetch(`${API_BASE}/api/payments/b2c`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": testApiKey.trim(),
        },
        body: JSON.stringify({
          phoneNumber: testPhone,
          amount: Number(testAmount),
          remarks: testRemarks,
          commandId: testCommandId,
        }),
      });
      const data = await res.json();
      setTestResponse({ ok: res.ok, status: res.status, data });
    } catch (err) {
      setTestResponse({ ok: false, status: 0, data: { error: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Request failed" } });
    } finally {
      setTestRunning(false);
    }
  }

  const sendAmt = Number(amount) || 0;
  const fee = parseFloat((sendAmt * FEE_RATE).toFixed(2));
  const total = parseFloat((sendAmt + fee).toFixed(2));
  const balance = Number(wallet?.balance ?? 0);
  const canSend = balance >= total && total > 0;

  const curlPreview = `curl -X POST ${API_BASE}/api/payments/b2c \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${testApiKey || "sk_YOUR_SECRET_KEY"}" \\
  -d '{
    "phoneNumber": "${testPhone || "2547XXXXXXXX"}",
    "amount": ${testAmount || "100"},
    "remarks": "${testRemarks || "Test payment"}",
    "commandId": "${testCommandId}"
  }'`;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="mb-2">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ArrowUpRight className="w-6 h-6 text-green-600" />
          B2C Payments
        </h2>
        <p className="text-muted-foreground mt-1">Send money directly to any M-Pesa number. Top up your wallet first — 8% fee applies per transaction.</p>
      </div>

      {/* Wallet Balance Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="sm:col-span-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-green-700 font-medium mb-1">
              <Wallet className="w-4 h-4" /> B2C Wallet Balance
            </div>
            {loadingWallet ? (
              <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-green-700">KES {fmt(wallet?.balance ?? "0")}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Available to send (incl. 8% fee deducted per transaction)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Total Topped Up</p>
            <p className="text-xl font-semibold">KES {fmt(wallet?.totalToppedup ?? "0")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Fees Earned (Platform)</p>
            <p className="text-xl font-semibold text-blue-600">KES {fmt(wallet?.totalFees ?? "0")}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send"><Send className="w-4 h-4 mr-1" />Send Money</TabsTrigger>
          <TabsTrigger value="topup"><Plus className="w-4 h-4 mr-1" />Top Up Wallet</TabsTrigger>
          <TabsTrigger value="apitest"><Terminal className="w-4 h-4 mr-1" />API Test</TabsTrigger>
        </TabsList>

        {/* Send Tab */}
        <TabsContent value="send">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="w-4 h-4 text-green-600" /> Send B2C Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSend} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Recipient Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="2547XXXXXXXX or 07XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (KES)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9" type="number" min={10} placeholder="Min KES 10" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                    {sendAmt > 0 && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs space-y-0.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">Send amount</span><span>KES {fmt(sendAmt)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (8%)</span><span className="text-blue-600">KES {fmt(fee)}</span></div>
                        <div className="flex justify-between font-semibold border-t border-blue-100 pt-0.5 mt-0.5"><span>Total deducted</span><span className={!canSend && sendAmt > 0 ? "text-red-600" : ""}>KES {fmt(total)}</span></div>
                        {!canSend && sendAmt > 0 && <p className="text-red-600 pt-0.5">Wallet balance insufficient. Top up at least KES {fmt(total - balance)} more.</p>}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Type</Label>
                    <Select value={commandId} onValueChange={setCommandId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BusinessPayment">Business Payment</SelectItem>
                        <SelectItem value="SalaryPayment">Salary Payment</SelectItem>
                        <SelectItem value="PromotionPayment">Promotion Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <Input placeholder="e.g. Refund for order #123" value={remarks} onChange={e => setRemarks(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Occasion <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input placeholder="e.g. November promotion" value={occasion} onChange={e => setOccasion(e.target.value)} />
                  </div>
                  {sendPollId && (
                    <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Waiting for Safaricom confirmation…
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={sending || !canSend}>
                    {sending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending…</> : <><Send className="w-4 h-4 mr-2" />Send Money</>}
                  </Button>
                  {!canSend && sendAmt === 0 && balance === 0 && (
                    <p className="text-center text-xs text-muted-foreground">Top up your wallet to start sending.</p>
                  )}
                </form>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card className="border-blue-100 bg-blue-50">
                <CardContent className="pt-4 text-sm space-y-2 text-blue-800">
                  <p className="font-semibold flex items-center gap-1"><Info className="w-4 h-4" />Fee Structure</p>
                  <p>Each B2C payment deducts the send amount plus an <strong>8% platform fee</strong> from your wallet.</p>
                  <p className="font-mono text-xs bg-blue-100 rounded px-2 py-1">Total = Amount × 1.08</p>
                  <p>Example: Sending KES 1,000 deducts <strong>KES 1,080</strong> from your wallet (KES 80 fee).</p>
                </CardContent>
              </Card>
              <Card className="border-green-100 bg-green-50">
                <CardContent className="pt-4 text-sm space-y-1 text-green-800">
                  <p className="font-semibold">Payment Types</p>
                  <p><strong>Business Payment</strong> — Refunds, commissions, general</p>
                  <p><strong>Salary Payment</strong> — Employee disbursements</p>
                  <p><strong>Promotion Payment</strong> — Cashback, rewards, bonuses</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Top Up Tab */}
        <TabsContent value="topup">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-600" /> Top Up B2C Wallet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTopup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>M-Pesa Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="2547XXXXXXXX or 07XXXXXXXX" value={topupPhone} onChange={e => setTopupPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (KES)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9" type="number" min={10} placeholder="Min KES 10" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
                    </div>
                  </div>
                  {topupCheckout && (
                    <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Waiting for M-Pesa payment…
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={topping || !!topupCheckout}>
                    {topping ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending STK Push…</> : <><Plus className="w-4 h-4 mr-2" />Top Up Now</>}
                  </Button>
                </form>

                {wallet && wallet.recentTopups.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium mb-2">Recent Top-Ups</p>
                    <div className="space-y-2">
                      {wallet.recentTopups.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                          <div>
                            <p className="font-semibold">KES {fmt(t.amount)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
                          </div>
                          <StatusBadge status={t.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-amber-100 bg-amber-50 h-fit">
              <CardContent className="pt-4 text-sm text-amber-800 space-y-2">
                <p className="font-semibold">How it works</p>
                <p>1. Enter your M-Pesa phone and top-up amount</p>
                <p>2. You'll receive an STK Push prompt on your phone</p>
                <p>3. Approve it — your B2C wallet is credited instantly</p>
                <p>4. Use the balance to send B2C payments (8% fee per transaction goes to the platform)</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Test Tab */}
        <TabsContent value="apitest">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Left: Input form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-600" /> B2C API Tester
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-800">
                  Test the live B2C disbursement endpoint using your Secret Key. Your Secret Key is shown once when you create an API key — find it in the <strong>API Keys</strong> section of the sidebar.
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Secret Key</Label>
                  <div className="relative">
                    <Input
                      type={showTestKey ? "text" : "password"}
                      placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={testApiKey}
                      onChange={e => setTestApiKey(e.target.value)}
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowTestKey(v => !v)}
                    >
                      {showTestKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Phone + Amount */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Phone</Label>
                    <Input
                      placeholder="2547XXXXXXXX"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      className="text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Amount (KES)</Label>
                    <Input
                      type="number"
                      min={10}
                      placeholder="100"
                      value={testAmount}
                      onChange={e => setTestAmount(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Remarks</Label>
                  <Input
                    placeholder="e.g. Test payment"
                    value={testRemarks}
                    onChange={e => setTestRemarks(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Command ID */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Command ID</Label>
                  <Select value={testCommandId} onValueChange={setTestCommandId}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BusinessPayment">BusinessPayment</SelectItem>
                      <SelectItem value="SalaryPayment">SalaryPayment</SelectItem>
                      <SelectItem value="PromotionPayment">PromotionPayment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={handleApiTest}
                  disabled={testRunning || !testApiKey.trim() || !testPhone.trim() || !testAmount || !testRemarks.trim()}
                >
                  {testRunning
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending request…</>
                    : <><Send className="w-4 h-4 mr-2" />Run Test</>}
                </Button>
              </CardContent>
            </Card>

            {/* Right: cURL + Response */}
            <div className="space-y-4">
              {/* cURL preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> cURL Equivalent
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <pre className="bg-gray-950 text-green-300 text-xs p-4 rounded-b-lg overflow-x-auto font-mono whitespace-pre-wrap break-all">
                    {curlPreview}
                  </pre>
                </CardContent>
              </Card>

              {/* Response viewer */}
              {(testResponse !== null || testRunning) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      Response
                      {testResponse && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          testResponse.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {testResponse.status === 0 ? "Network Error" : `HTTP ${testResponse.status}`}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {testRunning ? (
                      <div className="bg-gray-950 text-gray-500 text-xs p-4 rounded-b-lg font-mono animate-pulse">
                        Waiting for response…
                      </div>
                    ) : (
                      <pre className={`text-xs p-4 rounded-b-lg overflow-x-auto font-mono whitespace-pre-wrap ${
                        testResponse?.ok ? "bg-gray-950 text-gray-50" : "bg-gray-950 text-red-300"
                      }`}>
                        {JSON.stringify(testResponse?.data, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Hint box */}
              {testResponse === null && !testRunning && (
                <Card className="border-gray-100 bg-gray-50">
                  <CardContent className="pt-4 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-medium text-gray-700">What this tests</p>
                    <p>Calls <code className="bg-gray-100 px-1 rounded font-mono">POST /api/payments/b2c</code> with your Secret Key in the <code className="bg-gray-100 px-1 rounded font-mono">X-API-Key</code> header — exactly as an external system would call it.</p>
                    <p className="text-amber-700 font-medium mt-2">⚠ This sends a real B2C payment. Make sure your wallet has sufficient balance (amount + 8% fee).</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Transaction History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">B2C Transaction History</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { fetchTransactions(); fetchWallet(); }} disabled={loadingTxs}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingTxs ? "animate-spin" : ""}`} />Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center text-muted-foreground gap-2">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm">No B2C transactions yet. Top up your wallet and send your first payment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3">Phone</th>
                    <th className="pb-2 pr-3">Amount</th>
                    <th className="pb-2 pr-3">Fee (8%)</th>
                    <th className="pb-2 pr-3">Total</th>
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Receipt</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td className="py-2 pr-3 font-mono text-xs">{tx.phoneNumber}</td>
                      <td className="py-2 pr-3 font-semibold">KES {fmt(tx.amount)}</td>
                      <td className="py-2 pr-3 text-blue-600 text-xs">{tx.feeAmount ? `KES ${fmt(tx.feeAmount)}` : "—"}</td>
                      <td className="py-2 pr-3 font-semibold text-xs">{tx.totalDeducted ? `KES ${fmt(tx.totalDeducted)}` : "—"}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{tx.commandId.replace("Payment", "")}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{tx.mpesaReceiptNumber ?? "—"}</td>
                      <td className="py-2 pr-3"><StatusBadge status={tx.status} /></td>
                      <td className="py-2 text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
