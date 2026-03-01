import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Clock, BookOpen, Edit2, Trash2, Filter, X, Calendar } from "lucide-react";
import { EvidenceUploadButton } from "@/components/EvidenceUploadButton";
import type { Student, LessonLog } from "@shared/schema";

const COMMON_SUBJECTS = [
  "Math", "Reading", "Writing", "Science", "History", "Geography",
  "Art", "Music", "Physical Education", "Foreign Language", "Bible",
  "Computer Science", "Nature Study", "Literature"
];

const COMMON_TAGS = [
  "reading", "project", "field trip", "hands-on", "video", "workbook",
  "discussion", "test", "review", "outdoor", "group", "independent"
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

export default function LessonLogging() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<LessonLog | null>(null);
  const [filterStudentId, setFilterStudentId] = useState<string>("");
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const [formDate, setFormDate] = useState(todayString());
  const [formStudentId, setFormStudentId] = useState<string>("");
  const [formSubject, setFormSubject] = useState("");
  const [formCustomSubject, setFormCustomSubject] = useState("");
  const [formDuration, setFormDuration] = useState("30");
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formCustomTag, setFormCustomTag] = useState("");
  const [formEvidence, setFormEvidence] = useState<{ objectPath: string; fileName: string; fileType: string; contentType: string } | null>(null);

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const queryParams = new URLSearchParams();
  if (filterStudentId) queryParams.set("studentId", filterStudentId);
  if (filterSubject) queryParams.set("subjectName", filterSubject);
  if (filterStartDate) queryParams.set("startDate", filterStartDate);
  if (filterEndDate) queryParams.set("endDate", filterEndDate);

  const { data: logs = [], isLoading } = useQuery<LessonLog[]>({
    queryKey: ["/api/lesson-logs", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/lesson-logs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/lesson-logs", data);
      return res.json();
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
      toast({ title: "Lesson logged!", description: formEvidence ? "Lesson and evidence recorded." : "Your lesson has been recorded." });
      resetForm();
      setShowForm(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/lesson-logs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-logs"] });
      toast({ title: "Updated", description: "Lesson log updated." });
      resetForm();
      setEditingLog(null);
      setShowForm(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/lesson-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-logs"] });
      toast({ title: "Deleted", description: "Lesson log removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormDate(todayString());
    setFormStudentId("");
    setFormSubject("");
    setFormCustomSubject("");
    setFormDuration("30");
    setFormTitle("");
    setFormNotes("");
    setFormTags([]);
    setFormCustomTag("");
    setFormEvidence(null);
  }

  function openEdit(log: LessonLog) {
    setEditingLog(log);
    setFormDate(log.date);
    setFormStudentId(String(log.studentId));
    const isCommonSubject = COMMON_SUBJECTS.includes(log.subjectName);
    setFormSubject(isCommonSubject ? log.subjectName : "custom");
    setFormCustomSubject(isCommonSubject ? "" : log.subjectName);
    setFormDuration(String(log.durationMinutes));
    setFormTitle(log.title || "");
    setFormNotes(log.notes || "");
    setFormTags(log.tags || []);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedSubject = formSubject === "custom" ? formCustomSubject : formSubject;
    if (!resolvedSubject) {
      toast({ title: "Subject required", description: "Please select or enter a subject.", variant: "destructive" });
      return;
    }
    if (!formStudentId) {
      toast({ title: "Student required", description: "Please select a student.", variant: "destructive" });
      return;
    }
    const data = {
      studentId: Number(formStudentId),
      subjectName: resolvedSubject,
      date: formDate,
      durationMinutes: Number(formDuration) || 30,
      title: formTitle || null,
      notes: formNotes || null,
      tags: formTags,
    };
    if (editingLog) {
      updateMutation.mutate({ id: editingLog.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function toggleTag(tag: string) {
    setFormTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function addCustomTag() {
    if (formCustomTag.trim() && !formTags.includes(formCustomTag.trim())) {
      setFormTags(prev => [...prev, formCustomTag.trim()]);
      setFormCustomTag("");
    }
  }

  function clearFilters() {
    setFilterStudentId("");
    setFilterSubject("");
    setFilterStartDate("");
    setFilterEndDate("");
  }

  const hasActiveFilters = filterStudentId || filterSubject || filterStartDate || filterEndDate;

  const totalMinutes = logs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const subjectTotals: Record<string, number> = {};
  const studentTotals: Record<number, number> = {};
  logs.forEach(log => {
    subjectTotals[log.subjectName] = (subjectTotals[log.subjectName] || 0) + log.durationMinutes;
    studentTotals[log.studentId] = (studentTotals[log.studentId] || 0) + log.durationMinutes;
  });

  const uniqueSubjects = [...new Set(logs.map(l => l.subjectName))];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Lesson Logging</h1>
            <p className="text-muted-foreground">Track and log your daily learning activities</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{[filterStudentId, filterSubject, filterStartDate, filterEndDate].filter(Boolean).length}</Badge>}
            </Button>
            <Button
              onClick={() => { resetForm(); setEditingLog(null); setShowForm(true); }}
              data-testid="button-log-lesson"
            >
              <Plus className="h-4 w-4 mr-1" />
              Log Today's Learning
            </Button>
          </div>
        </div>

        {showFilters && (
          <Card data-testid="card-filters">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Student</Label>
                  <Select value={filterStudentId} onValueChange={(v) => setFilterStudentId(v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="select-filter-student">
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {students.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Select value={filterSubject} onValueChange={(v) => setFilterSubject(v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="select-filter-subject">
                      <SelectValue placeholder="All subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {uniqueSubjects.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} data-testid="input-filter-start-date" />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} data-testid="input-filter-end-date" />
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2" data-testid="button-clear-filters">
                  <X className="h-3 w-3 mr-1" /> Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {logs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="card-summary-totals">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold" data-testid="text-total-entries">{logs.length}</p>
                <p className="text-xs text-muted-foreground">Entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold" data-testid="text-total-hours">{formatDuration(totalMinutes)}</p>
                <p className="text-xs text-muted-foreground">Total Time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold" data-testid="text-total-subjects">{Object.keys(subjectTotals).length}</p>
                <p className="text-xs text-muted-foreground">Subjects</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold" data-testid="text-total-students">{Object.keys(studentTotals).length}</p>
                <p className="text-xs text-muted-foreground">Students</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingLog(null); } }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-lesson-form">
            <DialogHeader>
              <DialogTitle>{editingLog ? "Edit Lesson Log" : "Log Today's Learning"}</DialogTitle>
              <DialogDescription>
                {editingLog ? "Update the details of this lesson log entry." : "Record what was learned today. Quick and easy!"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    data-testid="input-log-date"
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="480"
                    value={formDuration}
                    onChange={e => setFormDuration(e.target.value)}
                    data-testid="input-log-duration"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="student">Student</Label>
                <Select value={formStudentId} onValueChange={setFormStudentId}>
                  <SelectTrigger data-testid="select-log-student">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Select value={formSubject} onValueChange={setFormSubject}>
                  <SelectTrigger data-testid="select-log-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_SUBJECTS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    <SelectItem value="custom">Other (custom)</SelectItem>
                  </SelectContent>
                </Select>
                {formSubject === "custom" && (
                  <Input
                    className="mt-2"
                    placeholder="Enter subject name"
                    value={formCustomSubject}
                    onChange={e => setFormCustomSubject(e.target.value)}
                    data-testid="input-log-custom-subject"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g., Chapter 5 Review"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  data-testid="input-log-title"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="What was covered? How did it go?"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={3}
                  data-testid="input-log-notes"
                />
              </div>

              <div>
                <Label>Tags (optional)</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COMMON_TAGS.map(tag => (
                    <Badge
                      key={tag}
                      variant={formTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleTag(tag)}
                      data-testid={`tag-${tag}`}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add custom tag"
                    value={formCustomTag}
                    onChange={e => setFormCustomTag(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                    className="flex-1"
                    data-testid="input-custom-tag"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCustomTag} data-testid="button-add-tag">Add</Button>
                </div>
                {formTags.filter(t => !COMMON_TAGS.includes(t)).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formTags.filter(t => !COMMON_TAGS.includes(t)).map(tag => (
                      <Badge key={tag} variant="default" className="cursor-pointer" onClick={() => toggleTag(tag)}>
                        {tag} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {!editingLog && (
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
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingLog(null); }} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-log">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingLog ? "Update" : "Log It"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card className="text-center py-12" data-testid="card-empty-state">
            <CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No lesson logs yet</h3>
              <p className="text-muted-foreground mb-4">Start recording your daily learning activities.</p>
              <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-first-log">
                <Plus className="h-4 w-4 mr-1" /> Log Your First Lesson
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map(log => {
              const student = students.find(s => s.id === log.studentId);
              return (
                <Card key={log.id} className="hover:shadow-md transition-shadow" data-testid={`card-log-${log.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" data-testid={`badge-subject-${log.id}`}>{log.subjectName}</Badge>
                          {student && (
                            <Badge variant="outline" style={{ borderColor: student.color || undefined }} data-testid={`badge-student-${log.id}`}>
                              {student.name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(log.durationMinutes)}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.date + "T00:00:00").toLocaleDateString()}
                          </span>
                        </div>
                        {log.title && <p className="font-medium mt-1" data-testid={`text-title-${log.id}`}>{log.title}</p>}
                        {log.notes && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2" data-testid={`text-notes-${log.id}`}>{log.notes}</p>}
                        {log.tags && log.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {log.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(log)} data-testid={`button-edit-${log.id}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" data-testid={`button-delete-${log.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this log?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(log.id)} data-testid="button-confirm-delete">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
