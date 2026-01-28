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
import { Plus, CalendarIcon, FileUp, X, Loader2, FileText, BookOpen, Search, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Lesson, CurriculumResource } from "@shared/schema";
import { format } from "date-fns";

// Helper to parse date string as local date (not UTC)
function parseLocalDate(dateStr: string): Date {
  // Add time component to ensure it's interpreted as local timezone
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
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
  curriculumResource?: CurriculumResource | null;
}

export function CreateLessonDialog({ lesson, preselectedDate, preselectedSubjectId, trigger, open, onOpenChange, curriculumResource }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: subjects } = useSubjects();
  const createMutation = useCreateLesson();
  const updateMutation = useUpdateLesson();
  const [isAudioUploading, setIsAudioUploading] = useState(false);
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  
  const { data: curriculumResources = [] } = useQuery<CurriculumResource[]>({
    queryKey: ["/api/curriculum-resources"],
    enabled: librarySearchOpen,
  });
  
  const filteredLibraryItems = curriculumResources.filter(r => {
    if (!librarySearchQuery) return true;
    const query = librarySearchQuery.toLowerCase();
    return (
      r.subject?.toLowerCase().includes(query) ||
      r.title?.toLowerCase().includes(query) ||
      r.chapters?.toLowerCase().includes(query) ||
      r.notes?.toLowerCase().includes(query)
    );
  }).slice(0, 20);
  
  const { uploadFile, isUploading: isPdfUploading } = useUpload({
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
    } else if (curriculumResource && isOpen) {
      const matchingSubject = subjects?.find(s => 
        s.name.toLowerCase() === curriculumResource.subject?.toLowerCase()
      );
      form.reset({
        title: curriculumResource.title || curriculumResource.chapters || "",
        content: curriculumResource.notes || "",
        link: curriculumResource.resourceLink || "",
        subjectId: matchingSubject?.id || preselectedSubjectId || 0,
        dateScheduled: format(new Date(), "yyyy-MM-dd"),
        completed: false,
        audioDirectionsUrl: null,
        documentUrl: null,
      });
    } else {
      if (preselectedDate) {
        form.setValue("dateScheduled", format(preselectedDate, "yyyy-MM-dd"));
      }
      if (preselectedSubjectId) {
        form.setValue("subjectId", preselectedSubjectId);
      }
    }
  }, [lesson, preselectedDate, preselectedSubjectId, form, isOpen, curriculumResource, subjects]);
  
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
      console.log("Submitting lesson data:", data);
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
                            format(parseLocalDate(field.value), "EEEE, MMMM d, yyyy")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseLocalDate(field.value) : undefined}
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
                  <FormLabel className="flex items-center justify-between">
                    <span>Resource Link (Optional)</span>
                    <Popover open={librarySearchOpen} onOpenChange={setLibrarySearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto py-0.5 px-2 text-xs text-muted-foreground"
                          data-testid="button-browse-library"
                        >
                          <BookOpen className="h-3 w-3 mr-1" />
                          Browse Library
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-2" align="end">
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search curriculum library..."
                              value={librarySearchQuery}
                              onChange={(e) => setLibrarySearchQuery(e.target.value)}
                              className="pl-7 h-8 text-sm"
                              data-testid="input-library-search"
                            />
                          </div>
                          <ScrollArea className="h-48">
                            {filteredLibraryItems.length === 0 ? (
                              <div className="text-center py-4 text-sm text-muted-foreground">
                                {curriculumResources.length === 0 
                                  ? "No items in library" 
                                  : "No matching items"}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {filteredLibraryItems.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className="w-full text-left p-2 rounded-md hover-elevate text-sm"
                                    onClick={() => {
                                      field.onChange(item.resourceLink || "");
                                      if (item.title || item.chapters) {
                                        const currentTitle = form.getValues("title");
                                        if (!currentTitle) {
                                          form.setValue("title", item.title || item.chapters || "");
                                        }
                                      }
                                      setLibrarySearchOpen(false);
                                      setLibrarySearchQuery("");
                                    }}
                                    data-testid={`library-item-${item.id}`}
                                  >
                                    <div className="font-medium truncate">
                                      {item.title || item.chapters || item.subject}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                      <span>{item.subject}</span>
                                      {item.resourceLink && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <ExternalLink className="h-2.5 w-2.5" />
                                          <span className="truncate">
                                            {(() => {
                                              try {
                                                return new URL(item.resourceLink).hostname;
                                              } catch {
                                                return item.resourceLink.slice(0, 30);
                                              }
                                            })()}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} data-testid="input-lesson-link" />
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
                  disabled={isPdfUploading}
                  data-testid="button-upload-pdf"
                >
                  {isPdfUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4 mr-2" />
                  )}
                  {isPdfUploading ? "Uploading..." : "Upload PDF"}
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
                      onUploadingChange={setIsAudioUploading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={isPending || isPdfUploading || isAudioUploading}
            >
              {isAudioUploading || isPdfUploading ? "Uploading..." : isPending ? (lesson ? "Updating..." : "Scheduling...") : (lesson ? "Save Changes" : "Schedule Lesson")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
