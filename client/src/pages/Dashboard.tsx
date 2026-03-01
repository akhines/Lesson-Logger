import { AppLayout } from "@/components/AppLayout";
import { useSubjects } from "@/hooks/use-subjects";
import { useLessons } from "@/hooks/use-lessons";
import { useStudents } from "@/hooks/use-students";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EvidenceUploadButton } from "@/components/EvidenceUploadButton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  BookOpen, Calendar, CheckSquare, Clock, Users, ChevronRight,
  Plus, Flame, ClipboardList, Edit2, Copy, Lightbulb, ArrowRight, Sparkles, Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import type { Student, LessonLog } from "@shared/schema";

interface OnboardingStatus {
  hasStudents: boolean;
  studentCount: number;
  subjectCount: number;
  hasAnyLessonLogs: boolean;
  lessonLogCount: number;
  hasAnyEvidence: boolean;
  evidenceCount: number;
  hasScheduledLessons: boolean;
  onboardingComplete: boolean;
}

const COMMON_SUBJECTS = [
  "Math", "Reading", "Writing", "Science", "History", "Geography",
  "Art", "Music", "Physical Education", "Foreign Language", "Bible",
  "Computer Science", "Nature Study", "Literature"
];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

interface DashboardSummary {
  weekTotals: { minutes: number; lessons: number };
  streakCount: number;
  recentLogs: LessonLog[];
  recommendations: {
    id: string;
    title: string;
    description: string;
    ctaLabel: string;
    ctaHref?: string;
    ctaAction?: string;
    priority: number;
  }[];
  studentCount: number;
  subjectCount: number;
}

