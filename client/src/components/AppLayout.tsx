import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  BookOpen, 
  CalendarDays, 
  LogOut, 
  Menu,
  GraduationCap,
  Users,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: Users },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/subjects", label: "Subjects", icon: BookOpen },
    { href: "/wizard", label: "Wizard", icon: Sparkles },
  ];

  const Sidebar = () => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl leading-none tracking-tight">Scholar</h1>
            <p className="text-xs text-muted-foreground mt-1">Homeschool Manager</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                `}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback>{user?.firstName?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 fixed inset-y-0 z-50">
        <Sidebar />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed inset-x-0 top-0 h-16 bg-card/80 backdrop-blur-md border-b border-border z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-display font-bold text-lg">Scholar</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen w-full">
        <div className="container max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
