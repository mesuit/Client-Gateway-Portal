import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/layout/protected-route";

// Pages
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
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
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
      <Route path="/docs">
        <ProtectedRoute><Docs /></ProtectedRoute>
      </Route>
      <Route path="/payment-links">
        <ProtectedRoute><PaymentLinks /></ProtectedRoute>
      </Route>
      <Route path="/test">
        <ProtectedRoute><TestPayment /></ProtectedRoute>
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
