import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Receipt, KeyRound, Building2, BookOpen, LogOut, Loader2, Link2, Smartphone, Zap, CheckCircle2, AlertTriangle, Menu, X, ArrowUpRight, CreditCard, FlaskConical, Layers, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getAuthHeaders } from "@/hooks/use-auth";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "https://pay.makamesco-tech.co.ke";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, nexusOnly: false },
  { href: "/transactions", label: "Transactions", icon: Receipt, nexusOnly: false },
  { href: "/api-keys", label: "API Keys", icon: KeyRound, nexusOnly: false },
  { href: "/settlement", label: "Settlement", icon: Building2, nexusOnly: false },
  { href: "/payment-links", label: "Payment Links", icon: Link2, nexusOnly: false },
  { href: "/card", label: "Card & Airtel Pay", icon: CreditCard, nexusOnly: false },
  { href: "/card-test", label: "Test Card & Airtel Pay", icon: FlaskConical, nexusOnly: false },
  { href: "/b2c", label: "B2C Payments", icon: ArrowUpRight, nexusOnly: false },
  { href: "/saas", label: "SaaS Multi-Tenant", icon: Layers, nexusOnly: true },
  { href: "/test", label: "STK Push Tester", icon: Smartphone, nexusOnly: false },
  { href: "/docs", label: "Documentation", icon: BookOpen, nexusOnly: false },
];

const HEISTTECH_PLANS = [
  { id: "1month",   label: "1 Month Plan",   amount: 450,  badge: null,                             badgeColor: "",          popular: false, note: null },
  { id: "3months",  label: "3 Months Plan",  amount: 1400, badge: "🎉 You Save KES 100!",           badgeColor: "bg-green-500", popular: true,  note: null },
  { id: "6months",  label: "6 Months Plan",  amount: 2800, badge: "🔥 You Save KES 200!",           badgeColor: "bg-orange-400", popular: false, note: null },
  { id: "12months", label: "12 Months Plan", amount: 3800, badge: "🚀 You Save KES 2,200!",          badgeColor: "bg-blue-500", popular: false, note: "Renews at: KES 5000/year" },
];

function ActivationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isHeistTech = typeof window !== "undefined" && window.location.hostname.includes("heisttech");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<string>(isHeistTech ? "1month" : "monthly");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"choose" | "paying" | "done">("choose");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  useEffect(() => { return () => stopPoll(); }, []);

  const currentAmount = isHeistTech
    ? (HEISTTECH_PLANS.find(p => p.id === plan)?.amount ?? 450)
    : (plan === "monthly" ? 100 : 500);

  const handlePay = async () => {
    const digits = phone.replace(/\D/g, "");
    const formatted = digits.startsWith("254") ? digits : digits.startsWith("0") ? "254" + digits.slice(1) : "254" + digits;
    if (formatted.length < 12) {
      toast({ title: "Invalid phone", description: "Enter a valid M-Pesa number", variant: "destructive" });
      return;
    }

    setStep("paying");

    try {
      const res = await fetch(`${API_BASE}/api/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ plan, phone: formatted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to initiate payment");

      setCheckoutId(data.checkoutRequestId);

      const deadline = Date.now() + 90_000; // 90-second timeout
      pollRef.current = setInterval(async () => {
        try {
          // Timed out — no callback received within 90 s
          if (Date.now() > deadline) {
            stopPoll();
            setStep("choose");
            toast({
              title: "Request timed out",
              description: "No response from M-Pesa after 90 seconds. Check your phone for the prompt — if it appeared, please wait a minute before trying again.",
              variant: "destructive",
            });
            return;
          }

          const sr = await fetch(`${API_BASE}/api/activate/status/${data.checkoutRequestId}`, {
            headers: { ...getAuthHeaders(), "Cache-Control": "no-cache" },
            cache: "no-store",
          });
          if (!sr.ok) return; // transient error — keep polling
          const sd = await sr.json();
          if (sd.status === "completed") {
            stopPoll();
            setStep("done");
            qc.invalidateQueries({ queryKey: ["me"] });
            qc.invalidateQueries({ queryKey: ["getMe"] });
          } else if (sd.status === "failed") {
            stopPoll();
            setStep("choose");
            const reason = sd.failureReason ?? "M-Pesa payment was not completed. Please check your phone and try again.";
            toast({ title: "Payment not completed", description: reason, variant: "destructive" });
          }
        } catch {
          // Network error — keep polling silently
        }
      }, 3000);
    } catch (err: any) {
      setStep("choose");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleClose = () => {
    stopPoll();
    setStep("choose");
    setPhone("");
    setCheckoutId(null);
    onClose();
    if (step === "done") window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className={isHeistTech ? "sm:max-w-sm mx-4" : "sm:max-w-md mx-4"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-600" /> Activate Your Account
          </DialogTitle>
          <DialogDescription>
            Unlock unlimited M-Pesa payments. Pay via M-Pesa STK Push — account activates automatically.
          </DialogDescription>
        </DialogHeader>

        {step === "done" ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <p className="text-xl font-bold">Account Activated!</p>
            <p className="text-sm text-muted-foreground">
              You now have unlimited access on the <strong>{plan}</strong> plan.
            </p>
            <Button onClick={handleClose} className="w-full bg-green-600 hover:bg-green-700 mt-4">Get Started</Button>
          </div>
        ) : step === "paying" ? (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="font-semibold">STK Push Sent!</p>
            <p className="text-sm text-muted-foreground">
              Check your phone for the M-Pesa prompt. Enter your PIN to pay <strong>KES {currentAmount.toLocaleString()}</strong>.
            </p>
            <p className="text-xs text-muted-foreground animate-pulse">Waiting for payment confirmation…</p>
          </div>
        ) : isHeistTech ? (
          /* ── HeistTech: phone first, then plan dropdown ── */
          <div className="space-y-4 py-1">
            {/* Step 1 — Phone */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">M-Pesa Phone Number</Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 0712 345 678"
                className="h-11 text-base"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Enter the M-Pesa number that will receive the STK push prompt</p>
            </div>

            {/* Step 2 — Plan dropdown */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Select Subscription Plan</Label>
              <select
                value={plan}
                onChange={e => setPlan(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {HEISTTECH_PLANS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} — KES {p.amount.toLocaleString()}{p.badge ? ` (${p.badge})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected plan summary */}
            {(() => {
              const selected = HEISTTECH_PLANS.find(p => p.id === plan)!;
              return (
                <div className={`rounded-lg border-2 p-3 text-center space-y-1 ${selected.popular ? "border-green-400 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                  <p className="font-semibold text-base">{selected.label}</p>
                  <p className="text-2xl font-bold">KES {selected.amount.toLocaleString()}</p>
                  {selected.badge ? (
                    <span className={`inline-block text-white text-xs font-semibold px-3 py-0.5 rounded-full ${selected.badgeColor}`}>
                      {selected.badge}
                    </span>
                  ) : (
                    <span className="inline-block text-xs text-gray-500 bg-gray-200 px-3 py-0.5 rounded-full">No Savings</span>
                  )}
                  {selected.note && <p className="text-xs text-blue-600 font-medium">{selected.note}</p>}
                </div>
              );
            })()}

            <Button onClick={handlePay} className="w-full bg-green-600 hover:bg-green-700 h-11" disabled={!phone}>
              <Zap className="w-4 h-4 mr-2" />
              Pay KES {currentAmount.toLocaleString()} & Activate
            </Button>
          </div>
        ) : (
          /* ── Nexus Pay 2-plan layout (unchanged) ── */
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              {(["monthly", "yearly"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${plan === p ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  {p === "yearly" && (
                    <span className="absolute -top-2 right-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">Best Value</span>
                  )}
                  <div className="text-2xl font-bold">KES {p === "monthly" ? "100" : "500"}</div>
                  <div className="text-sm font-medium capitalize mt-0.5">{p}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p === "monthly" ? "Renews every 30 days" : "One-time · Full year access"}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>M-Pesa Phone Number</Label>
              <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712345678" />
              <p className="text-xs text-muted-foreground">We'll send an STK Push to this number</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">What you get:</p>
              <p>✓ Unlimited STK Push payments</p>
              <p>✓ Payment links & dashboard access</p>
              <p>✓ Funds routed directly to your till</p>
              <p>✓ No transaction fees</p>
            </div>

            <Button onClick={handlePay} className="w-full bg-green-600 hover:bg-green-700" disabled={!phone}>
              <Zap className="w-4 h-4 mr-2" />
              Pay KES {plan === "monthly" ? 100 : 500} & Activate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NavContent({ location, onNav, isHeistTech }: { location: string; onNav?: () => void; isHeistTech: boolean }) {
  const visibleItems = NAV_ITEMS.filter(item => !item.nexusOnly || !isHeistTech);
  return (
    <nav className="space-y-1">
      {visibleItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onNav}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.nexusOnly && (
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 border-purple-200 font-medium">
                  SaaS
                </Badge>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ children }: { children?: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [activateOpen, setActivateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const isHeistTech = typeof window !== "undefined" && window.location.hostname.includes("heisttech");
  const isSandbox = (user as any)?.mode === "sandbox";
  const sandboxUsed = (user as any)?.sandboxTransactionsUsed ?? 0;
  const sandboxRemaining = Math.max(0, 2 - sandboxUsed);

  // Close mobile menu on location change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Desktop Sidebar ── */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-sm">{isHeistTech ? "H" : "N"}</span>
            </div>
            <span className="font-bold text-lg tracking-tight">{isHeistTech ? "HeistTech Pay" : "Nexus Pay"}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
          <NavContent location={location} isHeistTech={isHeistTech} />
        </div>

        {isSandbox && (
          <div className="mx-4 mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-amber-800">Sandbox Mode</span>
              <Badge className="ml-auto text-xs bg-amber-500 hover:bg-amber-600 text-white py-0 px-1.5">
                {sandboxRemaining}/2 left
              </Badge>
            </div>
            <p className="text-xs text-amber-700 leading-snug">
              {sandboxRemaining === 0
                ? "You've used all sandbox transactions. Activate to continue."
                : `${sandboxRemaining} test transaction${sandboxRemaining !== 1 ? "s" : ""} remaining.`}
            </p>
            <Button
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-white h-7 text-xs gap-1"
              onClick={() => setActivateOpen(true)}
            >
              <Zap className="w-3 h-3" />
              {typeof window !== "undefined" && window.location.hostname.includes("heisttech")
                ? "Activate — From KES 450"
                : "Activate — From KES 100"}
            </Button>
          </div>
        )}

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="mb-4 px-2">
            <p className="text-sm font-medium truncate">{user?.businessName}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            {!isSandbox && (
              <Badge className="mt-1 text-xs bg-green-600 hover:bg-green-700 py-0">
                Active · {(user as any)?.subscriptionType ?? "plan"}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar text-sidebar-foreground border-b border-sidebar-border/50 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs">{isHeistTech ? "H" : "N"}</span>
          </div>
          <span className="font-bold tracking-tight">{isHeistTech ? "HeistTech Pay" : "Nexus Pay"}</span>
        </div>
        <div className="flex items-center gap-2">
          {isSandbox && (
            <Badge className="text-xs bg-amber-500 text-white px-2 py-0.5">
              Sandbox {sandboxRemaining}/2
            </Badge>
          )}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground flex flex-col h-full shadow-2xl">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-xs">{isHeistTech ? "H" : "N"}</span>
                </div>
                <span className="font-bold">{isHeistTech ? "HeistTech Pay" : "Nexus Pay"}</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-sidebar-accent/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex-1 overflow-y-auto py-4 px-3">
              <NavContent location={location} onNav={() => setMobileMenuOpen(false)} isHeistTech={isHeistTech} />
            </div>

            {/* Sandbox banner */}
            {isSandbox && (
              <div className="mx-3 mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-semibold text-amber-800">Sandbox Mode</span>
                  <Badge className="ml-auto text-xs bg-amber-500 hover:bg-amber-600 text-white py-0 px-1.5">
                    {sandboxRemaining}/2 left
                  </Badge>
                </div>
                <p className="text-xs text-amber-700 leading-snug">
                  {sandboxRemaining === 0
                    ? "You've used all sandbox transactions. Activate to continue."
                    : `${sandboxRemaining} test transaction${sandboxRemaining !== 1 ? "s" : ""} remaining.`}
                </p>
                <Button
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700 text-white h-7 text-xs gap-1"
                  onClick={() => { setMobileMenuOpen(false); setActivateOpen(true); }}
                >
                  <Zap className="w-3 h-3" />
                  {typeof window !== "undefined" && window.location.hostname.includes("heisttech")
                    ? "Activate — From KES 450"
                    : "Activate — From KES 100"}
                </Button>
              </div>
            )}

            {/* User info + logout */}
            <div className="p-3 border-t border-sidebar-border/50 shrink-0">
              <div className="mb-3 px-1">
                <p className="text-sm font-medium truncate">{user?.businessName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
                {!isSandbox && (
                  <Badge className="mt-1 text-xs bg-green-600 hover:bg-green-700 py-0">
                    Active · {(user as any)?.subscriptionType ?? "plan"}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-[72px] md:pt-8">
          {children}
        </div>
      </main>

      <ActivationModal open={activateOpen} onClose={() => setActivateOpen(false)} />
    </div>
  );
}
