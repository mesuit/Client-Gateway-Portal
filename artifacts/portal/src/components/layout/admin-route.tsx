import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { Loader2, ShieldX } from "lucide-react";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  const isAdmin = (user as any)?.isAdmin === true;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }
    if (!isAdmin) {
      setLocation("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAdmin, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <ShieldX className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-gray-500 text-sm">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return <Sidebar>{children}</Sidebar>;
}
