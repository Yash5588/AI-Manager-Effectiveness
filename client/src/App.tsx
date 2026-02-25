import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import EmployeeFeedback from "./pages/EmployeeFeedback";
import HRDashboard from "./pages/HRDashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Protected route for managers
const ManagerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "manager") return <Navigate to={user.role === "hr" ? "/hr" : "/employee/feedback"} replace />;
  return <>{children}</>;
};

// Protected route for employees
const EmployeeRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "employee") return <Navigate to={user.role === "hr" ? "/hr" : "/"} replace />;
  return <>{children}</>;
};

// Protected route for HR
const HRRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "hr") return <Navigate to={user.role === "manager" ? "/" : "/employee/feedback"} replace />;
  return <>{children}</>;
};

// Redirect logged-in users away from login page
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (user) {
    const dest = user.role === "hr" ? "/hr" : user.role === "manager" ? "/" : "/employee/feedback";
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />Step 4 — Update Auth Routes to support HR login

Editing

      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<ManagerRoute><Index /></ManagerRoute>} />
            <Route path="/employee/feedback" element={<EmployeeRoute><EmployeeFeedback /></EmployeeRoute>} />
            <Route path="/hr" element={<HRRoute><HRDashboard /></HRRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
