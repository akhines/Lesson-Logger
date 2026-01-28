import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { format, isToday, startOfWeek, addDays, isSameDay, isBefore, isAfter } from "date-fns";

// Helper to parse date string as local date (not UTC)
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
import { GraduationCap, Calendar, CheckSquare, Clock, BookOpen, LogOut, Play, Pause, Volume2, MessageSquare, Calculator, ArrowRight, Palette, FileText, Paintbrush, ExternalLink, Check, Loader2, FileAudio, Upload, Camera, Image, Trash2, QrCode, Download } from "lucide-react";
import type { Lesson, Student, FormContent, MathFactsAssignment, GrammarAssignment, LessonResource, Subject } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { Feather, PenLine, Copy, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import { ReadAloud } from "@/components/ReadAloud";
import { AvatarBuilder, AvatarDisplay, parseAvatarConfig, serializeAvatarConfig, AvatarConfig } from "@/components/AvatarBuilder";
import { PDFWorksheet } from "@/components/PDFWorksheet";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Edit3 } from "lucide-react";

type LessonWithFormContent = Lesson & { 
  formContent: FormContent | null; 
  resources?: LessonResource[];
  subject?: Subject | null;
};

type EvidenceUpload = {
  id: number;
  lessonId: number | null;
  studentId: number;
  title: string | null;
  fileUrl: string;
  fileType: string;
  fileName: string | null;
  reviewStatus: string;
  createdAt: string;
};

