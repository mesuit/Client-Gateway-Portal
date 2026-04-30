import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, Send, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Phone, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "https://pay.makamesco-tech.co.ke";

interface ApiKey { id: number; name: string; keyPrefix: string; isActive: boolean; }
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
  resultDescription: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle className="w-3 h-3" />Completed</Badge>;
  if (status === "failed") return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" />Failed</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
}

export default function B2CPage() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [loadingKey, setLoadingKey] = useState(true);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [occasion, setOccasion] = useState("");
  const [commandId, setCommandId] = useState("BusinessPayment");
  const [sending, setSending] = useState(false);
  const [transactions, setTransactions] = useState<B2CTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchKey() {
      try {
        const res = await fetch(`${API_BASE}/api/keys`, { headers: getAuthHeaders() });
        const keys: ApiKey[] = await res.json();
        const active = keys.find(k => k.isActive);
        if (active) setApiKey(`${active.keyPrefix}...`);
      } catch {
        // silent
      } finally {
        setLoadingKey(false);
      }
    }
    fetchKey();
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoadingTxs(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/b2c`, { headers: getAuthHeaders() });
      if (res.ok) setTransactions(await res.json());
    } catch {
      // silent
    } finally {
      setLoadingTxs(false);
    }
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`${API_BASE}/api/payments/b2c/status/${pollingId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.status !== "pending") {
          setPollingId(null);
          fetchTransactions();
          toast({
            title: data.status === "completed" ? "Payment Sent!" : "Payment Failed",
            description: data.status === "completed"
              ? `KES ${data.amount} sent to ${data.receiverPartyPublicName ?? data.phoneNumber}`
              : data.resultDescription ?? "Transaction failed",
            variant: data.status === "completed" ? "default" : "destructive",
          });
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [pollingId, fetchTransactions, toast]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !amount || !remarks) {
      toast({ title: "Missing fields", description: "Phone, amount, and remarks are required.", variant: "destructive" });
      return;
    }
    const formatted = phone.replace(/^\+/, "").replace(/^0/, "254");
    if (!/^2547\d{8}$|^2541\d{8}$/.test(formatted)) {
      toast({ title: "Invalid phone", description: "Use format 2547XXXXXXXX or 0712XXXXXX", variant: "destructive" });
      return;
    }
    if (Number(amount) < 10) {
      toast({ title: "Too low", description: "Minimum amount is KES 10", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/b2c`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formatted, amount: Number(amount), remarks, occasion: occasion || undefined, commandId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "B2C failed");
      toast({ title: "Request Accepted", description: `ConversationID: ${data.conversationId}` });
      setPollingId(data.conversationId);
      setPhone(""); setAmount(""); setRemarks(""); setOccasion("");
      fetchTransactions();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-2">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ArrowUpRight className="w-6 h-6 text-green-600" />
          B2C Payments
        </h2>
        <p className="text-muted-foreground mt-1">Send money directly from your shortcode to any M-Pesa number.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Send Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-green-600" /> Send Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="2547XXXXXXXX or 07XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (KES)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" type="number" min={10} placeholder="Minimum KES 10" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
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
              {pollingId && (
                <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking status…
                </div>
              )}
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={sending || loadingKey}>
                {sending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending…</> : <><Send className="w-4 h-4 mr-2" />Send Money</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="space-y-4">
          <Card className="border-green-100 bg-green-50">
            <CardContent className="pt-4 text-sm space-y-2 text-green-800">
              <p className="font-semibold">How it works</p>
              <p>• Money is sent directly from the platform shortcode to the recipient's M-Pesa wallet</p>
              <p>• Safaricom processes the request and sends a callback with the result</p>
              <p>• Status updates automatically every few seconds</p>
              <p>• Minimum amount: <strong>KES 10</strong></p>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-blue-50">
            <CardContent className="pt-4 text-sm space-y-1 text-blue-800">
              <p className="font-semibold">Payment Types</p>
              <p><strong>Business Payment</strong> — General payments, refunds, commissions</p>
              <p><strong>Salary Payment</strong> — Employee salary disbursements</p>
              <p><strong>Promotion Payment</strong> — Cashback, bonuses, rewards</p>
            </CardContent>
          </Card>
          {loadingKey ? null : (
            <Card className="border-gray-100">
              <CardContent className="pt-4 text-sm text-muted-foreground">
                <p className="font-medium text-gray-700 mb-1">API Access</p>
                <p>Send B2C via your API key using <code className="bg-gray-100 px-1 rounded text-xs">POST /api/payments/b2c</code>. See the <strong>Docs</strong> page for full examples.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent B2C Transactions</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loadingTxs}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingTxs ? "animate-spin" : ""}`} />Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center text-muted-foreground gap-2">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm">No B2C transactions yet. Send your first payment above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Remarks</th>
                    <th className="pb-2 pr-4">Receipt</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="py-2">
                      <td className="py-2 pr-4 font-mono text-xs">{tx.phoneNumber}</td>
                      <td className="py-2 pr-4 font-semibold">KES {tx.amount}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{tx.commandId.replace("Payment", "")}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[120px] truncate">{tx.remarks}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{tx.mpesaReceiptNumber ?? "—"}</td>
                      <td className="py-2 pr-4"><StatusBadge status={tx.status} /></td>
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
