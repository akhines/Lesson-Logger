import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Clock,
  FolderOpen,
  Download,
  Link2,
  Bell,
  LayoutDashboard,
  ArrowRight,
  CheckCircle,
  Star,
  Quote,
  FileText,
  Share2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import appLogo from "@assets/Lesson_Logger_1770312446893.PNG";
import dashboardPreview from "@assets/hero-lesson-portfolio.png";

const FEATURES = [
  {
    icon: Clock,
    title: "30-Second Logging",
    description: "Pick a student, pick a subject, jot a note. Done. Your day is logged before your coffee gets cold.",
  },
  {
    icon: LayoutDashboard,
    title: "Calm Dashboard",
    description: "See what matters today. Gentle nudges, not nagging checklists. A quiet home base that keeps you on track.",
  },
  {
    icon: FolderOpen,
    title: "Auto-Built Portfolio",
    description: "Every log, photo, and note is organized by student, subject, and date. Your portfolio builds itself.",
  },
  {
    icon: Download,
    title: "One-Click Exports",
    description: "Need records for an umbrella school or co-op? Export a polished PDF in one click. No reformatting.",
  },
  {
    icon: Share2,
    title: "Secure Share Links",
    description: "Share a read-only portfolio with grandparents, evaluators, or co-op leaders. Password-protect if you want.",
  },
  {
    icon: Bell,
    title: "Gentle Reminders",
    description: "Opt-in daily or weekly nudges so nothing slips through the cracks. Never guilt-trippy, always helpful.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Log in 30 seconds",
    description: "Open the Quick Log, select your student and subject, add optional notes or photos, and tap save. That's it.",
    icon: FileText,
  },
  {
    step: "2",
    title: "Watch your portfolio build itself",
    description: "Every entry is automatically organized by student, subject, and date into a timeline you can browse anytime.",
    icon: FolderOpen,
  },
  {
    step: "3",
    title: "Share or export anytime",
    description: "Generate a polished PDF for your records, or create a secure share link for evaluators and family.",
    icon: Link2,
  },
];

const PAIN_POINTS = [
  "Scattered notes across notebooks, apps, and spreadsheets",
  "Forgotten logs you have to reconstruct from memory",
  "Portfolio stress when review time comes around",
  "The end-of-year scramble to pull records together",
  "Sharing progress with family or evaluators is messy",
];

const TESTIMONIALS = [
  {
    name: "Sarah M.",
    role: "Mom of 3, Oklahoma",
    content: "I used to dread record-keeping. Now I log in under a minute while the kids clean up. It's become the easiest part of our day.",
    rating: 5,
  },
  {
    name: "Jessica R.",
    role: "Homeschool mom, Texas",
    content: "The portfolio just builds itself. When our evaluator asked for records, I exported everything in two clicks. She was impressed.",
    rating: 5,
  },
  {
    name: "Amanda K.",
    role: "Mom of 2, Virginia",
    content: "Finally something that doesn't try to be a curriculum. It just helps me track what we're already doing. Exactly what I needed.",
    rating: 5,
  },
];

