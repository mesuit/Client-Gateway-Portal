import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Copy, Trash2, ExternalLink, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";

const API_BASE = "https://pay.makamesco-tech.co.ke";

interface PaymentLink {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  amount: string | null;
  accountReference: string;
  transactionDesc: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

async function fetchLinks(): Promise<PaymentLink[]> {
  const res = await fetch(`${API_BASE}/api/payment-links`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch links");
  return res.json();
}

export default function PaymentLinks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    accountReference: "",
    transactionDesc: "",
  });

  const { data: links = [], isLoading } = useQuery({ queryKey: ["payment-links"], queryFn: fetchLinks });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/payment-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          amount: form.amount ? Number(form.amount) : undefined,
          accountReference: form.accountReference,
          transactionDesc: form.transactionDesc,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to create link");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-links"] });
      setShowForm(false);
      setForm({ title: "", description: "", amount: "", accountReference: "", transactionDesc: "" });
      toast({ title: "Payment link created!", description: "Share the link with your customers." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API_BASE}/api/payment-links/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Link deactivated" });
    },
  });

  const copyLink = (slug: string, id: number) => {
    const url = `${API_BASE.replace("/api", "")}/pay/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Link copied!", description: url });
  };

  const payUrl = (slug: string) => `${window.location.origin}/pay/${slug}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Payment Links</h2>
          <p className="text-muted-foreground">Create shareable links for customers to pay via M-Pesa.</p>
        </div>
        <Button onClick={() => setShowForm(p => !p)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Link
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Payment Link</CardTitle>
            <CardDescription>Customers will see this page and enter their phone number to pay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Link Title *</Label>
                <Input
                  placeholder="e.g. Pay for Order #123"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="Additional details shown to the customer"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount in KES (leave blank to let customer enter)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  min="1"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Reference *</Label>
                <Input
                  placeholder="e.g. INV-001"
                  value={form.accountReference}
                  onChange={e => setForm(p => ({ ...p, accountReference: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Transaction Description *</Label>
                <Input
                  placeholder="e.g. Payment for web design services"
                  value={form.transactionDesc}
                  onChange={e => setForm(p => ({ ...p, transactionDesc: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.title || !form.accountReference || !form.transactionDesc}
              >
                {createMutation.isPending ? "Creating..." : "Create Link"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading links...</div>
      ) : links.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Link2 className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No payment links yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first link to start accepting payments.</p>
            <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Create Link</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map(link => (
            <Card key={link.id} className={!link.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{link.title}</h3>
                      <Badge variant={link.isActive ? "default" : "secondary"}>
                        {link.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {link.amount && (
                        <Badge variant="outline">KES {link.amount}</Badge>
                      )}
                      {!link.amount && (
                        <Badge variant="outline">Variable amount</Badge>
                      )}
                    </div>
                    {link.description && (
                      <p className="text-sm text-muted-foreground mb-1">{link.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {payUrl(link.slug)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => copyLink(link.slug, link.id)}
                    >
                      {copied === link.id ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === link.id ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <a href={payUrl(link.slug)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                    {link.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => deleteMutation.mutate(link.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
