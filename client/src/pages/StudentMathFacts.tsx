import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Play, RotateCcw, Trophy, Timer, Calculator, ArrowLeft, GraduationCap, Home } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Student, MathFactsAssignment } from "@shared/schema";

type Operation = "addition" | "subtraction" | "multiplication" | "division";

interface Problem {
  num1: number;
  num2: number;
  operation: Operation;
  answer: number;
  displayText: string;
}

interface PracticeResult {
  problem: Problem;
  userAnswer: number;
  correct: boolean;
  timeSpent: number;
}

const OPERATION_SYMBOLS: Record<Operation, string> = {
  addition: "+",
  subtraction: "-",
  multiplication: "×",
  division: "÷",
};

const OPERATION_LABELS: Record<Operation, string> = {
  addition: "Addition",
  subtraction: "Subtraction",
  multiplication: "Multiplication",
  division: "Division",
};

function generateProblem(operation: Operation, maxNumber: number): Problem {
  let num1: number, num2: number, answer: number;

  switch (operation) {
    case "addition":
      num1 = Math.floor(Math.random() * maxNumber) + 1;
      num2 = Math.floor(Math.random() * maxNumber) + 1;
      answer = num1 + num2;
      break;
    case "subtraction":
      num1 = Math.floor(Math.random() * maxNumber) + 1;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
      break;
    case "multiplication":
      num1 = Math.floor(Math.random() * Math.min(maxNumber, 12)) + 1;
      num2 = Math.floor(Math.random() * Math.min(maxNumber, 12)) + 1;
      answer = num1 * num2;
      break;
    case "division":
      num2 = Math.floor(Math.random() * Math.min(maxNumber, 12)) + 1;
      answer = Math.floor(Math.random() * Math.min(maxNumber, 12)) + 1;
      num1 = num2 * answer;
      break;
    default:
      num1 = 1;
      num2 = 1;
      answer = 2;
  }

  return {
    num1,
    num2,
    operation,
    answer,
    displayText: `${num1} ${OPERATION_SYMBOLS[operation]} ${num2} = ?`,
  };
}

