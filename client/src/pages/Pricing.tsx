// Pricing page for subscription plans - public page before sign-in
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Crown, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import appLogo from "@assets/Lesson_Logger_1770312446893.PNG";

// Static feature lists for display
const PLAN_FEATURES: Record<string, string[]> = {
  basic: [
    "Dashboard & Reports",
    "Up to 3 students included",
    "Weekly schedule management",
    "Subject & lesson tracking",
    "Portfolio uploads & review",
    "Labels & tagging",
    "Student portal access",
  ],
  premium: [
    "Everything in Basic",
    "Library (audiobooks & ebooks)",
    "AI Curriculum Upload",
    "Study Helper (AI assistant)",
    "Math Facts Practice",
    "Grammar Practice",
    "Copywork Generator",
  ],
};

// Plan definitions
const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 29,
    description: "Everything you need to manage your homeschool",
    features: PLAN_FEATURES.basic,
    highlight: false,
    icon: Check,
  },
  {
    id: "premium",
    name: "Premium",
    price: 49,
    description: "Full access to all features including AI tools",
    features: PLAN_FEATURES.premium,
    highlight: true,
    icon: Crown,
  },
];

export default function Pricing() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleStartTrial = (planId: string) => {
    // Redirect to login, which will start the trial process
    // The plan selection will be handled after authentication
    window.location.href = `/api/login?plan=${planId}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border/50 backdrop-blur-sm fixed w-full z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img 
                src={appLogo} 
                alt="Lesson Logger" 
                className="h-12 w-auto object-contain"
              />
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={() => setLocation("/")} variant="ghost" className="font-semibold" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            {user ? (
              <Button onClick={() => setLocation("/")} variant="default" className="font-semibold" data-testid="button-go-to-dashboard">
                Go to Dashboard
              </Button>
            ) : (
              <Button onClick={() => window.location.href = "/api/login"} variant="outline" className="font-semibold" data-testid="button-login">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              7-Day Free Trial
            </Badge>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start your 7-day free trial today. No credit card required.
              Cancel anytime during the trial.
            </p>
          </div>

          {/* Plan Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {PLANS.map((plan) => {
              const Icon = plan.icon;

              return (
                <Card 
                  key={plan.id} 
                  className={`relative ${plan.highlight ? "border-primary shadow-lg scale-[1.02]" : ""}`}
                  data-testid={`card-plan-${plan.id}`}
                >
                  {plan.highlight && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${plan.highlight ? "text-primary" : "text-muted-foreground"}`} />
                      <CardTitle>{plan.name}</CardTitle>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-primary font-medium mt-2">
                      First 7 days free
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.id === "basic" && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        + $10/month for each additional student beyond 3
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => handleStartTrial(plan.id)}
                      data-testid={`button-start-trial-${plan.id}`}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Free Trial
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Additional Students Info */}
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-display font-bold mb-4">
              Need More Students?
            </h2>
            <p className="text-muted-foreground mb-4">
              Both plans include up to 3 students. Add more students for just $10/month each.
            </p>
          </div>

          {/* FAQ / Trust Section */}
          <div className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-display font-bold mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div className="border-b border-border pb-6">
                <h3 className="font-semibold mb-2">How does the free trial work?</h3>
                <p className="text-muted-foreground">
                  Sign up and get full access to all features for 7 days, completely free. 
                  No credit card required during the trial. After 7 days, choose a plan to continue.
                </p>
              </div>
              <div className="border-b border-border pb-6">
                <h3 className="font-semibold mb-2">Can I switch plans later?</h3>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.
                </p>
              </div>
              <div className="border-b border-border pb-6">
                <h3 className="font-semibold mb-2">What happens if I cancel?</h3>
                <p className="text-muted-foreground">
                  You can cancel your subscription anytime. You'll continue to have access until the end of your billing period.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 text-center text-sm text-muted-foreground">
            <p>All subscriptions are billed monthly. Cancel anytime.</p>
            <p>Secure payments powered by Stripe.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
