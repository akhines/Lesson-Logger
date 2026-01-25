import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, parseISO, isToday, startOfWeek, addDays, isSameDay, isBefore, isAfter } from "date-fns";
import { GraduationCap, Calendar, CheckSquare, Clock, BookOpen, LogOut, Play, Pause, Volume2, MessageSquare, Calculator, ArrowRight, Palette } from "lucide-react";
import type { Lesson, Student, FormContent, MathFactsAssignment } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { Feather, PenLine } from "lucide-react";
import { useState, useRef } from "react";
import { ReadAloud } from "@/components/ReadAloud";
import { AvatarBuilder, AvatarDisplay, parseAvatarConfig, serializeAvatarConfig, AvatarConfig } from "@/components/AvatarBuilder";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LessonWithFormContent = Lesson & { formContent: FormContent | null };

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

  const { data: currentStudent, isLoading: studentLoading, isError: studentError } = useQuery<Student | null>({
    queryKey: ["/api/student-portal/me"],
    queryFn: async () => {
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!studentLoading && (studentError || currentStudent === null)) {
      setLocation("/student-login");
    }
  }, [studentLoading, studentError, currentStudent, setLocation]);

  const { data: lessons, isLoading: lessonsLoading } = useQuery<LessonWithFormContent[]>({
    queryKey: ["/api/student-portal/schedule"],
    enabled: !!currentStudent,
  });

  const { data: mathFactsAssignments, isLoading: assignmentsLoading } = useQuery<MathFactsAssignment[]>({
    queryKey: ["/api/student-portal/math-facts-assignments"],
    enabled: !!currentStudent,
  });

  const handleLogout = () => {
    fetch("/api/student-auth/logout", { method: "POST" }).then(() => {
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

  // Show loading state while checking authentication
  if (studentLoading) {
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
                    <Card key={lesson.id} className="overflow-hidden" data-testid={`card-today-lesson-${lesson.id}`}>
                      <div 
                        className="h-2"
                        style={{ backgroundColor: SUBJECT_CATEGORY_COLORS.other }}
                      />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{lesson.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
                                <span className="text-xs font-medium text-blue-600">Directions</span>
                              </div>
                              <ReadAloud text={lesson.content} />
                            </div>
                            <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                              {lesson.content}
                            </p>
                          </div>
                        )}
                        
                        {lesson.audioDirectionsUrl && (
                          <div className="pt-2">
                            <AudioPlayer src={lesson.audioDirectionsUrl} />
                          </div>
                        )}
                        
                        {lesson.formContent && (
                          <div className="space-y-3 pt-2 border-t">
                            {lesson.formContent.copywork && (
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <Feather className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-medium text-primary">Copywork</span>
                                  </div>
                                  <ReadAloud text={lesson.formContent.copywork} />
                                </div>
                                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded italic">
                                  "{lesson.formContent.copywork}"
                                </p>
                              </div>
                            )}
                            
                            {lesson.formContent.dictationPrompt && (
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <PenLine className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-medium text-amber-600">Dictation</span>
                                  </div>
                                  <ReadAloud text={lesson.formContent.dictationPrompt} />
                                </div>
                                <p className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded">
                                  {lesson.formContent.dictationPrompt}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Pending
                            </Badge>
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
