// Hook for managing subscription state and feature access
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type SubscriptionPlan = "free" | "basic" | "premium";

export interface SubscriptionStatus {
  plan: SubscriptionPlan;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  studentCount: number;
  maxStudents: number;
  additionalStudents: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    id: string;
    unitAmount: number;
    currency: string;
    recurring: { interval: string } | null;
    metadata: Record<string, string>;
  }[];
}

// Get current subscription status
export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription"],
  });
}

// Get available plans
export function usePlans() {
  return useQuery<{ products: Plan[] }>({
    queryKey: ["/api/subscription/plans"],
  });
}

// Create checkout session
export function useCheckout() {
  return useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { priceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

// Create customer portal session
export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscription/portal");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

// Check feature access
export function useFeatureAccess(feature: string) {
  return useQuery<{
    feature: string;
    hasAccess: boolean;
    plan: string;
    requiredPlan: string;
  }>({
    queryKey: [`/api/features/${feature}`],
    enabled: !!feature,
  });
}

// Feature definitions for UI
export const FEATURE_DEFINITIONS = {
  // Basic plan features
  dashboard: { name: "Dashboard", plan: "basic" },
  students: { name: "Students", plan: "basic" },
  schedule: { name: "Schedule", plan: "basic" },
  subjects: { name: "Subjects", plan: "basic" },
  labels: { name: "Labels/Tags", plan: "basic" },
  reports: { name: "Reports", plan: "basic" },
  uploads: { name: "File Uploads", plan: "basic" },
  review_queue: { name: "Portfolio Review", plan: "basic" },
  portfolio: { name: "Portfolio", plan: "basic" },
  
  // Premium plan features
  library: { name: "Library", plan: "premium" },
  curriculum: { name: "Curriculum Tools", plan: "premium" },
  ai_curriculum: { name: "AI Curriculum Upload", plan: "premium" },
  study_helper: { name: "Study Helper", plan: "premium" },
  math_facts: { name: "Math Facts Practice", plan: "premium" },
  grammar_practice: { name: "Grammar Practice", plan: "premium" },
  copywork_generator: { name: "Copywork Generator", plan: "premium" },
} as const;

export type FeatureName = keyof typeof FEATURE_DEFINITIONS;

// Helper to check if a plan includes a feature
export function planIncludesFeature(plan: SubscriptionPlan, feature: FeatureName): boolean {
  const featureDef = FEATURE_DEFINITIONS[feature];
  if (!featureDef) return false;
  
  if (plan === "premium") return true;
  if (plan === "basic") return featureDef.plan === "basic";
  return false;
}
