import { AppLayout } from "@/components/AppLayout";
import { useSubjects } from "@/hooks/use-subjects";
import { useLessons } from "@/hooks/use-lessons";
import { useStudents } from "@/hooks/use-students";
import { format } from "date-fns";
import { BookOpen, Calendar, CheckSquare, Clock, Users, TrendingUp, ChevronRight, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";

export default function Dashboard() {
  const { data: subjects, isLoading: subjectsLoading } = useSubjects();
  const { data: students, isLoading: studentsLoading } = useStudents();
  const { data: lessons, isLoading: lessonsLoading } = useLessons({
    startDate: format(new Date(), "yyyy-MM-dd"), // Today's lessons
  });

  const isLoading = subjectsLoading || lessonsLoading || studentsLoading;

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
  
  // Calculate per-student progress
  const studentProgress = students?.map(student => {
    // Find subjects assigned to this student (via junction table or legacy studentId)
    const studentSubjectIds = subjects?.filter(s => 
      s.studentId === student.id || s.students?.some(st => st.id === student.id)
    ).map(s => s.id) || [];
    
    const studentLessons = todayLessons.filter(l => studentSubjectIds.includes(l.subjectId));
    const completed = studentLessons.filter(l => l.completed).length;
    const total = studentLessons.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
      student,
      completed,
      total,
      percentage,
      lessons: studentLessons,
    };
  }).filter(sp => sp.total > 0) || [];

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

      {/* Student Progress Section */}
      {studentProgress.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold font-display">Student Progress Today</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentProgress.map(({ student, completed, total, percentage, lessons }) => (
              <Dialog key={student.id}>
                <DialogTrigger asChild>
                  <Card 
                    className="shadow-sm cursor-pointer hover-elevate group" 
                    data-testid={`card-student-progress-${student.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: student.color || '#6366f1' }}
                          >
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <CardTitle className="text-base">{student.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">Grade {student.gradeLevel || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={percentage === 100 ? "default" : "secondary"} className="text-xs">
                            {completed}/{total}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{percentage}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                        {percentage === 100 && (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                            <CheckSquare className="h-3 w-3" />
                            All lessons complete!
                          </p>
                        )}
                        {percentage > 0 && percentage < 100 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {total - completed} lesson{total - completed !== 1 ? 's' : ''} remaining
                          </p>
                        )}
                      </div>
                      {/* Show lesson preview */}
                      <div className="mt-3 pt-3 border-t space-y-1">
                        {lessons.slice(0, 3).map(lesson => (
                          <div key={lesson.id} className="flex items-center gap-2 text-xs">
                            {lesson.completed ? (
                              <CheckSquare className="h-3 w-3 text-green-500" />
                            ) : (
                              <Clock className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className={lesson.completed ? "text-muted-foreground line-through" : ""}>
                              {lesson.title}
                            </span>
                          </div>
                        ))}
                        {lessons.length > 3 && (
                          <p className="text-xs text-primary font-medium">Click to see all {lessons.length} lessons</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: student.color || '#6366f1' }}
                      >
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <DialogTitle className="text-xl">{student.name}'s Progress</DialogTitle>
                        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM do")}</p>
                      </div>
                    </div>
                  </DialogHeader>
                  
                  {/* Progress Summary */}
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Daily Progress</span>
                      <Badge variant={percentage === 100 ? "default" : "secondary"}>
                        {completed} of {total} complete
                      </Badge>
                    </div>
                    <Progress value={percentage} className="h-3" />
                    <p className="text-sm text-muted-foreground mt-2">
                      {percentage === 100 
                        ? "Great job! All lessons completed for today!" 
                        : `${total - completed} lesson${total - completed !== 1 ? 's' : ''} remaining`}
                    </p>
                  </div>
                  
                  {/* All Lessons List */}
                  <div className="mt-4 space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Today's Lessons</h3>
                    
                    {/* Incomplete lessons first */}
                    {lessons.filter(l => !l.completed).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          In Progress ({lessons.filter(l => !l.completed).length})
                        </p>
                        {lessons.filter(l => !l.completed).map(lesson => {
                          const subject = subjects?.find(s => s.id === lesson.subjectId);
                          return (
                            <div 
                              key={lesson.id} 
                              className="p-3 bg-card border border-border rounded-lg flex items-start gap-3"
                            >
                              <div 
                                className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject?.category || 'other'] || '#6B7280' }}
                              >
                                <BookOpen className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{lesson.title}</p>
                                <p className="text-xs text-muted-foreground">{subject?.name || 'Unknown Subject'}</p>
                                {lesson.content && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lesson.content}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Completed lessons */}
                    {lessons.filter(l => l.completed).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckSquare className="h-3 w-3" />
                          Completed ({lessons.filter(l => l.completed).length})
                        </p>
                        {lessons.filter(l => l.completed).map(lesson => {
                          const subject = subjects?.find(s => s.id === lesson.subjectId);
                          return (
                            <div 
                              key={lesson.id} 
                              className="p-3 bg-muted/30 border border-border/50 rounded-lg flex items-start gap-3 opacity-70"
                            >
                              <div 
                                className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject?.category || 'other'] || '#6B7280' }}
                              >
                                <CheckSquare className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate line-through">{lesson.title}</p>
                                <p className="text-xs text-muted-foreground">{subject?.name || 'Unknown Subject'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="mt-6 pt-4 border-t flex gap-2">
                    <Link href="/schedule" className="flex-1">
                      <Button variant="outline" className="w-full gap-2">
                        <Calendar className="h-4 w-4" />
                        View Schedule
                      </Button>
                    </Link>
                    <Link href="/students" className="flex-1">
                      <Button variant="outline" className="w-full gap-2">
                        <Users className="h-4 w-4" />
                        Student Profile
                      </Button>
                    </Link>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      )}

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
                <Button variant="ghost" className="mt-2 text-primary">Schedule something</Button>
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
