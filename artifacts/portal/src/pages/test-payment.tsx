import { useState, useEffect } from "react";
import { Smartphone, Send, RefreshCw, CheckCircle, XCircle, Clock, Eye, EyeOff } from "lucide-react";

const API_BASE = "https://pay.makamesco-tech.co.ke";
const KEY_STORAGE = "nexuspay_test_api_key";

type Status = "idle" | "loading" | "success" | "error";

interface PushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  customerMessage: string;
  transactionId: number;
}

interface StatusResult {
  status: "pending" | "completed" | "failed" | "cancelled";
  amount: string;
  phoneNumber: string;
  mpesaReceiptNumber: string | null;
  updatedAt: string;
}

export default function TestPayment() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("1");
  const [reference, setReference] = useState("TEST001");
  const [description, setDescription] = useState("Test Payment");

  const [pushStatus, setPushStatus] = useState<Status>("idle");
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState("");

  const [checkStatus, setCheckStatus] = useState<Status>("idle");
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setApiKey(saved);
  }, []);

  const saveKey = (k: string) => {
    setApiKey(k);
    if (k) localStorage.setItem(KEY_STORAGE, k);
    else localStorage.removeItem(KEY_STORAGE);
  };

  const sendPush = async () => {
    if (!apiKey || !phone || !amount) return;
    setPushStatus("loading");
    setPushResult(null);
    setPushError("");
    setStatusResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/payments/stkpush`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          amount: Number(amount),
          accountReference: reference.trim() || "TEST",
          transactionDesc: description.trim() || "Test Payment",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
      setPushResult(data);
      setPushStatus("success");
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Request failed");
      setPushStatus("error");
    }
  };

  const pollStatus = async () => {
    if (!pushResult?.checkoutRequestId || !apiKey) return;
    setCheckStatus("loading");
    setStatusError("");

    try {
      const res = await fetch(
        `${API_BASE}/api/payments/status/${pushResult.checkoutRequestId}`,
        { headers: { "X-API-Key": apiKey } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      setStatusResult(data);
      setCheckStatus("success");
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Status check failed");
      setCheckStatus("error");
    }
  };

  const statusIcon = (s: StatusResult["status"]) => {
    if (s === "completed") return <CheckCircle className="text-green-600 w-5 h-5" />;
    if (s === "pending") return <Clock className="text-yellow-600 w-5 h-5" />;
    return <XCircle className="text-red-500 w-5 h-5" />;
  };

  const statusColor = (s: StatusResult["status"]) => {
    if (s === "completed") return "text-green-700 bg-green-50 border-green-200";
    if (s === "pending") return "text-yellow-700 bg-yellow-50 border-yellow-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-600 rounded-2xl mb-3 shadow-lg">
            <Smartphone className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">STK Push Tester</h1>
          <p className="text-sm text-gray-500 mt-1">Makamesco Nexus Pay — Live Test</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">API Credentials</h2>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">API Key</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => saveKey(e.target.value)}
                placeholder="nxp_live_..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
              <button
                onClick={() => setShowKey(p => !p)}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Saved locally in your browser — never sent anywhere except your gateway.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Payment Details</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="254712345678"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1">Format: 254XXXXXXXXX</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Amount (KES)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="TEST001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Test Payment"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          <button
            onClick={sendPush}
            disabled={pushStatus === "loading" || !apiKey || !phone || !amount}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {pushStatus === "loading" ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending STK Push...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send STK Push
              </>
            )}
          </button>

          {pushStatus === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 font-semibold text-sm mb-1">Request Failed</p>
              <p className="text-red-600 text-xs">{pushError}</p>
            </div>
          )}

          {pushStatus === "success" && pushResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-green-700 font-semibold text-sm">STK Push Sent! Check your phone.</p>
              <div className="space-y-1 text-xs">
                {[
                  ["Message", pushResult.customerMessage],
                  ["Checkout ID", pushResult.checkoutRequestId],
                  ["Transaction ID", String(pushResult.transactionId)],
                  ["Response Code", pushResult.responseCode],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800 text-right break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {pushResult && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Payment Status</h2>
            <p className="text-xs text-gray-500">After paying on your phone, click below to confirm.</p>

            <button
              onClick={pollStatus}
              disabled={checkStatus === "loading"}
              className="w-full bg-white hover:bg-gray-50 disabled:opacity-60 text-green-700 font-semibold py-3 rounded-xl border-2 border-green-600 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {checkStatus === "loading" ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Checking...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Check Status</>
              )}
            </button>

            {checkStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-600 text-xs">{statusError}</p>
              </div>
            )}

            {checkStatus === "success" && statusResult && (
              <div className={`border rounded-xl p-4 space-y-2 ${statusColor(statusResult.status)}`}>
                <div className="flex items-center gap-2">
                  {statusIcon(statusResult.status)}
                  <span className="font-bold capitalize">{statusResult.status}</span>
                </div>
                <div className="space-y-1 text-xs">
                  {[
                    ["Amount", `KES ${statusResult.amount}`],
                    ["Phone", statusResult.phoneNumber],
                    ["M-Pesa Receipt", statusResult.mpesaReceiptNumber || "—"],
                    ["Updated", new Date(statusResult.updatedAt).toLocaleTimeString()],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="opacity-70">{k}</span>
                      <span className="font-semibold text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Gateway: pay.makamesco-tech.co.ke
        </p>
      </div>
    </div>
  );
}
