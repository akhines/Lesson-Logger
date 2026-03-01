import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Clock, Calendar, Edit2, Copy, Filter, X, BookOpen, ChevronDown, ChevronRight,
  CheckSquare, Image, Paperclip, Download, Eye
} from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import type { Student, LessonLog, EvidenceUpload } from "@shared/schema";

type LogWithEvidence = LessonLog & { evidence: EvidenceUpload[] };

interface TimelineResponse {
  logs: LogWithEvidence[];
  orphanEvidence: EvidenceUpload[];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

const DATE_PRESETS = [
  { label: "This Week", getValue: () => ({ start: formatDateStr(startOfWeek(new Date(), { weekStartsOn: 1 })), end: todayString() }) },
  { label: "This Month", getValue: () => ({ start: formatDateStr(startOfMonth(new Date())), end: todayString() }) },
  { label: "Last 30 Days", getValue: () => ({ start: formatDateStr(subDays(new Date(), 30)), end: todayString() }) },
  { label: "Last 90 Days", getValue: () => ({ start: formatDateStr(subDays(new Date(), 90)), end: todayString() }) },
  { label: "This Year", getValue: () => ({ start: formatDateStr(startOfYear(new Date())), end: todayString() }) },
];

interface MonthGroup {
  key: string;
  label: string;
  subjects: Record<string, LogWithEvidence[]>;
  totalMinutes: number;
  logCount: number;
  evidenceCount: number;
}

export default function LearningTimeline() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const defaultRange = DATE_PRESETS[2].getValue();
  const [studentId, setStudentId] = useState<string>("");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [hasEvidenceFilter, setHasEvidenceFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>("Last 30 Days");

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  useEffect(() => {
    if (students.length === 1 && !studentId) {
      setStudentId(String(students[0].id));
    }
  }, [students, studentId]);

  const queryParams = new URLSearchParams();
  if (studentId) queryParams.set("studentId", studentId);
  if (startDate) queryParams.set("start", startDate);
  if (endDate) queryParams.set("end", endDate);
  if (subjectFilter) queryParams.set("subject", subjectFilter);
  if (tagFilter) queryParams.set("tag", tagFilter);
  if (hasEvidenceFilter) queryParams.set("hasEvidence", hasEvidenceFilter);

  const { data, isLoading } = useQuery<TimelineResponse>({
    queryKey: ["/api/portfolio/timeline", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/timeline?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    },
  });

  const logs = data?.logs ?? [];
  const orphanEvidence = data?.orphanEvidence ?? [];

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
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Duplicated!", description: "Lesson duplicated to today." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const uniqueSubjects = useMemo(() => [...new Set(logs.map(l => l.subjectName))].sort(), [logs]);
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    logs.forEach(l => l.tags?.forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [logs]);

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups: Record<string, LogWithEvidence[]> = {};
    logs.forEach(log => {
      const d = new Date(log.date + "T00:00:00");
      const key = format(d, "yyyy-MM");
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, monthLogs]) => {
        const subjects: Record<string, LogWithEvidence[]> = {};
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
  }, [logs]);

  const totalMinutes = logs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalEvidence = logs.reduce((s, l) => s + l.evidence.length, 0) + orphanEvidence.length;
  const hasActiveFilters = !!(subjectFilter || tagFilter || hasEvidenceFilter);

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMonth(label: string) {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    const range = preset.getValue();
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset(preset.label);
  }

