import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import appLogo from "@assets/Lesson_Logger_1770312446893.PNG";

const INCLUDED_FEATURES = [
  "Up to 3 students",
  "30-second lesson logging",
  "Auto-organized portfolio",
  "PDF export packs",
  "Secure shareable portfolio links",
  "Daily & weekly email reminders",
  "Student portal with PIN access",
  "Calm dashboard with guidance",
  "Evidence uploads & review queue",
  "Subject & schedule management",
];

const FAQS = [
  {
    q: "How does the free trial work?",
    a: "Sign up and get full access to every feature for 7 days. No credit card required. After 7 days, subscribe to keep going or your account pauses until you're ready.",
  },
  {
    q: "Can I add more than 3 students?",
    a: "Yes. Your plan includes 3 students. Each additional student is $10/month, added to your subscription automatically when you create them.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep access through the end of your billing period. Your data is never deleted, so you can come back anytime and pick up where you left off.",
  },
  {
    q: "Is there a yearly plan?",
    a: "Not yet, but we're working on it. For now, all plans are billed monthly with no commitment.",
  },
  {
    q: "Do you offer refunds?",
    a: "If you're not happy within the first 30 days of a paid subscription, reach out and we'll make it right.",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleStartTrial = () => {
    window.location.href = "/api/login?plan=standard";
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/40 backdrop-blur-md fixed w-full z-50 bg-background/90">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img
                src={appLogo}
                alt="Lesson Logger"
                className="h-10 w-auto object-contain"
                data-testid="img-pricing-logo"
              />
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={() => setLocation("/")} variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Home
            </Button>
            {user ? (
              <Button onClick={() => setLocation("/")} variant="default" size="sm" data-testid="button-go-to-dashboard">
                Go to Dashboard
              </Button>
            ) : (
              <Button onClick={() => window.location.href = "/api/login"} variant="outline" size="sm" data-testid="button-login">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <Badge className="bg-primary/10 text-primary border-primary/20" data-testid="badge-free-trial">
              7-Day Free Trial
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-display font-bold" data-testid="text-pricing-title">
              One plan. Everything included.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto" data-testid="text-pricing-subtitle">
              No tiers to compare, no features locked behind upgrades. Just a simple, fair price for everything you need.
            </p>
          </div>

          <Card className="max-w-lg mx-auto border-primary/30 shadow-lg" data-testid="card-plan-standard">
            <CardContent className="pt-8 pb-8 px-8 space-y-8">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-primary uppercase tracking-wide">Standard</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-6xl font-bold" data-testid="text-price">$19</span>
                  <span className="text-muted-foreground text-lg">/month</span>
                </div>
                <p className="text-sm text-primary font-medium">First 7 days free</p>
              </div>

              <ul className="space-y-3">
                {INCLUDED_FEATURES.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm" data-testid={`text-plan-feature-${i}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-4">
                  + $10/month for each additional student beyond 3
                </p>
                <Button
                  className="w-full h-12 text-base"
                  onClick={handleStartTrial}
                  data-testid="button-start-trial-standard"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground mt-3">No credit card required</p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-16 max-w-2xl mx-auto">
            <h2 className="text-2xl font-display font-bold mb-6 text-center" data-testid="text-pricing-faq-title">
              Questions about pricing
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left font-semibold" data-testid={`button-pricing-faq-${i}`}>
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed" data-testid={`text-pricing-faq-answer-${i}`}>
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-16 text-center space-y-2">
            <p className="text-sm text-muted-foreground">All subscriptions billed monthly. Cancel anytime.</p>
            <p className="text-sm text-muted-foreground">Secure payments powered by Stripe.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
