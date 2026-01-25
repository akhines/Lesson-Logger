import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Calendar, 
  Trophy, 
  Clock, 
  Target, 
  TrendingUp, 
  User,
  Calculator
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import type { Student, MathFactsSession, StudentLogin } from "@shared/schema";

const OPERATION_LABELS: Record<string, string> = {
  addition: "Addition",
  subtraction: "Subtraction",
  multiplication: "Multiplication",
  division: "Division",
};

export default function Reports() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("this-month");

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: mathSessions = [] } = useQuery<MathFactsSession[]>({
    queryKey: ["/api/math-facts-sessions"],
  });

  const { data: studentLogins = [] } = useQuery<StudentLogin[]>({
    queryKey: ["/api/student-logins"],
  });

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month":
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case "last-3-months":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "all-time":
      default:
        return { start: new Date(0), end: now };
    }
  };

  const { start, end } = getDateRange();

  const filteredSessions = mathSessions.filter(session => {
    const sessionDate = session.completedAt ? new Date(session.completedAt) : new Date();
    const dateInRange = sessionDate >= start && sessionDate <= end;
    const studentMatch = selectedStudentId === "all" || session.studentId === parseInt(selectedStudentId);
    return dateInRange && studentMatch;
  });

  const filteredLogins = studentLogins.filter(login => {
    const loginDate = login.loginAt ? new Date(login.loginAt) : new Date();
    const dateInRange = loginDate >= start && loginDate <= end;
    const studentMatch = selectedStudentId === "all" || login.studentId === parseInt(selectedStudentId);
    return dateInRange && studentMatch;
  });

  const totalSessions = filteredSessions.length;
  const overallAccuracy = totalSessions > 0
    ? Math.round(filteredSessions.reduce((acc, s) => acc + (s.correctAnswers / s.totalProblems) * 100, 0) / totalSessions)
    : 0;
  const totalProblemsAttempted = filteredSessions.reduce((acc, s) => acc + s.totalProblems, 0);
  const totalCorrectAnswers = filteredSessions.reduce((acc, s) => acc + s.correctAnswers, 0);
  const avgTimePerProblem = filteredSessions.reduce((acc, s) => acc + (s.averageTimeMs || 0), 0) / (totalSessions || 1);

  const sessionsByOperation = filteredSessions.reduce((acc, session) => {
    if (!acc[session.operation]) {
      acc[session.operation] = { total: 0, correct: 0, sessions: 0 };
    }
    acc[session.operation].total += session.totalProblems;
    acc[session.operation].correct += session.correctAnswers;
    acc[session.operation].sessions += 1;
    return acc;
  }, {} as Record<string, { total: number; correct: number; sessions: number }>);

  const sessionsByStudent = filteredSessions.reduce((acc, session) => {
    const studentId = session.studentId.toString();
    if (!acc[studentId]) {
      acc[studentId] = { total: 0, correct: 0, sessions: 0 };
    }
    acc[studentId].total += session.totalProblems;
    acc[studentId].correct += session.correctAnswers;
    acc[studentId].sessions += 1;
    return acc;
  }, {} as Record<string, { total: number; correct: number; sessions: number }>);

  const loginsByStudent = filteredLogins.reduce((acc, login) => {
    const studentId = login.studentId.toString();
    if (!acc[studentId]) {
      acc[studentId] = { logins: 0, lessonsCompleted: 0 };
    }
    acc[studentId].logins += 1;
    acc[studentId].lessonsCompleted += login.lessonsCompleted || 0;
    return acc;
  }, {} as Record<string, { logins: number; lessonsCompleted: number }>);

  const getStudentName = (id: number) => {
    return students.find(s => s.id === id)?.name || "Unknown";
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-7 w-7" />
              Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Track attendance and view grading reports
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="w-[180px]" data-testid="select-report-student">
                <SelectValue placeholder="All students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id.toString()}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="all-time">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="math-facts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="math-facts" data-testid="tab-math-facts">
              <Calculator className="h-4 w-4 mr-2" />
              Math Facts Grading
            </TabsTrigger>
            <TabsTrigger value="attendance" data-testid="tab-attendance">
              <Calendar className="h-4 w-4 mr-2" />
              Attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="math-facts" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalSessions}</p>
                      <p className="text-sm text-muted-foreground">Practice Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                      <Target className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{overallAccuracy}%</p>
                      <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalCorrectAnswers}/{totalProblemsAttempted}</p>
                      <p className="text-sm text-muted-foreground">Problems Correct</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{(avgTimePerProblem / 1000).toFixed(1)}s</p>
                      <p className="text-sm text-muted-foreground">Avg. Time/Problem</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance by Operation</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(sessionsByOperation).length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">No practice sessions recorded yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(sessionsByOperation).map(([op, data]) => (
                        <div key={op} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{OPERATION_LABELS[op] || op}</span>
                            <span className="text-sm text-muted-foreground">
                              {data.sessions} sessions
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(data.correct / data.total) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-16 text-right">
                              {Math.round((data.correct / data.total) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance by Student</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(sessionsByStudent).length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">No practice sessions recorded yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(sessionsByStudent).map(([studentId, data]) => (
                        <div key={studentId} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {getStudentName(parseInt(studentId))}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {data.sessions} sessions
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${(data.correct / data.total) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-16 text-right">
                              {Math.round((data.correct / data.total) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Practice Sessions</CardTitle>
                <CardDescription>Latest math facts practice results</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSessions.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No practice sessions recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredSessions.slice(0, 10).map((session) => (
                      <div 
                        key={session.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        data-testid={`session-row-${session.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{getStudentName(session.studentId)}</span>
                          </div>
                          <Badge variant="outline">
                            {OPERATION_LABELS[session.operation]}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Up to {session.maxNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium">
                              {session.correctAnswers}/{session.totalProblems}
                              <span className="text-muted-foreground ml-1">
                                ({Math.round((session.correctAnswers / session.totalProblems) * 100)}%)
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.completedAt ? format(new Date(session.completedAt), "MMM d, h:mm a") : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{filteredLogins.length}</p>
                      <p className="text-sm text-muted-foreground">Total Logins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                      <Target className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {filteredLogins.reduce((acc, l) => acc + (l.lessonsCompleted || 0), 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Lessons Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{Object.keys(loginsByStudent).length}</p>
                      <p className="text-sm text-muted-foreground">Active Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance by Student</CardTitle>
                <CardDescription>Student login activity and lesson completion</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(loginsByStudent).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No student logins recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(loginsByStudent).map(([studentId, data]) => (
                      <div 
                        key={studentId} 
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
                        data-testid={`attendance-row-${studentId}`}
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{getStudentName(parseInt(studentId))}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-lg">{data.logins}</p>
                            <p className="text-muted-foreground">Logins</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-lg">{data.lessonsCompleted}</p>
                            <p className="text-muted-foreground">Lessons</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Login Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredLogins.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No login activity recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredLogins.slice(0, 10).map((login) => (
                      <div 
                        key={login.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        data-testid={`login-row-${login.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{getStudentName(login.studentId)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="outline">
                            {login.lessonsCompleted || 0} lessons
                          </Badge>
                          <span className="text-muted-foreground">
                            {login.loginAt ? format(new Date(login.loginAt), "MMM d, h:mm a") : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