  function clearFilters() {
    setSubjectFilter("");
    setTagFilter("");
    setHasEvidenceFilter("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {students.length > 1 && (
            <Select value={studentId || "all"} onValueChange={v => setStudentId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44" data-testid="select-tl-student-top">
                <SelectValue placeholder="All students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                {students.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(p => (
              <Button
                key={p.label}
                variant={activePreset === p.label ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => applyPreset(p)}
                data-testid={`button-preset-${p.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 sm:ml-auto">
            {selectMode && selectedIds.size > 0 && (
              <Badge variant="secondary" data-testid="text-selected-count">
                {selectedIds.size} selected
              </Badge>
            )}
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              data-testid="button-toggle-select"
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              {selectMode ? "Done" : "Select"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-timeline-filters"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">!</Badge>}
            </Button>
          </div>
        </div>
      </div>

      {showFilters && (
        <Card data-testid="card-timeline-filters">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <Select value={subjectFilter || "all"} onValueChange={v => setSubjectFilter(v === "all" ? "" : v)}>
                  <SelectTrigger data-testid="select-tl-subject"><SelectValue placeholder="All subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {uniqueSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Has Evidence</Label>
                <Select value={hasEvidenceFilter || "all"} onValueChange={v => setHasEvidenceFilter(v === "all" ? "" : v)}>
                  <SelectTrigger data-testid="select-tl-evidence"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="true">With evidence</SelectItem>
                    <SelectItem value="false">Without evidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActivePreset(""); }} data-testid="input-tl-start" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActivePreset(""); }} data-testid="input-tl-end" />
              </div>
            </div>
            {uniqueTags.length > 0 && (
              <div className="mt-3">
                <Label className="text-xs">Tags</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {uniqueTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={tagFilter === tag ? "default" : "outline"}
                      className="cursor-pointer select-none text-xs"
                      onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                      data-testid={`tag-filter-${tag}`}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2" data-testid="button-tl-clear-filters">
                <X className="h-3 w-3 mr-1" /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {logs.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground" data-testid="text-timeline-summary">
          <span>{logs.length} entries</span>
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

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-xl" />)}
        </div>
      ) : monthGroups.length === 0 ? (
        <Card className="text-center py-12" data-testid="card-timeline-empty">
          <CardContent>
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No lesson logs found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or log some lessons first.
            </p>
            <Button onClick={() => setLocation("/lesson-logging")} data-testid="button-go-logging">
              Go to Lesson Logging
            </Button>
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
                  <h3 className="text-lg font-bold font-display">{group.label}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
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
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{subjectName}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {subjectLogs.length} {subjectLogs.length === 1 ? "entry" : "entries"} &middot; {formatDuration(subjectLogs.reduce((s, l) => s + l.durationMinutes, 0))}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {subjectLogs.map(log => {
                            const student = students.find(s => s.id === log.studentId);
                            return (
                              <div
                                key={log.id}
                                className="p-3 rounded-lg border border-border/50 bg-card hover:border-border transition-colors"
                                data-testid={`timeline-log-${log.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  {selectMode && (
                                    <Checkbox
                                      checked={selectedIds.has(log.id)}
                                      onCheckedChange={() => toggleSelect(log.id)}
                                      className="mt-0.5"
                                      data-testid={`checkbox-log-${log.id}`}
                                    />
                                  )}
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
                                      {student && (
                                        <Badge variant="outline" className="text-xs py-0" style={{ borderColor: student.color || undefined }}>
                                          {student.name}
                                        </Badge>
                                      )}
                                      {log.evidence.length > 0 && (
                                        <Badge variant="outline" className="text-xs py-0 text-blue-600 border-blue-300">
                                          <Paperclip className="h-3 w-3 mr-0.5" />
                                          {log.evidence.length}
                                        </Badge>
                                      )}
                                    </div>
                                    {log.title && <p className="font-medium text-sm mt-0.5" data-testid={`text-tl-title-${log.id}`}>{log.title}</p>}
                                    {log.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{log.notes}</p>}
                                    {log.tags && log.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {log.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>)}
                                      </div>
                                    )}

                                    {log.evidence.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mt-2" data-testid={`evidence-row-${log.id}`}>
                                        {log.evidence.map(ev => (
                                          <div key={ev.id} className="relative group" data-testid={`evidence-thumb-${ev.id}`}>
                                            {ev.fileType === "image" ? (
                                              <button
                                                onClick={() => setPreviewUrl(ev.fileUrl)}
                                                className="w-14 h-14 rounded-md overflow-hidden border border-border/50 hover:border-primary transition-colors"
                                                data-testid={`button-preview-evidence-${ev.id}`}
                                              >
                                                <img src={ev.fileUrl} alt={ev.title || ev.fileName || "Evidence"} className="w-full h-full object-cover" />
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => window.open(ev.fileUrl, "_blank", "noopener,noreferrer")}
                                                className="w-14 h-14 rounded-md border border-border/50 hover:border-primary transition-colors flex flex-col items-center justify-center bg-muted/50 text-muted-foreground"
                                                data-testid={`button-open-file-${ev.id}`}
                                              >
                                                {ev.fileType === "pdf" || ev.fileType === "document" ? (
                                                  <Download className="h-4 w-4" />
                                                ) : (
                                                  <Image className="h-4 w-4" />
                                                )}
                                                <span className="text-[9px] mt-0.5 truncate max-w-[48px]">{ev.fileType}</span>
                                              </button>
                                            )}
                                            {ev.reviewStatus === "approved" && (
                                              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" title="Approved" />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {!selectMode && (
                                    <div className="flex gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setLocation("/lesson-logging")}
                                        title="Edit log"
                                        data-testid={`button-tl-edit-${log.id}`}
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => duplicateMutation.mutate(log)}
                                        title="Duplicate to today"
                                        data-testid={`button-tl-dup-${log.id}`}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {orphanEvidence.length > 0 && (
            <div data-testid="orphan-evidence-section">
              <h3 className="text-lg font-bold font-display mb-3 flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-muted-foreground" />
                Other Evidence
              </h3>
              <div className="flex flex-wrap gap-2 pl-2 border-l-2 border-border ml-2 py-2">
                {orphanEvidence.map(ev => {
                  const student = students.find(s => s.id === ev.studentId);
                  return (
                    <div key={ev.id} className="relative" data-testid={`orphan-evidence-${ev.id}`}>
                      {ev.fileType === "image" ? (
                        <button
                          onClick={() => setPreviewUrl(ev.fileUrl)}
                          className="w-20 h-20 rounded-md overflow-hidden border border-border/50 hover:border-primary transition-colors"
                        >
                          <img src={ev.fileUrl} alt={ev.title || "Evidence"} className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <button
                          onClick={() => window.open(ev.fileUrl, "_blank", "noopener,noreferrer")}
                          className="w-20 h-20 rounded-md border border-border/50 hover:border-primary transition-colors flex flex-col items-center justify-center bg-muted/50 text-muted-foreground"
                          data-testid={`button-open-orphan-file-${ev.id}`}
                        >
                          <Download className="h-5 w-5" />
                          <span className="text-[10px] mt-1">{ev.fileType}</span>
                        </button>
                      )}
                      {student && (
                        <p className="text-[10px] text-center text-muted-foreground mt-0.5 truncate max-w-[80px]">{student.name}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Evidence preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                data-testid="img-lightbox-preview"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")} data-testid="button-open-fullsize">
              <Eye className="h-4 w-4 mr-1" />
              Open full size
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
