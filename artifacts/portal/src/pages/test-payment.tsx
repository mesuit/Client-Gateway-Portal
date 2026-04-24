import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Smartphone, Send, RefreshCw, CheckCircle, XCircle, Clock, Eye, EyeOff, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/hooks/use-auth";

const API_BASE = "https://pay.makamesco-tech.co.ke";
const KEY_STORAGE = "nexuspay_test_api_key";

interface ApiKey { id: number; name: string; keyPrefix: string; isActive: boolean; }
interface PushResult { checkoutRequestId: string; customerMessage: string; transactionId: number; }
interface StatusResult { status: "pending" | "completed" | "failed" | "cancelled"; amount: string; phoneNumber: string; mpesaReceiptNumber: string | null; updatedAt: string; }

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

export default function TestPayment() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? "");
  const [showKey, setShowKey] = useState(false);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("1");
  const [reference, setReference] = useState("TEST001");
  const [description, setDescription] = useState("Test Payment");

  const [sending, setSending] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState("");

  const [checking, setChecking] = useState(false);
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [statusError, setStatusError] = useState("");

  const { data: keys = [] } = useQuery<ApiKey[]>({
    queryKey: ["api-keys-test"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/keys`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const saveKey = (k: string) => {
    setApiKey(k);
    localStorage.setItem(KEY_STORAGE, k);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
  };

  const phoneForSend = formatPhone(phone);
  const phoneValid = /^2547\d{8}$|^2541\d{8}$/.test(phoneForSend);

  const sendPush = async () => {
    if (!apiKey || !phoneValid || !amount) return;
    setSending(true);
    setPushError("");
    setPushResult(null);
    setStatusResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/payments/stkpush`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          phoneNumber: phoneForSend,
          amount: Number(amount),
          accountReference: reference || "TEST001",
          transactionDesc: description || "Test Payment",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
      setPushResult(data);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  };

  const checkStatus = async () => {
    if (!pushResult || !apiKey) return;
    setChecking(true);
    setStatusError("");
    try {
      const res = await fetch(`${API_BASE}/api/payments/status/${pushResult.checkoutRequestId}`, {
        headers: { "X-API-Key": apiKey },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setStatusResult(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Status check failed");
    } finally {
      setChecking(false);
    }
  };

  const statusColor = (s: StatusResult["status"]) => ({
    completed: "text-green-700 bg-green-50 border-green-200",
    pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
    failed: "text-red-700 bg-red-50 border-red-200",
    cancelled: "text-gray-700 bg-gray-50 border-gray-200",
  }[s]);

  const statusIcon = (s: StatusResult["status"]) => ({
    completed: <CheckCircle className="w-5 h-5 text-green-600" />,
    pending: <Clock className="w-5 h-5 text-yellow-600" />,
    failed: <XCircle className="w-5 h-5 text-red-500" />,
    cancelled: <XCircle className="w-5 h-5 text-gray-400" />,
  }[s]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Smartphone className="w-8 h-8 text-primary" />
          STK Push Tester
        </h2>
        <p className="text-muted-foreground mt-1">Send a live M-Pesa payment prompt to any Safaricom number.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> API Key
          </CardTitle>
          <CardDescription>
            Use your <strong>Secret Key</strong> from the{" "}
            <Link href="/api-keys" className="text-primary underline underline-offset-2">API Keys page</Link>.
            It starts with <code className="bg-muted px-1 rounded text-xs">nxp_</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => saveKey(e.target.value)}
              placeholder="nxp_live_..."
              className="pr-10 font-mono text-sm"
            />
            <button
              onClick={() => setShowKey(p => !p)}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {keys.filter(k => k.isActive).length > 0 && (
            <p className="text-xs text-muted-foreground">
              You have {keys.filter(k => k.isActive).length} active key(s). Copy the full secret from the API Keys page.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              type="tel"
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              placeholder="0712345678 or 254712345678"
            />
            {phone && (
              <p className={`text-xs ${phoneValid ? "text-green-600" : "text-amber-600"}`}>
                {phoneValid
                  ? `✓ Will send to ${phoneForSend}`
                  : `Will be formatted to: ${phoneForSend || "—"} (enter a valid Safaricom number)`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="TEST001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Test Payment"
            />
          </div>

          <Button
            onClick={sendPush}
            disabled={sending || !apiKey || !phoneValid || !amount}
            className="w-full gap-2"
          >
            {sending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Sending STK Push...</>
            ) : (
              <><Send className="w-4 h-4" /> Send STK Push</>
            )}
          </Button>

          {pushError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              <p className="font-semibold mb-1">Request Failed</p>
              <p>{pushError}</p>
              {pushError.toLowerCase().includes("api key") && (
                <p className="mt-2 text-xs">
                  Make sure you copied the full <strong>Secret Key</strong> from{" "}
                  <Link href="/api-keys" className="underline">API Keys</Link> — not just the prefix.
                </p>
              )}
            </div>
          )}

          {pushResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <p className="text-green-700 font-semibold">STK Push sent! Check the phone.</p>
              <p className="text-green-600 text-sm">{pushResult.customerMessage}</p>
              <p className="text-xs text-muted-foreground font-mono">
                Checkout ID: {pushResult.checkoutRequestId}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {pushResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verify Payment</CardTitle>
            <CardDescription>After the customer pays on their phone, check the status here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={checkStatus} disabled={checking} className="w-full gap-2">
              {checking ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Checking...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Check Status</>
              )}
            </Button>

            {statusError && (
              <p className="text-sm text-red-600">{statusError}</p>
            )}

            {statusResult && (
              <div className={`border rounded-lg p-4 space-y-2 ${statusColor(statusResult.status)}`}>
                <div className="flex items-center gap-2">
                  {statusIcon(statusResult.status)}
                  <span className="font-bold capitalize text-lg">{statusResult.status}</span>
                  {statusResult.status === "completed" && (
                    <Badge className="bg-green-600">Paid</Badge>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  {[
                    ["Amount", `KES ${statusResult.amount}`],
                    ["Phone", statusResult.phoneNumber],
                    ["M-Pesa Receipt", statusResult.mpesaReceiptNumber || "—"],
                    ["Updated", new Date(statusResult.updatedAt).toLocaleTimeString()],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="opacity-70">{k}</span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
