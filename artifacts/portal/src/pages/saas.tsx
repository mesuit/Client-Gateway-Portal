import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Layers, Zap, CheckCircle2, Loader2, Copy, Pencil, Trash2, Plus,
  Building2, Calendar, RefreshCcw, ShieldCheck, Globe, Users, ArrowRight
} from "lucide-react";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "";

const PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    amount: 300,
    period: "/ month",
    savings: null,
    badge: null,
    popular: false,
  },
  {
    id: "yearly",
    label: "Yearly",
    amount: 1000,
    period: "/ year",
    savings: "Save KES 2,600",
    badge: "Best Value",
    popular: true,
  },
];

// ─── Activation Modal ──────────────────────────────────────────────────────────
function ActivateSaasModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState("monthly");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"choose" | "paying" | "done">("choose");
  const [amount, setAmount] = useState(300);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPoll(), []);

  const handlePay = async () => {
    const digits = phone.replace(/\D/g, "");
    const formatted = digits.startsWith("254") ? digits : digits.startsWith("0") ? "254" + digits.slice(1) : "254" + digits;
    if (formatted.length < 12) {
      toast({ title: "Invalid phone", description: "Enter a valid M-Pesa number", variant: "destructive" });
      return;
    }
    setStep("paying");
    try {
      const res = await fetch(`${API_BASE}/api/saas/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ plan, phone: formatted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to initiate payment");

      pollRef.current = setInterval(async () => {
        const sr = await fetch(`${API_BASE}/api/saas/activate/status/${data.checkoutRequestId}`, { headers: getAuthHeaders() });
        const sd = await sr.json();
        if (sd.status === "active") { stopPoll(); setStep("done"); }
        else if (sd.status === "failed") {
          stopPoll(); setStep("choose");
          toast({ title: "Payment failed", description: "M-Pesa payment was not completed.", variant: "destructive" });
        }
      }, 3000);
    } catch (err: any) {
      setStep("choose");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleClose = () => {
    stopPoll();
    if (step === "done") onSuccess();
    setStep("choose");
    setPhone("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" /> Activate SaaS Multi-Tenant
          </DialogTitle>
          <DialogDescription>
            Host multiple tenants under one merchant account. Each tenant gets a unique code for routing payments.
          </DialogDescription>
        </DialogHeader>

        {step === "done" ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <p className="text-xl font-bold">SaaS Activated!</p>
            <p className="text-sm text-muted-foreground">You can now create and manage tenants under your account.</p>
            <Button onClick={handleClose} className="w-full bg-purple-600 hover:bg-purple-700">
              Start Creating Tenants <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : step === "paying" ? (
          <div className="py-10 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto" />
            <p className="font-semibold">STK Push Sent!</p>
            <p className="text-sm text-muted-foreground">
              Check your phone and enter your M-Pesa PIN to pay <strong>KES {amount.toLocaleString()}</strong>.
            </p>
            <p className="text-xs text-muted-foreground animate-pulse">Waiting for payment confirmation…</p>
          </div>
        ) : (
          <div className="space-y-5 py-1">
            {/* Plan cards */}
            <div className="grid grid-cols-2 gap-3">
              {PLANS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPlan(p.id); setAmount(p.amount); }}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    plan === p.id ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-2.5 right-2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      {p.badge}
                    </span>
                  )}
                  <div className="text-xl font-bold">KES {p.amount.toLocaleString()}</div>
                  <div className="text-xs font-medium text-muted-foreground mt-0.5">{p.period}</div>
                  {p.savings && <div className="text-xs text-green-600 font-semibold mt-1">{p.savings}</div>}
                </button>
              ))}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label>M-Pesa Phone Number</Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">STK Push will be sent to this number</p>
            </div>

            {/* Feature list */}
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800 space-y-1">
              <p className="font-semibold mb-1.5">What you get:</p>
              <p>✓ Unlimited tenants under one merchant account</p>
              <p>✓ Unique tenant code per client for payment routing</p>
              <p>✓ Each tenant linked to its own settlement account</p>
              <p>✓ Single API key — pass <code className="bg-purple-100 px-1 rounded">tenantCode</code> per request</p>
            </div>

            <Button
              onClick={handlePay}
              disabled={!phone}
              className="w-full bg-purple-600 hover:bg-purple-700 h-11"
            >
              <Zap className="w-4 h-4 mr-2" />
              Pay KES {amount.toLocaleString()} & Activate SaaS
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Tenant Form Modal ─────────────────────────────────────────────────────────
function TenantModal({
  open, onClose, mode, initial, settlementAccounts,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initial?: { id: number; name: string; description?: string; settlementAccountId?: number | null };
  settlementAccounts: Array<{ id: number; accountName: string; accountType: string; accountNumber: string }>;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [settlementAccountId, setSettlementAccountId] = useState<string>(
    initial?.settlementAccountId ? String(initial.settlementAccountId) : "none"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setSettlementAccountId(initial?.settlementAccountId ? String(initial.settlementAccountId) : "none");
    }
  }, [open, initial]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        settlementAccountId: (settlementAccountId && settlementAccountId !== "none") ? Number(settlementAccountId) : null,
      };
      const url = mode === "create" ? `${API_BASE}/api/saas/tenants` : `${API_BASE}/api/saas/tenants/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      toast({ title: mode === "create" ? "Tenant created!" : "Tenant updated!" });
      qc.invalidateQueries({ queryKey: ["saas-tenants"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create New Tenant" : "Edit Tenant"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new tenant. A unique tenant code will be generated automatically."
              : "Update tenant details."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tenant Name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corporation"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description of this tenant"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Settlement Account <span className="text-muted-foreground text-xs">(optional)</span></Label>
            {settlementAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground border rounded-md p-3">
                No settlement accounts found. Add one in the Settlement page first.
              </p>
            ) : (
              <Select value={settlementAccountId} onValueChange={setSettlementAccountId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select settlement account…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (no routing override)</SelectItem>
                  {settlementAccounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.accountName} — {a.accountType} {a.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Payments with this tenant's code will settle to the selected account.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {mode === "create" ? "Create Tenant" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Saas() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activateOpen, setActivateOpen] = useState(false);
  const [tenantModal, setTenantModal] = useState<{ open: boolean; mode: "create" | "edit"; tenant?: any }>({
    open: false, mode: "create",
  });

  const { data: saasStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["saas-status"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/saas/status`, { headers: getAuthHeaders() });
      return res.json() as Promise<{ active: boolean; subscription: any }>;
    },
  });

  const { data: tenants = [], isLoading: tenantsLoading, refetch: refetchTenants } = useQuery({
    queryKey: ["saas-tenants"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/saas/tenants`, { headers: getAuthHeaders() });
      return res.json() as Promise<any[]>;
    },
    enabled: saasStatus?.active === true,
  });

  const { data: settlementAccounts = [] } = useQuery({
    queryKey: ["settlement-accounts-saas"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/settlement`, { headers: getAuthHeaders() });
      return res.json() as Promise<any[]>;
    },
    enabled: saasStatus?.active === true,
  });

  const deleteTenant = async (id: number, name: string) => {
    if (!confirm(`Delete tenant "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/saas/tenants/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Tenant deleted" });
      qc.invalidateQueries({ queryKey: ["saas-tenants"] });
    } catch {
      toast({ title: "Failed to delete tenant", variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: code });
  };

  const isSaasActive = saasStatus?.active === true;
  const sub = saasStatus?.subscription;

  const expiryDate = sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : null;
  const daysLeft = sub?.expiresAt ? Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86400000) : null;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Layers className="w-7 h-7 text-purple-600" />
            <h1 className="text-2xl font-bold">SaaS Multi-Tenant</h1>
            {isSaasActive ? (
              <Badge className="bg-purple-600 hover:bg-purple-700 text-white">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Not Subscribed</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Host multiple clients (tenants) under one merchant account. Each tenant gets a unique code for automatic payment routing.
          </p>
        </div>
        {isSaasActive && (
          <Button onClick={() => setTenantModal({ open: true, mode: "create" })} className="bg-purple-600 hover:bg-purple-700 shrink-0">
            <Plus className="w-4 h-4 mr-2" /> Add Tenant
          </Button>
        )}
      </div>

      {/* ── Subscription Status Card (active) ── */}
      {isSaasActive && sub && (
        <Card className="border-purple-200 bg-purple-50/40">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Plan</p>
                  <p className="font-semibold capitalize">{sub.plan}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Expires</p>
                  <p className="font-semibold">{expiryDate}</p>
                </div>
              </div>
              {daysLeft !== null && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Days Left</p>
                  <p className={`font-semibold ${daysLeft < 7 ? "text-red-600" : "text-green-700"}`}>{daysLeft} days</p>
                </div>
              )}
              <div className="ml-auto">
                <Button variant="outline" size="sm" onClick={() => setActivateOpen(true)} className="border-purple-300 text-purple-700 hover:bg-purple-100">
                  <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Renew / Upgrade
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pricing + Activation (not subscribed) ── */}
      {!isSaasActive && (
        <div className="space-y-6">
          {/* Feature list */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Users, title: "Unlimited Tenants", desc: "Create as many tenants (clients) as you need under one account." },
              { icon: Globe, title: "Unique Tenant Codes", desc: "Each tenant gets a unique code like tnnt_abc123 for API routing." },
              { icon: Building2, title: "Per-Tenant Settlement", desc: "Each tenant's payments settle directly to their own till or paybill." },
            ].map(f => (
              <Card key={f.title} className="border-gray-200">
                <CardContent className="pt-5">
                  <f.icon className="w-8 h-8 text-purple-500 mb-3" />
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            {PLANS.map(p => (
              <Card key={p.id} className={`relative border-2 ${p.popular ? "border-purple-400 bg-purple-50/50" : "border-gray-200"}`}>
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    {p.badge}
                  </span>
                )}
                <CardContent className="pt-6 pb-4 text-center">
                  <p className="text-sm font-semibold text-muted-foreground capitalize">{p.label}</p>
                  <p className="text-4xl font-black mt-1">KES {p.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{p.period}</p>
                  {p.savings && <p className="text-xs text-green-600 font-semibold mt-1">{p.savings}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 px-8"
            onClick={() => setActivateOpen(true)}
          >
            <Zap className="w-5 h-5 mr-2" /> Activate SaaS — from KES 300/month
          </Button>
        </div>
      )}

      {/* ── Tenant Table (active) ── */}
      {isSaasActive && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Tenants</h2>
            <span className="text-sm text-muted-foreground">{tenants.length} tenant{tenants.length !== 1 ? "s" : ""}</span>
          </div>

          {tenantsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading tenants…
            </div>
          ) : tenants.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200">
              <CardContent className="py-12 text-center space-y-3">
                <Layers className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="font-semibold text-gray-500">No tenants yet</p>
                <p className="text-sm text-muted-foreground">Create your first tenant to start routing payments to separate settlement accounts.</p>
                <Button
                  onClick={() => setTenantModal({ open: true, mode: "create" })}
                  className="bg-purple-600 hover:bg-purple-700 mt-2"
                >
                  <Plus className="w-4 h-4 mr-2" /> Create First Tenant
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tenants.map((t: any) => (
                <Card key={t.id} className={`border ${t.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                  <CardContent className="py-4 px-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Tenant info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{t.name}</span>
                          {!t.isActive && <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>}
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                        )}

                        {/* Tenant code chip */}
                        <button
                          onClick={() => copyCode(t.tenantCode)}
                          className="mt-2 inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-800 text-xs font-mono rounded px-2 py-1 hover:bg-purple-100 transition-colors"
                          title="Click to copy"
                        >
                          <span>{t.tenantCode}</span>
                          <Copy className="w-3 h-3 opacity-60" />
                        </button>
                      </div>

                      {/* Settlement account */}
                      <div className="shrink-0 text-sm text-muted-foreground">
                        {t.settlementAccountId ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-green-600" />
                            <span>{t.settlementAccountName ?? "—"}</span>
                            <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{t.settlementAccountType} {t.settlementAccountNumber}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600">No settlement account set</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-gray-800"
                          onClick={() => setTenantModal({ open: true, mode: "edit", tenant: t })}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600"
                          onClick={() => deleteTenant(t.id, t.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── How to use via API (active only) ── */}
      {isSaasActive && (
        <Card className="border-gray-200 bg-gray-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Using Tenant Codes in Your API Calls</CardTitle>
            <CardDescription>
              Pass <code className="bg-gray-200 rounded px-1">tenantCode</code> in the STK Push request body. The payment settles to that tenant's settlement account automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* cURL */}
            <div className="rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">cURL</div>
              <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto leading-relaxed">{`curl -X POST ${API_BASE}/api/payments/stkpush \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SECRET_KEY" \\
  -d '{
    "phoneNumber": "254712345678",
    "amount": 500,
    "accountReference": "INV-001",
    "transactionDesc": "Order Payment",
    "tenantCode": "tnnt_abc12345"
  }'`}
              </pre>
            </div>

            {/* Node.js */}
            <div className="rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 font-mono">Node.js / JavaScript</div>
              <pre className="bg-gray-900 text-green-300 text-xs p-4 overflow-x-auto leading-relaxed">{`const res = await fetch('${API_BASE}/api/payments/stkpush', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    phoneNumber: '254712345678',
    amount: 500,
    accountReference: 'INV-001',
    transactionDesc: 'Order Payment',
    tenantCode: 'tnnt_abc12345'   // ← copy from the tenant card above
  })
});

const data = await res.json();
// data.checkoutRequestId — poll /api/payments/status/:id to confirm`}
              </pre>
            </div>

            <p className="text-xs text-muted-foreground">
              Your merchant API key is used for authentication. The <code className="bg-gray-100 rounded px-1">tenantCode</code> determines which settlement account receives the funds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Modals ── */}
      <ActivateSaasModal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        onSuccess={() => {
          setActivateOpen(false);
          refetchStatus();
          refetchTenants();
        }}
      />

      <TenantModal
        open={tenantModal.open}
        onClose={() => setTenantModal({ open: false, mode: "create" })}
        mode={tenantModal.mode}
        initial={tenantModal.tenant}
        settlementAccounts={settlementAccounts}
      />
    </div>
  );
}
