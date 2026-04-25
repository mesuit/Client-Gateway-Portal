import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, KeyRound, ArrowUpRight } from "lucide-react";

const API_BASE = "https://pay.makamesco-tech.co.ke";
const KEY_STORAGE = "b2c_api_key";

interface B2CTx {
  id: number;
  conversationId: string | null;
  status: string;
  amount: string;
  phoneNumber: string;
  mpesaReceiptNumber: string | null;
  receiverPartyPublicName: string | null;
  commandId: string;
  remarks: string | null;
  resultDescription: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return (
    <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Completed
    </Badge>
  );
  if (status === "failed") return (
    <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
      <XCircle className="w-3 h-3" /> Failed
    </Badge>
  );
  return (
    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1">
      <Clock className="w-3 h-3" /> Pending
    </Badge>
  );
}

export default function B2CPage() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? "");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [occasion, setOccasion] = useState("");
  const [commandId, setCommandId] = useState("BusinessPayment");

  const { data: txs = [], isFetching, refetch } = useQuery<B2CTx[]>({
    queryKey: ["/api/payments/b2c", apiKey],
    queryFn: async () => {
      if (!apiKey) return [];
      const r = await fetch(`${API_BASE}/api/payments/b2c`, {
        headers: { "X-API-Key": apiKey },
      });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!apiKey,
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey) throw new Error("Enter your Secret API Key above to send B2C payments.");
      const r = await fetch(`${API_BASE}/api/payments/b2c`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          phoneNumber: phone,
          amount: Number(amount),
          remarks,
          occasion: occasion || undefined,
          commandId,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? data.error ?? "B2C request failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "B2C Payment Queued",
        description: `Conversation ID: ${data.conversationId}. M-Pesa will send the money shortly.`,
      });
      setPhone(""); setAmount(""); setRemarks(""); setOccasion("");
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "B2C Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem(KEY_STORAGE, val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !amount || !remarks) {
      toast({ title: "Missing fields", description: "Phone, amount and remarks are required.", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ArrowUpRight className="w-6 h-6 text-green-600" />
          B2C Payments
        </h2>
        <p className="text-muted-foreground mt-1">
          Send money directly from your M-Pesa shortcode to any customer's phone — refunds, salaries, commissions, promotions.
        </p>
      </div>

      {/* API Key Input */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-600" />
            Secret API Key
          </CardTitle>
          <CardDescription className="text-xs">Required for all B2C calls. Get your key from the API Keys section.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="password"
            placeholder="sk_live_..."
            value={apiKey}
            onChange={e => handleKeyChange(e.target.value)}
            className="font-mono text-sm bg-white"
          />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Send Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-green-600" />
              Send Money
            </CardTitle>
            <CardDescription>Funds are deducted from your M-Pesa shortcode balance.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="phone">Recipient Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="254712345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Format: 254XXXXXXXXX</p>
              </div>

              <div>
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="10"
                  placeholder="500"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum KES 10</p>
              </div>

              <div>
                <Label htmlFor="commandId">Payment Type</Label>
                <Select value={commandId} onValueChange={setCommandId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BusinessPayment">Business Payment</SelectItem>
                    <SelectItem value="SalaryPayment">Salary Payment</SelectItem>
                    <SelectItem value="PromotionPayment">Promotion Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Input
                  id="remarks"
                  placeholder="e.g. Invoice refund, March salary"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="occasion">
                  Occasion <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="occasion"
                  placeholder="e.g. End of month"
                  value={occasion}
                  onChange={e => setOccasion(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={sendMutation.isPending || !apiKey}
              >
                {sendMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Send B2C Payment</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info cards */}
        <div className="space-y-4">
          <Card className="border-green-100 bg-green-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">How it works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              {[
                ["Submit", "You send the request — Safaricom queues the transfer from your shortcode."],
                ["Processing", "M-Pesa processes the transfer. Status shows as Pending."],
                ["Confirmed", "Safaricom notifies us automatically. Status updates to Completed or Failed."],
              ].map(([title, desc], i) => (
                <div className="flex gap-3" key={title}>
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                  <p><strong>{title}</strong> — {desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Payment Types</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {[
                ["BusinessPayment", "Refunds, commissions, general disbursements"],
                ["SalaryPayment", "Staff wages — appears as salary on statement"],
                ["PromotionPayment", "Cashback, rewards, offers"],
              ].map(([name, desc]) => (
                <div key={name} className="flex gap-2 items-start">
                  <code className="text-xs bg-white border rounded px-1.5 py-0.5 shrink-0 mt-0.5">{name}</code>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-purple-100 bg-purple-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">B2C Setup</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-purple-800 space-y-1">
              <p>B2C requires two extra settings on the server:</p>
              <ul className="list-disc list-inside space-y-1 font-mono">
                <li>MPESA_INITIATOR_NAME</li>
                <li>MPESA_SECURITY_CREDENTIAL</li>
              </ul>
              <p className="mt-2 text-purple-700">Get these from your Daraja portal under <strong>B2C API</strong>. Contact your admin to configure them.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">B2C History</h3>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {!apiKey ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <KeyRound className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Enter your API key above to load your B2C history.</p>
            </CardContent>
          </Card>
        ) : txs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Send className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">No B2C payments yet. Send your first one above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Recipient</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Receipt</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {txs.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs">{tx.phoneNumber}</p>
                      {tx.receiverPartyPublicName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{tx.receiverPartyPublicName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">KES {Number(tx.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{tx.commandId}</code>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">
                      {tx.mpesaReceiptNumber ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
