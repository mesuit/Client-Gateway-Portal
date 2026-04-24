import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useListSettlementAccounts, 
  useAddSettlementAccount,
  useSetDefaultSettlementAccount,
  useDeleteSettlementAccount,
  getListSettlementAccountsQueryKey,
  AddSettlementAccountRequestAccountType
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Store, Check, Trash2, Loader2, Star, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const addAccountSchema = z.object({
  accountType: z.enum(["till", "paybill"] as const),
  accountNumber: z.string().min(5, "Account number is too short").max(20),
  accountName: z.string().min(2, "Account name is required"),
});

export default function Settlement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: accounts, isLoading } = useListSettlementAccounts();
  const addMutation = useAddSettlementAccount();
  const setDefaultMutation = useSetDefaultSettlementAccount();
  const deleteMutation = useDeleteSettlementAccount();

  const form = useForm<z.infer<typeof addAccountSchema>>({
    resolver: zodResolver(addAccountSchema),
    defaultValues: { 
      accountType: "till",
      accountNumber: "",
      accountName: ""
    },
  });

  const onSubmit = (values: z.infer<typeof addAccountSchema>) => {
    addMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSettlementAccountsQueryKey() });
          setIsAddOpen(false);
          form.reset();
          toast({ title: "Settlement account added successfully" });
        },
        onError: (err) => {
          toast({ title: "Failed to add account", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleSetDefault = (id: number) => {
    setDefaultMutation.mutate(
      { accountId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSettlementAccountsQueryKey() });
          toast({ title: "Default account updated" });
        },
        onError: (err) => {
          toast({ title: "Update failed", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(
      { accountId: deleteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSettlementAccountsQueryKey() });
          setDeleteId(null);
          toast({ title: "Account deleted" });
        },
        onError: (err) => {
          toast({ title: "Delete failed", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settlement Accounts</h2>
          <p className="text-muted-foreground">Manage your M-Pesa Till and Paybill numbers where funds are settled.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-blue-800 text-sm">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">How settlement works</p>
          <p>When a customer pays via your API or a payment link, the M-Pesa STK prompt is sent by the Nexus Pay platform — but if you have a <strong>Buy Goods Till</strong> set as default, the money goes <em>directly into your till</em>. Your customer sees your business name and you receive the M-Pesa confirmation SMS. No funds pass through Nexus Pay.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : accounts?.length === 0 ? (
        <Card className="border-dashed bg-gray-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No settlement accounts</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Add your M-Pesa Till or Paybill number to start receiving payments.
            </p>
            <Button onClick={() => setIsAddOpen(true)}>Add Settlement Account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts?.map((account) => (
            <Card key={account.id} className={`relative ${account.isDefault ? 'border-primary ring-1 ring-primary' : ''}`}>
              {account.isDefault && (
                <div className="absolute -top-3 -right-3 bg-primary text-white p-1.5 rounded-full shadow-sm">
                  <Star className="w-4 h-4 fill-current" />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      {account.accountType === "till" ? <Store className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{account.accountName}</CardTitle>
                      <CardDescription className="uppercase text-xs tracking-wider font-semibold mt-1">
                        {account.accountType === "till" ? "Buy Goods Till" : "Paybill Number"}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">Account Number</div>
                    <div className="font-mono text-lg font-medium tracking-tight">{account.accountNumber}</div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2">
                    {!account.isDefault && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSetDefault(account.id)}
                        disabled={setDefaultMutation.isPending}
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={`text-destructive hover:bg-destructive/10 hover:text-destructive ${account.isDefault ? 'w-full' : ''}`}
                      onClick={() => setDeleteId(account.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Settlement Account</DialogTitle>
            <DialogDescription>
              Add a new M-Pesa Till or Paybill number where collected funds will be settled.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="till">Buy Goods Till Number</SelectItem>
                        <SelectItem value="paybill">Paybill Number</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name / Store Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Main Branch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Account
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Settlement Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this account? You will no longer be able to route new payments to this number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
