import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, ShieldCheck, TrendingUp, Wallet, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { getAuthHeaders } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const API_BASE = "https://pay.makamesco-tech.co.ke";

interface AdminUser {
  id: number;
  email: string;
  businessName: string;
  mode: string;
  subscriptionType: string | null;
  subscriptionExpiresAt: string | null;
  sandboxTransactionsUsed: number;
  txCount: number;
  totalVolume: string;
  createdAt: string;
}

interface Withdrawal {
  id: number;
  amount: string;
  phone: string;
  status: string;
  note: string | null;
  processedAt: string | null;
  createdAt: string;
  userId: number;
  email: string;
  businessName: string;
}

interface WithdrawalDetail {
  withdrawal: Withdrawal;
  settlements: { id: number; accountType: string; accountNumber: string; accountName: string; isDefault: boolean }[];
}

function modeBadge(mode: string, sub: string | null, exp: string | null) {
  if (mode === "active") {
    const expired = exp && new Date(exp) < new Date();
    if (expired) return <Badge variant="destructive">Expired</Badge>;
    return <Badge className="bg-green-500 hover:bg-green-600">{sub === "yearly" ? "Active (Yearly)" : "Active (Monthly)"}</Badge>;
  }
  return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Sandbox</Badge>;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"withdrawals" | "users">("withdrawals");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const { data: stats } = useQuery<{
    totalTransactions: number;
    completedTransactions: number;
    totalVolume: string;
    walletBalance: string;
    walletAvailable: string;
    walletTxCount: number;
    totalWithdrawn: string;
  }>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/stats`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: withdrawals, isLoading: wLoading } = useQuery<Withdrawal[]>({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/withdrawals`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: users, isLoading: uLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/users`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: detail } = useQuery<WithdrawalDetail>({
    queryKey: ["admin-withdrawal-detail", detailId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/withdrawals/${detailId}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!detailId,
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "complete" | "reject" }) => {
      const r = await fetch(`${API_BASE}/api/admin/withdrawals/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ note }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (_, { action }) => {
      toast({ title: action === "complete" ? "Marked as complete" : "Withdrawal rejected" });
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setDetailId(null);
      setNote("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: async ({ userId, plan }: { userId: number; plan: string }) => {
      const r = await fetch(`${API_BASE}/api/admin/users/${userId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ plan }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast({ title: "User activated" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const r = await fetch(`${API_BASE}/api/admin/users/${userId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast({ title: "User returned to sandbox" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pending = withdrawals?.filter(w => w.status === "pending") ?? [];
  const processed = withdrawals?.filter(w => w.status !== "pending") ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Super Admin Panel</h2>
          <p className="text-muted-foreground text-sm">Manage users, withdrawals, and account activations</p>
        </div>
      </div>

      {/* Wallet Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-green-700" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Platform Wallet</span>
            </div>
            <div className="text-3xl font-bold text-green-800">
              KES {Number(stats?.walletBalance ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-green-700 mt-1">
              Available: KES {Number(stats?.walletAvailable ?? 0).toLocaleString()} · Withdrawn: KES {Number(stats?.totalWithdrawn ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-0.5">{stats?.walletTxCount ?? 0} platform-collected transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">All Transactions</span>
            </div>
            <div className="text-3xl font-bold">{stats?.completedTransactions ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total volume: KES {Number(stats?.totalVolume ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{stats?.totalTransactions ?? 0} total incl. pending/failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Merchant Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold">{pending.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Pending Withdrawals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold">{users?.length ?? 0}</div>
            <p className="text-sm text-muted-foreground mt-1">Total Merchants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold">{users?.filter(u => u.mode === "active").length ?? 0}</div>
            <p className="text-sm text-muted-foreground mt-1">Active Subscribers</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(["withdrawals", "users"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "withdrawals" ? `Withdrawals (${pending.length} pending)` : "Merchants"}
          </button>
        ))}
      </div>

      {/* Withdrawals Tab */}
      {tab === "withdrawals" && (
        <div className="space-y-4">
          <h3 className="font-semibold">Pending Withdrawals</h3>
          {wLoading && <Loader2 className="animate-spin" />}
          {!wLoading && pending.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-gray-50">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p>No pending withdrawals</p>
            </div>
          )}
          {pending.map(w => (
            <Card key={w.id} className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold">{w.businessName}</div>
                    <div className="text-sm text-muted-foreground">{w.email}</div>
                    <div className="text-sm">Amount: <strong className="text-green-700">KES {Number(w.amount).toLocaleString()}</strong></div>
                    <div className="text-sm">To: <strong>{w.phone}</strong></div>
                    <div className="text-xs text-muted-foreground">{format(new Date(w.createdAt), "MMM d, yyyy h:mm a")}</div>
                  </div>
                  <Button onClick={() => { setDetailId(w.id); setNote(""); }} size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {processed.length > 0 && (
            <>
              <h3 className="font-semibold mt-6">Processed</h3>
              {processed.map(w => (
                <Card key={w.id} className="opacity-70">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{w.businessName} — KES {Number(w.amount).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{w.email} · {format(new Date(w.createdAt), "MMM d")}</div>
                      </div>
                      <Badge variant={w.status === "completed" ? "default" : "destructive"}>
                        {w.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-3">
          {uLoading && <Loader2 className="animate-spin" />}
          {users?.map(u => (
            <Card key={u.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{u.businessName}</span>
                      {modeBadge(u.mode, u.subscriptionType, u.subscriptionExpiresAt)}
                    </div>
                    <div className="text-sm text-muted-foreground">{u.email}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {u.txCount} transactions · KES {Number(u.totalVolume).toLocaleString()} volume
                      {u.mode === "sandbox" && ` · ${u.sandboxTransactionsUsed}/2 sandbox used`}
                      {u.subscriptionExpiresAt && ` · expires ${format(new Date(u.subscriptionExpiresAt), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.mode === "sandbox" ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => activateMutation.mutate({ userId: u.id, plan: "monthly" })}
                          disabled={activateMutation.isPending}
                        >
                          Activate Monthly
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => activateMutation.mutate({ userId: u.id, plan: "yearly" })}
                          disabled={activateMutation.isPending}
                        >
                          Activate Yearly
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs"
                        onClick={() => revokeMutation.mutate(u.id)}
                        disabled={revokeMutation.isPending}
                      >
                        Revoke to Sandbox
                      </Button>
                    )}
                    <button onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)} className="p-1 text-muted-foreground">
                      {expandedUser === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expandedUser === u.id && (
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                    <div>Joined: {format(new Date(u.createdAt), "MMM d, yyyy")}</div>
                    <div>Plan: {u.subscriptionType ?? "None"}</div>
                    <div>Sandbox used: {u.sandboxTransactionsUsed}/2</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Withdrawal Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={open => { if (!open) { setDetailId(null); setNote(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Withdrawal Request</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div><strong>Business:</strong> {detail.withdrawal.businessName}</div>
                <div><strong>Email:</strong> {detail.withdrawal.email}</div>
                <div><strong>Amount:</strong> <span className="text-green-700 font-bold">KES {Number(detail.withdrawal.amount).toLocaleString()}</span></div>
                <div><strong>M-Pesa Phone:</strong> {detail.withdrawal.phone}</div>
                <div><strong>Requested:</strong> {format(new Date(detail.withdrawal.createdAt), "MMM d, yyyy h:mm a")}</div>
              </div>

              {detail.settlements.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Settlement Accounts</p>
                  {detail.settlements.map(s => (
                    <div key={s.id} className={`border rounded-lg p-3 text-sm flex justify-between items-center ${s.isDefault ? "border-green-400 bg-green-50" : ""}`}>
                      <div>
                        <div className="font-medium">{s.accountName}</div>
                        <div className="text-muted-foreground">{s.accountType.toUpperCase()} · {s.accountNumber}</div>
                      </div>
                      {s.isDefault && <Badge className="bg-green-500">Default</Badge>}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Note (optional)</label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Payment sent via M-Pesa B2B"
                  className="mt-1"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => completeMutation.mutate({ id: detailId!, action: "reject" })}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => completeMutation.mutate({ id: detailId!, action: "complete" })}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Mark Complete
                </Button>
              </DialogFooter>
            </div>
          ) : <Loader2 className="animate-spin mx-auto" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
