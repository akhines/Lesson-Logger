import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Subjects from "@/pages/Subjects";
import Schedule from "@/pages/Schedule";
import Students from "@/pages/Students";
import StudentLogin from "@/pages/StudentLogin";
import StudentPortal from "@/pages/StudentPortal";
import { Loader2 } from "lucide-react";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Student routes are always available regardless of parent auth status
  return (
    <Switch>
      {/* Student routes - always accessible */}
      <Route path="/student-login" component={StudentLogin} />
      <Route path="/student-portal" component={StudentPortal} />
      
      {/* Parent routes - conditional based on auth */}
      {!user ? (
        <>
          <Route path="/" component={Landing} />
          <Route component={() => {
             window.location.href = "/";
             return null;
          }} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/students" component={Students} />
          <Route path="/subjects" component={Subjects} />
          <Route path="/schedule" component={Schedule} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
