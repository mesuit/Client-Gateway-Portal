import { useGetDashboardStats, useListTransactions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity, ArrowUpRight, DollarSign, Percent } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: transactionsData, isLoading: txLoading } = useListTransactions({ query: { queryKey: ['transactions', { limit: 5 }] } });

  // Mock chart data since the API doesn't provide a timeseries.
  // In a real app, this would come from the backend.
  const chartData = [
    { name: "Mon", total: Math.floor(Math.random() * 5000) + 1000 },
    { name: "Tue", total: Math.floor(Math.random() * 5000) + 1000 },
    { name: "Wed", total: Math.floor(Math.random() * 5000) + 1000 },
    { name: "Thu", total: Math.floor(Math.random() * 5000) + 1000 },
    { name: "Fri", total: Math.floor(Math.random() * 5000) + 1000 },
    { name: "Sat", total: Math.floor(Math.random() * 5000) + 1000 },
    { name: "Sun", total: Number(stats?.todayVolume || 0) },
  ];

  if (statsLoading || txLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your M-Pesa payments and transactions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {Number(stats?.totalVolume || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime transaction volume</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Volume</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {Number(stats?.todayVolume || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Volume processed today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTransactions?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.todayTransactions || 0} today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">Of all processed transactions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Transaction Volume</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `KES ${value}`} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {transactionsData?.transactions?.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">{tx.phoneNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-sm font-bold">KES {Number(tx.amount).toLocaleString()}</div>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              ))}
              {(!transactionsData?.transactions || transactionsData.transactions.length === 0) && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No recent transactions
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
