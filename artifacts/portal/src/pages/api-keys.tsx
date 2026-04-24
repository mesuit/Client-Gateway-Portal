import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useListApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  getListApiKeysQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, Plus, Trash2, KeyRound, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const createKeySchema = z.object({
  keyName: z.string().min(2, "Name must be at least 2 characters").max(50),
});

interface NewKeyData { name: string; publicKey: string; secretKey: string; }

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [newKeyData, setNewKeyData] = useState<NewKeyData | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: keys, isLoading } = useListApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();

  const form = useForm<z.infer<typeof createKeySchema>>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { keyName: "" },
  });

  const onSubmit = (values: z.infer<typeof createKeySchema>) => {
    createMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          setShowSecret(false);
          setCopied(false);
          setNewKeyData({
            name: values.keyName,
            publicKey: data.publicKey,
            secretKey: data.secretKey,
          });
        },
        onError: (err) => {
          toast({ title: "Failed to create key", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleRevoke = () => {
    if (!revokeId) return;
    revokeMutation.mutate(
      { keyId: revokeId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          setRevokeId(null);
          toast({ title: "API Key revoked successfully" });
        },
        onError: (err) => {
          toast({ title: "Failed to revoke key", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const copySecret = () => {
    if (!newKeyData) return;
    navigator.clipboard.writeText(newKeyData.secretKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      toast({ title: "Secret key copied to clipboard" });
    });
  };

  // Full-page success view when a key was just created
  if (newKeyData) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">API Key Created</h2>
            <p className="text-muted-foreground text-sm">Key: <strong>{newKeyData.name}</strong></p>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              <CardTitle className="text-base text-amber-800">Copy your secret key now</CardTitle>
            </div>
            <CardDescription className="text-amber-700">
              This is the <strong>only time</strong> you will see the full secret key. Store it securely — you cannot retrieve it later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-amber-800 font-semibold">Secret Key (use this for API calls)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    readOnly
                    value={newKeyData.secretKey}
                    type={showSecret ? "text" : "password"}
                    className="font-mono text-sm bg-white pr-10 border-amber-300"
                  />
                  <button
                    onClick={() => setShowSecret(p => !p)}
                    className="absolute right-3 top-2.5 text-amber-600 hover:text-amber-800"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  onClick={copySecret}
                  className={copied ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}
                >
                  {copied ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy</>}
                </Button>
              </div>
              <p className="text-xs text-amber-700 font-mono">Prefix: {newKeyData.secretKey.slice(0, 10)}...</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Public Identifier (not used for API auth)</Label>
              <div className="flex gap-2">
                <Input readOnly value={newKeyData.publicKey} className="font-mono text-sm bg-gray-50 text-gray-500" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(newKeyData.publicKey); toast({ title: "Copied" }); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
          <p className="font-semibold">How to use your secret key:</p>
          <code className="block bg-gray-900 text-green-300 p-3 rounded-lg text-xs font-mono mt-2">
            {`X-API-Key: ${newKeyData.secretKey.slice(0, 20)}...`}
          </code>
          <p className="text-xs text-gray-400 mt-2">Pass this header in every API request to authenticate.</p>
        </div>

        <Button
          onClick={() => setNewKeyData(null)}
          variant="outline"
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to API Keys
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground">Manage your API keys for integrating with Nexus Pay.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Secret Key
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : keys?.length === 0 ? (
        <Card className="border-dashed bg-gray-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <KeyRound className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No API keys yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Create your first API key to start accepting M-Pesa payments via the Nexus Pay API.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>Create Secret Key</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {keys?.map((key) => (
            <Card key={key.id} className={!key.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{key.keyName}</CardTitle>
                    {key.isActive ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                  </div>
                  {key.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setRevokeId(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Created on {format(new Date(key.createdAt), "MMM d, yyyy")}
                  {key.lastUsedAt && ` • Last used ${format(new Date(key.lastUsedAt), "MMM d, yyyy")}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Public Identifier</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm font-mono truncate">
                        {key.publicKey}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(key.publicKey); toast({ title: "Copied" }); }}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-xs flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      API calls require your <strong>Secret Key</strong> (<code className="bg-amber-100 px-1 rounded">sk_...</code>), shown once at creation. If lost, create a new key.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Key Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your key a name (e.g. "Production Server" or "Website"). The secret key is shown once — copy it immediately.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="keyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Production Web Server" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Key
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Any app using this key will immediately lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRevoke(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
