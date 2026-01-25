import { AppLayout } from "@/components/AppLayout";
import { useAssignments, useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from "@/hooks/use-assignments";
import { useLessons } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { useStudents } from "@/hooks/use-students";
import { useFormContent, useDeleteFormContent } from "@/hooks/use-form-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssignmentSchema } from "@shared/routes";
import { SUBJECT_CATEGORY_COLORS, FORM_LABELS } from "@shared/schema";
import type { FormContent as FormContentType } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";
import { WeeklyAssignmentView } from "@/components/WeeklyAssignmentView";
import { FormContentDialog } from "@/components/FormContentDialog";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { CheckSquare, Clock, FileText, Trash2, Download, ChevronLeft, ChevronRight, Calendar, List, Filter, Feather, Plus, Pencil, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type ViewMode = "list" | "weekly";
type PageMode = "assignments" | "forms";

export default function Assignments() {
  const { data: assignments, isLoading } = useAssignments();
  const { data: lessons } = useLessons();
  const { data: subjects } = useSubjects();
  const { data: students } = useStudents();
  const { data: allFormContent, isLoading: formContentLoading } = useFormContent();
  const deleteFormContentMutation = useDeleteFormContent();
  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();
  const deleteMutation = useDeleteAssignment();
  const { toast } = useToast();
  
  // URL query params for form selection
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const formFromUrl = searchParams.get("form");
  
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [pageMode, setPageMode] = useState<PageMode>("assignments");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filterStudent, setFilterStudent] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  
  // Form content state
  const [selectedForm, setSelectedForm] = useState("form_1");
  const [editingFormContent, setEditingFormContent] = useState<FormContentType | undefined>(undefined);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  
  // Switch to forms mode if URL has form parameter
  useEffect(() => {
    if (formFromUrl && ["form_1", "form_2", "form_3"].includes(formFromUrl)) {
      setPageMode("forms");
      setSelectedForm(formFromUrl);
    }
  }, [formFromUrl]);
  
  const filteredFormContent = allFormContent?.filter((c) => c.formLevel === selectedForm) || [];
  
  const handleDeleteFormContent = async (id: number) => {
    if (confirm("Are you sure you want to delete this content?")) {
      try {
        await deleteFormContentMutation.mutateAsync(id);
        toast({ title: "Content deleted" });
      } catch (error) {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    }
  };
  
  const handleEditFormContent = (content: FormContentType) => {
    setEditingFormContent(content);
    setFormDialogOpen(true);
  };
  
  const handleCreateFormContent = () => {
    setEditingFormContent(undefined);
    setFormDialogOpen(true);
  };

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
            <h1 className="text-3xl font-display font-bold text-foreground">
              {pageMode === "assignments" ? "Assignments" : "Charlotte Mason Forms"}
            </h1>
            <p className="text-muted-foreground">
              {pageMode === "assignments" 
                ? "Track homework and projects." 
                : "Custom language arts curriculum with copywork and dictation prompts."}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Page mode toggle */}
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button 
                variant={pageMode === "assignments" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setPageMode("assignments")}
                className="rounded-none gap-1.5"
                data-testid="button-mode-assignments"
              >
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Assignments</span>
              </Button>
              <Button 
                variant={pageMode === "forms" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setPageMode("forms")}
                className="rounded-none gap-1.5"
                data-testid="button-mode-forms"
              >
                <Feather className="h-4 w-4" />
                <span className="hidden sm:inline">Forms</span>
              </Button>
            </div>
            
            {/* View mode toggle - only for assignments */}
            {pageMode === "assignments" && (
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
            )}
            
            {/* Action button */}
            {pageMode === "assignments" ? (
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
            ) : (
              <Button onClick={handleCreateFormContent} className="gap-2 shadow-lg shadow-primary/20" data-testid="button-add-form-content">
                <Plus className="h-4 w-4" /> Add Content
              </Button>
            )}
          </div>
        </div>

        {/* Filters - only for assignments */}
        {pageMode === "assignments" && (
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
        )}
      </div>

      {/* Assignments View */}
      {pageMode === "assignments" && viewMode === "weekly" && (
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

      {pageMode === "assignments" && viewMode === "list" && (
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

      {/* Forms View */}
      {pageMode === "forms" && (
        <>
          <Tabs value={selectedForm} onValueChange={setSelectedForm} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="form_1" data-testid="tab-form-1">Form 1 (Grades 1-3)</TabsTrigger>
              <TabsTrigger value="form_2" data-testid="tab-form-2">Form 2 (Grades 4-6)</TabsTrigger>
              <TabsTrigger value="form_3" data-testid="tab-form-3">Form 3 (Grades 7-9)</TabsTrigger>
            </TabsList>

            {["form_1", "form_2", "form_3"].map((formLevel) => (
              <TabsContent key={formLevel} value={formLevel}>
                {formContentLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
                    ))}
                  </div>
                ) : filteredFormContent.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/5">
                    <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-bold">No content for {FORM_LABELS[formLevel as keyof typeof FORM_LABELS]}</h3>
                    <p className="text-muted-foreground mb-4 max-w-sm">
                      Add your first copywork and dictation content for this form level.
                    </p>
                    <Button onClick={handleCreateFormContent} data-testid="button-create-first-content">
                      Add Content
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredFormContent.map((content) => (
                      <Card key={content.id} className="group hover-elevate" data-testid={`card-content-${content.id}`}>
                        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg" data-testid={`text-content-title-${content.id}`}>
                                {content.title}
                              </CardTitle>
                              {content.weekNumber && (
                                <CardDescription>Week {content.weekNumber}</CardDescription>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditFormContent(content)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-edit-content-${content.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFormContent(content.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              data-testid={`button-delete-content-${content.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {content.copywork && (
                            <div>
                              <Badge variant="secondary" className="mb-2">Copywork</Badge>
                              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg italic">
                                "{content.copywork}"
                              </p>
                            </div>
                          )}
                          {content.dictationPrompt && (
                            <div>
                              <Badge variant="secondary" className="mb-2">Dictation Prompt</Badge>
                              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                                {content.dictationPrompt}
                              </p>
                            </div>
                          )}
                          {content.notes && (
                            <div>
                              <Badge variant="outline" className="mb-2">Notes</Badge>
                              <p className="text-sm text-muted-foreground">{content.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <FormContentDialog
            content={editingFormContent}
            defaultFormLevel={selectedForm}
            open={formDialogOpen}
            onOpenChange={setFormDialogOpen}
          />
        </>
      )}
    </AppLayout>
  );
}