export default function StudentMathFacts() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>("addition");
  const [maxNumber, setMaxNumber] = useState(12);
  const [problemCount, setProblemCount] = useState(10);
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [problemStartTime, setProblemStartTime] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const assignmentIdFromUrl = urlParams.get("assignmentId");

  const { data: currentStudent, isLoading: studentLoading } = useQuery<Student | null>({
    queryKey: ["/api/student-portal/me"],
    queryFn: async () => {
      const res = await fetch("/api/student-portal/me");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        return null;
      }
      return res.json();
    },
    retry: false,
  });

  const { data: assignments = [] } = useQuery<MathFactsAssignment[]>({
    queryKey: ["/api/student-portal/math-facts-assignments"],
    enabled: !!currentStudent,
  });

  useEffect(() => {
    if (!studentLoading && !currentStudent) {
      setLocation("/student-login");
    }
  }, [studentLoading, currentStudent, setLocation]);

  useEffect(() => {
    if (assignmentIdFromUrl && assignments.length > 0 && !autoStarted && !isPracticing && !showResults) {
      const assignment = assignments.find(a => a.id === parseInt(assignmentIdFromUrl));
      if (assignment && !assignment.completed) {
        setAutoStarted(true);
        setSelectedAssignmentId(assignment.id);
        setOperation(assignment.operation as Operation);
        setMaxNumber(assignment.maxNumber);
        setProblemCount(assignment.problemCount);
        setResults([]);
        setShowResults(false);
        setIsPracticing(true);
      }
    }
  }, [assignmentIdFromUrl, assignments, autoStarted, isPracticing, showResults]);

  const pendingAssignments = assignments.filter(a => !a.completed);

  const saveSessionMutation = useMutation({
    mutationFn: async (data: {
      studentId: number;
      operation: string;
      maxNumber: number;
      totalProblems: number;
      correctAnswers: number;
      averageTimeMs: number;
    }) => {
      const response = await apiRequest("POST", "/api/student-portal/math-facts-sessions", data);
      return response.json();
    },
    onSuccess: (data: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/math-facts-sessions"] });
      
      if (selectedAssignmentId) {
        completeAssignmentMutation.mutate({ assignmentId: selectedAssignmentId, sessionId: data.id });
      } else {
        toast({
          title: "Results Saved!",
          description: "Your practice session has been recorded.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your results. Please try again.",
        variant: "destructive",
      });
    },
  });

  const completeAssignmentMutation = useMutation({
    mutationFn: async ({ assignmentId, sessionId }: { assignmentId: number; sessionId?: number }) => {
      return apiRequest("PATCH", `/api/student/math-facts-assignments/${assignmentId}/complete`, { sessionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-portal/math-facts-assignments"] });
      toast({
        title: "Assignment Complete!",
        description: "Great job finishing your math facts assignment!",
      });
    },
  });

  const startNextProblem = useCallback(() => {
    const newProblem = generateProblem(operation, maxNumber);
    setCurrentProblem(newProblem);
    setCurrentAnswer("");
    setProblemStartTime(Date.now());
  }, [operation, maxNumber]);

  const startPractice = (assignment?: MathFactsAssignment) => {
    if (assignment) {
      setSelectedAssignmentId(assignment.id);
      setOperation(assignment.operation as Operation);
      setMaxNumber(assignment.maxNumber);
      setProblemCount(assignment.problemCount);
    } else {
      setSelectedAssignmentId(null);
    }
    setResults([]);
    setShowResults(false);
    setIsPracticing(true);
  };

  useEffect(() => {
    if (isPracticing && !currentProblem) {
      startNextProblem();
    }
  }, [isPracticing, currentProblem, startNextProblem]);

  const handleAnswerSubmit = () => {
    if (!currentProblem || currentAnswer === "") return;

    const userAnswer = parseInt(currentAnswer, 10);
    const timeSpent = Date.now() - problemStartTime;
    const correct = userAnswer === currentProblem.answer;

    const result: PracticeResult = {
      problem: currentProblem,
      userAnswer,
      correct,
      timeSpent,
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (newResults.length >= problemCount) {
      setIsPracticing(false);
      setCurrentProblem(null);
      setShowResults(true);
    } else {
      startNextProblem();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAnswerSubmit();
    }
  };

  const finishPractice = () => {
    if (!currentStudent) return;

    const correctCount = results.filter(r => r.correct).length;
    const avgTimeMs = Math.round(results.reduce((acc, r) => acc + r.timeSpent, 0) / results.length);
    
    saveSessionMutation.mutate({
      studentId: currentStudent.id,
      operation,
      maxNumber,
      totalProblems: results.length,
      correctAnswers: correctCount,
      averageTimeMs: avgTimeMs,
    });
  };

  const resetPractice = () => {
    setIsPracticing(false);
    setCurrentProblem(null);
    setResults([]);
    setShowResults(false);
    setSelectedAssignmentId(null);
  };

  const correctCount = results.filter(r => r.correct).length;
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
  const avgTime = results.length > 0 
    ? Math.round(results.reduce((acc, r) => acc + r.timeSpent, 0) / results.length / 1000 * 10) / 10
    : 0;

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

  if (!currentStudent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Math Facts Practice</h1>
              <p className="text-sm text-muted-foreground">Hi, {currentStudent.name}!</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setLocation("/student-portal")} data-testid="button-back-to-portal">
            <Home className="h-4 w-4 mr-2" />
            Back to Portal
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {!isPracticing && !showResults && (
          <>
            {pendingAssignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Assignments</CardTitle>
                  <CardDescription>Complete these math facts assignments from your parent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingAssignments.map(assignment => (
                    <div 
                      key={assignment.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      data-testid={`assignment-item-${assignment.id}`}
                    >
                      <div>
                        <h3 className="font-medium">
                          {assignment.title || `${OPERATION_LABELS[assignment.operation as Operation]} Practice`}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {assignment.problemCount} problems • Up to {assignment.maxNumber}
                        </p>
                      </div>
                      <Button onClick={() => startPractice(assignment)} data-testid={`button-start-assignment-${assignment.id}`}>
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Free Practice</CardTitle>
                <CardDescription>Practice any math facts you want</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Operation</Label>
                    <Select value={operation} onValueChange={(v) => setOperation(v as Operation)}>
                      <SelectTrigger data-testid="select-free-operation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="addition">Addition (+)</SelectItem>
                        <SelectItem value="subtraction">Subtraction (-)</SelectItem>
                        <SelectItem value="multiplication">Multiplication (×)</SelectItem>
                        <SelectItem value="division">Division (÷)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Number</Label>
                    <Select value={maxNumber.toString()} onValueChange={(v) => setMaxNumber(parseInt(v))}>
                      <SelectTrigger data-testid="select-free-max">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">Up to 5</SelectItem>
                        <SelectItem value="10">Up to 10</SelectItem>
                        <SelectItem value="12">Up to 12</SelectItem>
                        <SelectItem value="20">Up to 20</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Problems</Label>
                    <Select value={problemCount.toString()} onValueChange={(v) => setProblemCount(parseInt(v))}>
                      <SelectTrigger data-testid="select-free-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 problems</SelectItem>
                        <SelectItem value="10">10 problems</SelectItem>
                        <SelectItem value="15">15 problems</SelectItem>
                        <SelectItem value="20">20 problems</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={() => startPractice()} className="w-full" data-testid="button-start-free-practice">
                  <Play className="h-4 w-4 mr-2" />
                  Start Free Practice
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {isPracticing && currentProblem && (
          <Card className="text-center">
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline">
                  Problem {results.length + 1} of {problemCount}
                </Badge>
                <Badge variant="secondary">
                  {correctCount} / {results.length} correct
                </Badge>
              </div>
              <Progress value={(results.length / problemCount) * 100} className="mb-6" />
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="text-6xl md:text-8xl font-bold font-mono py-8">
                {currentProblem.displayText}
              </div>

              <div className="max-w-xs mx-auto space-y-4">
                <Input
                  type="number"
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your answer"
                  className="text-center text-3xl h-16"
                  autoFocus
                  data-testid="input-answer"
                />
                <Button 
                  onClick={handleAnswerSubmit} 
                  size="lg" 
                  className="w-full"
                  disabled={currentAnswer === ""}
                  data-testid="button-submit-answer"
                >
                  Submit Answer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showResults && (
          <div className="space-y-6">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Trophy className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="text-3xl">Practice Complete!</CardTitle>
                <CardDescription>
                  {accuracy >= 80 ? "Great job! Keep up the excellent work!" : 
                   accuracy >= 60 ? "Good effort! Keep practicing to improve!" :
                   "Keep practicing! You'll get better!"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-3xl font-bold text-primary">{accuracy}%</div>
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-3xl font-bold text-primary">{correctCount}/{results.length}</div>
                    <div className="text-sm text-muted-foreground">Correct</div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-3xl font-bold text-primary">{avgTime}s</div>
                    <div className="text-sm text-muted-foreground">Avg Time</div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={finishPractice} disabled={saveSessionMutation.isPending} data-testid="button-save-results">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {saveSessionMutation.isPending ? "Saving..." : "Save Results"}
                  </Button>
                  <Button variant="outline" onClick={resetPractice} data-testid="button-practice-again">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Practice Again
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/student-portal")} data-testid="button-back-portal">
                    <Home className="h-4 w-4 mr-2" />
                    Back to Portal
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Problem Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div 
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        result.correct 
                          ? "bg-green-50 dark:bg-green-900/20" 
                          : "bg-red-50 dark:bg-red-900/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {result.correct ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                        <span className="font-medium">
                          {result.problem.num1} {OPERATION_SYMBOLS[result.problem.operation]} {result.problem.num2} = {result.problem.answer}
                        </span>
                        {!result.correct && (
                          <span className="text-muted-foreground">
                            (You answered: {result.userAnswer})
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {(result.timeSpent / 1000).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
