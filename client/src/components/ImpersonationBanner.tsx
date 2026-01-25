import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserX, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImpersonationStatus {
  isImpersonating: boolean;
  targetUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export function ImpersonationBanner() {
  const { toast } = useToast();

  const { data: status } = useQuery<ImpersonationStatus>({
    queryKey: ["/api/admin/impersonation-status"],
    refetchOnWindowFocus: true,
  });

  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/stop-impersonation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonation-status"] });
      toast({ title: "Returned to Admin", description: "You are now back to your admin account." });
      window.location.href = "/settings";
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to stop impersonation.", 
        variant: "destructive" 
      });
    },
  });

  if (!status?.isImpersonating) {
    return null;
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Admin Mode: Viewing as {status.targetUser?.firstName} {status.targetUser?.lastName}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="bg-amber-100 border-amber-700 text-amber-900 hover:bg-amber-200 gap-1"
        onClick={() => stopImpersonationMutation.mutate()}
        disabled={stopImpersonationMutation.isPending}
        data-testid="button-stop-impersonation"
      >
        <UserX className="h-3 w-3" />
        {stopImpersonationMutation.isPending ? "Exiting..." : "Exit Impersonation"}
      </Button>
    </div>
  );
}
