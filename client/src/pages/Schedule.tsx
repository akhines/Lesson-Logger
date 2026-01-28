import { AppLayout } from "@/components/AppLayout";
import { useState, useMemo } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { useLessons, useDeleteLesson, useUpdateLesson } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { useDaysOff, useCreateDayOff, useDeleteDayOff } from "@/hooks/use-days-off";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateLessonDialog } from "@/components/CreateLessonDialog";
import { CheckCircle2, Circle, MoreVertical, Trash2, Pencil, ChevronLeft, ChevronRight, CalendarOff, X, Volume2, Plus, Calendar, RotateCcw, CalendarClock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lesson } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  
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

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = addDays(startOfWeek(addDays(monthEnd, 7), { weekStartsOn: 0 }), -1);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [calendarMonth]);

  const getLessonsForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return lessons?.filter(l => l.dateScheduled === dateStr) || [];
  };

  const getDayOffForDate = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return daysOff?.find(d => d.date === dateStr);
  };

  const getLessonCountForDay = (day: Date) => {
    return getLessonsForDay(day).length;
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

  const handleDateClick = (day: Date) => {
    setCurrentDate(day);
    if (!isSameMonth(day, calendarMonth)) {
      setCalendarMonth(day);
    }
  };

  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToCurrentWeek = () => {
    const today = new Date();
    setCurrentDate(today);
    setCalendarMonth(today);
  };

  const goToPreviousMonth = () => setCalendarMonth(subMonths(calendarMonth, 1));
  const goToNextMonth = () => setCalendarMonth(addMonths(calendarMonth, 1));

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

  const isInCurrentWeek = (day: Date) => {
    return weekDays.some(wd => isSameDay(wd, day));
  };

  return (
    <AppLayout>
      <div className="flex gap-4 lg:gap-6 h-[calc(100vh-8rem)]">
        {/* Mini Calendar Sidebar - Hidden on small screens */}
        <div className="hidden md:block w-56 lg:w-64 flex-shrink-0 space-y-4">
          <CreateLessonDialog 
            lesson={editingLesson}
            preselectedDate={selectedDate || undefined}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            trigger={
              <Button onClick={() => handleCreate()} className="w-full shadow-md gap-2" data-testid="button-add-lesson">
                <Plus className="h-4 w-4" />
                Create Lesson
              </Button>
            }
          />
          
          {/* Mini Calendar */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPreviousMonth} data-testid="button-prev-month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">
                  {format(calendarMonth, "MMMM yyyy")}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth} data-testid="button-next-month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-7 gap-0">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
                    {d}
                  </div>
                ))}
                {calendarDays.map((day, i) => {
                  const isCurrentMonth = isSameMonth(day, calendarMonth);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isInCurrentWeek(day);
                  const lessonCount = getLessonCountForDay(day);
                  const hasDayOff = daysOffSet.has(format(day, "yyyy-MM-dd"));
                  
                  return (
                    <button
                      key={i}
                      onClick={() => handleDateClick(day)}
                      className={cn(
                        "relative h-8 w-full text-xs rounded-md transition-colors",
                        !isCurrentMonth && "text-muted-foreground/40",
                        isCurrentMonth && "hover:bg-muted",
                        isToday && "bg-primary text-primary-foreground hover:bg-primary/90",
                        isSelected && !isToday && "bg-primary/20",
                        hasDayOff && "line-through text-muted-foreground"
                      )}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      {format(day, "d")}
                      {lessonCount > 0 && !isToday && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Week Stats */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">This Week</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Lessons</span>
                  <span className="font-medium">{weekStats.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium text-primary">{weekStats.completed}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: weekStats.total > 0 ? `${(weekStats.completed / weekStats.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2" 
            onClick={goToCurrentWeek}
            data-testid="button-current-week"
          >
            <Calendar className="h-4 w-4" />
            Go to Today
          </Button>
        </div>

        {/* Main Calendar View */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Week Header */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek} data-testid="button-prev-week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextWeek} data-testid="button-next-week">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg md:text-xl font-bold font-display ml-2">
                {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "d, yyyy")}
              </h2>
            </div>
            
            {/* Mobile Controls - Visible only on small screens */}
            <div className="flex md:hidden items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} data-testid="button-today-mobile">
                Today
              </Button>
              <CreateLessonDialog 
                lesson={editingLesson}
                preselectedDate={selectedDate || undefined}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                trigger={
                  <Button size="sm" className="gap-1" data-testid="button-add-lesson-mobile">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                }
              />
            </div>
          </div>

          {/* Week Grid */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="grid grid-cols-7 h-full border border-border rounded-lg overflow-hidden min-w-[700px]">
              {weekDays.map((day, index) => {
                const dayLessons = getLessonsForDay(day);
                const dayOff = getDayOffForDate(day);
                const isToday = isSameDay(day, new Date());
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div 
                    key={index} 
                    className={cn(
                      "flex flex-col border-r border-border last:border-r-0",
                      dayOff && "bg-muted/30"
                    )}
                  >
                    {/* Day Header */}
                    <div className={cn(
                      "p-2 text-center border-b border-border flex-shrink-0",
                      isWeekend && "bg-muted/20"
                    )}>
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        {format(day, "EEE")}
                      </div>
                      <div className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-semibold",
                        isToday && "bg-primary text-primary-foreground"
                      )}>
                        {format(day, "d")}
                      </div>
                      {dayOff && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <CalendarOff className="h-3 w-3 text-orange-500" />
                          <span className="text-xs text-orange-500 font-medium truncate">
                            {dayOff.reason || "Day Off"}
                          </span>
                          <button 
                            onClick={() => handleRemoveDayOff(dayOff)}
                            className="text-muted-foreground hover:text-destructive"
                            data-testid={`button-remove-day-off-${format(day, "yyyy-MM-dd")}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Lessons Container */}
                    <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                      {isLoading ? (
                        <div className="h-12 bg-muted/20 animate-pulse rounded" />
                      ) : (
                        <>
                          {dayLessons.map((lesson) => {
                            const subject = subjects?.find(s => s.id === lesson.subjectId);
                            const bgColor = SUBJECT_CATEGORY_COLORS[subject?.category || 'other'] || SUBJECT_CATEGORY_COLORS.other;
                            
                            return (
                              <div 
                                key={lesson.id}
                                className={cn(
                                  "group rounded-md p-2 text-white text-xs cursor-pointer transition-all hover:shadow-md",
                                  lesson.completed && "opacity-50"
                                )}
                                style={{ backgroundColor: bgColor }}
                                data-testid={`lesson-card-${lesson.id}`}
                              >
                                <div className="flex items-start gap-1.5">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(lesson);
                                    }}
                                    className="mt-0.5 flex-shrink-0 opacity-80 hover:opacity-100"
                                    data-testid={`button-toggle-lesson-${lesson.id}`}
                                  >
                                    {lesson.completed ? (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                      <Circle className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className={cn(
                                      "font-medium truncate leading-tight",
                                      lesson.completed && "line-through"
                                    )}>
                                      {lesson.title}
                                    </div>
                                    <div className="text-[10px] opacity-80 truncate mt-0.5">
                                      {subject?.name}
                                    </div>
                                  </div>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-white/20"
                                        onClick={(e) => e.stopPropagation()}
                                        data-testid={`button-lesson-menu-${lesson.id}`}
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {lesson.completed ? (
                                        <DropdownMenuItem 
                                          onClick={() => handleToggleComplete(lesson)} 
                                          data-testid={`menu-mark-incomplete-${lesson.id}`}
                                        >
                                          <RotateCcw className="mr-2 h-3 w-3" /> Mark Incomplete
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem 
                                          onClick={() => handleToggleComplete(lesson)} 
                                          data-testid={`menu-mark-complete-${lesson.id}`}
                                        >
                                          <CheckCircle2 className="mr-2 h-3 w-3" /> Mark Complete
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => handleEdit(lesson)} data-testid={`menu-reschedule-${lesson.id}`}>
                                        <CalendarClock className="mr-2 h-3 w-3" /> Reschedule
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleEdit(lesson)} data-testid={`menu-edit-lesson-${lesson.id}`}>
                                        <Pencil className="mr-2 h-3 w-3" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDelete(lesson.id)} className="text-destructive" data-testid={`menu-delete-lesson-${lesson.id}`}>
                                        <Trash2 className="mr-2 h-3 w-3" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  
                                  {lesson.audioDirectionsUrl && (
                                    <Volume2 className="h-3 w-3 flex-shrink-0 opacity-80" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Add Lesson Button */}
                          {!dayOff && (
                            <button
                              onClick={() => handleCreate(day)}
                              className="w-full p-2 rounded-md border border-dashed border-border text-muted-foreground text-xs hover:bg-muted/50 hover:border-primary/50 transition-colors flex items-center justify-center gap-1"
                              data-testid={`button-add-lesson-${format(day, "yyyy-MM-dd")}`}
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Day Footer */}
                    {!dayOff && !isWeekend && dayLessons.length > 0 && (
                      <div className="p-1.5 border-t border-border flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full h-7 text-xs text-muted-foreground gap-1"
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
      </div>

      {/* Day Off Dialog */}
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
              <Button variant="outline" onClick={() => setDayOffDialogOpen(false)} data-testid="button-cancel-day-off">
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