function EvidenceUploadSection({ lessonId, studentId }: { lessonId: number; studentId: number }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const { data: evidence, refetch, isLoading: evidenceLoading, isError: evidenceError } = useQuery<EvidenceUpload[]>({
    queryKey: ['/api/student-portal/evidence', lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/student-portal/evidence?lessonId=${lessonId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch evidence');
      return res.json();
    },
    enabled: !!lessonId && !!studentId,
  });
  
  const uploadMutation = useMutation({
    mutationFn: async (formData: { fileUrl: string; fileType: string; fileName: string; fileSize: number }) => {
      const res = await apiRequest('POST', '/api/student-portal/evidence', {
        lessonId,
        ...formData,
      });
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Work uploaded!", description: "Your teacher will review it soon." });
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/wav'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload an image, PDF, or audio file.", variant: "destructive" });
      return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }
    
    setUploading(true);
    
    try {
      // Get presigned upload URL
      const presignedRes = await apiRequest('POST', '/api/uploads/request-url', {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      
      const { uploadURL, objectPath } = await presignedRes.json() as { uploadURL: string; objectPath: string };
      
      // Upload file directly to object storage
      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      // Construct the file URL from the object path
      const fileUrl = objectPath;
      
      // Determine file type category
      let fileType = 'document';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type.startsWith('audio/')) fileType = 'audio';
      else if (file.type === 'application/pdf') fileType = 'document';
      
      // Save evidence record
      await uploadMutation.mutateAsync({
        fileUrl,
        fileType,
        fileName: file.name,
        fileSize: file.size,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="space-y-3 pt-3 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">My Work</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {evidence?.length || 0} uploaded
        </Badge>
      </div>
      
      {/* Loading state */}
      {evidenceLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {/* Error state */}
      {evidenceError && !evidenceLoading && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm text-red-600 dark:text-red-400">
          Failed to load your work. Try refreshing the page.
        </div>
      )}
      
      {/* Show existing uploads */}
      {!evidenceLoading && !evidenceError && evidence && evidence.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {evidence.map((item) => (
            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/50">
              {item.fileType === 'image' ? (
                <img src={item.fileUrl} alt={item.fileName || 'Work'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                  <FileText className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground text-center truncate w-full">
                    {item.fileName || 'File'}
                  </span>
                </div>
              )}
              {item.reviewStatus === 'approved' && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Upload button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        data-testid="button-upload-evidence"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Add Photo or File
          </>
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,audio/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-evidence-file"
      />
      <p className="text-xs text-muted-foreground text-center">
        Upload a picture of your work or a file
      </p>
    </div>
  );
}

function ChecklistItemDialog({ 
  lesson, 
  onMarkComplete, 
  isPending,
  studentId 
}: { 
  lesson: LessonWithFormContent; 
  onMarkComplete: (id: number) => void;
  isPending: boolean;
  studentId: number;
}) {
  const [open, setOpen] = useState(false);
  const [pdfWorksheetOpen, setPdfWorksheetOpen] = useState(false);
  
  const isPdf = lesson.documentUrl?.toLowerCase().endsWith('.pdf');
  
  const handleMarkComplete = () => {
    onMarkComplete(lesson.id);
    setOpen(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
          lesson.completed 
            ? 'bg-green-100 dark:bg-green-950/30' 
            : 'bg-background hover:bg-muted/50 cursor-pointer'
        }`}
        data-testid={`checklist-item-${lesson.id}`}
      >
        <div
          className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 ${
            lesson.completed 
              ? 'bg-green-600 border-green-600 text-white' 
              : 'border-primary/40'
          }`}
        >
          {lesson.completed && <Check className="h-4 w-4" />}
        </div>
        <DialogTrigger asChild>
          <button 
            className="flex-1 min-w-0 text-left"
            data-testid={`button-open-lesson-${lesson.id}`}
          >
            <p className={`font-medium ${lesson.completed ? 'line-through text-muted-foreground' : ''}`}>
              {lesson.title}
            </p>
            {lesson.subject && (
              <p className="text-xs text-muted-foreground">
                {lesson.subject.name}
              </p>
            )}
          </button>
        </DialogTrigger>
        {lesson.completed ? (
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 shrink-0">
            Done
          </Badge>
        ) : (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0" data-testid={`button-view-details-${lesson.id}`}>
              View Details
            </Button>
          </DialogTrigger>
        )}
      </div>
      
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl pr-6">{lesson.title}</DialogTitle>
          <DialogDescription className="sr-only">
            View lesson details and mark as complete
          </DialogDescription>
          {lesson.subject && (
            <Badge variant="outline" className="w-fit">
              {lesson.subject.name}
            </Badge>
          )}
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {lesson.content && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">Directions</span>
                </div>
                <ReadAloud text={lesson.content} />
              </div>
              <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                {lesson.content}
              </p>
            </div>
          )}
          
          {lesson.audioDirectionsUrl && (
            <div className="pt-2">
              <AudioPlayer src={lesson.audioDirectionsUrl} />
            </div>
          )}
          
          {lesson.documentUrl && (
            <div className="pt-2">
              {lesson.documentUrl.toLowerCase().endsWith('.mp3') || 
               lesson.documentUrl.toLowerCase().endsWith('.wav') || 
               lesson.documentUrl.toLowerCase().endsWith('.m4a') ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileAudio className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Audio File</span>
                  </div>
                  <AudioPlayer src={lesson.documentUrl} />
                </div>
              ) : isPdf ? (
                <Button
                  onClick={() => setPdfWorksheetOpen(true)}
                  className="gap-2"
                  data-testid={`button-open-pdf-worksheet-${lesson.id}`}
                >
                  <Edit3 className="h-4 w-4" />
                  Open Worksheet & Type Answers
                </Button>
              ) : (
                <a 
                  href={lesson.documentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  data-testid={`link-checklist-document-${lesson.id}`}
                >
                  <FileText className="h-4 w-4" />
                  View Document
                </a>
              )}
            </div>
          )}
          
          {isPdf && lesson.documentUrl && (
            <PDFWorksheet
              lessonId={lesson.id}
              pdfUrl={lesson.documentUrl}
              open={pdfWorksheetOpen}
              onOpenChange={setPdfWorksheetOpen}
            />
          )}
          
          {lesson.link && (
            <div className="pt-2">
              <a 
                href={lesson.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                data-testid={`link-checklist-resource-${lesson.id}`}
              >
                <ExternalLink className="h-4 w-4" />
                Open Resource Link
              </a>
            </div>
          )}
          
          {lesson.formContent && (
            <div className="space-y-4 pt-2 border-t">
              {lesson.formContent.copywork && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Feather className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Copywork</span>
                    </div>
                    <ReadAloud text={lesson.formContent.copywork} />
                  </div>
                  <p className="text-base text-muted-foreground bg-muted/30 p-4 rounded italic leading-relaxed">
                    "{lesson.formContent.copywork}"
                  </p>
                </div>
              )}
              
              {lesson.formContent.dictationPrompt && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <PenLine className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-600">Dictation</span>
                    </div>
                    <ReadAloud text={lesson.formContent.dictationPrompt} />
                  </div>
                  <p className="text-base text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-4 rounded leading-relaxed">
                    {lesson.formContent.dictationPrompt}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Library Resources (Copywork/Reading from Library) */}
          {lesson.resources && lesson.resources.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              {lesson.resources.map(resource => (
                <div key={resource.id}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {resource.title?.toLowerCase().includes("copywork") ? (
                        <>
                          <Copy className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">Copywork</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 text-indigo-600" />
                          <span className="text-sm font-medium text-indigo-600">{resource.title || "Reading"}</span>
                        </>
                      )}
                    </div>
                    {resource.description && <ReadAloud text={resource.description} />}
                  </div>
                  {resource.description && (
                    <p className="text-base text-muted-foreground bg-muted/30 p-4 rounded whitespace-pre-line leading-relaxed">
                      {resource.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Evidence Upload Section */}
          <EvidenceUploadSection lessonId={lesson.id} studentId={studentId} />
          
          {/* Finish Lesson Button */}
          <div className="pt-4 border-t">
            {lesson.completed ? (
              <div className="flex items-center justify-center gap-2 py-3 bg-green-100 dark:bg-green-950/50 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-green-700 dark:text-green-400 font-medium">
                  Lesson Complete!
                </span>
              </div>
            ) : (
              <Button 
                onClick={handleMarkComplete}
                disabled={isPending}
                className="w-full"
                size="lg"
                data-testid={`button-finish-lesson-${lesson.id}`}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Finishing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Finish Lesson
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LessonCard({ lesson }: { lesson: LessonWithFormContent }) {
  const [open, setOpen] = useState(false);
  
  const hasDetails = lesson.content || lesson.audioDirectionsUrl || lesson.documentUrl || lesson.formContent || 
    lesson.link || (lesson.resources && lesson.resources.length > 0);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card 
          className={`overflow-hidden transition-all ${hasDetails ? 'cursor-pointer hover-elevate' : ''}`}
          data-testid={`card-lesson-${lesson.id}`}
        >
          <div 
            className="h-2"
            style={{ backgroundColor: SUBJECT_CATEGORY_COLORS.other }}
          />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg">{lesson.title}</CardTitle>
                {lesson.subject && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {lesson.subject.name}
                  </Badge>
                )}
              </div>
              {hasDetails && (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {lesson.completed ? "Completed" : "Not started"}
              </span>
            </div>
            {hasDetails && (
              <p className="text-xs text-muted-foreground italic">
                Tap to see details
              </p>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl pr-6">{lesson.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Lesson details and instructions
          </DialogDescription>
          {lesson.subject && (
            <Badge variant="outline" className="w-fit">
              {lesson.subject.name}
            </Badge>
          )}
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {lesson.completed ? "Completed" : "Not started"}
            </span>
          </div>
          
          {lesson.content && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">Directions</span>
                </div>
                <ReadAloud text={lesson.content} />
              </div>
              <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                {lesson.content}
              </p>
            </div>
          )}
          
          {lesson.audioDirectionsUrl && (
            <div className="pt-2">
              <AudioPlayer src={lesson.audioDirectionsUrl} />
            </div>
          )}
          
          {lesson.documentUrl && (
            <div className="pt-2">
              {lesson.documentUrl.toLowerCase().endsWith('.mp3') || 
               lesson.documentUrl.toLowerCase().endsWith('.wav') || 
               lesson.documentUrl.toLowerCase().endsWith('.m4a') ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileAudio className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Audio File</span>
                  </div>
                  <AudioPlayer src={lesson.documentUrl} />
                </div>
              ) : (
                <a 
                  href={lesson.documentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  data-testid={`link-lesson-document-${lesson.id}`}
                >
                  <FileText className="h-4 w-4" />
                  {lesson.documentUrl.toLowerCase().endsWith('.pdf') ? 'View PDF' : 'View Document'}
                </a>
              )}
            </div>
          )}
          
          {lesson.link && (
            <div className="pt-2">
              <a 
                href={lesson.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                data-testid={`link-lesson-resource-${lesson.id}`}
              >
                <ExternalLink className="h-4 w-4" />
                Open Resource Link
              </a>
            </div>
          )}
          
          {lesson.formContent && (
            <div className="space-y-4 pt-2 border-t">
              {lesson.formContent.copywork && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Feather className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Copywork</span>
                    </div>
                    <ReadAloud text={lesson.formContent.copywork} />
                  </div>
                  <p className="text-base text-muted-foreground bg-muted/30 p-4 rounded italic leading-relaxed">
                    "{lesson.formContent.copywork}"
                  </p>
                </div>
              )}
              
              {lesson.formContent.dictationPrompt && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <PenLine className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-600">Dictation</span>
                    </div>
                    <ReadAloud text={lesson.formContent.dictationPrompt} />
                  </div>
                  <p className="text-base text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-4 rounded leading-relaxed">
                    {lesson.formContent.dictationPrompt}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {lesson.resources && lesson.resources.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              {lesson.resources.map(resource => (
                <div key={resource.id}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {resource.title?.toLowerCase().includes("copywork") ? (
                        <>
                          <Copy className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">Copywork</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 text-indigo-600" />
                          <span className="text-sm font-medium text-indigo-600">{resource.title || "Reading"}</span>
                        </>
                      )}
                    </div>
                    {resource.description && <ReadAloud text={resource.description} />}
                  </div>
                  {resource.description && (
                    <p className="text-base text-muted-foreground bg-muted/30 p-4 rounded whitespace-pre-line leading-relaxed">
                      {resource.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LessonListItem({ lesson, studentId }: { lesson: LessonWithFormContent; studentId: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/student-portal/lessons/${lesson.id}/complete`, {
        completed: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-portal/schedule"] });
      toast({ title: "Great job!", description: "Lesson marked as complete!" });
      setDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark lesson complete.", variant: "destructive" });
    },
  });
  
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <Card className="overflow-hidden" data-testid={`card-pending-lesson-${lesson.id}`}>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">{lesson.title}</h3>
              <p className="text-sm text-muted-foreground">
                Scheduled: {lesson.dateScheduled ? format(parseLocalDate(lesson.dateScheduled), "EEEE, MMM d") : "No date"}
              </p>
              {lesson.subject && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {lesson.subject.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {lesson.audioDirectionsUrl && (
                <AudioPlayer src={lesson.audioDirectionsUrl} />
              )}
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`button-view-pending-lesson-${lesson.id}`}
                >
                  <BookOpen className="h-4 w-4 mr-1" />
                  View Details
                </Button>
              </DialogTrigger>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl pr-6">{lesson.title}</DialogTitle>
          <DialogDescription className="sr-only">
            View lesson details and upload your work
          </DialogDescription>
          {lesson.subject && (
            <Badge variant="outline" className="w-fit">
              {lesson.subject.name}
            </Badge>
          )}
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {lesson.content && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">Directions</span>
                </div>
                <ReadAloud text={lesson.content} />
              </div>
              <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                {lesson.content}
              </p>
            </div>
          )}
          
          {lesson.audioDirectionsUrl && (
            <div className="pt-2">
              <AudioPlayer src={lesson.audioDirectionsUrl} />
            </div>
          )}
          
          {lesson.link && (
            <div className="pt-2">
              <a 
                href={lesson.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Open Resource Link
              </a>
            </div>
          )}
          
          {lesson.formContent && (
            <div className="space-y-4 pt-2 border-t">
              {lesson.formContent.copywork && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Feather className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Copywork</span>
                    </div>
                    <ReadAloud text={lesson.formContent.copywork} />
                  </div>
                  <p className="text-base text-muted-foreground bg-muted/30 p-4 rounded italic leading-relaxed">
                    "{lesson.formContent.copywork}"
                  </p>
                </div>
              )}
              
              {lesson.formContent.dictationPrompt && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <PenLine className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-600">Dictation</span>
                    </div>
                    <ReadAloud text={lesson.formContent.dictationPrompt} />
                  </div>
                  <p className="text-base text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-4 rounded leading-relaxed">
                    {lesson.formContent.dictationPrompt}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Library Resources (Copywork/Reading from Library) */}
          {lesson.resources && lesson.resources.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              {lesson.resources.map(resource => (
                <div key={resource.id}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {resource.title?.toLowerCase().includes("copywork") ? (
                        <>
                          <Copy className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">Copywork</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 text-indigo-600" />
                          <span className="text-sm font-medium text-indigo-600">{resource.title || "Reading"}</span>
                        </>
                      )}
                    </div>
                    {resource.description && <ReadAloud text={resource.description} />}
                  </div>
                  {resource.description && (
                    <p className="text-base text-muted-foreground bg-muted/30 p-4 rounded whitespace-pre-line leading-relaxed">
                      {resource.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Evidence Upload Section */}
          <EvidenceUploadSection lessonId={lesson.id} studentId={studentId} />
          
          {/* Finish Lesson Button */}
          <div className="pt-4 border-t">
            <Button 
              onClick={() => markCompleteMutation.mutate()}
              disabled={markCompleteMutation.isPending}
              className="w-full"
              size="lg"
              data-testid={`button-finish-pending-lesson-${lesson.id}`}
            >
              {markCompleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finishing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Finish Lesson
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AudioPlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={togglePlay}
      className="gap-2"
      data-testid="button-play-audio-directions"
    >
      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      <Volume2 className="h-4 w-4" />
      {isPlaying ? "Pause" : "Listen to Directions"}
    </Button>
  );
}

export default function StudentPortal() {
  const [, setLocation] = useLocation();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const { toast } = useToast();
  
  const handleShowQr = async () => {
    setQrDialogOpen(true);
    setQrLoading(true);
    setQrCodeSvg(null);
    
    try {
      const res = await fetch("/api/student-portal/qr-code", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setQrCodeSvg(data.svg);
      } else {
        toast({ title: "Failed to load QR code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load QR code", variant: "destructive" });
    } finally {
      setQrLoading(false);
    }
  };

  const downloadQr = () => {
    if (!qrCodeSvg) return;
    const blob = new Blob([qrCodeSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my_upload_qr.svg";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Check for admin impersonation token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const adminToken = urlParams.get("admin_token");
  
  // Validate admin token server-side
  const { data: tokenValidation, isLoading: tokenValidating } = useQuery({
    queryKey: ["/api/admin/validate-student-view", adminToken],
    queryFn: async () => {
      if (!adminToken) return { valid: false };
      const res = await fetch("/api/admin/validate-student-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: adminToken }),
      });
      if (!res.ok) return { valid: false };
      return res.json();
    },
    enabled: !!adminToken,
    retry: false,
  });
  
  const isAdminViewing = !!adminToken && tokenValidation?.valid === true;
  const adminStudentId = tokenValidation?.studentId ?? null;
  const adminStudentName = tokenValidation?.studentName ?? null;

  const { data: currentStudent, isLoading: studentLoading, isError: studentError } = useQuery<Student | null>({
    queryKey: ["/api/student-portal/me", adminStudentId],
    queryFn: async () => {
      // If admin is viewing, use the admin endpoint
      if (adminStudentId) {
        const res = await fetch(`/api/admin/view-student/${adminStudentId}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        return res.json();
      }
      
      const res = await fetch("/api/student-portal/me");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized");
        }
        return null;
      }
      return res.json();
    },
    retry: false,
  });

  // Redirect to login if not authenticated (unless admin viewing)
  useEffect(() => {
    // Wait for token validation if admin token is present
    if (adminToken && tokenValidating) return;
    
    if (!isAdminViewing && !studentLoading && (studentError || currentStudent === null)) {
      setLocation("/student-login");
    }
  }, [studentLoading, studentError, currentStudent, setLocation, isAdminViewing, adminToken, tokenValidating]);

  const { data: lessons, isLoading: lessonsLoading } = useQuery<LessonWithFormContent[]>({
    queryKey: isAdminViewing 
      ? ["/api/admin/view-student-lessons", adminStudentId] 
      : ["/api/student-portal/schedule"],
    queryFn: async () => {
      if (isAdminViewing && adminStudentId) {
        const res = await fetch(`/api/admin/view-student-lessons/${adminStudentId}`, {
          credentials: "include",
        });
        if (!res.ok) return [];
        return res.json();
      }
      const res = await fetch("/api/student-portal/schedule");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentStudent,
  });

  const { data: mathFactsAssignments, isLoading: assignmentsLoading } = useQuery<MathFactsAssignment[]>({
    queryKey: ["/api/student-portal/math-facts-assignments"],
    enabled: !!currentStudent && !isAdminViewing, // Skip for admin viewing
  });

  const { data: grammarAssignments } = useQuery<GrammarAssignment[]>({
    queryKey: ["/api/student-portal/grammar-assignments"],
    enabled: !!currentStudent && !isAdminViewing,
  });

  // Portfolio items for student to browse their work
  type PortfolioItem = {
    id: number;
    title: string | null;
    fileUrl: string;
    fileType: string;
    fileName: string | null;
    reviewStatus: string;
    createdAt: string;
    labels: { id: number; name: string; color: string | null }[];
  };
  
  const { data: portfolioItems } = useQuery<PortfolioItem[]>({
    queryKey: ["/api/student-portal/portfolio"],
    enabled: !!currentStudent && !isAdminViewing,
  });

  const handleLogout = () => {
    fetch("/api/student-auth/logout", { method: "POST" }).then(() => {
      // Clear all student portal related query caches to prevent data leakage
      queryClient.removeQueries({ queryKey: ["/api/student-portal/me"] });
      queryClient.removeQueries({ queryKey: ["/api/student-portal/schedule"] });
      queryClient.removeQueries({ queryKey: ["/api/student-portal/math-facts-assignments"] });
      queryClient.removeQueries({ queryKey: ["/api/student-portal/grammar-assignments"] });
      queryClient.removeQueries({ queryKey: ["/api/admin/validate-student-view"] });
      setLocation("/student-login");
    });
  };

  const updateAvatarMutation = useMutation({
    mutationFn: async (config: AvatarConfig) => {
      return apiRequest("PATCH", "/api/student-portal/avatar", { avatar: serializeAvatarConfig(config) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-portal/me"] });
      setAvatarDialogOpen(false);
      toast({ title: "Avatar saved!", description: "Your new avatar looks great!" });
    },
    onError: () => {
      toast({ title: "Oops!", description: "Couldn't save your avatar. Try again!", variant: "destructive" });
    },
  });
  
  const markLessonCompleteMutation = useMutation({
    mutationFn: async (lessonId: number) => {
      return apiRequest("PATCH", `/api/student/lessons/${lessonId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-portal/schedule"] });
      toast({ title: "Great job!", description: "Lesson marked as complete!" });
    },
    onError: () => {
      toast({ title: "Oops!", description: "Couldn't mark lesson complete. Try again!", variant: "destructive" });
    },
  });

  // Show loading state while checking authentication or validating token
  if (studentLoading || (adminToken && tokenValidating)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect will happen via useEffect
  if (!currentStudent) {
    return null;
  }

  const isLoading = lessonsLoading || assignmentsLoading;

  const OPERATION_LABELS: Record<string, string> = {
    addition: "Addition",
    subtraction: "Subtraction",
    multiplication: "Multiplication",
    division: "Division",
  };

  const pendingMathAssignments = mathFactsAssignments?.filter(a => !a.completed) || [];
  const completedMathAssignments = mathFactsAssignments?.filter(a => a.completed) || [];
  const pendingGrammarAssignments = grammarAssignments?.filter(a => !a.completed) || [];

  const GRAMMAR_CATEGORY_LABELS: Record<string, string> = {
    nouns: "Nouns",
    verbs: "Verbs",
    adjectives: "Adjectives",
    adverbs: "Adverbs",
    pronouns: "Pronouns",
    prepositions: "Prepositions",
    conjunctions: "Conjunctions",
    mixed: "Mixed Practice",
  };

  const todayLessons = lessons?.filter(l => {
    if (!l.dateScheduled) return false;
    return isToday(parseLocalDate(l.dateScheduled));
  }) || [];

  const pendingLessons = lessons?.filter(l => !l.completed) || [];
  const completedLessons = lessons?.filter(l => l.completed) || [];

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {isAdminViewing && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Admin View: Viewing student portal as {adminStudentName || currentStudent?.name}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="bg-amber-100 border-amber-700 text-amber-900 hover:bg-amber-200"
            onClick={() => window.close()}
            data-testid="button-close-admin-view"
          >
            Close Preview
          </Button>
        </div>
      )}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
              <DialogTrigger asChild>
                <button 
                  className="relative group cursor-pointer" 
                  data-testid="button-edit-avatar"
                  title="Click to customize your avatar"
                >
                  <AvatarDisplay 
                    config={parseAvatarConfig(currentStudent?.avatar)} 
                    size={48} 
                    className="ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Palette className="h-5 w-5 text-white" />
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-display">Create Your Avatar</DialogTitle>
                </DialogHeader>
                <AvatarBuilder 
                  initialConfig={parseAvatarConfig(currentStudent?.avatar)}
                  onSave={(config) => updateAvatarMutation.mutate(config)}
                  onCancel={() => setAvatarDialogOpen(false)}
                  saving={updateAvatarMutation.isPending}
                />
              </DialogContent>
            </Dialog>
            <div>
              <h1 className="font-display font-bold text-xl">My Learning Portal</h1>
              {currentStudent && (
                <p className="text-sm text-muted-foreground">Welcome, {currentStudent.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleShowQr} data-testid="button-student-qr">
              <QrCode className="h-4 w-4 mr-2" />
              My QR Code
            </Button>
            <Button variant="outline" onClick={handleLogout} data-testid="button-student-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>My Upload QR Code</DialogTitle>
            <DialogDescription>
              Scan this code to quickly upload your work from a phone or tablet.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrCodeSvg ? (
              <>
                <div 
                  className="bg-white p-4 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                  data-testid="student-qr-code-display"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Your uploaded work will go to your teacher for review.
                </p>
                <Button onClick={downloadQr} variant="outline" data-testid="button-student-download-qr">
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Failed to load QR code</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-muted/20 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Daily Checklist */}
            <section>
              <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-display flex items-center gap-2">
                      <CheckSquare className="h-6 w-6 text-primary" />
                      Today&apos;s Checklist
                    </CardTitle>
                    {todayLessons.length > 0 && (
                      <Badge 
                        variant={todayLessons.every(l => l.completed) ? "default" : "secondary"}
                        className={todayLessons.every(l => l.completed) ? "bg-green-600" : ""}
                        data-testid="badge-checklist-progress"
                      >
                        {todayLessons.filter(l => l.completed).length} / {todayLessons.length} Complete
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {todayLessons.length > 0 ? (
                    <div className="space-y-2">
                      {todayLessons.map(lesson => (
                        <ChecklistItemDialog 
                          key={lesson.id}
                          lesson={lesson}
                          onMarkComplete={(id) => markLessonCompleteMutation.mutate(id)}
                          isPending={markLessonCompleteMutation.isPending && markLessonCompleteMutation.variables === lesson.id}
                          studentId={currentStudent?.id || 0}
                        />
                      ))}
                      
                      {todayLessons.every(l => l.completed) && (
                        <div className="mt-4 p-4 bg-green-100 dark:bg-green-950/50 rounded-lg text-center">
                          <p className="text-green-700 dark:text-green-400 font-medium text-lg">
                            Great job! You&apos;ve completed all your lessons for today!
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>No lessons scheduled for today!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {pendingMathAssignments.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                  <Calculator className="h-6 w-6 text-primary" />
                  Math Facts Assignments
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pendingMathAssignments.map(assignment => (
                    <Card key={assignment.id} className="overflow-hidden" data-testid={`card-math-assignment-${assignment.id}`}>
                      <div className="h-2 bg-primary" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">
                          {assignment.title || `${OPERATION_LABELS[assignment.operation]} Practice`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calculator className="h-4 w-4" />
                          <span>{assignment.problemCount} problems</span>
                          <span className="mx-1">•</span>
                          <span>Up to {assignment.maxNumber}</span>
                        </div>
                        {assignment.dueDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            <span className={isBefore(parseLocalDate(assignment.dueDate), new Date()) && !isToday(parseLocalDate(assignment.dueDate)) ? "text-red-500 font-medium" : "text-muted-foreground"}>
                              Due: {format(parseLocalDate(assignment.dueDate), "EEEE, MMM d")}
                            </span>
                          </div>
                        )}
                        <Link href={`/student-math-facts?assignmentId=${assignment.id}`}>
                          <Button className="w-full mt-2" data-testid={`button-start-math-assignment-${assignment.id}`}>
                            <Play className="h-4 w-4 mr-2" />
                            Start Practice
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {pendingGrammarAssignments.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-amber-500" />
                  Grammar Assignments
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pendingGrammarAssignments.map(assignment => (
                    <Card key={assignment.id} className="overflow-hidden" data-testid={`card-grammar-assignment-${assignment.id}`}>
                      <div className="h-2 bg-amber-500" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">
                          {assignment.title || `${GRAMMAR_CATEGORY_LABELS[assignment.category] || assignment.category} Practice`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <BookOpen className="h-4 w-4" />
                          <span>{assignment.questionCount} questions</span>
                          <span className="mx-1">•</span>
                          <span>{GRAMMAR_CATEGORY_LABELS[assignment.category] || assignment.category}</span>
                        </div>
                        {assignment.dueDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            <span className={isBefore(parseLocalDate(assignment.dueDate), new Date()) && !isToday(parseLocalDate(assignment.dueDate)) ? "text-red-500 font-medium" : "text-muted-foreground"}>
                              Due: {format(parseLocalDate(assignment.dueDate), "EEEE, MMM d")}
                            </span>
                          </div>
                        )}
                        <Link href={`/student-grammar?assignmentId=${assignment.id}`}>
                          <Button className="w-full mt-2" variant="secondary" data-testid={`button-start-grammar-assignment-${assignment.id}`}>
                            <Play className="h-4 w-4 mr-2" />
                            Start Practice
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                <Paintbrush className="h-6 w-6 text-purple-500" />
                Creative Tools
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="overflow-hidden" data-testid="card-math-facts">
                  <div className="h-2 bg-green-500" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-green-500" />
                      Math Facts Practice
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Practice addition, subtraction, multiplication, and division.
                    </p>
                    <Button asChild className="w-full" variant="default" data-testid="button-open-math-facts">
                      <Link href="/student-math-facts">
                        <Calculator className="h-4 w-4 mr-2" />
                        Start Practice
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden" data-testid="card-grammar-practice">
                  <div className="h-2 bg-amber-500" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-amber-500" />
                      Grammar Practice
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Practice identifying nouns, verbs, adjectives, and more.
                    </p>
                    <Button asChild className="w-full" variant="secondary" data-testid="button-open-grammar">
                      <Link href="/student-grammar">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Start Practice
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className="overflow-hidden" data-testid="card-writing-center">
                  <div className="h-2 bg-blue-500" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      Writing Center
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Write stories, outlines, notes, and more with a full word processor.
                    </p>
                    <Button asChild className="w-full" variant="secondary" data-testid="button-open-writing">
                      <Link href="/student-writing">
                        <FileText className="h-4 w-4 mr-2" />
                        Start Writing
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden" data-testid="card-library">
                  <div className="h-2 bg-teal-500" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-teal-500" />
                      Library
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Find books to read and audiobooks to listen to.
                    </p>
                    <Button asChild className="w-full" variant="secondary" data-testid="button-open-library">
                      <Link href="/student-library">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Browse Library
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden" data-testid="card-study-helper">
                  <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-indigo-500" />
                      Study Helper
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ask questions about your schoolwork and get helpful answers!
                    </p>
                    <Button asChild className="w-full" variant="secondary" data-testid="button-open-helper">
                      <Link href="/student-helper">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Ask Questions
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden" data-testid="card-art-studio">
                  <div className="h-2 bg-purple-500" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Palette className="h-5 w-5 text-purple-500" />
                      Art Studio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create digital artwork with brushes, shapes, colors, and more.
                    </p>
                    <Button asChild className="w-full" variant="secondary" data-testid="button-open-art">
                      <Link href="/student-art">
                        <Palette className="h-4 w-4 mr-2" />
                        Start Creating
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* My Portfolio Section */}
            {portfolioItems && portfolioItems.length > 0 && (
              <section>
                <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                  <Image className="h-6 w-6 text-emerald-500" />
                  My Portfolio ({portfolioItems.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {portfolioItems.map(item => (
                    <Card key={item.id} className="overflow-hidden" data-testid={`card-portfolio-item-${item.id}`}>
                      <div className={`h-2 ${
                        item.reviewStatus === "approved" ? "bg-green-500" : 
                        item.reviewStatus === "rejected" ? "bg-red-500" : 
                        "bg-amber-500"
                      }`} />
                      {item.fileType.startsWith("image/") && (
                        <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                          <img 
                            src={item.fileUrl} 
                            alt={item.title || item.fileName || "My work"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base line-clamp-1">
                            {item.title || item.fileName || "My Work"}
                          </CardTitle>
                          <Badge 
                            variant={item.reviewStatus === "approved" ? "default" : "secondary"}
                            className={
                              item.reviewStatus === "approved" ? "bg-green-600" : 
                              item.reviewStatus === "rejected" ? "bg-red-600 text-white" : ""
                            }
                          >
                            {item.reviewStatus === "approved" ? "Approved" : 
                             item.reviewStatus === "rejected" ? "Needs Work" : 
                             "Pending Review"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">
                          Uploaded {format(new Date(item.createdAt), "MMM d, yyyy")}
                        </p>
                        {item.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.labels.map(label => (
                              <Badge 
                                key={label.id} 
                                variant="outline" 
                                className="text-xs"
                                style={label.color ? { borderColor: label.color, color: label.color } : {}}
                              >
                                {label.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {!item.fileType.startsWith("image/") && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-2"
                            onClick={() => window.open(item.fileUrl, "_blank")}
                            data-testid={`button-view-portfolio-${item.id}`}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View File
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                <Clock className="h-6 w-6 text-amber-500" />
                Upcoming Lessons ({pendingLessons.length})
              </h2>
              {pendingLessons.length > 0 ? (
                <div className="space-y-3">
                  {pendingLessons.slice(0, 10).map(lesson => (
                    <LessonListItem key={lesson.id} lesson={lesson} studentId={currentStudent?.id || 0} />
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/10">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No upcoming lessons! Great job!
                  </CardContent>
                </Card>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                <CheckSquare className="h-6 w-6 text-green-500" />
                Completed Lessons ({completedLessons.length})
              </h2>
              {completedLessons.length > 0 ? (
                <div className="space-y-3">
                  {completedLessons.slice(0, 5).map(lesson => (
                    <Card key={lesson.id} className="overflow-hidden bg-muted/5" data-testid={`card-completed-lesson-${lesson.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{lesson.title}</h3>
                            {lesson.grade && (
                              <p className="text-sm text-green-600 font-medium">Grade: {lesson.grade}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Completed
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/10">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No completed lessons yet.
                  </CardContent>
                </Card>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-display font-bold mb-4">This Week&apos;s Schedule</h2>
              <Card>
                <CardContent className="py-4">
                  <div className="grid grid-cols-5 gap-4">
                    {weekDays.map((day, i) => {
                      const dayLessons = lessons?.filter(l => {
                        if (!l.dateScheduled) return false;
                        return isSameDay(parseLocalDate(l.dateScheduled), day);
                      }) || [];
                      const isCurrentDay = isToday(day);
                      
                      return (
                        <div 
                          key={i} 
                          className={`text-center p-3 rounded-lg ${isCurrentDay ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'}`}
                        >
                          <div className="text-xs text-muted-foreground font-medium">
                            {format(day, "EEE")}
                          </div>
                          <div className={`text-lg font-bold ${isCurrentDay ? 'text-primary' : ''}`}>
                            {format(day, "d")}
                          </div>
                          <div className="mt-2 text-xs font-medium">
                            {dayLessons.length} lesson{dayLessons.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
