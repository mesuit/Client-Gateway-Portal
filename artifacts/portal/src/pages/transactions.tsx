import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Search, AlertCircle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const API_BASE = "";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATUS_CONFIG: Record<string, { label: string; badge: React.ReactNode; icon: React.ReactNode; defaultDesc: string }> = {
  completed: {
    label: "Completed",
    badge: <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Completed</Badge>,
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
    defaultDesc: "Payment received successfully",
  },
  pending: {
    label: "Pending",
    badge: <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">Pending</Badge>,
    icon: <Clock className="w-3.5 h-3.5 text-yellow-500" />,
    defaultDesc: "Waiting for customer to enter M-Pesa PIN",
  },
  failed: {
    label: "Failed",
    badge: <Badge variant="destructive" className="text-xs">Failed</Badge>,
    icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
    defaultDesc: "Payment failed",
  },
  cancelled: {
    label: "Cancelled",
    badge: <Badge variant="secondary" className="text-xs">Cancelled</Badge>,
    icon: <XCircle className="w-3.5 h-3.5 text-muted-foreground" />,
    defaultDesc: "Customer cancelled the payment",
  },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status.toLowerCase()] ?? {
    label: status,
    badge: <Badge variant="outline" className="text-xs">{status}</Badge>,
    icon: null,
    defaultDesc: "",
  };
}

type Transaction = {
  id: number;
  checkoutRequestId: string | null;
  mpesaReceiptNumber: string | null;
  phoneNumber: string;
  amount: string;
  status: string;
  statusDescription: string | null;
  accountReference: string | null;
  transactionDesc: string | null;
  createdAt: string;
  updatedAt: string;
};

type TxResponse = {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
};

const DATE_TABS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function TransactionRow({ tx }: { tx: Transaction }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getStatusConfig(tx.status);
  const desc = tx.statusDescription || cfg.defaultDesc;

  return (
    <>
      <tr
        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Receipt */}
        <td className="px-4 py-3">
          {tx.mpesaReceiptNumber
            ? <span className="font-mono text-xs font-semibold text-primary">{tx.mpesaReceiptNumber}</span>
            : <span className="text-muted-foreground text-xs">—</span>}
        </td>

        {/* Phone */}
        <td className="px-4 py-3 text-sm">{tx.phoneNumber}</td>

        {/* Amount */}
        <td className="px-4 py-3">
          <span className="font-semibold text-sm">KES {Number(tx.amount).toLocaleString()}</span>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {cfg.icon}
            {cfg.badge}
          </div>
        </td>

        {/* Reference / Desc */}
        <td className="px-4 py-3">
          <div className="text-sm">{tx.accountReference || "—"}</div>
          {tx.transactionDesc && tx.transactionDesc !== tx.accountReference && (
            <div className="text-xs text-muted-foreground">{tx.transactionDesc}</div>
          )}
        </td>

        {/* Date + expand */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(tx.createdAt), "MMM d, h:mm a")}
            </span>
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-muted/20 border-b">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Status Detail</p>
                <p className={tx.status === "failed" || tx.status === "cancelled" ? "text-red-600" : "text-foreground"}>
                  {desc}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Checkout Request ID</p>
                <p className="font-mono break-all">{tx.checkoutRequestId || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Transaction Description</p>
                <p>{tx.transactionDesc || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Last Updated</p>
                <p>{format(new Date(tx.updatedAt), "MMM d, yyyy h:mm:ss a")}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Transactions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 25;

  const { data, isLoading } = useQuery<TxResponse>({
    queryKey: ["transactions", { page, limit, statusFilter, dateFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFilter !== "all") params.set("date", dateFilter);
      const r = await fetch(`${API_BASE}/api/transactions?${params}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load transactions");
      return r.json();
    },
  });

  const filtered = search.trim()
    ? (data?.transactions ?? []).filter(
        (tx) =>
          tx.phoneNumber.includes(search) ||
          (tx.mpesaReceiptNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (tx.accountReference ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (tx.transactionDesc ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : (data?.transactions ?? []);

  const statusCounts = (data?.transactions ?? []).reduce<Record<string, number>>((acc, tx) => {
    acc[tx.status] = (acc[tx.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground">View, search, and inspect your M-Pesa transaction history. Click any row to see details.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          {/* Date filter tabs */}
          <div className="flex gap-1 border-b pb-3 mb-2 overflow-x-auto">
            {DATE_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => { setDateFilter(t.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  dateFilter === t.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status filter + search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {STATUS_TABS.map((t) => {
                const count = t.value === "all"
                  ? (data?.total ?? 0)
                  : (statusCounts[t.value] ?? 0);
                return (
                  <button
                    key={t.value}
                    onClick={() => { setStatusFilter(t.value); setPage(1); }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      statusFilter === t.value
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {t.label}
                    {count > 0 && (
                      <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-normal">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Phone, receipt, reference, description…"
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Receipt No</th>
                  <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Reference / Desc</th>
                  <th className="px-4 py-3 text-right font-medium text-xs text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="h-32 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-32 text-center text-muted-foreground">
                      {search ? "No transactions match your search." : dateFilter === "today" ? "No transactions today." : "No transactions found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-muted-foreground">
              {data ? `${filtered.length} shown of ${data.total} total` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <span className="text-sm font-medium">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data || data.transactions.length < limit || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
