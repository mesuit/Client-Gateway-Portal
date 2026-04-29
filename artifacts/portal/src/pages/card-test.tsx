import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical, ExternalLink, RefreshCw, Radio,
  CheckCircle2, Clock, XCircle, Loader2, CreditCard,
} from "lucide-react";

const API_BASE = "https://pay.makamesco-tech.co.ke";

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-5 h-5 text-green-600" />;
  if (status === "failed") return <XCircle className="w-5 h-5 text-red-500" />;
  if (status === "cancelled") return <XCircle className="w-5 h-5 text-gray-400" />;
  return <Clock className="w-5 h-5 text-amber-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-600",
    cancelled: "bg-gray-100 text-gray-600",
    pending: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
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
}

export default function CardTest() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [amount, setAmount] = useState("10");
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
    addLog("Polling started — checking every 5 seconds…");
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

        if (["completed", "failed", "cancelled"].includes(data.status)) {
          addLog(`Done. Final status: ${data.status.toUpperCase()}`);
          stopPolling();
          if (data.status === "completed") {
            toast({
              title: "Payment confirmed!",
              description: `${data.paymentMethod ?? "Payment"} successful. KES ${Number(data.netAmount ?? 0).toLocaleString()} credited to your balance.`,
            });
          }
        }
      } catch {
        addLog(`Poll #${count} — network error, retrying…`);
      }
      if (count >= 24) { addLog("Timed out after 2 minutes."); stopPolling(); }
    }, 5000);
  };

  const handleInitiate = async () => {
    if (!apiKey.trim()) {
      toast({ title: "Enter your API Secret Key", variant: "destructive" });
      return;
    }
    if (Number(amount) < 10) {
      toast({ title: "Minimum amount is KES 10", variant: "destructive" });
      return;
    }
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
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey.trim() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Request failed");
      setResult(data);
      toast({ title: "Payment link created", description: "Click 'Open Payment Page' to pay and test." });
      startPolling(data.orderTrackingId, apiKey.trim());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setInitiating(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!result || !apiKey.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/payments/pesapal/status/${result.orderTrackingId}`, {
        headers: { "X-API-Key": apiKey.trim() },
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-blue-600" />
            Test Card & Airtel Pay
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a live PesaPal payment and watch the status update in real-time. Works with Visa, Mastercard, and Airtel Money.
          </p>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">This is a real payment — actual money moves</p>
          <p>Use <strong>KES 10</strong> minimum. The 10% platform fee applies. After clicking "Open Payment Page", choose your method and pay — the status log below will update automatically.</p>
        </div>

        {/* API Key */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Step 1 — Enter your API Secret Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk_live_xxxxxxxxxxxxxxxx — paste from API Keys section"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Go to <strong>API Keys</strong> in the sidebar → copy your Secret Key → paste it here.
            </p>
          </CardContent>
        </Card>

        {/* Payment details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 2 — Fill in payment details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (KES) <span className="text-red-500">*</span></Label>
                <Input type="number" min={10} value={amount} onChange={e => setAmount(e.target.value)} placeholder="10" />
              </div>
              <div className="space-y-1.5">
                <Label>Description <span className="text-red-500">*</span></Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Test payment" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-muted-foreground text-xs">(needed for Airtel Money)</span></Label>
                <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712345678" />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleInitiate} disabled={initiating || !apiKey.trim()}>
              {initiating
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating payment…</>
                : <><FlaskConical className="w-4 h-4 mr-2" /> Create Test Payment</>}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Step 3 — Open the payment page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fee breakdown */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Customer pays</p>
                  <p className="text-xl font-bold">KES {result.amount}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Platform fee (10%)</p>
                  <p className="text-xl font-bold text-red-500">KES {result.platformFee}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Your net credit</p>
                  <p className="text-xl font-bold text-green-600">KES {result.netAmount}</p>
                </div>
              </div>

              {/* Tracking ID */}
              <div className="bg-gray-50 border rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Order Tracking ID</p>
                <code className="text-xs font-mono break-all">{result.orderTrackingId}</code>
              </div>

              {/* Open button */}
              <a href={result.redirectUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2" size="lg">
                  <ExternalLink className="w-4 h-4" /> Open Payment Page
                </Button>
              </a>
              <p className="text-xs text-center text-muted-foreground">
                Opens PesaPal in a new tab — choose Visa, Mastercard, or Airtel Money to complete the payment
              </p>

              {/* Live status */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Radio className={`w-4 h-4 ${polling ? "text-green-500 animate-pulse" : "text-gray-400"}`} />
                    Live Status
                    {polling && <span className="text-xs font-normal text-green-600">— polling every 5s</span>}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleManualRefresh} className="h-7 text-xs gap-1">
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </Button>
                    {polling && (
                      <Button size="sm" variant="outline" onClick={stopPolling} className="h-7 text-xs">Stop</Button>
                    )}
                  </div>
                </div>

                {pollResult && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={pollResult.status} />
                      <StatusBadge status={pollResult.status} />
                      {pollResult.paymentMethod && (
                        <span className="text-sm text-muted-foreground">via <strong>{pollResult.paymentMethod}</strong></span>
                      )}
                    </div>

                    {pollResult.status === "completed" && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1 text-sm">
                        <p className="font-semibold text-green-800">Payment confirmed!</p>
                        {pollResult.paymentMethod && (
                          <p className="text-green-700 text-xs">
                            {pollResult.paymentMethod.toLowerCase().includes("airtel")
                              ? "Airtel sent an STK push to the customer's phone — they approved it."
                              : pollResult.paymentMethod.toLowerCase().includes("visa") || pollResult.paymentMethod.toLowerCase().includes("mastercard")
                              ? "Customer paid by card on PesaPal's secure page."
                              : pollResult.paymentMethod.toLowerCase().includes("mpesa") || pollResult.paymentMethod.toLowerCase().includes("safaricom")
                              ? "M-Pesa STK push was triggered by PesaPal."
                              : `Payment method: ${pollResult.paymentMethod}`}
                          </p>
                        )}
                        <p className="text-green-700 text-xs font-medium">
                          KES {Number(pollResult.netAmount ?? 0).toLocaleString()} credited to your Card & Airtel Pay balance.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Poll log */}
                {pollLog.length > 0 && (
                  <div ref={logRef} className="bg-gray-950 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {pollLog.map((line, i) => (
                      <p key={i} className="text-xs font-mono text-green-400 leading-relaxed">{line}</p>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* How payment methods work */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How payment method detection works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">When the customer pays, PesaPal reports exactly which method they used. You'll see it in the <strong>paymentMethod</strong> field above and in the status log.</p>
            <div className="space-y-3">
              {[
                {
                  method: "Airtel Money",
                  color: "border-red-200 bg-red-50",
                  badge: "bg-red-100 text-red-700",
                  desc: "Customer selects Airtel Money on PesaPal. Airtel sends an STK push to their phone. They approve it by entering their Airtel PIN. PesaPal confirms and notifies us.",
                },
                {
                  method: "Visa / Mastercard",
                  color: "border-blue-200 bg-blue-50",
                  badge: "bg-blue-100 text-blue-700",
                  desc: "Customer enters card details on PesaPal's secure, PCI-DSS compliant page. No card data touches your server. Payment goes through instantly.",
                },
                {
                  method: "M-Pesa via PesaPal",
                  color: "border-green-200 bg-green-50",
                  badge: "bg-green-100 text-green-700",
                  desc: "PesaPal triggers an M-Pesa STK push from their own shortcode. This is separate from the direct STK push route — the customer pays PesaPal, who then notifies us.",
                },
              ].map(({ method, color, badge, desc }) => (
                <div key={method} className={`rounded-lg border p-3 space-y-1 ${color}`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{method}</span>
                  <p className="text-xs text-gray-700 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
