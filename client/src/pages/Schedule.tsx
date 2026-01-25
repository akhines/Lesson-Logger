import { AppLayout } from "@/components/AppLayout";
import { useState, useMemo } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { useLessons, useDeleteLesson, useUpdateLesson } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { useDaysOff, useCreateDayOff, useDeleteDayOff } from "@/hooks/use-days-off";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateLessonDialog } from "@/components/CreateLessonDialog";
import { LessonResourcesDialog } from "@/components/LessonResourcesDialog";
import { CheckCircle2, Circle, MoreVertical, Trash2, Pencil, ExternalLink, Link2, ChevronLeft, ChevronRight, CalendarOff, X, Volume2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lesson } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Schedule() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { data: lessons, isLoading } = useLessons();
  const { data: subjects } = useSubjects();
  const { data: daysOff } = useDaysOff();
  const deleteMutation = useDeleteLesson();
  const updateMutation = useUpdateLesson();
  const createDayOffMutation = useCreateDayOff();
  const deleteDayOffMutation = useDeleteDayOff();
  const { toast } = useToast();

  const [editingLesson, setEditingLesson] = useState<Lesson | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dayOffDialogOpen, setDayOffDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayOffReason, setDayOffReason] = useState("");

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const daysOffSet = useMemo(() => {
    return new Set(daysOff?.map(d => d.date) || []);
  }, [daysOff]);

  const getLessonsForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return lessons?.filter(l => l.dateScheduled === dateStr) || [];
  };

  const getDayOffForDate = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return daysOff?.find(d => d.date === dateStr);
  };

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

  const handleCreate = (date?: Date) => {
    setEditingLesson(undefined);
    setSelectedDate(date || null);
    setDialogOpen(true);
  };

  const handleAddDayOff = (day: Date) => {
    setSelectedDate(day);
    setDayOffReason("");
    setDayOffDialogOpen(true);
  };

  const handleCreateDayOff = async () => {
    if (!selectedDate) return;
    
    try {
      const result = await createDayOffMutation.mutateAsync({
        date: format(selectedDate, "yyyy-MM-dd"),
        reason: dayOffReason || undefined,
      });
      
      setDayOffDialogOpen(false);
      toast({ 
        title: "Day off added",
        description: result.bumpedLessons > 0 
          ? `${result.bumpedLessons} lesson(s) were rescheduled` 
          : undefined
      });
    } catch (e) {
      toast({ title: "Failed to add day off", variant: "destructive" });
    }
  };

  const handleRemoveDayOff = async (dayOff: { id: number }) => {
    if (!confirm("Remove this day off? Note: Lessons that were bumped will not be automatically moved back.")) {
      return;
    }
    await deleteDayOffMutation.mutateAsync(dayOff.id);
    toast({ title: "Day off removed" });
  };

  const goToPreviousWeek = () => setWeekStart(subWeeks(weekStart, 1));
  const goToNextWeek = () => setWeekStart(addWeeks(weekStart, 1));
  const goToCurrentWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekStats = useMemo(() => {
    let totalLessons = 0;
    let completedLessons = 0;
    weekDays.forEach(day => {
      const dayLessons = getLessonsForDay(day);
      totalLessons += dayLessons.length;
      completedLessons += dayLessons.filter(l => l.completed).length;
    });
    return { total: totalLessons, completed: completedLessons };
  }, [weekDays, lessons]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek} data-testid="button-prev-week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-xl font-bold font-display">
                {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {weekStats.completed} / {weekStats.total} lessons completed
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={goToNextWeek} data-testid="button-next-week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goToCurrentWeek} data-testid="button-current-week">
              Today
            </Button>
            <CreateLessonDialog 
              lesson={editingLesson}
              preselectedDate={selectedDate || undefined}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              trigger={
                <Button onClick={() => handleCreate()} className="shadow-md" data-testid="button-add-lesson">
                  + Schedule Lesson
                </Button>
              }
            />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 min-w-[900px]">
            {weekDays.map((day, index) => {
              const dayLessons = getLessonsForDay(day);
              const dayOff = getDayOffForDate(day);
              const isToday = isSameDay(day, new Date());
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <div 
                  key={index} 
                  className={cn(
                    "flex flex-col rounded-xl border border-border bg-card min-h-[400px]",
                    isToday && "ring-2 ring-primary",
                    dayOff && "bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "p-3 text-center border-b border-border",
                    isToday && "bg-primary/10",
                    isWeekend && "bg-muted/30"
                  )}>
                    <div className="text-xs font-medium text-muted-foreground uppercase">
                      {format(day, "EEE")}
                    </div>
                    <div className={cn(
                      "text-2xl font-bold",
                      isToday && "text-primary"
                    )}>
                      {format(day, "d")}
                    </div>
                    {dayOff && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <CalendarOff className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate">
                          {dayOff.reason || "Day Off"}
                        </span>
                        <button 
                          onClick={() => handleRemoveDayOff(dayOff)}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                          data-testid={`button-remove-day-off-${format(day, "yyyy-MM-dd")}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {isLoading ? (
                      <div className="h-16 bg-muted/20 animate-pulse rounded" />
                    ) : dayLessons.length === 0 && !dayOff ? (
                      <div className="h-full flex items-center justify-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground text-xs"
                          onClick={() => handleCreate(day)}
                          data-testid={`button-add-lesson-${format(day, "yyyy-MM-dd")}`}
                        >
                          + Add
                        </Button>
                      </div>
                    ) : (
                      dayLessons.map((lesson) => {
                        const subject = subjects?.find(s => s.id === lesson.subjectId);
                        return (
                          <Card 
                            key={lesson.id} 
                            className={cn(
                              "transition-all duration-200",
                              lesson.completed && "opacity-60"
                            )}
                            data-testid={`lesson-card-${lesson.id}`}
                          >
                            <CardContent className="p-2">
                              <div className="flex items-start gap-2">
                                <button 
                                  onClick={() => handleToggleComplete(lesson)}
                                  className="mt-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                                  data-testid={`button-toggle-lesson-${lesson.id}`}
                                >
                                  {lesson.completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  ) : (
                                    <Circle className="h-4 w-4" />
                                  )}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                  <div 
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white inline-block mb-1"
                                    style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject?.category || 'other'] || SUBJECT_CATEGORY_COLORS.other }}
                                  >
                                    {subject?.name}
                                  </div>
                                  <div className={cn(
                                    "text-sm font-medium truncate flex items-center gap-1",
                                    lesson.completed && "line-through text-muted-foreground"
                                  )}>
                                    {lesson.title}
                                    {lesson.audioDirectionsUrl && (
                                      <Volume2 className="h-3 w-3 text-primary flex-shrink-0" />
                                    )}
                                  </div>
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(lesson)}>
                                      <Pencil className="mr-2 h-3 w-3" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(lesson.id)} className="text-destructive">
                                      <Trash2 className="mr-2 h-3 w-3" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>

                  {!dayOff && !isWeekend && (
                    <div className="p-2 border-t border-border">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-xs text-muted-foreground gap-1"
                        onClick={() => handleAddDayOff(day)}
                        data-testid={`button-day-off-${format(day, "yyyy-MM-dd")}`}
                      >
                        <CalendarOff className="h-3 w-3" />
                        Day Off
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={dayOffDialogOpen} onOpenChange={setDayOffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Day Off</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Adding a day off for <strong>{selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}</strong>.
              Any lessons scheduled on this day will be automatically moved to the next available school day.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="Vacation, Holiday, Sick Day..."
                value={dayOffReason}
                onChange={(e) => setDayOffReason(e.target.value)}
                data-testid="input-day-off-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDayOffDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateDayOff}
                disabled={createDayOffMutation.isPending}
                data-testid="button-confirm-day-off"
              >
                {createDayOffMutation.isPending ? "Adding..." : "Add Day Off"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
