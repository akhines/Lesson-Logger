import { AppLayout } from "@/components/AppLayout";
import { useAssignments, useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from "@/hooks/use-assignments";
import { useLessons } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssignmentSchema } from "@shared/routes";
import { ObjectUploader } from "@/components/ObjectUploader";
import { format } from "date-fns";
import { useState } from "react";
import { CheckSquare, Clock, FileText, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Assignments() {
  const { data: assignments, isLoading } = useAssignments();
  const { data: lessons } = useLessons();
  const { data: subjects } = useSubjects();
  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();
  const deleteMutation = useDeleteAssignment();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

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

  const onSubmit = async (data: any) => {
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

  const getSubjectName = (lessonId: number) => {
    const lesson = lessons?.find(l => l.id === lessonId);
    if (!lesson) return "Unknown";
    const subject = subjects?.find(s => s.id === lesson.subjectId);
    return subject?.name || "Unknown";
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Assignments</h1>
          <p className="text-muted-foreground">Track homework and projects.</p>
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">+ New Assignment</Button>
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
                          <SelectTrigger>
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
                        <Input placeholder="Essay, Worksheet, etc." {...field} />
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
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  Create Assignment
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-6">
          {assignments?.map((assignment) => (
            <Card key={assignment.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-muted text-muted-foreground font-normal">
                      {getSubjectName(assignment.lessonId)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <Select 
                        defaultValue={assignment.status || "pending"} 
                        onValueChange={(val) => handleStatusChange(assignment.id, val)}
                      >
                        <SelectTrigger className="h-7 w-[110px] text-xs">
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
                  
                  <h3 className="font-bold text-xl mb-1">{assignment.title}</h3>
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
                           if (result.successful && result.successful.length > 0) {
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
                   <Button variant="ghost" size="icon" onClick={() => handleDelete(assignment.id)} className="text-destructive hover:bg-destructive/10">
                     <Trash2 className="h-4 w-4" />
                   </Button>
                </div>
              </div>
            </Card>
          ))}
          {assignments?.length === 0 && (
             <div className="text-center py-12 text-muted-foreground">No assignments found.</div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
