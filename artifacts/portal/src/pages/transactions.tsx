import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const API_BASE = "";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pending</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

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
];

export default function Transactions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 20;

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
          (tx.accountReference ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : (data?.transactions ?? []);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
          <p className="text-muted-foreground">View and search through your M-Pesa transaction history.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            {/* Date filter row */}
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

            {/* Status filter + search row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-1">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => { setStatusFilter(t.value); setPage(1); }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      statusFilter === t.value
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Phone, receipt, or reference…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt No</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {dateFilter === "today" ? "No transactions today." : "No transactions found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium font-mono text-xs">
                          {tx.mpesaReceiptNumber || "—"}
                        </TableCell>
                        <TableCell>{tx.phoneNumber}</TableCell>
                        <TableCell>KES {Number(tx.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getStatusBadge(tx.status)}
                            {(tx.status === "failed" || tx.status === "cancelled") && tx.statusDescription && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="text-xs">{tx.statusDescription}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{tx.accountReference || "—"}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {format(new Date(tx.createdAt), "MMM d, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                {data ? `${data.total} total` : ""}
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
    </TooltipProvider>
  );
}
