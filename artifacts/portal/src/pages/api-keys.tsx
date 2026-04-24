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
import { Copy, Plus, Trash2, KeyRound, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  
  const [newKeyData, setNewKeyData] = useState<{ name: string; publicKey: string; secretKey: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

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
          setNewKeyData({
            name: values.keyName,
            publicKey: data.publicKey,
            secretKey: data.secretKey,
          });
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "API Key created successfully" });
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

  const copyToClipboard = (text: string, isSecret = false) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

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
            <h3 className="text-lg font-medium">No API keys found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Create an API key to authenticate your server requests to the Nexus Pay API.
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
                <div className="space-y-2">
                  <div className="text-sm font-medium">Public Key</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm font-mono truncate">
                      {key.publicKey}
                    </code>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(key.publicKey)}>
                      <Copy className="w-4 h-4" />
                    </Button>
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
              Give your new API key a descriptive name so you can identify it later.
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

      {/* Secret Key Modal (Shown only once) */}
      <Dialog open={!!newKeyData} onOpenChange={(open) => !open && setNewKeyData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <DialogTitle>API Key Created</DialogTitle>
            </div>
            <DialogDescription>
              Please copy your secret key now. You will not be able to see it again!
            </DialogDescription>
          </DialogHeader>
          
          {newKeyData && (
            <div className="space-y-4 my-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex gap-3 text-yellow-800">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-sm">Store this secret key securely. If you lose it, you'll need to generate a new API key.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Secret Key</Label>
                <div className="flex gap-2">
                  <Input readOnly value={newKeyData.secretKey} className="font-mono text-sm bg-gray-50" />
                  <Button 
                    variant={copiedSecret ? "default" : "outline"} 
                    className={copiedSecret ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => copyToClipboard(newKeyData.secretKey, true)}
                  >
                    {copiedSecret ? "Copied!" : <><Copy className="w-4 h-4 mr-2" /> Copy</>}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setNewKeyData(null)} className="w-full">
              I have saved my secret key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any applications using this API key will immediately lose access and requests will fail.
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
