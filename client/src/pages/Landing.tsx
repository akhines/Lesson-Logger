import { Button } from "@/components/ui/button";
import { GraduationCap, Calendar, BookOpen, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-border/50 backdrop-blur-sm fixed w-full z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-xl">Scholar</span>
          </div>
          <Button onClick={handleLogin} variant="default" className="font-semibold">
            Log In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-display font-bold leading-[1.1] text-foreground">
                Homeschooling <br/>
                <span className="text-primary">Made Simple</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Manage lessons, track assignments, and organize your curriculum in one beautiful dashboard. Focus on teaching, not planning.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" onClick={handleLogin} className="text-lg px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Get Started Free
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 h-12">
                  View Demo
                </Button>
              </div>
            </div>
            <div className="relative">
              {/* Decorative blob */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-3xl opacity-50 animate-pulse" />
              
              {/* Card stack illustration */}
              <div className="relative bg-card rounded-2xl shadow-2xl border border-border p-6 md:p-8 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">Weekly Schedule</h3>
                    <p className="text-sm text-muted-foreground">Oct 24 - Oct 30</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { title: "Algebra: Quadratic Equations", sub: "Math • 9:00 AM", color: "bg-blue-500" },
                    { title: "The American Revolution", sub: "History • 10:30 AM", color: "bg-amber-500" },
                    { title: "Lab: Plant Biology", sub: "Science • 1:00 PM", color: "bg-emerald-500" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 border border-border/50">
                      <div className={`h-10 w-1 rounded-full ${item.color}`} />
                      <div>
                        <p className="font-semibold text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-display font-bold mb-4">Everything you need to succeed</h2>
            <p className="text-muted-foreground">Built specifically for homeschool educators and students to stay on track.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: Calendar, 
                title: "Flexible Scheduling", 
                desc: "Drag-and-drop lesson planning that adapts to your life, not the other way around." 
              },
              { 
                icon: BookOpen, 
                title: "Curriculum Tracking", 
                desc: "Manage multiple subjects and track progress across the entire school year." 
              },
              { 
                icon: CheckCircle, 
                title: "Assignment Management", 
                desc: "Create assignments, accept uploads, and grade work all in one place." 
              },
            ].map((feature, i) => (
              <div key={i} className="bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300 group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border mt-auto">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 Scholar App. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
