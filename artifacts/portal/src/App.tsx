import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { AdminRoute } from "@/components/layout/admin-route";


// Pages
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import ApiKeys from "@/pages/api-keys";
import Settlement from "@/pages/settlement";
import Docs from "@/pages/docs";
import TestPayment from "@/pages/test-payment";
import PaymentLinks from "@/pages/payment-links";
import Pay from "@/pages/pay";
import AdminPanel from "@/pages/admin";
import B2C from "@/pages/b2c";
import CardPayments from "@/pages/card";
import CardTest from "@/pages/card-test";
import Saas from "@/pages/saas";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/pay/:slug" component={Pay} />
      
      {/* Protected Routes */}
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/transactions">
        <ProtectedRoute><Transactions /></ProtectedRoute>
      </Route>
      <Route path="/api-keys">
        <ProtectedRoute><ApiKeys /></ProtectedRoute>
      </Route>
      <Route path="/settlement">
        <ProtectedRoute><Settlement /></ProtectedRoute>
      </Route>
      <Route path="/docs" component={Docs} />
      <Route path="/payment-links">
        <ProtectedRoute><PaymentLinks /></ProtectedRoute>
      </Route>
      <Route path="/test">
        <ProtectedRoute><TestPayment /></ProtectedRoute>
      </Route>
      <Route path="/b2c">
        <ProtectedRoute><B2C /></ProtectedRoute>
      </Route>
      <Route path="/card">
        <ProtectedRoute><CardPayments /></ProtectedRoute>
      </Route>
      <Route path="/card-test">
        <ProtectedRoute><CardTest /></ProtectedRoute>
      </Route>
      <Route path="/saas">
        <ProtectedRoute><Saas /></ProtectedRoute>
      </Route>
      <Route path="/admin">
        <AdminRoute><AdminPanel /></AdminRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
