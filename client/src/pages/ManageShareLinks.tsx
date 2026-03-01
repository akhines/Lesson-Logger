import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Ban,
  Loader2,
  ArrowLeft,
  Calendar,
  Lock,
  Download,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { PortfolioShareToken } from "@shared/schema";

type ShareLinkWithStudent = PortfolioShareToken & { studentName: string };

export default function ManageShareLinks() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: shareLinks = [], isLoading } = useQuery<ShareLinkWithStudent[]>({
    queryKey: ["/api/share-links"],
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/share-links/${id}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      toast({ title: "Link revoked", description: "The share link has been deactivated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/share-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      setDeleteConfirmId(null);
      toast({ title: "Link deleted", description: "The share link has been permanently removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCopyLink = async (link: ShareLinkWithStudent) => {
    const url = `${window.location.origin}/portfolio/${link.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
    } catch {
      toast({ title: "Error", description: "Failed to copy link.", variant: "destructive" });
    }
  };

  const getLinkStatus = (link: ShareLinkWithStudent) => {
    if (link.revokedAt) return "revoked";
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) return "expired";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400" data-testid="badge-status-active">Active</Badge>;
      case "revoked":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" data-testid="badge-status-revoked">Revoked</Badge>;
      case "expired":
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400" data-testid="badge-status-expired">Expired</Badge>;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/portfolio")}
            data-testid="button-back-portfolio"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-manage-links-title">Manage Share Links</h1>
            <p className="text-muted-foreground">View, copy, revoke, or delete your portfolio share links</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : shareLinks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium" data-testid="text-no-links">No share links yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create a share link from the Portfolio page to share student work.
              </p>
              <Button onClick={() => setLocation("/portfolio")} data-testid="button-goto-portfolio">
                Go to Portfolio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {shareLinks.map(link => {
              const status = getLinkStatus(link);
              return (
                <Card key={link.id} data-testid={`card-share-link-${link.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium" data-testid={`text-link-student-${link.id}`}>
                            {link.studentName}
                          </span>
                          {getStatusBadge(status)}
                          {(link as any).hasPassword && (
                            <Badge variant="outline" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Password
                            </Badge>
                          )}
                          {link.allowDownload && (
                            <Badge variant="outline" className="text-xs">
                              <Download className="h-3 w-3 mr-1" />
                              Downloads
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created {link.createdAt ? format(new Date(link.createdAt), "MMM d, yyyy") : "N/A"}
                          </span>
                          {link.startDate || link.endDate ? (
                            <span>
                              Range: {link.startDate || "start"} to {link.endDate || "present"}
                            </span>
                          ) : (
                            <span>All time</span>
                          )}
                          {link.expiresAt ? (
                            <span>
                              Expires: {format(new Date(link.expiresAt), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span>No expiration</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyLink(link)}
                          disabled={status !== "active"}
                          data-testid={`button-copy-link-${link.id}`}
                        >
                          {copiedId === link.id ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copiedId === link.id ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(`/portfolio/${link.token}`, "_blank")}
                          disabled={status !== "active"}
                          data-testid={`button-open-link-${link.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {status === "active" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => revokeMutation.mutate(link.id)}
                            disabled={revokeMutation.isPending}
                            data-testid={`button-revoke-link-${link.id}`}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(link.id)}
                          data-testid={`button-delete-link-${link.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Share Link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete this share link? Anyone with the link will no longer be able to access the portfolio.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
