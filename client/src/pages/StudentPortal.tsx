import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isToday, isTomorrow, startOfWeek, addDays, isSameDay } from "date-fns";
import { GraduationCap, Calendar, CheckSquare, Clock, BookOpen, LogOut } from "lucide-react";
import type { Assignment, Lesson, Student } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";

export default function StudentPortal() {
  const [, setLocation] = useLocation();

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

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/student-portal/assignments"],
    enabled: !!currentStudent,
  });

  const { data: lessons, isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["/api/student-portal/schedule"],
    enabled: !!currentStudent,
  });

  const handleLogout = () => {
    fetch("/api/student-auth/logout", { method: "POST" }).then(() => {
      setLocation("/student-login");
    });
  };

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

  const isLoading = assignmentsLoading || lessonsLoading;

  const todayLessons = lessons?.filter(l => {
    if (!l.dateScheduled) return false;
    return isToday(parseISO(l.dateScheduled));
  }) || [];

  const tomorrowLessons = lessons?.filter(l => {
    if (!l.dateScheduled) return false;
    return isTomorrow(parseISO(l.dateScheduled));
  }) || [];

  const pendingAssignments = assignments?.filter(a => a.status === "pending") || [];
  const completedAssignments = assignments?.filter(a => a.status === "submitted" || a.status === "graded") || [];

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
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
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {lesson.completed ? "Completed" : "Not started"}
                          </span>
                        </div>
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

            <section>
              <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                <Clock className="h-6 w-6 text-amber-500" />
                Pending Assignments ({pendingAssignments.length})
              </h2>
              {pendingAssignments.length > 0 ? (
                <div className="space-y-3">
                  {pendingAssignments.map(assignment => (
                    <Card key={assignment.id} className="overflow-hidden" data-testid={`card-pending-assignment-${assignment.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{assignment.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              Due: {assignment.dueDate ? format(parseISO(assignment.dueDate), "EEEE, MMM d") : "No date"}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Pending
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/10">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No pending assignments! Great job!
                  </CardContent>
                </Card>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-display font-bold mb-4 flex items-center gap-2">
                <CheckSquare className="h-6 w-6 text-green-500" />
                Completed Assignments ({completedAssignments.length})
              </h2>
              {completedAssignments.length > 0 ? (
                <div className="space-y-3">
                  {completedAssignments.slice(0, 5).map(assignment => (
                    <Card key={assignment.id} className="overflow-hidden bg-muted/5" data-testid={`card-completed-assignment-${assignment.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{assignment.title}</h3>
                            {assignment.grade && (
                              <p className="text-sm text-green-600 font-medium">Grade: {assignment.grade}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {assignment.status === "graded" ? "Graded" : "Submitted"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/10">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No completed assignments yet.
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
