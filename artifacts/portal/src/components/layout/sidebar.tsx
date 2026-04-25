import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Receipt, KeyRound, Building2, BookOpen, LogOut, Loader2, Link2, Smartphone, ShieldCheck, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getAuthHeaders } from "@/hooks/use-auth";

const API_BASE = "https://pay.makamesco-tech.co.ke";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/settlement", label: "Settlement", icon: Building2 },
  { href: "/payment-links", label: "Payment Links", icon: Link2 },
  { href: "/test", label: "STK Push Tester", icon: Smartphone },
  { href: "/docs", label: "Documentation", icon: BookOpen },
];

function ActivationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"choose" | "paying" | "done">("choose");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  useEffect(() => { return () => stopPoll(); }, []);

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

      // Poll for activation status
      pollRef.current = setInterval(async () => {
        const sr = await fetch(`${API_BASE}/api/activate/status/${data.checkoutRequestId}`, {
          headers: getAuthHeaders(),
        });
        const sd = await sr.json();
        if (sd.status === "completed") {
          stopPoll();
          setStep("done");
          // Refresh user data
          qc.invalidateQueries({ queryKey: ["me"] });
          qc.invalidateQueries({ queryKey: ["getMe"] });
        } else if (sd.status === "failed") {
          stopPoll();
          setStep("choose");
          toast({ title: "Payment failed", description: "M-Pesa payment was not completed. Please try again.", variant: "destructive" });
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
      <DialogContent className="sm:max-w-md">
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
              Check your phone for the M-Pesa prompt. Enter your PIN to pay <strong>KES {plan === "monthly" ? 100 : 500}</strong>.
            </p>
            <p className="text-xs text-muted-foreground animate-pulse">Waiting for payment confirmation…</p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Plan selector */}
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
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0712345678"
              />
              <p className="text-xs text-muted-foreground">We'll send an STK Push to this number</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">What you get:</p>
              <p>✓ Unlimited STK Push payments</p>
              <p>✓ Payment links & dashboard access</p>
              <p>✓ Funds routed directly to your till</p>
              <p>✓ No transaction fees</p>
            </div>

            <Button
              onClick={handlePay}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!phone}
            >
              <Zap className="w-4 h-4 mr-2" />
              Pay KES {plan === "monthly" ? 100 : 500} & Activate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Sidebar({ children }: { children?: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [activateOpen, setActivateOpen] = useState(false);

  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
        toast({ title: "Logged out successfully" });
      },
      onError: () => {
        logout();
      }
    });
  };

  const isSandbox = (user as any)?.mode === "sandbox";
  const sandboxUsed = (user as any)?.sandboxTransactionsUsed ?? 0;
  const sandboxRemaining = Math.max(0, 2 - sandboxUsed);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Nexus Pay" className="w-8 h-8 rounded object-cover" />
            <span className="font-bold text-lg tracking-tight">Nexus Pay</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
          <nav className="space-y-1">
            {(user as any)?.isAdmin && (
              <Link href="/admin">
                <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer mb-1 ${
                  location === "/admin"
                    ? "bg-purple-600 text-white font-medium"
                    : "text-purple-400 hover:bg-purple-600/20 hover:text-purple-300"
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Panel</span>
                </div>
              </Link>
            )}
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}>
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sandbox Banner */}
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
              <Zap className="w-3 h-3" /> Activate — From KES 100
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
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>

      <ActivationModal open={activateOpen} onClose={() => setActivateOpen(false)} />
    </div>
  );
}
