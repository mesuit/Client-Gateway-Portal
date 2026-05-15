import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ShieldCheck, BarChart3, Wallet, Settings, Shield, Eye, EyeOff,
  AlertTriangle, RefreshCw, Trash2, Save, KeyRound, Radio,
  Search, Activity, Zap, TrendingUp, ArrowUpCircle,
} from "lucide-react";
import { format } from "date-fns";
import { getAuthHeaders } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "https://pay.makamesco-tech.co.ke";

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

interface SettingRow {
  key: string;
  value: string | null;
  masked: boolean;
  updatedAt: string | null;
}

interface SecurityEvent {
  id: number;
  eventType: string;
  severity: string;
  description: string;
  ipAddress: string | null;
  userId: number | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AdminTransaction {
  id: number;
  type: "stk" | "b2c" | "pesapal";
  merchantId: number | null;
  merchantEmail: string | null;
  merchantName: string | null;
  phone: string | null;
  amount: string;
  status: string;
  receipt: string | null;
  description: string | null;
  createdAt: string;
  flags: string[];
}

function modeBadge(mode: string, sub: string | null, exp: string | null) {
  if (mode === "active") {
    const expired = exp && new Date(exp) < new Date();
    if (expired) return <Badge variant="destructive">Expired</Badge>;
    return <Badge className="bg-green-500 hover:bg-green-600">{sub === "yearly" ? "Active (Yearly)" : "Active (Monthly)"}</Badge>;
  }
  return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Sandbox</Badge>;
}

function severityBadge(severity: string) {
  const classes: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-500 text-white",
    low: "bg-gray-200 text-gray-700",
  };
  return <Badge className={`text-xs ${classes[severity] ?? "bg-gray-200"}`}>{severity.toUpperCase()}</Badge>;
}

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    failed_login: "Failed Login",
    invalid_api_key: "Invalid API Key",
    unauthorized_admin: "Unauthorized Admin",
    suspicious_activity: "Suspicious Activity",
  };
  return labels[type] ?? type;
}

const SETTING_LABELS: Record<string, { label: string; placeholder: string; sensitive: boolean; group: string }> = {
  mpesa_consumer_key: { label: "M-Pesa Consumer Key", placeholder: "Consumer key from Daraja portal", sensitive: false, group: "STK Push (C2B)" },
  mpesa_consumer_secret: { label: "M-Pesa Consumer Secret", placeholder: "Consumer secret from Daraja portal", sensitive: true, group: "STK Push (C2B)" },
  mpesa_passkey: { label: "M-Pesa Passkey", placeholder: "Paybill passkey from Daraja portal", sensitive: true, group: "STK Push (C2B)" },
  mpesa_shortcode: { label: "M-Pesa Shortcode (Paybill)", placeholder: "e.g. 174379", sensitive: false, group: "STK Push (C2B)" },
  b2c_consumer_key: { label: "B2C Consumer Key", placeholder: "Leave blank to use STK Push key", sensitive: false, group: "B2C (Send Money)" },
  b2c_consumer_secret: { label: "B2C Consumer Secret", placeholder: "Leave blank to use STK Push secret", sensitive: true, group: "B2C (Send Money)" },
  b2c_shortcode: { label: "B2C Shortcode", placeholder: "Leave blank to use STK Push shortcode", sensitive: false, group: "B2C (Send Money)" },
  mpesa_initiator_name: { label: "Initiator Name", placeholder: "API operator username from Daraja", sensitive: false, group: "B2C (Send Money)" },
  mpesa_security_credential: { label: "Security Credential (encrypted)", placeholder: "Pre-encrypted credential (recommended)", sensitive: true, group: "B2C (Send Money)" },
  mpesa_initiator_password: { label: "Initiator Password (plaintext)", placeholder: "Will be encrypted automatically", sensitive: true, group: "B2C (Send Money)" },
  callback_base_url: { label: "Callback Base URL", placeholder: "e.g. https://pay.makamesco-tech.co.ke", sensitive: false, group: "General" },
};

const SETTING_GROUPS = ["General", "STK Push (C2B)", "B2C (Send Money)"];

