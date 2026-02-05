// Pricing page for subscription plans - public page before sign-in
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import appLogo from "@assets/Lesson_Logger_1770312446893.PNG";

// Static feature lists for display
const PLAN_FEATURES: Record<string, string[]> = {
  standard: [
    "Up to 3 students included",
    "Intuitive weekly schedule",
    "Subject & lesson tracking",
    "Student management",
    "Portfolio uploads & review",
    "Student portal access",
  ],
};

// Plan definitions
const PLANS = [
  {
    id: "standard",
    name: "Standard",
    price: 19,
    description: "Everything you need to manage your homeschool",
    features: PLAN_FEATURES.standard,
    icon: Check,
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
          <div className="flex justify-center">
            {PLANS.map((plan) => {
              const Icon = plan.icon;

              return (
                <Card 
                  key={plan.id} 
                  className="max-w-md w-full"
                  data-testid={`card-plan-${plan.id}`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
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
                    <p className="mt-4 text-sm text-muted-foreground">
                      + $10/month for each additional student beyond 3
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant="default"
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
