import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import sunwovenLogo from "@assets/sunwoven_logo_only_1769366536907.png";
import type { SiteSetting } from "@shared/schema";

const DEFAULT_CONTENT = {
  heroHeadline: "Homeschooling Made Simple",
  heroSubheadline: "Manage lessons, track assignments, and organize your curriculum in one beautiful dashboard. Focus on teaching, not planning.",
  heroPrimaryButton: "Get Started Free",
  heroSecondaryButton: "View Demo",
  featuresHeadline: "Everything you need to succeed",
  featuresSubheadline: "Built specifically for homeschool educators and students to stay on track.",
  feature1Title: "Flexible Scheduling",
  feature1Description: "Drag-and-drop lesson planning that adapts to your life, not the other way around.",
  feature2Title: "Curriculum Tracking",
  feature2Description: "Manage multiple subjects and track progress across the entire school year.",
  feature3Title: "Assignment Management",
  feature3Description: "Create assignments, accept uploads, and grade work all in one place.",
  footerText: "© 2024 Sunwoven Homeschool. All rights reserved.",
};

export default function Landing() {
  const [, setLocation] = useLocation();

  const { data: siteSettings } = useQuery<SiteSetting[]>({
    queryKey: ["/api/site-settings/public"],
  });

  const getContent = (key: keyof typeof DEFAULT_CONTENT) => {
    const setting = siteSettings?.find(s => s.key === key);
    return setting?.value || DEFAULT_CONTENT[key];
  };

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const features = [
    { 
      icon: Calendar, 
      title: getContent("feature1Title"), 
      desc: getContent("feature1Description"),
      color: "bg-blue-500" 
    },
    { 
      icon: BookOpen, 
      title: getContent("feature2Title"), 
      desc: getContent("feature2Description"),
      color: "bg-amber-500" 
    },
    { 
      icon: CheckCircle, 
      title: getContent("feature3Title"), 
      desc: getContent("feature3Description"),
      color: "bg-emerald-500" 
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-border/50 backdrop-blur-sm fixed w-full z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src={sunwovenLogo} 
              alt="Sunwoven Homeschool" 
              className="h-12 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setLocation("/student-login")} variant="outline" className="font-semibold" data-testid="button-student-login">
              Student Login
            </Button>
            <Button onClick={handleLogin} variant="default" className="font-semibold" data-testid="button-parent-login">
              Parent Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-display font-bold leading-[1.1] text-foreground">
                {getContent("heroHeadline").split(" ").slice(0, -2).join(" ")} <br/>
                <span className="text-primary">{getContent("heroHeadline").split(" ").slice(-2).join(" ")}</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                {getContent("heroSubheadline")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" onClick={handleLogin} className="text-lg px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  {getContent("heroPrimaryButton")}
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 h-12">
                  {getContent("heroSecondaryButton")}
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
            <h2 className="text-3xl font-display font-bold mb-4">{getContent("featuresHeadline")}</h2>
            <p className="text-muted-foreground">{getContent("featuresSubheadline")}</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
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
          <p>{getContent("footerText")}</p>
        </div>
      </footer>
    </div>
  );
}
