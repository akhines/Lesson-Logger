import { AppLayout } from "@/components/AppLayout";
import { useSubjects } from "@/hooks/use-subjects";
import { useLessons } from "@/hooks/use-lessons";
import { format } from "date-fns";
import { BookOpen, Calendar, CheckSquare, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: subjects, isLoading: subjectsLoading } = useSubjects();
  const { data: lessons, isLoading: lessonsLoading } = useLessons({
    startDate: format(new Date(), "yyyy-MM-dd"), // Today's lessons
  });

  const isLoading = subjectsLoading || lessonsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-muted/20 animate-pulse rounded-2xl" />
      </AppLayout>
    );
  }

  // Calculate stats
  const todayLessons = lessons?.filter(l => l.dateScheduled === format(new Date(), "yyyy-MM-dd")) || [];
  const completedToday = todayLessons.filter(l => l.completed).length;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Here's what's happening today, {format(new Date(), "EEEE MMMM do")}.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subjects?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Currently enrolled</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lessons Today</CardTitle>
            <Calendar className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayLessons.length}</div>
            <p className="text-xs text-muted-foreground">Scheduled for today</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday}</div>
            <p className="text-xs text-muted-foreground">Lessons finished today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Schedule */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">Today's Schedule</h2>
            <Link href="/schedule">
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View Calendar</Button>
            </Link>
          </div>
          
          {todayLessons.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No lessons scheduled for today.</p>
              <Link href="/schedule">
                <Button variant="link" className="mt-2 text-primary">Schedule something</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayLessons.map((lesson) => (
                <div key={lesson.id} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-start gap-4 hover:border-primary/50 transition-colors">
                  <div className={`h-10 w-1 rounded-full ${lesson.completed ? "bg-primary" : "bg-secondary"}`} />
                  <div className="flex-1">
                    <h3 className="font-semibold">{lesson.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {subjects?.find(s => s.id === lesson.subjectId)?.name || "Unknown Subject"}
                    </p>
                  </div>
                  {lesson.completed ? (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Completed</span>
                  ) : (
                    <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded-full font-medium">Scheduled</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subjects Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">Subjects</h2>
            <Link href="/subjects">
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">Manage Subjects</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subjects?.slice(0, 4).map((subject) => (
              <div key={subject.id} className="bg-card p-5 rounded-xl border border-border shadow-sm hover:shadow-md transition-all">
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent mb-3">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h3 className="font-bold">{subject.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {subject.description || "No description"}
                </p>
              </div>
            ))}
            {!subjects?.length && (
               <div className="col-span-2 bg-card rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                <p>No subjects added yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
