import { AppLayout } from "@/components/AppLayout";
import { useParams, Link } from "wouter";
import { useSubject } from "@/hooks/use-subjects";
import { useStudents } from "@/hooks/use-students";
import { useLessons, useDeleteLesson, useUpdateLesson } from "@/hooks/use-lessons";
import { CreateLessonDialog } from "@/components/CreateLessonDialog";
import { CurriculumUploadDialog } from "@/components/CurriculumUploadDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, BookOpen, Plus, Calendar, Sparkles, Trash2, Pencil, ChevronDown, ChevronUp, ExternalLink, Volume2 } from "lucide-react";
import { format, parseISO, isBefore, isAfter, isToday } from "date-fns";
import { SUBJECT_CATEGORY_COLORS, FORM_LABELS } from "@shared/schema";
import type { Lesson } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const SUBJECT_CATEGORY_LABELS: Record<string, string> = {
  language_arts: "Language Arts",
  math: "Math",
  science: "Science",
  history: "History",
  art: "Art",
  music: "Music",
  physical_education: "PE",
  foreign_language: "Foreign Language",
  other: "Other",
};

export default function SubjectDetail() {
  const params = useParams<{ id: string }>();
  const subjectId = parseInt(params.id || "0", 10);
  
  const { data: subject, isLoading: subjectLoading } = useSubject(subjectId);
  const { data: allLessons, isLoading: lessonsLoading } = useLessons();
  const { data: students } = useStudents();
  const deleteMutation = useDeleteLesson();
  const updateMutation = useUpdateLesson();
  const { toast } = useToast();
  
  const [editingLesson, setEditingLesson] = useState<Lesson | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());

  const lessons = useMemo(() => {
    if (!allLessons) return [];
    return allLessons
      .filter(lesson => lesson.subjectId === subjectId)
      .sort((a, b) => {
        const dateA = a.dateScheduled ? parseISO(a.dateScheduled) : new Date(0);
        const dateB = b.dateScheduled ? parseISO(b.dateScheduled) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });
  }, [allLessons, subjectId]);

  const lessonStats = useMemo(() => {
    const total = lessons.length;
    const completed = lessons.filter(l => l.completed).length;
    const upcoming = lessons.filter(l => {
      if (!l.dateScheduled) return false;
      return isAfter(parseISO(l.dateScheduled), new Date()) && !l.completed;
    }).length;
    const overdue = lessons.filter(l => {
      if (!l.dateScheduled) return false;
      return isBefore(parseISO(l.dateScheduled), new Date()) && !l.completed && !isToday(parseISO(l.dateScheduled));
    }).length;
    return { total, completed, upcoming, overdue };
  }, [lessons]);

  const student = useMemo(() => {
    if (!subject?.studentId || !students) return null;
    return students.find(s => s.id === subject.studentId) || null;
  }, [subject, students]);

  const handleDeleteLesson = async (lessonId: number) => {
    if (confirm("Are you sure you want to delete this lesson?")) {
      try {
        await deleteMutation.mutateAsync(lessonId);
        toast({ title: "Lesson deleted" });
      } catch (error) {
        toast({ title: "Failed to delete lesson", variant: "destructive" });
      }
    }
  };

  const handleToggleComplete = async (lesson: Lesson) => {
    try {
      await updateMutation.mutateAsync({
        id: lesson.id,
        completed: !lesson.completed,
      });
      toast({ title: lesson.completed ? "Marked as incomplete" : "Marked as complete" });
    } catch (error) {
      toast({ title: "Failed to update lesson", variant: "destructive" });
    }
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setDialogOpen(true);
  };

  const handleCreateLesson = () => {
    setEditingLesson(undefined);
    setDialogOpen(true);
  };

  const toggleExpanded = (lessonId: number) => {
    const newExpanded = new Set(expandedLessons);
    if (newExpanded.has(lessonId)) {
      newExpanded.delete(lessonId);
    } else {
      newExpanded.add(lessonId);
    }
    setExpandedLessons(newExpanded);
  };

  if (subjectLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-96" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!subject) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold mb-2">Subject not found</h2>
          <p className="text-muted-foreground mb-4">The subject you're looking for doesn't exist.</p>
          <Link href="/subjects">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Subjects
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const categoryColor = SUBJECT_CATEGORY_COLORS[subject.category || 'other'] || SUBJECT_CATEGORY_COLORS.other;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Link href="/subjects">
            <Button variant="ghost" size="sm" className="gap-2 w-fit" data-testid="button-back-to-subjects">
              <ArrowLeft className="h-4 w-4" />
              Back to Subjects
            </Button>
          </Link>
          
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div 
                className="h-14 w-14 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: categoryColor }}
              >
                <BookOpen className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-subject-title">
                  {subject.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge 
                    variant="outline" 
                    className="text-xs text-white"
                    style={{ backgroundColor: categoryColor, borderColor: categoryColor }}
                  >
                    {SUBJECT_CATEGORY_LABELS[subject.category || 'other']}
                  </Badge>
                  {subject.gradeLevel && (
                    <Badge variant="secondary" className="text-xs">
                      Grade {subject.gradeLevel}
                    </Badge>
                  )}
                  {subject.curriculumSource && (
                    <Badge variant="outline" className="text-xs">
                      {subject.curriculumSource}
                    </Badge>
                  )}
                  {subject.formLevel && (
                    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                      {FORM_LABELS[subject.formLevel as keyof typeof FORM_LABELS]}
                    </Badge>
                  )}
                  {student && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <div 
                        className="h-2 w-2 rounded-full" 
                        style={{ backgroundColor: student.color || '#6B7280' }}
                      />
                      {student.name}
                    </Badge>
                  )}
                </div>
                {subject.description && (
                  <p className="text-sm text-muted-foreground mt-2">{subject.description}</p>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <CurriculumUploadDialog 
                subjectId={subject.id} 
                subjectName={subject.name}
                trigger={
                  <Button variant="outline" className="gap-2" data-testid="button-ai-import-lessons">
                    <Sparkles className="h-4 w-4" />
                    AI Import
                  </Button>
                }
              />
              <CreateLessonDialog 
                lesson={editingLesson}
                preselectedSubjectId={subjectId}
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) setEditingLesson(undefined);
                }}
                trigger={
                  <Button onClick={handleCreateLesson} className="gap-2 shadow-md" data-testid="button-add-lesson">
                    <Plus className="h-4 w-4" />
                    Add Lesson
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">
                {lessonsLoading ? "-" : lessonStats.total}
              </div>
              <p className="text-xs text-muted-foreground">Total Lessons</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">
                {lessonsLoading ? "-" : lessonStats.completed}
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-blue-600">
                {lessonsLoading ? "-" : lessonStats.upcoming}
              </div>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-orange-600">
                {lessonsLoading ? "-" : lessonStats.overdue}
              </div>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
        </div>

        {/* Lessons List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Lessons</CardTitle>
            {lessons.length > 0 && (
              <span className="text-sm text-muted-foreground">{lessons.length} lessons</span>
            )}
          </CardHeader>
          <CardContent>
            {lessonsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted/30 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : lessons.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                <Calendar className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <h3 className="font-medium mb-1">No lessons yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Add your first lesson to get started.</p>
                <Button onClick={handleCreateLesson} size="sm" data-testid="button-add-first-lesson">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lesson
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson) => {
                  const isExpanded = expandedLessons.has(lesson.id);
                  const lessonDate = lesson.dateScheduled ? parseISO(lesson.dateScheduled) : null;
                  const isOverdue = lessonDate && isBefore(lessonDate, new Date()) && !lesson.completed && !isToday(lessonDate);
                  const isTodayLesson = lessonDate && isToday(lessonDate);
                  
                  return (
                    <div 
                      key={lesson.id} 
                      className={cn(
                        "border rounded-lg overflow-hidden",
                        lesson.completed && "opacity-60",
                        isOverdue && "border-orange-300 dark:border-orange-700",
                        isTodayLesson && !lesson.completed && "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10"
                      )}
                      data-testid={`lesson-item-${lesson.id}`}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <Checkbox
                          checked={lesson.completed || false}
                          onCheckedChange={() => handleToggleComplete(lesson)}
                          data-testid={`checkbox-lesson-${lesson.id}`}
                        />
                        <button
                          onClick={() => toggleExpanded(lesson.id)}
                          className="flex-1 flex items-center justify-between text-left hover-elevate rounded p-1 -m-1"
                          data-testid={`button-expand-lesson-${lesson.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-medium truncate", lesson.completed && "line-through")}>
                                {lesson.title}
                              </span>
                              {isTodayLesson && !lesson.completed && (
                                <Badge variant="secondary" className="text-xs shrink-0">Today</Badge>
                              )}
                              {isOverdue && (
                                <Badge variant="destructive" className="text-xs shrink-0">Overdue</Badge>
                              )}
                              {lesson.link && (
                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              {lesson.audioDirectionsUrl && (
                                <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                            </div>
                            {lessonDate && (
                              <p className="text-xs text-muted-foreground">
                                {format(lessonDate, "EEEE, MMMM d, yyyy")}
                              </p>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditLesson(lesson)}
                            data-testid={`button-edit-lesson-${lesson.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-lesson-${lesson.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                          <div className="pt-3 space-y-2">
                            {lesson.content && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Content</p>
                                <p className="text-sm whitespace-pre-wrap">{lesson.content}</p>
                              </div>
                            )}
                            {lesson.link && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Resource Link</p>
                                <a 
                                  href={lesson.link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline flex items-center gap-1"
                                >
                                  {lesson.link}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                            {lesson.audioDirectionsUrl && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Audio Directions</p>
                                <audio controls className="w-full h-8">
                                  <source src={lesson.audioDirectionsUrl} type="audio/mpeg" />
                                  Your browser does not support the audio element.
                                </audio>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
