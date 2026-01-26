import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { format, parseISO, isToday, startOfWeek, addDays, isSameDay, isBefore, isAfter } from "date-fns";
import { GraduationCap, Calendar, CheckSquare, Clock, BookOpen, LogOut, Play, Pause, Volume2, MessageSquare, Calculator, ArrowRight, Palette, FileText, Paintbrush, ExternalLink, Check, Loader2, FileAudio } from "lucide-react";
import type { Lesson, Student, FormContent, MathFactsAssignment, GrammarAssignment, LessonResource, Subject } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { Feather, PenLine, Copy, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import { ReadAloud } from "@/components/ReadAloud";
import { AvatarBuilder, AvatarDisplay, parseAvatarConfig, serializeAvatarConfig, AvatarConfig } from "@/components/AvatarBuilder";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LessonWithFormContent = Lesson & { 
  formContent: FormContent | null; 
  resources?: LessonResource[];
  subject?: Subject | null;
};

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
  const { toast } = useToast();
  
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
    return isToday(parseISO(l.dateScheduled));
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
          <Button variant="outline" onClick={handleLogout} data-testid="button-student-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-muted/20 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-primary" />
                Today&apos;s Lessons
              </h2>
              {todayLessons.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {todayLessons.map(lesson => (
                    <LessonCard key={lesson.id} lesson={lesson} />
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/10">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No lessons scheduled for today!
                  </CardContent>
                </Card>
              )}
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
                            <span className={isBefore(parseISO(assignment.dueDate), new Date()) && !isToday(parseISO(assignment.dueDate)) ? "text-red-500 font-medium" : "text-muted-foreground"}>
                              Due: {format(parseISO(assignment.dueDate), "EEEE, MMM d")}
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
                            <span className={isBefore(parseISO(assignment.dueDate), new Date()) && !isToday(parseISO(assignment.dueDate)) ? "text-red-500 font-medium" : "text-muted-foreground"}>
                              Due: {format(parseISO(assignment.dueDate), "EEEE, MMM d")}
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

            <section>
              <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                <Clock className="h-6 w-6 text-amber-500" />
                Upcoming Lessons ({pendingLessons.length})
              </h2>
              {pendingLessons.length > 0 ? (
                <div className="space-y-3">
                  {pendingLessons.slice(0, 10).map(lesson => (
                    <Card key={lesson.id} className="overflow-hidden" data-testid={`card-pending-lesson-${lesson.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium">{lesson.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              Scheduled: {lesson.dateScheduled ? format(parseISO(lesson.dateScheduled), "EEEE, MMM d") : "No date"}
                            </p>
                            {lesson.content && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm text-muted-foreground line-clamp-2">{lesson.content}</p>
                                </div>
                                <ReadAloud text={lesson.content} className="mt-1" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {lesson.audioDirectionsUrl && (
                              <AudioPlayer src={lesson.audioDirectionsUrl} />
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              onClick={() => markLessonCompleteMutation.mutate(lesson.id)}
                              disabled={markLessonCompleteMutation.isPending}
                              data-testid={`button-complete-lesson-${lesson.id}`}
                            >
                              {markLessonCompleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Done
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                        return isSameDay(parseISO(l.dateScheduled), day);
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
