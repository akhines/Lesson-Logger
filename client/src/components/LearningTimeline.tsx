import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock, Calendar, Edit2, Copy, Filter, X, BookOpen, ChevronDown, ChevronRight, CheckSquare
} from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import type { Student, LessonLog } from "@shared/schema";

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
  label: string;
  subjects: Record<string, LessonLog[]>;
  totalMinutes: number;
  logCount: number;
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
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const queryParams = new URLSearchParams();
  if (studentId) queryParams.set("studentId", studentId);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  if (subjectFilter) queryParams.set("subjectName", subjectFilter);
  if (tagFilter) queryParams.set("tag", tagFilter);

  const { data: logs = [], isLoading } = useQuery<LessonLog[]>({
    queryKey: ["/api/lesson-logs", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/lesson-logs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
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

  const uniqueSubjects = useMemo(() => [...new Set(logs.map(l => l.subjectName))].sort(), [logs]);
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    logs.forEach(l => l.tags?.forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [logs]);

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups: Record<string, LessonLog[]> = {};
    logs.forEach(log => {
      const d = new Date(log.date + "T00:00:00");
      const key = format(d, "yyyy-MM");
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, monthLogs]) => {
        const subjects: Record<string, LessonLog[]> = {};
        monthLogs.forEach(log => {
          if (!subjects[log.subjectName]) subjects[log.subjectName] = [];
          subjects[log.subjectName].push(log);
        });
        Object.values(subjects).forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)));

        const d = new Date(key + "-01");
        return {
          label: format(d, "MMMM yyyy"),
          subjects,
          totalMinutes: monthLogs.reduce((s, l) => s + l.durationMinutes, 0),
          logCount: monthLogs.length,
        };
      });
  }, [logs]);

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
  }

  function clearFilters() {
    setStudentId("");
    setSubjectFilter("");
    setTagFilter("");
    const range = DATE_PRESETS[2].getValue();
    setStartDate(range.start);
    setEndDate(range.end);
  }

  const hasActiveFilters = studentId || subjectFilter || tagFilter;
  const totalMinutes = logs.reduce((s, l) => s + l.durationMinutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map(p => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => applyPreset(p)}
              data-testid={`button-preset-${p.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
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

      {showFilters && (
        <Card data-testid="card-timeline-filters">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Student</Label>
                <Select value={studentId} onValueChange={v => setStudentId(v === "all" ? "" : v)}>
                  <SelectTrigger data-testid="select-tl-student"><SelectValue placeholder="All students" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All students</SelectItem>
                    {students.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Select value={subjectFilter} onValueChange={v => setSubjectFilter(v === "all" ? "" : v)}>
                  <SelectTrigger data-testid="select-tl-subject"><SelectValue placeholder="All subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {uniqueSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-tl-start" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-tl-end" />
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
            const isCollapsed = collapsedMonths.has(group.label);
            return (
              <div key={group.label} data-testid={`month-group-${group.label}`}>
                <button
                  className="flex items-center gap-2 w-full text-left mb-3 group"
                  onClick={() => toggleMonth(group.label)}
                  data-testid={`button-toggle-month-${group.label}`}
                >
                  {isCollapsed ? <ChevronRight className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  <h3 className="text-lg font-bold font-display">{group.label}</h3>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {group.logCount} entries &middot; {formatDuration(group.totalMinutes)}
                  </span>
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
                        <div className="space-y-1.5">
                          {subjectLogs.map(log => {
                            const student = students.find(s => s.id === log.studentId);
                            return (
                              <div
                                key={log.id}
                                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-border transition-colors"
                                data-testid={`timeline-log-${log.id}`}
                              >
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
                                  </div>
                                  {log.title && <p className="font-medium text-sm mt-0.5" data-testid={`text-tl-title-${log.id}`}>{log.title}</p>}
                                  {log.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{log.notes}</p>}
                                  {log.tags && log.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {log.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>)}
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
                                      title="Edit"
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
        </div>
      )}
    </div>
  );
}
