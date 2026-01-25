import { AppLayout } from "@/components/AppLayout";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { useLessons, useDeleteLesson, useUpdateLesson } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateLessonDialog } from "@/components/CreateLessonDialog";
import { LessonResourcesDialog } from "@/components/LessonResourcesDialog";
import { CheckCircle2, Circle, MoreVertical, Trash2, Pencil, ExternalLink, Link2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Lesson } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Schedule() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { data: lessons, isLoading } = useLessons();
  const { data: subjects } = useSubjects();
  const deleteMutation = useDeleteLesson();
  const updateMutation = useUpdateLesson();
  const { toast } = useToast();

  const [editingLesson, setEditingLesson] = useState<Lesson | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get days that have lessons for the calendar indicators
  const daysWithLessons = lessons?.map(l => parseISO(l.dateScheduled)) || [];

  const selectedDateLessons = lessons?.filter(l => 
    date && isSameDay(parseISO(l.dateScheduled), date)
  ) || [];

  const handleToggleComplete = async (lesson: Lesson) => {
    try {
      await updateMutation.mutateAsync({ 
        id: lesson.id, 
        completed: !lesson.completed 
      });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this lesson?")) {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Lesson deleted" });
    }
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingLesson(undefined);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-8rem)]">
        {/* Left Column: Calendar */}
        <div className="w-full lg:w-[350px] flex-shrink-0 space-y-6">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md mx-auto"
              modifiers={{
                hasEvent: daysWithLessons
              }}
              modifiersClassNames={{
                hasEvent: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full"
              }}
            />
          </div>

          <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
            <h3 className="font-bold text-primary mb-2">Quick Stats</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Scheduled today</span>
              <span className="font-bold">{selectedDateLessons.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="font-bold">{selectedDateLessons.filter(l => l.completed).length}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Lessons List */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold font-display">
                {date ? format(date, "EEEE, MMMM do") : "Select a date"}
              </h2>
              <p className="text-muted-foreground">
                {selectedDateLessons.length} lessons scheduled
              </p>
            </div>
            <CreateLessonDialog 
              lesson={editingLesson}
              preselectedDate={date}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              trigger={
                <Button onClick={handleCreate} className="shadow-md">
                  + Schedule Lesson
                </Button>
              }
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted/20 animate-pulse rounded-xl" />)}
              </div>
            ) : selectedDateLessons.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-2xl bg-muted/5">
                <p className="text-muted-foreground mb-4">No lessons scheduled for this day.</p>
                <Button variant="outline" onClick={handleCreate}>Add a Lesson</Button>
              </div>
            ) : (
              selectedDateLessons.map((lesson) => {
                const subject = subjects?.find(s => s.id === lesson.subjectId);
                return (
                  <Card key={lesson.id} className={cn("transition-all duration-200", lesson.completed && "opacity-75 bg-muted/30")}>
                    <CardContent className="p-5 flex gap-4 items-start">
                      <button 
                        onClick={() => handleToggleComplete(lesson)}
                        className="mt-1 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {lesson.completed ? (
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        ) : (
                          <Circle className="h-6 w-6" />
                        )}
                      </button>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject?.category || 'other'] || SUBJECT_CATEGORY_COLORS.other }}
                          >
                            {subject?.name}
                          </span>
                          {lesson.completed && (
                            <span className="text-xs font-medium text-muted-foreground">Completed</span>
                          )}
                        </div>
                        <h3 className={cn("font-bold text-lg", lesson.completed && "line-through text-muted-foreground")}>
                          {lesson.title}
                        </h3>
                        {lesson.content && (
                          <p className="text-sm text-muted-foreground">{lesson.content}</p>
                        )}
                        {lesson.link && (
                          <a 
                            href={lesson.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                          >
                            <ExternalLink className="h-3 w-3" /> Resource Link
                          </a>
                        )}
                        <div className="mt-2">
                          <LessonResourcesDialog 
                            lessonId={lesson.id} 
                            lessonTitle={lesson.title}
                            trigger={
                              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-7" data-testid={`button-resources-${lesson.id}`}>
                                <Link2 className="h-3 w-3" />
                                Resources
                              </Button>
                            }
                          />
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(lesson)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(lesson.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