export default function Dashboard() {
  const { data: subjects, isLoading: subjectsLoading } = useSubjects();
  const { data: students, isLoading: studentsLoading } = useStudents();
  const { data: lessons, isLoading: lessonsLoading } = useLessons({
    startDate: format(new Date(), "yyyy-MM-dd"),
  });
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const { data: onboardingStatus, isLoading: onboardingLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding/status"],
  });

  const { data: reminderSettings } = useQuery<{ dailyReminderEnabled: boolean; weeklySummaryEnabled: boolean; dailyReminderTime?: string }>({
    queryKey: ["/api/reminders/settings"],
  });

  useEffect(() => {
    if (onboardingStatus && !onboardingStatus.onboardingComplete && !onboardingStatus.hasStudents) {
      setLocation("/onboarding");
    }
  }, [onboardingStatus, setLocation]);

  const searchParams = new URLSearchParams(window.location.search);
  const [quickLogOpen, setQuickLogOpen] = useState(searchParams.get("openQuickLog") === "true");
  const [formDate, setFormDate] = useState(todayString());
  const [formStudentId, setFormStudentId] = useState<string>("");
  const [formSubject, setFormSubject] = useState("");
  const [formCustomSubject, setFormCustomSubject] = useState("");
  const [formDuration, setFormDuration] = useState("30");
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formEvidence, setFormEvidence] = useState<{ objectPath: string; fileName: string; fileType: string; contentType: string } | null>(null);

  const createLogMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/lesson-logs", data);
      return res.json();
    },
    onMutate: async (newLog: any) => {
      await queryClient.cancelQueries({ queryKey: ["/api/dashboard/summary"] });
      const previousSummary = queryClient.getQueryData(["/api/dashboard/summary"]);
      queryClient.setQueryData(["/api/dashboard/summary"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          weekTotals: {
            minutes: (old.weekTotals?.minutes || 0) + (newLog.durationMinutes || 0),
            lessons: (old.weekTotals?.lessons || 0) + 1,
          },
          recentLogs: [
            { ...newLog, id: Date.now(), createdAt: new Date().toISOString() },
            ...(old.recentLogs || []).slice(0, 4),
          ],
        };
      });
      return { previousSummary };
    },
    onSuccess: async (_data: any, variables: any) => {
      if (formEvidence && variables.studentId) {
        try {
          await apiRequest("POST", "/api/portfolio/evidence", {
            studentId: variables.studentId,
            fileUrl: formEvidence.objectPath,
            fileName: formEvidence.fileName,
            fileType: formEvidence.fileType,
            title: formEvidence.fileName,
            description: "Uploaded with lesson log",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        } catch (e) {
          console.error("Evidence save failed:", e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Lesson logged!", description: formEvidence ? "Lesson and evidence recorded." : "Your lesson has been recorded." });
      resetQuickLog();
      setQuickLogOpen(false);
    },
    onError: (err: Error, _newLog, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(["/api/dashboard/summary"], context.previousSummary);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (log: LessonLog) => {
      const res = await apiRequest("POST", "/api/lesson-logs", {
        studentId: log.studentId,
        subjectName: log.subjectName,
        date: todayString(),
        durationMinutes: log.durationMinutes,
        title: log.title,
        notes: log.notes,
        tags: log.tags,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Duplicated!", description: "Lesson duplicated to today." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetQuickLog() {
    setFormDate(todayString());
    setFormStudentId("");
    setFormSubject("");
    setFormCustomSubject("");
    setFormDuration("30");
    setFormTitle("");
    setFormNotes("");
    setFormEvidence(null);
  }

  function handleQuickLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedSubject = formSubject === "custom" ? formCustomSubject : formSubject;
    if (!resolvedSubject || !formStudentId) {
      toast({ title: "Missing fields", description: "Please select a student and subject.", variant: "destructive" });
      return;
    }
    createLogMutation.mutate({
      studentId: Number(formStudentId),
      subjectName: resolvedSubject,
      date: formDate,
      durationMinutes: Number(formDuration) || 30,
      title: formTitle || null,
      notes: formNotes || null,
      tags: [],
    });
  }

  function handleRecommendationClick(rec: DashboardSummary["recommendations"][0]) {
    if (rec.ctaAction === "openQuickLog") {
      setQuickLogOpen(true);
    } else if (rec.ctaHref) {
      setLocation(rec.ctaHref);
    }
  }

  const isLoading = subjectsLoading || lessonsLoading || studentsLoading;

  if (isLoading || summaryLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="h-12 bg-muted/20 animate-pulse rounded-xl w-1/3" />
          <div className="h-16 bg-muted/20 animate-pulse rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-muted/20 animate-pulse rounded-2xl" />
            ))}
          </div>
          <div className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  const todayLessons = lessons?.filter(l => l.dateScheduled === format(new Date(), "yyyy-MM-dd")) || [];
  const completedToday = todayLessons.filter(l => l.completed).length;

  const studentProgress = students?.map(student => {
    const studentSubjectIds = subjects?.filter(s =>
      s.studentId === student.id || s.students?.some(st => st.id === student.id)
    ).map(s => s.id) || [];
    const studentLessons = todayLessons.filter(l => studentSubjectIds.includes(l.subjectId));
    const completed = studentLessons.filter(l => l.completed).length;
    const total = studentLessons.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { student, completed, total, percentage, lessons: studentLessons };
  }).filter(sp => sp.total > 0) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-muted-foreground">Here's what's happening today, {format(new Date(), "EEEE MMMM do")}.</p>
          </div>
        </div>

        <Dialog open={quickLogOpen} onOpenChange={setQuickLogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto gap-2 text-lg h-14 px-8 shadow-lg shadow-primary/20" data-testid="button-quick-log">
              <Plus className="h-5 w-5" />
              Quick Log
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg" data-testid="dialog-quick-log">
            <DialogHeader>
              <DialogTitle>Quick Log</DialogTitle>
              <DialogDescription>Record today's learning in seconds.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleQuickLogSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ql-date">Date</Label>
                  <Input id="ql-date" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} data-testid="input-ql-date" />
                </div>
                <div>
                  <Label htmlFor="ql-duration">Minutes</Label>
                  <Input id="ql-duration" type="number" inputMode="numeric" min="1" max="480" value={formDuration} onChange={e => setFormDuration(e.target.value)} data-testid="input-ql-duration" />
                </div>
              </div>
              <div>
                <Label>Student</Label>
                <Select value={formStudentId} onValueChange={setFormStudentId}>
                  <SelectTrigger data-testid="select-ql-student"><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={formSubject} onValueChange={setFormSubject}>
                  <SelectTrigger data-testid="select-ql-subject"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {COMMON_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    <SelectItem value="custom">Other (custom)</SelectItem>
                  </SelectContent>
                </Select>
                {formSubject === "custom" && (
                  <Input className="mt-2" placeholder="Enter subject name" value={formCustomSubject} onChange={e => setFormCustomSubject(e.target.value)} data-testid="input-ql-custom-subject" />
                )}
              </div>
              <div>
                <Label htmlFor="ql-title">Title (optional)</Label>
                <Input id="ql-title" placeholder="e.g., Chapter 5" value={formTitle} onChange={e => setFormTitle(e.target.value)} data-testid="input-ql-title" />
              </div>
              <div>
                <Label htmlFor="ql-notes">Notes (optional)</Label>
                <Textarea id="ql-notes" placeholder="What was covered?" value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} data-testid="input-ql-notes" />
              </div>
              <div>
                <Label>Proof of Work (optional)</Label>
                <div className="mt-1">
                  <EvidenceUploadButton
                    uploadedFile={formEvidence}
                    onUploadComplete={setFormEvidence}
                    onUploadRemove={() => setFormEvidence(null)}
                    compact
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setQuickLogOpen(false)} data-testid="button-ql-cancel">Cancel</Button>
                <Button type="submit" disabled={createLogMutation.isPending} data-testid="button-ql-submit">
                  {createLogMutation.isPending ? "Saving..." : "Log It"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {onboardingStatus && !onboardingStatus.onboardingComplete && onboardingStatus.hasStudents && (() => {
          const items = [
            { key: "students", label: "Add your students", done: onboardingStatus.hasStudents, href: "/students" },
            { key: "subjects", label: "Set up subjects", done: onboardingStatus.subjectCount >= 3, href: "/subjects" },
            { key: "log", label: "Log your first lesson", done: onboardingStatus.hasAnyLessonLogs, action: "openQuickLog" },
            { key: "schedule", label: "Create a weekly schedule", done: onboardingStatus.hasScheduledLessons, href: "/schedule" },
            { key: "evidence", label: "Upload first evidence", done: onboardingStatus.hasAnyEvidence, href: "/portfolio" },
          ];
          const completedCount = items.filter(i => i.done).length;
          const allDone = completedCount === items.length;
          return (
            <Card className="border-primary/20 bg-primary/5" data-testid="card-activation-checklist">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Getting Started</CardTitle>
                  </div>
                  <Badge variant="secondary">{completedCount}/{items.length}</Badge>
                </div>
                <Progress value={(completedCount / items.length) * 100} className="h-2 mt-2" />
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${item.done ? "opacity-60" : "hover:bg-muted/50"}`}
                    onClick={() => {
                      if (item.done) return;
                      if (item.action === "openQuickLog") setQuickLogOpen(true);
                      else if (item.href) setLocation(item.href);
                    }}
                    data-testid={`checklist-item-${item.key}`}
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? "border-green-500 bg-green-500" : "border-muted-foreground/30"}`}>
                      {item.done && <CheckSquare className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : "font-medium"}`}>{item.label}</span>
                    {!item.done && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
                {allDone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={async () => {
                      await apiRequest("POST", "/api/onboarding/complete", {});
                      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
                    }}
                    data-testid="button-dismiss-checklist"
                  >
                    Dismiss checklist
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {reminderSettings && !reminderSettings.dailyReminderEnabled && !reminderSettings.weeklySummaryEnabled && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50" data-testid="banner-reminder-cta">
            <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">Want a daily reminder to log learning?</p>
            <Link href="/reminders">
              <Button variant="outline" size="sm" data-testid="button-setup-reminders">Set up reminders</Button>
            </Link>
          </div>
        )}

        {reminderSettings && (reminderSettings.dailyReminderEnabled || reminderSettings.weeklySummaryEnabled) && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10" data-testid="banner-reminder-active">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">
              {reminderSettings.dailyReminderEnabled && reminderSettings.dailyReminderTime
                ? `Daily reminder at ${Number(reminderSettings.dailyReminderTime.split(":")[0]) > 12
                    ? `${Number(reminderSettings.dailyReminderTime.split(":")[0]) - 12}:${reminderSettings.dailyReminderTime.split(":")[1]} PM`
                    : Number(reminderSettings.dailyReminderTime.split(":")[0]) === 0
                    ? `12:${reminderSettings.dailyReminderTime.split(":")[1]} AM`
                    : `${reminderSettings.dailyReminderTime} AM`
                  }`
                : "Weekly summary enabled"}
            </p>
            <Link href="/reminders">
              <Button variant="ghost" size="sm" data-testid="button-edit-reminders">Edit</Button>
            </Link>
          </div>
        )}

        {summary && summary.recommendations.length > 0 && (
          <Card data-testid="card-next-steps">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Next Steps</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.recommendations.map(rec => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 border border-border/50"
                  data-testid={`recommendation-${rec.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" data-testid={`text-rec-title-${rec.id}`}>{rec.title}</p>
                    <p className="text-xs text-muted-foreground">{rec.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRecommendationClick(rec)}
                    className="shrink-0 gap-1"
                    data-testid={`button-rec-${rec.id}`}
                  >
                    {rec.ctaLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="card-progress-glance">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold" data-testid="text-week-minutes">{formatDuration(summary?.weekTotals.minutes || 0)}</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <ClipboardList className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold" data-testid="text-week-lessons">{summary?.weekTotals.lessons || 0}</p>
              <p className="text-xs text-muted-foreground">Lessons Logged</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Flame className="h-5 w-5 mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-bold" data-testid="text-streak">{summary?.streakCount || 0}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <CheckSquare className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold" data-testid="text-completed-today">{completedToday}</p>
              <p className="text-xs text-muted-foreground">Completed Today</p>
            </CardContent>
          </Card>
        </div>

        {summary && summary.recentLogs.length > 0 && (
          <Card data-testid="card-recent-activity">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </div>
                <Link href="/lesson-logging">
                  <Button variant="ghost" size="sm" className="text-primary" data-testid="button-view-all-logs">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.recentLogs.map(log => {
                const student = students?.find(s => s.id === log.studentId);
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-card"
                    data-testid={`recent-log-${log.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{log.subjectName}</Badge>
                        {student && <Badge variant="outline" className="text-xs" style={{ borderColor: student.color || undefined }}>{student.name}</Badge>}
                        <span className="text-xs text-muted-foreground">{formatDuration(log.durationMinutes)}</span>
                        <span className="text-xs text-muted-foreground">{new Date(log.date + "T00:00:00").toLocaleDateString()}</span>
                      </div>
                      {log.title && <p className="text-sm font-medium mt-0.5 truncate">{log.title}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLocation("/lesson-logging")}
                        title="Edit"
                        data-testid={`button-edit-log-${log.id}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => duplicateMutation.mutate(log)}
                        title="Duplicate to today"
                        data-testid={`button-duplicate-log-${log.id}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {studentProgress.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-display">Student Progress Today</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentProgress.map(({ student, completed, total, percentage, lessons: studentLessons }) => (
                <Dialog key={student.id}>
                  <DialogTrigger asChild>
                    <Card
                      className="shadow-sm cursor-pointer hover-elevate group"
                      data-testid={`card-student-progress-${student.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                              style={{ backgroundColor: student.color || '#6366f1' }}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <CardTitle className="text-base">{student.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">Grade {student.gradeLevel || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={percentage === 100 ? "default" : "secondary"} className="text-xs">
                              {completed}/{total}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{percentage}%</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                          {percentage === 100 && (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                              <CheckSquare className="h-3 w-3" />
                              All lessons complete!
                            </p>
                          )}
                          {percentage > 0 && percentage < 100 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {total - completed} lesson{total - completed !== 1 ? 's' : ''} remaining
                            </p>
                          )}
                        </div>
                        <div className="mt-3 pt-3 border-t space-y-1">
                          {studentLessons.slice(0, 3).map(lesson => (
                            <div key={lesson.id} className="flex items-center gap-2 text-xs">
                              {lesson.completed ? (
                                <CheckSquare className="h-3 w-3 text-green-500" />
                              ) : (
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className={lesson.completed ? "text-muted-foreground line-through" : ""}>
                                {lesson.title}
                              </span>
                            </div>
                          ))}
                          {studentLessons.length > 3 && (
                            <p className="text-xs text-primary font-medium">Click to see all {studentLessons.length} lessons</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                          style={{ backgroundColor: student.color || '#6366f1' }}
                        >
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <DialogTitle className="text-xl">{student.name}'s Progress</DialogTitle>
                          <DialogDescription>{format(new Date(), "EEEE, MMMM do")}</DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Daily Progress</span>
                        <Badge variant={percentage === 100 ? "default" : "secondary"}>
                          {completed} of {total} complete
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-3" />
                      <p className="text-sm text-muted-foreground mt-2">
                        {percentage === 100
                          ? "Great job! All lessons completed for today!"
                          : `${total - completed} lesson${total - completed !== 1 ? 's' : ''} remaining`}
                      </p>
                    </div>

                    <div className="mt-4 space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Today's Lessons</h3>
                      {studentLessons.filter(l => !l.completed).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            In Progress ({studentLessons.filter(l => !l.completed).length})
                          </p>
                          {studentLessons.filter(l => !l.completed).map(lesson => {
                            const subject = subjects?.find(s => s.id === lesson.subjectId);
                            return (
                              <div key={lesson.id} className="p-3 bg-card border border-border rounded-lg flex items-start gap-3">
                                <div
                                  className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject?.category || 'other'] || '#6B7280' }}
                                >
                                  <BookOpen className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{lesson.title}</p>
                                  <p className="text-xs text-muted-foreground">{subject?.name || 'Unknown Subject'}</p>
                                  {lesson.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lesson.content}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {studentLessons.filter(l => l.completed).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            Completed ({studentLessons.filter(l => l.completed).length})
                          </p>
                          {studentLessons.filter(l => l.completed).map(lesson => {
                            const subject = subjects?.find(s => s.id === lesson.subjectId);
                            return (
                              <div key={lesson.id} className="p-3 bg-muted/30 border border-border/50 rounded-lg flex items-start gap-3 opacity-70">
                                <div
                                  className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject?.category || 'other'] || '#6B7280' }}
                                >
                                  <CheckSquare className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate line-through">{lesson.title}</p>
                                  <p className="text-xs text-muted-foreground">{subject?.name || 'Unknown Subject'}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t flex gap-2">
                      <Link href="/schedule" className="flex-1">
                        <Button variant="outline" className="w-full gap-2">
                          <Calendar className="h-4 w-4" />
                          View Schedule
                        </Button>
                      </Link>
                      <Link href="/students" className="flex-1">
                        <Button variant="outline" className="w-full gap-2">
                          <Users className="h-4 w-4" />
                          Student Profile
                        </Button>
                      </Link>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-display">Today's Schedule</h2>
              <Link href="/schedule">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" data-testid="button-view-calendar">View Calendar</Button>
              </Link>
            </div>

            {todayLessons.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No lessons scheduled for today.</p>
                <Link href="/schedule">
                  <Button variant="ghost" className="mt-2 text-primary">Schedule something</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {todayLessons.map((lesson) => (
                  <div key={lesson.id} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-start gap-4 hover:border-primary/50 transition-colors" data-testid={`card-lesson-${lesson.id}`}>
                    <div className={`h-10 w-1 rounded-full ${lesson.completed ? "bg-primary" : "bg-secondary"}`} />
                    <div className="flex-1">
                      <h3 className="font-semibold">{lesson.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {subjects?.find(s => s.id === lesson.subjectId)?.name || "Unknown Subject"}
                      </p>
                    </div>
                    {lesson.completed ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Completed</span>
                    ) : (
                      <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded-full font-medium">Scheduled</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-display">Subjects</h2>
              <Link href="/subjects">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" data-testid="button-manage-subjects">Manage Subjects</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjects?.slice(0, 4).map((subject) => (
                <div key={subject.id} className="bg-card p-5 rounded-xl border border-border shadow-sm hover:shadow-md transition-all" data-testid={`card-subject-${subject.id}`}>
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent mb-3">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold">{subject.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {subject.description || "No description"}
                  </p>
                </div>
              ))}
              {!subjects?.length && (
                <div className="col-span-2 bg-card rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                  <p>No subjects added yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!quickLogOpen && (
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <Button
            size="icon"
            onClick={() => setQuickLogOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg shadow-primary/30"
            aria-label="Quick Log"
            data-testid="button-quick-log-fab"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
