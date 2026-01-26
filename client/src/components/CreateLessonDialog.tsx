import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLessonSchema } from "@shared/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLesson, useUpdateLesson } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { useEffect, useState, useRef } from "react";
import { Plus, CalendarIcon, FileUp, X, Loader2, FileText } from "lucide-react";
import type { Lesson } from "@shared/schema";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AudioDirectionsRecorder } from "@/components/AudioDirectionsRecorder";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";

interface Props {
  lesson?: Lesson;
  preselectedDate?: Date;
  preselectedSubjectId?: number;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateLessonDialog({ lesson, preselectedDate, preselectedSubjectId, trigger, open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: subjects } = useSubjects();
  const createMutation = useCreateLesson();
  const updateMutation = useUpdateLesson();
  
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      form.setValue("documentUrl", response.objectPath);
      toast({ title: "PDF uploaded successfully" });
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });
  
  const form = useForm({
    resolver: zodResolver(insertLessonSchema),
    defaultValues: {
      title: "",
      content: "",
      link: "",
      subjectId: 0,
      dateScheduled: format(new Date(), "yyyy-MM-dd"),
      completed: false,
      audioDirectionsUrl: null as string | null,
      documentUrl: null as string | null,
    },
  });

  useEffect(() => {
    if (lesson) {
      form.reset({
        title: lesson.title,
        content: lesson.content || "",
        link: lesson.link || "",
        subjectId: lesson.subjectId,
        dateScheduled: lesson.dateScheduled,
        completed: lesson.completed || false,
        audioDirectionsUrl: lesson.audioDirectionsUrl || null,
        documentUrl: lesson.documentUrl || null,
      });
    } else {
      if (preselectedDate) {
        form.setValue("dateScheduled", format(preselectedDate, "yyyy-MM-dd"));
      }
      if (preselectedSubjectId) {
        form.setValue("subjectId", preselectedSubjectId);
      }
    }
  }, [lesson, preselectedDate, preselectedSubjectId, form, isOpen]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }
    
    await uploadFile(file);
  };
  
  const documentUrl = form.watch("documentUrl");

  const onSubmit = async (data: any) => {
    try {
      if (lesson) {
        await updateMutation.mutateAsync({ id: lesson.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setIsOpen?.(false);
      form.reset();
    } catch (error) {
      console.error(error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Schedule Lesson
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {lesson ? "Edit Lesson" : "Schedule New Lesson"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subjectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(parseInt(val))} 
                    value={field.value ? field.value.toString() : undefined}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-lesson-subject">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subjects?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateScheduled"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Scheduled Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-select-lesson-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(new Date(field.value), "EEEE, MMMM d, yyyy")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduction to Algebra" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Plan / Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Key concepts to cover..." 
                      className="min-h-[100px] resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Link (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>PDF Attachment (Optional)</FormLabel>
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-pdf-upload"
              />
              
              {documentUrl ? (
                <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{documentUrl.split('/').pop()}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => form.setValue("documentUrl", null)}
                    data-testid="button-remove-pdf"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-pdf"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4 mr-2" />
                  )}
                  {isUploading ? "Uploading..." : "Upload PDF"}
                </Button>
              )}
            </div>

            <FormField
              control={form.control}
              name="audioDirectionsUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audio Directions (Optional)</FormLabel>
                  <FormControl>
                    <AudioDirectionsRecorder
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={isPending}
            >
              {isPending ? (lesson ? "Updating..." : "Scheduling...") : (lesson ? "Save Changes" : "Schedule Lesson")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
