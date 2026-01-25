import { AppLayout } from "@/components/AppLayout";
import { useAssignments, useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from "@/hooks/use-assignments";
import { useLessons } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { useStudents } from "@/hooks/use-students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssignmentSchema } from "@shared/routes";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";
import { WeeklyAssignmentView } from "@/components/WeeklyAssignmentView";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { useState, useMemo } from "react";
import { CheckSquare, Clock, FileText, Trash2, Download, ChevronLeft, ChevronRight, Calendar, List, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type ViewMode = "list" | "weekly";

export default function Assignments() {
  const { data: assignments, isLoading } = useAssignments();
  const { data: lessons } = useLessons();
  const { data: subjects } = useSubjects();
  const { data: students } = useStudents();
  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();
  const deleteMutation = useDeleteAssignment();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filterStudent, setFilterStudent] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");

  const form = useForm({
    resolver: zodResolver(insertAssignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      lessonId: 0,
      dueDate: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
      grade: "",
      documentUrl: "",
    },
  });

  const onSubmit = async (data: { title: string; lessonId: number; dueDate: string; status: string; grade: string; documentUrl: string; description?: string }) => {
    try {
      await createMutation.mutateAsync(data);
      setCreateOpen(false);
      form.reset();
      toast({ title: "Assignment created" });
    } catch (e) {
      toast({ title: "Failed to create", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete assignment?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    await updateMutation.mutateAsync({ id, status });
  };

  const handleDocumentUpload = async (id: number, url: string) => {
    await updateMutation.mutateAsync({ id, documentUrl: url, status: "submitted" });
    toast({ title: "Document uploaded successfully" });
  };

  const getSubjectForAssignment = (lessonId: number) => {
    const lesson = lessons?.find(l => l.id === lessonId);
    if (!lesson) return undefined;
    return subjects?.find(s => s.id === lesson.subjectId);
  };

  const getSubjectName = (lessonId: number) => {
    const subject = getSubjectForAssignment(lessonId);
    return subject?.name || "Unknown";
  };

  const getSubjectColor = (lessonId: number) => {
    const subject = getSubjectForAssignment(lessonId);
    if (subject?.category) {
      return SUBJECT_CATEGORY_COLORS[subject.category] || SUBJECT_CATEGORY_COLORS.other;
    }
    return SUBJECT_CATEGORY_COLORS.other;
  };

  const getStudentForAssignment = (lessonId: number) => {
    const subject = getSubjectForAssignment(lessonId);
    if (!subject?.studentId) return undefined;
    return students?.find(s => s.id === subject.studentId);
  };

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(a => {
      const subject = getSubjectForAssignment(a.lessonId);
      const student = getStudentForAssignment(a.lessonId);
      
      if (filterStudent !== "all" && (!student || student.id.toString() !== filterStudent)) {
        return false;
      }
      
      if (filterSubject !== "all" && (!subject || subject.id.toString() !== filterSubject)) {
        return false;
      }
      
      return true;
    });
  }, [assignments, filterStudent, filterSubject, lessons, subjects, students]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Assignments</h1>
            <p className="text-muted-foreground">Track homework and projects.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button 
                variant={viewMode === "list" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-none"
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === "weekly" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("weekly")}
                className="rounded-none"
                data-testid="button-view-weekly"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg shadow-primary/20" data-testid="button-new-assignment">
                  + New Assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Assignment</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="lessonId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Linked Lesson</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value.toString()}>
                            <FormControl>
                              <SelectTrigger data-testid="select-assignment-lesson">
                                <SelectValue placeholder="Select a lesson" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {lessons?.map(l => (
                                <SelectItem key={l.id} value={l.id.toString()}>{l.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Essay, Worksheet, etc." {...field} data-testid="input-assignment-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-assignment-due-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-assignment">
                      Create Assignment
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          {students && students.length > 0 && (
            <Select value={filterStudent} onValueChange={setFilterStudent}>
              <SelectTrigger className="w-[150px]" data-testid="filter-student">
                <SelectValue placeholder="All Students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color || '#6B7280' }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-[150px]" data-testid="filter-subject">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects?.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[s.category || 'other'] }} 
                    />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterStudent !== "all" || filterSubject !== "all") && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => { setFilterStudent("all"); setFilterSubject("all"); }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {viewMode === "weekly" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))} data-testid="button-prev-week">
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <div className="text-lg font-semibold">
              Week of {format(weekStart, "MMM d, yyyy")}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))} data-testid="button-next-week">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <WeeklyAssignmentView
            assignments={filteredAssignments}
            lessons={lessons || []}
            subjects={subjects || []}
            students={students || []}
            weekStart={weekStart}
          />
        </div>
      )}

      {viewMode === "list" && (
        <>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredAssignments.map((assignment) => {
                const student = getStudentForAssignment(assignment.lessonId);
                const subjectColor = getSubjectColor(assignment.lessonId);
                
                return (
                  <Card key={assignment.id} className="overflow-hidden" data-testid={`card-assignment-${assignment.id}`}>
                    <div className="flex flex-col md:flex-row">
                      <div className="p-6 flex-1">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className="font-normal text-white"
                              style={{ backgroundColor: subjectColor, borderColor: subjectColor }}
                            >
                              {getSubjectName(assignment.lessonId)}
                            </Badge>
                            {student && (
                              <Badge 
                                variant="outline"
                                className="font-normal flex items-center gap-1"
                              >
                                <div 
                                  className="h-2 w-2 rounded-full" 
                                  style={{ backgroundColor: student.color || '#6B7280' }}
                                />
                                {student.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Status:</span>
                            <Select
                              defaultValue={assignment.status || "pending"}
                              onValueChange={(val) => handleStatusChange(assignment.id, val)}
                            >
                              <SelectTrigger className="h-7 w-[110px] text-xs" data-testid={`select-status-${assignment.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="graded">Graded</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <h3 className="font-bold text-xl mb-1" data-testid={`text-assignment-title-${assignment.id}`}>{assignment.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> Due: {assignment.dueDate ? format(new Date(assignment.dueDate), "MMM do") : "No date"}
                          </span>
                          {assignment.grade && (
                            <span className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                              Grade: {assignment.grade}
                            </span>
                          )}
                        </div>

                        {assignment.documentUrl ? (
                          <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                            <FileText className="h-5 w-5 text-primary" />
                            <div className="flex-1 text-sm font-medium">Submitted Document</div>
                            <a href={assignment.documentUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                            </a>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <ObjectUploader
                              buttonClassName="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                              onGetUploadParameters={async (file) => {
                                const res = await fetch("/api/uploads/request-url", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    name: file.name,
                                    size: file.size,
                                    contentType: file.type,
                                  }),
                                });
                                const { uploadURL } = await res.json();
                                return {
                                  method: "PUT",
                                  url: uploadURL,
                                  headers: { "Content-Type": file.type },
                                };
                              }}
                              onComplete={(result) => {
                                if (result.successful && result.successful.length > 0 && result.successful[0].uploadURL) {
                                  handleDocumentUpload(assignment.id, result.successful[0].uploadURL);
                                }
                              }}
                            >
                              Upload Homework
                            </ObjectUploader>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-muted/10 p-4 border-l border-border flex flex-row md:flex-col items-center justify-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(assignment.id)} 
                          className="text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-assignment-${assignment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {filteredAssignments.length === 0 && (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-assignments">
                  No assignments found.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
