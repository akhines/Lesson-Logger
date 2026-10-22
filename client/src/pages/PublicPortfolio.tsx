import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Image, FileText, User, Calendar, Clock, ChevronDown, ChevronRight,
  Paperclip, Download, Lock, AlertCircle, X, BookOpen
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";

interface EvidenceItem {
  id: number;
  title: string | null;
  description: string | null;
  fileUrl: string;
  fileType: string;
  fileName: string | null;
  createdAt: string | null;
  reviewStatus: string;
}

interface LogEntry {
  id: number;
  studentId: number;
  subjectName: string;
  date: string;
  durationMinutes: number;
  title: string | null;
  notes: string | null;
  tags: string[] | null;
  evidence: EvidenceItem[];
}

interface ShareData {
  studentName: string;
  studentAvatar: string | null;
  startDate: string | null;
  endDate: string | null;
  allowDownload: boolean;
  logs: LogEntry[];
  requiresPassword?: boolean;
}

interface MonthGroup {
  key: string;
  label: string;
  subjects: Record<string, LogEntry[]>;
  totalMinutes: number;
  logCount: number;
  evidenceCount: number;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function PublicPortfolio() {
  const { token } = useParams<{ token: string }>();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<ShareData>({
    queryKey: ['/api/share', token, passwordVerified],
    queryFn: async () => {
      const response = await fetch(`/api/share/${token}`, { credentials: "include" });
      if (response.status === 410) {
        const body = await response.json();
        throw new Error(body.status === "expired" ? "expired" : "revoked");
      }
      if (!response.ok) {
        throw new Error("not_found");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const requiresPassword = data?.requiresPassword && !passwordVerified;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/share/${token}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (res.status === 429) {
        setPasswordError("Too many attempts. Please try again in a minute.");
        return;
      }
      if (res.status === 401) {
        setPasswordError("Incorrect password. Please try again.");
        return;
      }
      if (!res.ok) {
        const body = await res.json();
        setPasswordError(body.message || "Verification failed");
        return;
      }
      setPasswordVerified(true);
      refetch();
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  }

  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (!data?.logs) return [];
    const groups: Record<string, LogEntry[]> = {};
    data.logs.forEach(log => {
      const d = new Date(log.date + "T00:00:00");
      const key = format(d, "yyyy-MM");
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, monthLogs]) => {
        const subjects: Record<string, LogEntry[]> = {};
        monthLogs.forEach(log => {
          if (!subjects[log.subjectName]) subjects[log.subjectName] = [];
          subjects[log.subjectName].push(log);
        });
        Object.values(subjects).forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)));

        const d = new Date(key + "-01");
        const evidenceCount = monthLogs.reduce((s, l) => s + l.evidence.length, 0);
        return {
          key,
          label: format(d, "MMMM yyyy"),
          subjects,
          totalMinutes: monthLogs.reduce((s, l) => s + l.durationMinutes, 0),
          logCount: monthLogs.length,
          evidenceCount,
        };
      });
  }, [data?.logs]);

  function toggleMonth(key: string) {
    setCollapsedMonths(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  const errorMessage = (error as Error)?.message;
  if (errorMessage === "revoked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-revoked-title">
              Link No Longer Active
            </h2>
            <p className="text-muted-foreground" data-testid="text-revoked-message">
              This shared portfolio link has been revoked and is no longer accessible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorMessage === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-expired-title">
              Link Expired
            </h2>
            <p className="text-muted-foreground" data-testid="text-expired-message">
              This shared portfolio link has expired and is no longer accessible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-error-title">
              Portfolio Not Found
            </h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
              This portfolio link may be invalid or no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-password-title">
                Password Required
              </h2>
              <p className="text-muted-foreground text-sm">
                This shared portfolio is password protected. Enter the password to view.
              </p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                data-testid="input-share-password"
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-destructive" data-testid="text-password-error">
                  {passwordError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={!password || isVerifying}
                data-testid="button-submit-password"
              >
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {isVerifying ? "Verifying..." : "Unlock Portfolio"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalLogs = data.logs?.length || 0;
  const totalMinutes = data.logs?.reduce((s, l) => s + l.durationMinutes, 0) || 0;
  const totalEvidence = data.logs?.reduce((s, l) => s + l.evidence.length, 0) || 0;
  const uniqueSubjects = Array.from(new Set(data.logs?.map(l => l.subjectName) || []));

  const dateRangeText = (() => {
    if (data.startDate && data.endDate) {
      return `${new Date(data.startDate + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} — ${new Date(data.endDate + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
    }
    if (data.startDate) {
      return `From ${new Date(data.startDate + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
    }
    if (data.endDate) {
      return `Through ${new Date(data.endDate + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
    }
    return "All Time";
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium" data-testid="text-shared-label">
                Shared Portfolio
              </p>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-student-name">
                {data.studentName}
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-date-range">
                {dateRangeText}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {totalLogs > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 flex-wrap" data-testid="text-portfolio-summary">
            <span>{totalLogs} entries</span>
            <span>{formatDuration(totalMinutes)} total</span>
            <span>{uniqueSubjects.length} subjects</span>
            {totalEvidence > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {totalEvidence} files
              </span>
            )}
          </div>
        )}

        {monthGroups.length === 0 ? (
          <Card className="text-center py-12" data-testid="card-portfolio-empty">
            <CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No lesson logs found</h3>
              <p className="text-muted-foreground">
                No lesson entries are available for this time period.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {monthGroups.map(group => {
              const isCollapsed = collapsedMonths.has(group.key);
              return (
                <div key={group.key} data-testid={`month-group-${group.key}`}>
                  <button
                    className="flex items-center gap-2 w-full text-left mb-3 group"
                    onClick={() => toggleMonth(group.key)}
                    data-testid={`button-toggle-month-${group.key}`}
                  >
                    {isCollapsed ? <ChevronRight className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    <h3 className="text-lg font-bold">{group.label}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto flex-wrap">
                      <span>{group.logCount} entries</span>
                      <span>&middot;</span>
                      <span>{formatDuration(group.totalMinutes)}</span>
                      {group.evidenceCount > 0 && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{group.evidenceCount}</span>
                        </>
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-4 pl-2 border-l-2 border-border ml-2">
                      {Object.entries(group.subjects).sort(([a], [b]) => a.localeCompare(b)).map(([subjectName, subjectLogs]) => (
                        <div key={subjectName} className="pl-4" data-testid={`subject-group-${subjectName}`}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="secondary">{subjectName}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {subjectLogs.length} {subjectLogs.length === 1 ? "entry" : "entries"} &middot; {formatDuration(subjectLogs.reduce((s, l) => s + l.durationMinutes, 0))}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {subjectLogs.map(log => (
                              <div
                                key={log.id}
                                className="p-3 rounded-md border border-border/50 bg-card"
                                data-testid={`timeline-log-${log.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(log.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDuration(log.durationMinutes)}
                                      </span>
                                      {log.evidence.length > 0 && (
                                        <Badge variant="outline" className="text-xs py-0">
                                          <Paperclip className="h-3 w-3 mr-0.5" />
                                          {log.evidence.length}
                                        </Badge>
                                      )}
                                    </div>
                                    {log.title && <p className="font-medium text-sm mt-0.5" data-testid={`text-log-title-${log.id}`}>{log.title}</p>}
                                    {log.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{log.notes}</p>}
                                    {log.tags && log.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {log.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>)}
                                      </div>
                                    )}

                                    {log.evidence.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mt-2" data-testid={`evidence-row-${log.id}`}>
                                        {log.evidence.map(ev => (
                                          <div key={ev.id} className="relative" data-testid={`evidence-thumb-${ev.id}`}>
                                            {ev.fileType === "image" ? (
                                              <button
                                                onClick={() => setLightboxImage(ev.fileUrl)}
                                                className="w-14 h-14 rounded-md overflow-hidden border border-border/50"
                                                data-testid={`button-preview-evidence-${ev.id}`}
                                              >
                                                <img src={ev.fileUrl} alt={ev.title || ev.fileName || "Evidence"} className="w-full h-full object-cover" />
                                              </button>
                                            ) : (
                                              <div className="w-14 h-14 rounded-md border border-border/50 flex flex-col items-center justify-center bg-muted/50 text-muted-foreground">
                                                {data.allowDownload ? (
                                                  <a
                                                    href={ev.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex flex-col items-center"
                                                    data-testid={`link-download-evidence-${ev.id}`}
                                                  >
                                                    <Download className="h-4 w-4" />
                                                    <span className="text-[9px] mt-0.5 truncate max-w-[48px]">{ev.fileType}</span>
                                                  </a>
                                                ) : (
                                                  <>
                                                    <FileText className="h-4 w-4" />
                                                    <span className="text-[9px] mt-0.5 truncate max-w-[48px]">{ev.fileType}</span>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
          data-testid="lightbox-overlay"
        >
          <div className="absolute top-4 right-4 flex gap-2">
            {data.allowDownload && (
              <a
                href={lightboxImage}
                download
                onClick={e => e.stopPropagation()}
                className="text-white/80 hover:text-white"
                data-testid="button-download-lightbox"
              >
                <Download className="h-6 w-6" />
              </a>
            )}
            <button
              className="text-white/80 hover:text-white"
              onClick={() => setLightboxImage(null)}
              data-testid="button-close-lightbox"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <img
            src={lightboxImage}
            alt="Full size view"
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
            data-testid="img-lightbox"
          />
        </div>
      )}

      <footer className="border-t py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Powered by Lesson Logger
        </div>
      </footer>
    </div>
  );
}
