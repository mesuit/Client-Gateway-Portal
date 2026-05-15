import { useState, useEffect } from "react";
import { useGetDashboardStats, useListTransactions } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, ArrowUpRight, DollarSign, Percent, Wallet, ArrowDownToLine, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "https://pay.makamesco-tech.co.ke";

const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed": return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
    case "failed": return <Badge variant="destructive">Failed</Badge>;
    case "pending": return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pending</Badge>;
    case "cancelled": return <Badge variant="secondary">Cancelled</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface WalletBalance {
  totalCollected: string;
  totalWithdrawn: string;
  available: string;
  txCount: number;
}

interface CooldownStatus {
  inCooldown: boolean;
  nextAllowedAt: string | null;
  secondsRemaining: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: transactionsData, isLoading: txLoading } = useListTransactions({
    query: { queryKey: ["transactions", { limit: 5 }] },
  });

  const { data: wallet, refetch: refetchWallet } = useQuery<WalletBalance>({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/wallet/balance`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: cooldown, refetch: refetchCooldown } = useQuery<CooldownStatus>({
    queryKey: ["withdraw-cooldown"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/wallet/withdraw/cooldown`, { headers: getAuthHeaders() });
      if (!res.ok) return { inCooldown: false, nextAllowedAt: null, secondsRemaining: 0 };
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // Live countdown tick
  useEffect(() => {
    if (!cooldown?.inCooldown) { setCountdown(0); return; }
    setCountdown(cooldown.secondsRemaining);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          refetchCooldown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: string; phone: string }) => {
      const res = await fetch(`${API_BASE}/api/wallet/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.message || "Withdrawal failed"), { code: json.error, data: json });
      return json;
    },
    onSuccess: () => {
      refetchWallet();
      refetchCooldown();
      setWithdrawDone(true);
    },
    onError: (err: Error & { code?: string; data?: CooldownStatus }) => {
      if (err.code === "RATE_LIMITED" && err.data?.secondsRemaining) {
        refetchCooldown();
        setWithdrawOpen(false);
      }
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    },
  });

  const handleWithdraw = () => {
    const phone = withdrawPhone.replace(/\D/g, "");
    const formatted = phone.startsWith("254") ? phone : phone.startsWith("0") ? "254" + phone.slice(1) : "254" + phone;
    withdrawMutation.mutate({ amount: withdrawAmount, phone: formatted });
  };

  if (statsLoading || txLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const walletAvailable = Number(wallet?.available || 0);
  const walletCollected = Number(wallet?.totalCollected || 0);
  const inCooldown = cooldown?.inCooldown && countdown > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your M-Pesa payments and transactions.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {Number(stats?.totalVolume || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime processed volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Volume</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {Number(stats?.todayVolume || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats?.todayTransactions || 0} transactions today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTransactions?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.successfulTransactions || 0} successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">Of all processed transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Wallet */}
      {walletCollected > 0 && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Platform Wallet</CardTitle>
                  <CardDescription className="text-xs">Funds collected by Nexus Pay (no till configured)</CardDescription>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 self-start sm:self-auto">
                <Button
                  onClick={() => { setWithdrawOpen(true); setWithdrawDone(false); }}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                  disabled={walletAvailable < 10 || !!inCooldown}
                >
                  {inCooldown
                    ? <><Clock className="w-4 h-4" /> {formatCountdown(countdown)}</>
                    : <><ArrowDownToLine className="w-4 h-4" /> Withdraw</>
                  }
                </Button>
                {inCooldown && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Next withdrawal in {formatCountdown(countdown)}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { label: "Available", value: `KES ${walletAvailable.toLocaleString()}`, highlight: true },
                { label: "Total Collected", value: `KES ${walletCollected.toLocaleString()}` },
                { label: "Transactions", value: `${wallet?.txCount || 0}` },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`rounded-xl p-2 sm:p-3 text-center ${highlight ? "bg-green-600 text-white" : "bg-white/70 text-gray-700"}`}>
                  <div className={`text-base sm:text-xl font-bold break-all ${highlight ? "" : "text-gray-900"}`}>{value}</div>
                  <div className={`text-xs mt-0.5 ${highlight ? "text-green-100" : "text-gray-400"}`}>{label}</div>
                </div>
              ))}
            </div>
            {walletAvailable < 10 && !inCooldown && (
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Minimum withdrawal is KES 10
              </p>
            )}
            {inCooldown && cooldown?.nextAllowedAt && (
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                <Clock className="w-3 h-3" /> One withdrawal per hour. Available again at {format(new Date(cooldown.nextAllowedAt), "h:mm a")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* No wallet hint */}
      {walletCollected === 0 && wallet !== undefined && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
          <Wallet className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
          <div>
            <p className="font-semibold">All payments routed to your till</p>
            <p className="text-blue-600 text-xs mt-1">
              Every payment is going directly to your configured M-Pesa till. The platform wallet only shows funds when no till is configured.
            </p>
          </div>
        </div>
      )}

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Last 5 transactions across all channels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactionsData?.transactions?.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{tx.phoneNumber}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), "MMM d, h:mm a")}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold">KES {Number(tx.amount).toLocaleString()}</span>
                  {getStatusBadge(tx.status)}
                </div>
              </div>
            ))}
            {(!transactionsData?.transactions || transactionsData.transactions.length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-sm">No transactions yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={open => { setWithdrawOpen(open); if (!open) { setWithdrawDone(false); setWithdrawAmount(""); setWithdrawPhone(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Available: <strong>KES {walletAvailable.toLocaleString()}</strong> — a 2.5% platform fee is deducted and the net amount is sent via M-Pesa B2C.
            </DialogDescription>
          </DialogHeader>

          {withdrawDone ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <p className="font-bold text-lg">Withdrawal Requested!</p>
              <p className="text-sm text-muted-foreground">Your request has been received and will be processed to your M-Pesa number.</p>
              {withdrawAmount && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span>KES {Number(withdrawAmount).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (2.5%):</span><span className="text-red-600">- KES {(Number(withdrawAmount) * 0.025).toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold"><span>You receive:</span><span className="text-green-600">KES {(Number(withdrawAmount) * 0.975).toFixed(2)}</span></div>
                </div>
              )}
              <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Next withdrawal available in 1 hour
              </p>
              <Button onClick={() => setWithdrawOpen(false)} className="w-full mt-2">Done</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  max={walletAvailable}
                  min={10}
                />
                {withdrawAmount && Number(withdrawAmount) > walletAvailable && (
                  <p className="text-xs text-red-500">Exceeds available balance of KES {walletAvailable.toLocaleString()}</p>
                )}
                {withdrawAmount && Number(withdrawAmount) >= 10 && Number(withdrawAmount) <= walletAvailable && (
                  <p className="text-xs text-muted-foreground">
                    You receive: <strong className="text-green-600">KES {(Number(withdrawAmount) * 0.975).toFixed(2)}</strong> after 2.5% fee
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>M-Pesa Phone Number</Label>
                <Input
                  type="tel"
                  value={withdrawPhone}
                  onChange={e => setWithdrawPhone(e.target.value)}
                  placeholder="0712345678 or 254712345678"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleWithdraw}
                  disabled={
                    withdrawMutation.isPending ||
                    !withdrawAmount ||
                    !withdrawPhone ||
                    Number(withdrawAmount) < 10 ||
                    Number(withdrawAmount) > walletAvailable
                  }
                  className="bg-green-600 hover:bg-green-700"
                >
                  {withdrawMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Request Withdrawal
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
