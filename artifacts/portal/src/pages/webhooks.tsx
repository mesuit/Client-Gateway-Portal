import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Rss, Copy, CheckCircle2, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";
import { format } from "date-fns";

const API_BASE = "";

type WebhookRow = {
  id: number;
  url: string;
  secret: string;
  events: string;
  isActive: boolean;
  createdAt: string;
};

const ALL_EVENTS = [
  { key: "payment.completed", label: "Payment Completed", desc: "Fires when an M-Pesa STK Push payment succeeds" },
  { key: "payment.failed", label: "Payment Failed", desc: "Fires when an STK Push payment fails or is rejected" },
  { key: "payment.cancelled", label: "Payment Cancelled", desc: "Fires when the user cancels the STK Push prompt" },
  { key: "subscription.activated", label: "Subscription Activated", desc: "Fires when a SaaS subscription payment is confirmed (Nexus Pay only)" },
];

export default function Webhooks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["payment.completed", "payment.failed"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: webhooks, isLoading } = useQuery<WebhookRow[]>({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/webhooks`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load webhooks");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ url: wUrl, events }: { url: string; events: string[] }) => {
      const r = await fetch(`${API_BASE}/api/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ url: wUrl, events }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      setNewSecret(data.secret);
      setUrl("");
      setSelectedEvents(["payment.completed", "payment.failed"]);
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/webhooks/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast({ title: "Webhook deleted" });
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(`${API_BASE}/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ isActive }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleCopy(secret: string) {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggleEvent(key: string) {
    setSelectedEvents(prev =>
      prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Webhooks</h2>
          <p className="text-muted-foreground">Get real-time HTTP notifications when payments happen in your account.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2" disabled={(webhooks?.length ?? 0) >= 5}>
          <Plus className="w-4 h-4" /> Add Webhook
        </Button>
      </div>

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-5 space-y-2 text-sm text-blue-800">
          <p className="font-semibold flex items-center gap-2"><Rss className="w-4 h-4" /> How Webhooks Work</p>
          <p>When a payment is completed or fails, we send a <strong>POST</strong> request to your URL with a JSON body. Every request includes an <code className="bg-blue-100 px-1 rounded font-mono text-xs">X-Webhook-Signature</code> header — a SHA-256 HMAC of the body using your webhook secret. Verify it to ensure the request came from us.</p>
          <div className="bg-blue-100 rounded-lg p-3 font-mono text-xs mt-1">
            {`// Node.js verification example
const sig = req.headers['x-webhook-signature']; // "sha256=..."
const expected = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (sig !== expected) return res.status(401).end();`}
          </div>
        </CardContent>
      </Card>

      {/* Webhook list */}
      {isLoading && <Loader2 className="animate-spin" />}
      {!isLoading && (webhooks?.length ?? 0) === 0 && (
        <div className="text-center py-16 border rounded-xl bg-gray-50">
          <Rss className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-muted-foreground">No webhooks yet</p>
          <p className="text-sm text-muted-foreground">Click "Add Webhook" to receive real-time payment events.</p>
        </div>
      )}
      {webhooks?.map(w => (
        <Card key={w.id} className={w.isActive ? "" : "opacity-60"}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm font-mono bg-gray-100 rounded px-2 py-0.5 break-all">{w.url}</code>
                  <Badge variant={w.isActive ? "default" : "secondary"}>
                    {w.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {w.events.split(",").map(e => (
                    <span key={e} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{e.trim()}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Secret: <code className="font-mono">{w.secret}</code> · Added {format(new Date(w.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleMutation.mutate({ id: w.id, isActive: !w.isActive })}
                  disabled={toggleMutation.isPending}
                  title={w.isActive ? "Pause" : "Resume"}
                >
                  {w.isActive
                    ? <ToggleRight className="w-5 h-5 text-green-600" />
                    : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  }
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => deleteMutation.mutate(w.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {(webhooks?.length ?? 0) >= 5 && (
        <p className="text-xs text-muted-foreground text-center">Maximum of 5 webhooks reached.</p>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen && !newSecret} onOpenChange={open => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <CardDescription>We'll POST payment events to this URL in real-time.</CardDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Endpoint URL</Label>
              <Input
                type="url"
                placeholder="https://yourapp.com/webhooks/pesagate"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Events to receive</Label>
              {ALL_EVENTS.map(ev => (
                <div key={ev.key} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id={ev.key}
                    checked={selectedEvents.includes(ev.key)}
                    onCheckedChange={() => toggleEvent(ev.key)}
                    className="mt-0.5"
                  />
                  <label htmlFor={ev.key} className="cursor-pointer flex-1">
                    <div className="text-sm font-medium">{ev.label}</div>
                    <div className="text-xs text-muted-foreground">{ev.desc}</div>
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ url, events: selectedEvents })}
              disabled={createMutation.isPending || !url || selectedEvents.length === 0}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret reveal dialog (shown once after creation) */}
      <Dialog open={!!newSecret} onOpenChange={open => { if (!open) { setNewSecret(null); setCreateOpen(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Webhook Created!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ Save this secret now — it won't be shown again</p>
              <p>Use it to verify the <code>X-Webhook-Signature</code> header on incoming requests.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Webhook Secret</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 rounded px-3 py-2 font-mono text-sm break-all">{newSecret}</code>
                <Button size="sm" variant="outline" onClick={() => handleCopy(newSecret!)}>
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setNewSecret(null); setCreateOpen(false); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