function typeBadge(type: "stk" | "b2c" | "pesapal") {
  if (type === "stk") return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">STK Push</span>;
  if (type === "b2c") return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700"><Zap className="w-3 h-3" />B2C</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Card/Airtel</span>;
}

function txStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    cancelled: "bg-gray-100 text-gray-600",
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

function TransactionsTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "stk" | "b2c" | "pesapal">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const { data: allTxs, isLoading, refetch, isFetching } = useQuery<AdminTransaction[]>({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/transactions?limit=500`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load transactions");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const stats = useMemo(() => {
    const all = allTxs ?? [];
    const done = (list: AdminTransaction[]) => list.filter(t => t.status === "completed").reduce((s, t) => s + Number(t.amount), 0);
    const stk = all.filter(t => t.type === "stk");
    const b2c = all.filter(t => t.type === "b2c");
    const pp = all.filter(t => t.type === "pesapal");
    return {
      stkCount: stk.length, stkVolume: done(stk),
      b2cCount: b2c.length, b2cVolume: done(b2c),
      ppCount: pp.length, ppVolume: done(pp),
      total: all.length,
    };
  }, [allTxs]);

  const filtered = useMemo(() => {
    let txs = allTxs ?? [];
    if (typeFilter !== "all") txs = txs.filter(t => t.type === typeFilter);
    if (statusFilter !== "all") txs = txs.filter(t => t.status === statusFilter);
    if (showFlaggedOnly) txs = txs.filter(t => t.flags.length > 0);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      txs = txs.filter(t =>
        t.phone?.toLowerCase().includes(q) ||
        t.receipt?.toLowerCase().includes(q) ||
        t.merchantEmail?.toLowerCase().includes(q) ||
        t.merchantName?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    return txs;
  }, [allTxs, typeFilter, statusFilter, search, showFlaggedOnly]);

  const flagged = useMemo(() => (allTxs ?? []).filter(t => t.flags.length > 0), [allTxs]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Transaction Monitor
          </h3>
          <p className="text-sm text-muted-foreground">Every transaction across all merchant accounts — STK Push, B2C, and Card/Airtel. Refreshes every 60s.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "stk" as const, label: "STK Push", count: stats.stkCount, volume: stats.stkVolume, color: "green" },
          { key: "b2c" as const, label: "B2C Send", count: stats.b2cCount, volume: stats.b2cVolume, color: "purple" },
          { key: "pesapal" as const, label: "Card / Airtel", count: stats.ppCount, volume: stats.ppVolume, color: "blue" },
        ].map(({ key, label, count, volume, color }) => (
          <Card
            key={key}
            onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
            className={`cursor-pointer border-2 transition-all ${typeFilter === key ? `border-${color}-500 bg-${color}-50` : "border-transparent hover:border-gray-200"}`}
          >
            <CardContent className="pt-4 pb-3">
              <div className={`text-xs font-semibold uppercase tracking-wide text-${color}-700 mb-1`}>{label}</div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground mt-0.5">KES {volume.toLocaleString()} completed</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {flagged.length > 0 && (
        <button
          onClick={() => setShowFlaggedOnly(v => !v)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
            showFlaggedOnly ? "bg-red-50 border-red-400" : "bg-red-50/60 border-red-200 hover:bg-red-50"
          }`}
        >
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-red-700 text-sm">{flagged.length} suspicious transaction{flagged.length > 1 ? "s" : ""} flagged</span>
            <span className="text-red-500 text-xs ml-2">
              {showFlaggedOnly ? "Showing flagged only — click to clear" : "Large amounts, repeated failures, rapid succession · Click to filter"}
            </span>
          </div>
          <Badge className="bg-red-500 text-white">{flagged.length}</Badge>
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 text-sm h-9"
            placeholder="Search phone, receipt, merchant…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: "all", label: "All Types" },
            { key: "stk", label: "STK Push" },
            { key: "b2c", label: "B2C" },
            { key: "pesapal", label: "Card/Airtel" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key as typeof typeFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === key ? "bg-primary text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 bg-white h-9"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Showing {filtered.length} of {stats.total} transactions
        {showFlaggedOnly && <span className="ml-1 text-red-500 font-medium">· filtered to flagged only</span>}
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="animate-spin w-4 h-4" /> Loading transactions…
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center text-muted-foreground gap-2">
          <BarChart3 className="w-10 h-10 text-gray-300" />
          <p className="font-medium">No transactions found</p>
          <p className="text-sm">Try clearing the filters or search.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-muted-foreground text-left">
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Merchant</th>
                <th className="px-3 py-2.5 font-medium">Phone</th>
                <th className="px-3 py-2.5 font-medium">Amount</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Receipt / Ref</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(tx => (
                <tr
                  key={`${tx.type}-${tx.id}`}
                  className={`hover:bg-gray-50/80 ${
                    tx.flags.includes("repeated_failure") ? "bg-red-50/50" :
                    tx.flags.includes("rapid_succession") ? "bg-orange-50/50" :
                    tx.flags.includes("large_amount") ? "bg-yellow-50/40" : ""
                  }`}
                >
                  <td className="px-3 py-2">{typeBadge(tx.type)}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs font-medium leading-tight">{tx.merchantName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground leading-tight">{tx.merchantEmail ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{tx.phone ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold text-xs whitespace-nowrap">
                    KES {Number(tx.amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2">{txStatusBadge(tx.status)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[130px] truncate" title={tx.receipt ?? undefined}>
                    {tx.receipt ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(tx.createdAt), "MMM d, HH:mm")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      {tx.flags.includes("large_amount") && (
                        <span className="text-yellow-700 text-xs font-semibold bg-yellow-100 px-1.5 py-0.5 rounded whitespace-nowrap">💰 Large</span>
                      )}
                      {tx.flags.includes("repeated_failure") && (
                        <span className="text-red-700 text-xs font-semibold bg-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">🚨 Repeat Fail</span>
                      )}
                      {tx.flags.includes("rapid_succession") && (
                        <span className="text-orange-700 text-xs font-semibold bg-orange-100 px-1.5 py-0.5 rounded whitespace-nowrap">⚡ Rapid</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Withdrawal History section */}
      <WithdrawalHistorySection />
    </div>
  );
}

function WithdrawalHistorySection() {
  const { data: allWithdrawals, isLoading } = useQuery<Withdrawal[]>({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/withdrawals`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const items = allWithdrawals ?? [];
  const recentProcessed = items.filter(w => w.status !== "pending").slice(0, 20);

  return (
    <div className="mt-8 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="w-4 h-4 text-purple-600" />
        <h3 className="font-semibold text-sm">Withdrawal History</h3>
        <span className="text-xs text-muted-foreground">({items.length} total, {items.filter(w => w.status === "pending").length} pending)</span>
      </div>
      {isLoading && <Loader2 className="animate-spin w-4 h-4 text-muted-foreground" />}
      {!isLoading && recentProcessed.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center border rounded-xl bg-gray-50">No processed withdrawals yet.</p>
      )}
      {recentProcessed.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-muted-foreground text-left">
                <th className="px-3 py-2 font-medium">Merchant</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentProcessed.map(w => (
                <tr key={w.id} className="hover:bg-gray-50/80">
                  <td className="px-3 py-2">
                    <div className="font-medium">{w.businessName}</div>
                    <div className="text-muted-foreground">{w.email}</div>
                  </td>
                  <td className="px-3 py-2 font-semibold">KES {Number(w.amount).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono">{w.phone}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${w.status === "completed" ? "bg-green-100 text-green-700" : w.status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">
                    {w.note ? (
                      <span className={w.note.startsWith("PROFIT:") ? "text-purple-600 font-semibold" : ""}>{w.note}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{format(new Date(w.createdAt), "MMM d, HH:mm")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});

  const { data: settings, isLoading } = useQuery<SettingRow[]>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/settings`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load settings");
      return r.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const r = await fetch(`${API_BASE}/api/admin/settings`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      toast({ title: "Settings saved", description: data.message });
      setEdits({});
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function getValue(key: string): string {
    if (key in edits) return edits[key];
    const row = settings?.find(s => s.key === key);
    if (row?.masked) return "";
    return row?.value ?? "";
  }

  function handleChange(key: string, val: string) {
    setEdits(prev => ({ ...prev, [key]: val }));
  }

  function hasChanges() {
    return Object.values(edits).some(v => v !== "");
  }

  function handleSave() {
    const toSave: Record<string, string> = {};
    for (const [k, v] of Object.entries(edits)) {
      if (v.trim()) toSave[k] = v.trim();
    }
    if (Object.keys(toSave).length === 0) {
      toast({ title: "No changes", description: "Enter values to save.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(toSave);
  }

  if (isLoading) return <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="animate-spin w-4 h-4" /> Loading settings…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">System Settings</h3>
          <p className="text-sm text-muted-foreground">Configure M-Pesa credentials. Settings are stored in the database and take effect within 30 seconds.</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges() || saveMutation.isPending} className="bg-green-600 hover:bg-green-700 gap-2">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {SETTING_GROUPS.map(group => {
        const keys = Object.entries(SETTING_LABELS).filter(([, meta]) => meta.group === group).map(([k]) => k);
        return (
          <Card key={group}>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                {group === "General" ? <Radio className="w-4 h-4 text-blue-600" /> :
                  group === "STK Push (C2B)" ? <KeyRound className="w-4 h-4 text-green-600" /> :
                    <Shield className="w-4 h-4 text-purple-600" />}
                <span className="font-semibold text-sm">{group}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keys.map(key => {
                  const meta = SETTING_LABELS[key];
                  const dbRow = settings?.find(s => s.key === key);
                  const isSensitive = meta.sensitive;
                  const isRevealed = showSensitive[key];
                  const currentValue = getValue(key);
                  const hasDbValue = !!dbRow?.value;
                  const isEdited = key in edits && edits[key] !== "";

                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">{meta.label}</Label>
                        <div className="flex items-center gap-1.5">
                          {hasDbValue && !isEdited && (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Set
                            </span>
                          )}
                          {isSensitive && (
                            <button
                              type="button"
                              onClick={() => setShowSensitive(p => ({ ...p, [key]: !isRevealed }))}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                      <Input
                        type={isSensitive && !isRevealed ? "password" : "text"}
                        placeholder={dbRow?.masked ? "•••••••• (already set — enter to replace)" : meta.placeholder}
                        value={currentValue}
                        onChange={e => handleChange(key, e.target.value)}
                        className={`text-sm font-mono ${isEdited ? "border-blue-400 ring-1 ring-blue-200" : ""}`}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
        <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Important Notes</p>
        <p>• Settings override environment variables within 30 seconds (no restart needed).</p>
        <p>• Leave B2C fields blank to fall back to STK Push credentials.</p>
        <p>• For Security Credential: either provide the pre-encrypted value, or the plaintext initiator password (it will be auto-encrypted using Safaricom's public certificate).</p>
        <p>• Callback Base URL only needed if automatic detection fails on your server.</p>
      </div>
    </div>
  );
}

function SecurityTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: events, isLoading, refetch, isFetching } = useQuery<SecurityEvent[]>({
    queryKey: ["admin-security-events"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/security-events?limit=200`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load security events");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/security-events`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast({ title: "Cleared", description: "Security events have been cleared." });
      qc.invalidateQueries({ queryKey: ["admin-security-events"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const counts = {
    critical: events?.filter(e => e.severity === "critical").length ?? 0,
    high: events?.filter(e => e.severity === "high").length ?? 0,
    medium: events?.filter(e => e.severity === "medium").length ?? 0,
    low: events?.filter(e => e.severity === "low").length ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Security Alerts</h3>
          <p className="text-sm text-muted-foreground">Real-time log of failed logins, invalid API keys, and unauthorized access attempts. Refreshes every 30s.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {(events?.length ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Critical", key: "critical", color: "bg-red-50 border-red-200 text-red-700" },
          { label: "High", key: "high", color: "bg-orange-50 border-orange-200 text-orange-700" },
          { label: "Medium", key: "medium", color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
          { label: "Low", key: "low", color: "bg-gray-50 border-gray-200 text-gray-600" },
        ].map(({ label, key, color }) => (
          <Card key={key} className={`border ${color.includes("border") ? color.split(" ").find(c => c.startsWith("border")) : ""}`}>
            <CardContent className={`pt-4 pb-3 ${color}`}>
              <div className="text-2xl font-bold">{counts[key as keyof typeof counts]}</div>
              <div className="text-xs font-medium mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="animate-spin w-4 h-4" /> Loading events…</div>}

      {!isLoading && (events?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center py-16 text-center text-muted-foreground gap-2">
          <ShieldCheck className="w-10 h-10 text-green-500" />
          <p className="font-medium">No security events</p>
          <p className="text-sm">The system looks clean. Events will appear here if suspicious activity is detected.</p>
        </div>
      )}

      {(events?.length ?? 0) > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-muted-foreground text-left">
                <th className="px-3 py-2.5 font-medium">Severity</th>
                <th className="px-3 py-2.5 font-medium">Event Type</th>
                <th className="px-3 py-2.5 font-medium">Description</th>
                <th className="px-3 py-2.5 font-medium">IP Address</th>
                <th className="px-3 py-2.5 font-medium">User / Email</th>
                <th className="px-3 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events?.map(ev => (
                <tr key={ev.id} className={`hover:bg-gray-50 ${ev.severity === "critical" ? "bg-red-50" : ev.severity === "high" ? "bg-orange-50/40" : ""}`}>
                  <td className="px-3 py-2">{severityBadge(ev.severity)}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs font-mono bg-gray-100 rounded px-1.5 py-0.5">{eventTypeLabel(ev.eventType)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs max-w-xs">{ev.description}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{ev.ipAddress ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{ev.email ?? (ev.userId ? `#${ev.userId}` : "—")}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(ev.createdAt), "MMM d, HH:mm:ss")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"withdrawals" | "users" | "transactions" | "settings" | "security">("withdrawals");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [profitOpen, setProfitOpen] = useState(false);
  const [profitPhone, setProfitPhone] = useState("");
  const [profitNote, setProfitNote] = useState("");
  const [profitAmount, setProfitAmount] = useState("");

  const { data: profit, refetch: refetchProfit } = useQuery<{
    activationFees: string;
    b2cFees: string;
    pesapalFees: string;
    withdrawalFees: string;
    saasRevenue: string;
    totalProfit: string;
    profitWithdrawn: string;
    profitAvailable: string;
  }>({
    queryKey: ["admin-profit"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/profit`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const withdrawProfitMutation = useMutation({
    mutationFn: async ({ amount, phone, note: wNote }: { amount: string; phone: string; note: string }) => {
      const r = await fetch(`${API_BASE}/api/admin/withdraw-profit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ amount, phone, note: wNote }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      toast({
        title: data?.autoProcessed ? "B2C initiated" : "Withdrawal queued",
        description: data?.autoProcessed
          ? "M-Pesa B2C disbursement has been initiated automatically."
          : "Queued for manual processing.",
      });
      setProfitOpen(false);
      setProfitPhone("");
      setProfitAmount("");
      setProfitNote("");
      refetchProfit();
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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

  const TABS = [
    { key: "withdrawals", label: `Withdrawals (${pending.length} pending)`, icon: null },
    { key: "users", label: "Merchants", icon: null },
    { key: "transactions", label: "Transactions", icon: <Activity className="w-3.5 h-3.5" /> },
    { key: "settings", label: "Settings", icon: <Settings className="w-3.5 h-3.5" /> },
    { key: "security", label: "Security", icon: <Shield className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Super Admin Panel</h2>
          <p className="text-muted-foreground text-sm">Manage users, withdrawals, system settings, and security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-green-700" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Platform Wallet</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-green-400 text-green-700 hover:bg-green-100 gap-1"
                onClick={() => {
                  setProfitAmount(profit?.profitAvailable ?? "");
                  setProfitOpen(true);
                }}
              >
                <TrendingUp className="w-3 h-3" /> Withdraw Profit
              </Button>
            </div>
            <div className="text-3xl font-bold text-green-800">
              KES {Number(stats?.walletBalance ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-green-700 mt-1">
              Available: KES {Number(stats?.walletAvailable ?? 0).toLocaleString()} · Withdrawn: KES {Number(stats?.totalWithdrawn ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-0.5">{stats?.walletTxCount ?? 0} platform-collected transactions</p>
            {profit && (
              <div className="mt-2 pt-2 border-t border-green-200">
                <p className="text-xs text-green-700 font-semibold">
                  Platform Profit: KES {Number(profit.profitAvailable).toLocaleString(undefined, { minimumFractionDigits: 2 })} available
                </p>
                <p className="text-xs text-green-600">
                  Total earned: KES {Number(profit.totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })} · Withdrawn: KES {Number(profit.profitWithdrawn).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
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

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
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

      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

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
                  <Button onClick={() => { setDetailId(w.id); setNote(""); }} size="sm">View Details</Button>
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
                      <Badge variant={w.status === "completed" ? "default" : "destructive"}>{w.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

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
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => activateMutation.mutate({ userId: u.id, plan: "monthly" })} disabled={activateMutation.isPending}>Activate Monthly</Button>
                        <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700" onClick={() => activateMutation.mutate({ userId: u.id, plan: "yearly" })} disabled={activateMutation.isPending}>Activate Yearly</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => revokeMutation.mutate(u.id)} disabled={revokeMutation.isPending}>Revoke to Sandbox</Button>
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

      {tab === "transactions" && <TransactionsTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "security" && <SecurityTab />}

      {/* Profit Withdrawal Dialog */}
      <Dialog open={profitOpen} onOpenChange={open => { if (!open) setProfitOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" /> Withdraw Platform Profit
            </DialogTitle>
          </DialogHeader>
          {profit && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="font-semibold text-green-800 mb-2">Profit Breakdown</div>
                <div className="flex justify-between text-green-700">
                  <span>Activation fees:</span>
                  <span className="font-medium">KES {Number(profit.activationFees).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>B2C service fees:</span>
                  <span className="font-medium">KES {Number(profit.b2cFees).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Card/Airtel platform fees:</span>
                  <span className="font-medium">KES {Number(profit.pesapalFees).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Withdrawal fees (2.5%):</span>
                  <span className="font-medium">KES {Number(profit.withdrawalFees).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {Number(profit.saasRevenue) > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>SaaS subscriptions:</span>
                    <span className="font-medium">KES {Number(profit.saasRevenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t border-green-300 pt-1.5 flex justify-between font-bold text-green-800">
                  <span>Available to withdraw:</span>
                  <span>KES {Number(profit.profitAvailable).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  value={profitAmount}
                  onChange={e => setProfitAmount(e.target.value)}
                  max={profit.profitAvailable}
                  placeholder={`Max: ${profit.profitAvailable}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Your M-Pesa Phone</Label>
                <Input
                  type="tel"
                  value={profitPhone}
                  onChange={e => setProfitPhone(e.target.value)}
                  placeholder="254712345678"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Input
                  value={profitNote}
                  onChange={e => setProfitNote(e.target.value)}
                  placeholder="e.g. Monthly profit withdrawal"
                />
              </div>
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                The system will automatically disburse via M-Pesa B2C if configured. No platform fee is deducted — you receive the full amount.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProfitOpen(false)}>Cancel</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 gap-2"
                  onClick={() => withdrawProfitMutation.mutate({ amount: profitAmount, phone: profitPhone, note: profitNote })}
                  disabled={withdrawProfitMutation.isPending || !profitAmount || !profitPhone}
                >
                  {withdrawProfitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Withdraw Profit
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Payment sent via M-Pesa B2B" className="mt-1" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="destructive" onClick={() => completeMutation.mutate({ id: detailId!, action: "reject" })} disabled={completeMutation.isPending}>
                  {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />} Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => completeMutation.mutate({ id: detailId!, action: "complete" })} disabled={completeMutation.isPending}>
                  {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Mark Complete
                </Button>
              </DialogFooter>
            </div>
          ) : <Loader2 className="animate-spin mx-auto" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
