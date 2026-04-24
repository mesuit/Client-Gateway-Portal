import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Smartphone, Send, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

const API_BASE = "https://pay.makamesco-tech.co.ke";

interface LinkInfo {
  title: string;
  description: string | null;
  amount: string | null;
  accountReference: string;
  transactionDesc: string;
}

interface PushResult {
  checkoutRequestId: string;
  customerMessage: string;
  transactionId: number;
}

interface StatusResult {
  status: "pending" | "completed" | "failed" | "cancelled";
  amount: string;
  phoneNumber: string;
  mpesaReceiptNumber: string | null;
}

export default function Pay() {
  const [, params] = useRoute("/pay/:slug");
  const slug = params?.slug ?? "";

  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [linkError, setLinkError] = useState("");

  const [phone, setPhone] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState("");

  const [checking, setChecking] = useState(false);
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/api/pay/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error("Payment link not found or inactive");
        return r.json();
      })
      .then(setLinkInfo)
      .catch(e => setLinkError(e.message));
  }, [slug]);

  const pay = async () => {
    if (!phone) return;
    setSending(true);
    setPushError("");

    try {
      const body: Record<string, unknown> = { phoneNumber: phone.trim() };
      if (!linkInfo?.amount) body.amount = Number(customAmount);

      const res = await fetch(`${API_BASE}/api/pay/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Payment failed");
      setPushResult(data);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  };

  const checkStatus = async () => {
    if (!pushResult) return;
    setChecking(true);
    setStatusError("");

    try {
      const res = await fetch(`${API_BASE}/api/payments/status/${pushResult.checkoutRequestId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Status check failed");
      setStatusResult(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Status check failed");
    } finally {
      setChecking(false);
    }
  };

  if (linkError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Unavailable</h2>
          <p className="text-gray-500">{linkError}</p>
        </div>
      </div>
    );
  }

  if (!linkInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-green-600" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    completed: "text-green-700 bg-green-50 border-green-200",
    pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
    failed: "text-red-700 bg-red-50 border-red-200",
    cancelled: "text-gray-700 bg-gray-50 border-gray-200",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="w-5 h-5 text-green-600" />,
    pending: <Clock className="w-5 h-5 text-yellow-600" />,
    failed: <XCircle className="w-5 h-5 text-red-500" />,
    cancelled: <XCircle className="w-5 h-5 text-gray-400" />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-600 rounded-2xl mb-3 shadow-lg">
            <Smartphone className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{linkInfo.title}</h1>
          {linkInfo.description && (
            <p className="text-sm text-gray-500 mt-1">{linkInfo.description}</p>
          )}
          {linkInfo.amount && (
            <div className="mt-2 inline-block bg-green-600 text-white px-4 py-1.5 rounded-full text-lg font-bold">
              KES {Number(linkInfo.amount).toLocaleString()}
            </div>
          )}
        </div>

        {!pushResult ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="254712345678"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1">Safaricom M-Pesa number: 2547XXXXXXXX</p>
            </div>

            {!linkInfo.amount && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                />
              </div>
            )}

            <button
              onClick={pay}
              disabled={sending || !phone || (!linkInfo.amount && !customAmount)}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {sending ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Sending prompt...</>
              ) : (
                <><Send className="w-4 h-4" /> Pay via M-Pesa</>
              )}
            </button>

            {pushError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                {pushError}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              You'll receive an M-Pesa prompt on your phone. Enter your PIN to complete payment.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-700 font-semibold mb-1">Check your phone!</p>
              <p className="text-green-600 text-sm">{pushResult.customerMessage}</p>
              <p className="text-xs text-gray-500 mt-2 font-mono">Ref: {pushResult.checkoutRequestId}</p>
            </div>

            <button
              onClick={checkStatus}
              disabled={checking}
              className="w-full bg-white hover:bg-gray-50 text-green-700 font-semibold py-3 rounded-xl border-2 border-green-600 transition-colors flex items-center justify-center gap-2"
            >
              {checking ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Checking...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Verify Payment</>
              )}
            </button>

            {statusError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
                {statusError}
              </div>
            )}

            {statusResult && (
              <div className={`border rounded-xl p-4 space-y-2 ${statusColors[statusResult.status]}`}>
                <div className="flex items-center gap-2">
                  {statusIcons[statusResult.status]}
                  <span className="font-bold capitalize text-lg">{statusResult.status}</span>
                </div>
                <div className="space-y-1 text-sm">
                  {[
                    ["Amount", `KES ${statusResult.amount}`],
                    ["Phone", statusResult.phoneNumber],
                    ["M-Pesa Receipt", statusResult.mpesaReceiptNumber || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="opacity-70">{k}</span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Powered by Makamesco Nexus Pay</p>
      </div>
    </div>
  );
}