const FAQS = [
  {
    q: "Is this a curriculum?",
    a: "No. Lesson Logger doesn't tell you what to teach. It helps you track, organize, and share what you're already doing, no matter your method or style.",
  },
  {
    q: "How long does daily logging take?",
    a: "Most families spend about 30 seconds per entry. Quick Log lets you pick a student, subject, and add a note. That's it.",
  },
  {
    q: "Can I share my portfolio with someone?",
    a: "Yes. You can create a secure, read-only share link for evaluators, grandparents, or co-op leaders. You can password-protect it and set it to expire.",
  },
  {
    q: "What does the free trial include?",
    a: "Everything. You get full access to all features for 7 days. No credit card required. If you like it, plans start at $19/month.",
  },
  {
    q: "Can I export my records?",
    a: "Yes. You can export a professional PDF of your portfolio at any time. It includes all your logs, evidence, and notes organized chronologically.",
  },
  {
    q: "Is my data private?",
    a: "Absolutely. Your family's data is yours. We never share, sell, or use it for advertising. Share links are opt-in and you control who sees what.",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogin = () => {
    setLocation("/login");
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-border/40 backdrop-blur-md fixed w-full z-50 bg-background/90">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex flex-col items-start">
            <img
              src={appLogo}
              alt="Lesson Logger"
              className="h-10 w-auto object-contain"
              data-testid="img-logo"
            />
            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">brought to you by Home Education Software</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => scrollToSection("how-it-works")} data-testid="button-nav-how-it-works">
              How It Works
            </Button>
            <Button variant="ghost" size="sm" onClick={() => scrollToSection("features")} data-testid="button-nav-features">
              Features
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/pricing")} data-testid="button-nav-pricing">
              Pricing
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button variant="ghost" size="sm" onClick={handleLogin} data-testid="button-sign-in">
              Sign In
            </Button>
            <Button size="sm" onClick={() => setLocation("/pricing")} data-testid="button-nav-start-free">
              Start Free
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-nav-menu" className="md:hidden border-t border-border/40 bg-background px-4 py-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => scrollToSection("how-it-works")} data-testid="button-mobile-how-it-works">
              How It Works
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => scrollToSection("features")} data-testid="button-mobile-features">
              Features
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => setLocation("/pricing")} data-testid="button-mobile-pricing">
              Pricing
            </Button>
            <div className="border-t border-border/40 pt-2 mt-2 space-y-2">
              <Button variant="outline" className="w-full" onClick={handleLogin} data-testid="button-mobile-sign-in">
                Sign In
              </Button>
              <Button className="w-full" onClick={() => setLocation("/pricing")} data-testid="button-mobile-start-free">
                Start Free
              </Button>
            </div>
          </div>
        )}
      </nav>

      <section className="pt-28 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-6 max-w-xl">
              <p className="text-sm font-medium text-primary tracking-wide uppercase" data-testid="text-hero-tagline">
                The calm homeschool organizer
              </p>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold leading-[1.1] text-foreground" data-testid="text-hero-headline">
                Your homeschool,{" "}
                <span className="text-primary">organized.</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed" data-testid="text-hero-subheadline">
                Log lessons in seconds, build your portfolio automatically, and export or share anytime.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => setLocation("/pricing")}
                  className="text-base px-8 h-12 shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/25 transition-all"
                  data-testid="button-hero-start-free"
                >
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollToSection("how-it-works")}
                  className="text-base px-8 h-12"
                  data-testid="button-hero-how-it-works"
                >
                  See How It Works
                </Button>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-hero-no-cc">
                7-day free trial. No credit card required.
              </p>
            </div>

            <div className="relative lg:ml-4">
              <div className="absolute -inset-6 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 rounded-3xl blur-2xl opacity-60" />
              <div className="relative rounded-xl shadow-2xl shadow-black/10 border border-border/60 overflow-hidden" data-testid="img-hero-preview">
                <img
                  src={dashboardPreview}
                  alt="Lesson Logger dashboard showing lesson logs and portfolio"
                  className="w-full h-auto"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6" data-testid="text-problem-headline">
            Homeschool shouldn't feel like paperwork.
          </h2>
          <p className="text-muted-foreground mb-10 text-lg max-w-2xl mx-auto">
            You got into this to give your kids something better. But the tracking, the records, the "did we do enough?" worry? That part shouldn't be hard.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            {PAIN_POINTS.map((point, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className="h-2 w-2 rounded-full bg-destructive/60 mt-2 flex-shrink-0" />
                <span className="text-muted-foreground" data-testid={`text-pain-point-${i}`}>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4" data-testid="text-how-it-works-headline">
              Three steps. That's it.
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              No setup wizards, no learning curve. Start logging today.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="text-center space-y-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <step.icon className="h-7 w-7" />
                </div>
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold" data-testid={`text-step-title-${step.step}`}>{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed" data-testid={`text-step-desc-${step.step}`}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4" data-testid="text-features-headline">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Built for real homeschool families, not institutions.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <Card key={i} className="border-border/60 bg-card/80 hover:shadow-md transition-shadow duration-200">
                <CardContent className="pt-6 pb-5 px-6 space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold" data-testid={`text-feature-title-${i}`}>{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed" data-testid={`text-feature-desc-${i}`}>
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4" data-testid="text-testimonials-headline">
              Trusted by homeschool families
            </h2>
            <p className="text-muted-foreground text-lg">
              Hear from parents who made record-keeping the easiest part of their day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Card key={i} className="border-border/60">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-0.5">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <Quote className="h-6 w-6 text-primary/20" />
                  <p className="text-muted-foreground italic leading-relaxed text-sm" data-testid={`text-testimonial-${i}`}>
                    "{t.content}"
                  </p>
                  <div className="pt-2 border-t border-border/40">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4" data-testid="text-pricing-headline">
              One plan. Everything included.
            </h2>
            <p className="text-muted-foreground text-lg">
              No tiers to compare. No features hidden behind upgrades.
            </p>
          </div>

          <Card className="max-w-md mx-auto border-primary/30 shadow-lg">
            <CardContent className="pt-8 pb-8 px-8 space-y-6">
              <div className="text-center">
                <p className="text-sm font-medium text-primary mb-1">Standard</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold">$19</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">7-day free trial included</p>
              </div>

              <ul className="space-y-3">
                {[
                  "Up to 3 students included",
                  "30-second lesson logging",
                  "Auto-organized portfolio",
                  "PDF exports",
                  "Secure share links",
                  "Daily & weekly reminders",
                  "Student portal access",
                  "Dashboard guidance",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-center text-muted-foreground">
                + $10/month for each additional student beyond 3
              </p>

              <Button
                className="w-full h-12 text-base"
                onClick={() => setLocation("/pricing")}
                data-testid="button-pricing-start-free"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">No credit card required</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-3xl font-display font-bold mb-8 text-center" data-testid="text-faq-headline">
            Common Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-semibold" data-testid={`button-faq-${i}`}>
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed" data-testid={`text-faq-answer-${i}`}>
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-24 px-4 bg-primary/5">
        <div className="container mx-auto max-w-2xl text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-display font-bold" data-testid="text-final-cta-headline">
            Start your most organized homeschool year yet.
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Join families who spend less time on paperwork and more time on what matters.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              size="lg"
              onClick={() => setLocation("/pricing")}
              className="text-base px-8 h-12"
              data-testid="button-final-cta-start-free"
            >
              Start Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleLogin}
              className="text-base px-8 h-12"
              data-testid="button-final-cta-sign-in"
            >
              Sign In
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      <footer className="py-10 border-t border-border/40 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-start">
              <img src={appLogo} alt="Lesson Logger" className="h-8 w-auto object-contain" />
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">brought to you by Home Education Software</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors" data-testid="link-footer-pricing">
                Pricing
              </button>
              <button onClick={() => scrollToSection("how-it-works")} className="hover:text-foreground transition-colors" data-testid="link-footer-how-it-works">
                How It Works
              </button>
              <button onClick={handleLogin} className="hover:text-foreground transition-colors" data-testid="link-footer-sign-in">
                Sign In
              </button>
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-footer-copyright">
              &copy; {new Date().getFullYear()} Lesson Logger. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
