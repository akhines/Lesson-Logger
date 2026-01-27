// Component for gating features based on subscription plan
import { useSubscription, FeatureName, planIncludesFeature, FEATURE_DEFINITIONS } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface FeatureGateProps {
  feature: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { data: subscription, isLoading } = useSubscription();
  
  if (isLoading) {
    return null;
  }
  
  const plan = subscription?.plan || "free";
  const hasAccess = planIncludesFeature(plan, feature);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  const featureDef = FEATURE_DEFINITIONS[feature];
  const requiredPlan = featureDef?.plan || "premium";
  
  return (
    <Card className="border-dashed" data-testid="card-feature-locked">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">{featureDef?.name || feature} - Premium Feature</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground mb-4">
          Upgrade to the {requiredPlan === "premium" ? "Premium" : "Basic"} plan to unlock this feature.
        </p>
        <Button asChild data-testid="button-upgrade">
          <Link href="/pricing">
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade Now
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Hook version for conditional logic
export function useHasFeature(feature: FeatureName): boolean {
  const { data: subscription } = useSubscription();
  const plan = subscription?.plan || "free";
  return planIncludesFeature(plan, feature);
}

// Simple locked badge for nav items
export function LockedBadge() {
  return (
    <span className="ml-auto inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Lock className="h-3 w-3 mr-1" />
      Pro
    </span>
  );
}
