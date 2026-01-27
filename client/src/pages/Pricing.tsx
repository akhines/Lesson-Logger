// Pricing page for subscription plans
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Crown, Loader2 } from "lucide-react";
import { useSubscription, useCheckout, useCustomerPortal, usePlans } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

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

export default function Pricing() {
  const { toast } = useToast();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: plansData, isLoading: plansLoading } = usePlans();
  const checkoutMutation = useCheckout();
  const portalMutation = useCustomerPortal();

  // Build price ID map from API data
  const priceIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (plansData?.products) {
      for (const product of plansData.products) {
        const planType = product.metadata?.plan;
        if (planType && product.prices?.[0]?.id) {
          map[planType] = product.prices[0].id;
        }
      }
    }
    return map;
  }, [plansData]);

  // Build display plans from API data
  const displayPlans = useMemo(() => {
    if (!plansData?.products) {
      return [];
    }
    
    return plansData.products
      .filter(p => p.metadata?.plan === 'basic' || p.metadata?.plan === 'premium')
      .sort((a, b) => {
        const aAmount = a.prices?.[0]?.unitAmount || 0;
        const bAmount = b.prices?.[0]?.unitAmount || 0;
        return aAmount - bAmount;
      })
      .map(product => ({
        id: product.metadata?.plan || product.id,
        name: product.name.replace('Sunwoven ', '').replace(' Plan', ''),
        price: (product.prices?.[0]?.unitAmount || 0) / 100,
        priceId: product.prices?.[0]?.id || '',
        description: product.description || '',
        features: PLAN_FEATURES[product.metadata?.plan || ''] || [],
        highlight: product.metadata?.plan === 'premium',
        icon: product.metadata?.plan === 'premium' ? Crown : Check,
      }));
  }, [plansData]);

  const handleSubscribe = async (priceId: string) => {
    if (!priceId) {
      toast({
        title: "Coming Soon",
        description: "Subscription plans will be available shortly. Please check back soon!",
      });
      return;
    }

    checkoutMutation.mutate(priceId);
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  const currentPlan = subscription?.plan || "free";
  const hasSubscription = currentPlan !== "free" && subscription?.status === "active";
  const isLoading = subLoading || plansLoading;

  // Fallback plans for display when API hasn't returned data yet
  const fallbackPlans = [
    {
      id: "basic",
      name: "Basic",
      price: 29,
      priceId: '',
      description: "Everything you need to manage your homeschool",
      features: PLAN_FEATURES.basic,
      highlight: false,
      icon: Check,
    },
    {
      id: "premium",
      name: "Premium",
      price: 49,
      priceId: '',
      description: "Full access to all features including AI tools",
      features: PLAN_FEATURES.premium,
      highlight: true,
      icon: Crown,
    },
  ];

  const plans = displayPlans.length > 0 ? displayPlans : fallbackPlans;
  const productsNotLoaded = !plansLoading && displayPlans.length === 0;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock the full potential of Sunwoven Homeschool with our subscription plans.
            Start managing your homeschool curriculum like never before.
          </p>
        </div>

        {productsNotLoaded && (
          <Card className="mb-8 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="py-4">
              <p className="text-amber-800 dark:text-amber-200 text-center">
                Subscription products are being set up. Pricing will be available shortly.
              </p>
            </CardContent>
          </Card>
        )}

        {hasSubscription && (
          <Card className="mb-8 bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium">
                    You're currently on the <span className="text-primary capitalize">{currentPlan}</span> plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Manage your subscription, update payment method, or cancel anytime.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleManageSubscription}
                  disabled={portalMutation.isPending}
                  data-testid="button-manage-subscription"
                >
                  {portalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const Icon = plan.icon;

            return (
              <Card 
                key={plan.id} 
                className={`relative ${plan.highlight ? "border-primary shadow-lg" : ""}`}
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
                  {isCurrentPlan ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => handleSubscribe(plan.priceId)}
                      disabled={checkoutMutation.isPending || !plan.priceId}
                      data-testid={`button-subscribe-${plan.id}`}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {currentPlan === "free" ? "Subscribe" : "Upgrade"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-display font-bold mb-4">
            Need More Students?
          </h2>
          <p className="text-muted-foreground mb-4">
            Both plans include up to 3 students. Add more students for just $10/month each.
          </p>
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All subscriptions are billed monthly. Cancel anytime.</p>
          <p>Secure payments powered by Stripe.</p>
        </div>
      </div>
    </AppLayout>
  );
}
