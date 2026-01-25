import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Play, RotateCcw, Trophy, Timer, Target, Calculator, Zap } from "lucide-react";

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

export default function MathFacts() {
  const [operation, setOperation] = useState<Operation>("addition");
  const [maxNumber, setMaxNumber] = useState(12);
  const [problemCount, setProblemCount] = useState(10);
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [problemStartTime, setProblemStartTime] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);

  const startPractice = useCallback(() => {
    setIsPracticing(true);
    setResults([]);
    setShowResults(false);
    setCurrentAnswer("");
    setFeedback(null);
    const newProblem = generateProblem(operation, maxNumber);
    setCurrentProblem(newProblem);
    setProblemStartTime(Date.now());
  }, [operation, maxNumber]);

  const submitAnswer = useCallback(() => {
    if (!currentProblem || currentAnswer === "") return;

    const userAnswer = parseInt(currentAnswer, 10);
    const correct = userAnswer === currentProblem.answer;
    const timeSpent = Date.now() - problemStartTime;

    const result: PracticeResult = {
      problem: currentProblem,
      userAnswer,
      correct,
      timeSpent,
    };

    const newResults = [...results, result];
    setResults(newResults);
    setFeedback(correct ? "correct" : "incorrect");

    setTimeout(() => {
      setFeedback(null);
      setCurrentAnswer("");

      if (newResults.length >= problemCount) {
        setIsPracticing(false);
        setShowResults(true);
      } else {
        const newProblem = generateProblem(operation, maxNumber);
        setCurrentProblem(newProblem);
        setProblemStartTime(Date.now());
      }
    }, 800);
  }, [currentProblem, currentAnswer, problemStartTime, results, problemCount, operation, maxNumber]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentAnswer !== "") {
      submitAnswer();
    }
  }, [currentAnswer, submitAnswer]);

  const resetPractice = () => {
    setIsPracticing(false);
    setShowResults(false);
    setCurrentProblem(null);
    setResults([]);
    setCurrentAnswer("");
    setFeedback(null);
  };

  const correctCount = results.filter(r => r.correct).length;
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
  const avgTime = results.length > 0 
    ? Math.round(results.reduce((acc, r) => acc + r.timeSpent, 0) / results.length / 1000 * 10) / 10
    : 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-7 w-7 text-primary" />
              Math Facts Practice
            </h1>
            <p className="text-muted-foreground mt-1">
              Build fluency with quick math fact drills
            </p>
          </div>
        </div>

        {!isPracticing && !showResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Practice Settings
              </CardTitle>
              <CardDescription>
                Choose your operation and difficulty level
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="operation">Operation</Label>
                  <Select value={operation} onValueChange={(v) => setOperation(v as Operation)}>
                    <SelectTrigger id="operation" data-testid="select-operation">
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
                  <Label htmlFor="maxNumber">Max Number</Label>
                  <Select value={maxNumber.toString()} onValueChange={(v) => setMaxNumber(parseInt(v, 10))}>
                    <SelectTrigger id="maxNumber" data-testid="select-max-number">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Up to 5</SelectItem>
                      <SelectItem value="10">Up to 10</SelectItem>
                      <SelectItem value="12">Up to 12</SelectItem>
                      <SelectItem value="20">Up to 20</SelectItem>
                      <SelectItem value="50">Up to 50</SelectItem>
                      <SelectItem value="100">Up to 100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="problemCount">Number of Problems</Label>
                  <Select value={problemCount.toString()} onValueChange={(v) => setProblemCount(parseInt(v, 10))}>
                    <SelectTrigger id="problemCount" data-testid="select-problem-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 problems</SelectItem>
                      <SelectItem value="10">10 problems</SelectItem>
                      <SelectItem value="15">15 problems</SelectItem>
                      <SelectItem value="20">20 problems</SelectItem>
                      <SelectItem value="25">25 problems</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={startPractice} 
                size="lg" 
                className="w-full"
                data-testid="button-start-practice"
              >
                <Play className="mr-2 h-5 w-5" />
                Start Practice
              </Button>
            </CardContent>
          </Card>
        )}

        {isPracticing && currentProblem && (
          <Card className="relative overflow-visible">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant="outline" className="text-sm">
                  {OPERATION_LABELS[operation]}
                </Badge>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Problem {results.length + 1} of {problemCount}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={resetPractice}
                    data-testid="button-cancel-practice"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
              <Progress value={(results.length / problemCount) * 100} className="mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className={`text-center py-8 rounded-lg transition-colors ${
                  feedback === "correct" 
                    ? "bg-green-100 dark:bg-green-900/30" 
                    : feedback === "incorrect" 
                    ? "bg-red-100 dark:bg-red-900/30" 
                    : "bg-muted/30"
                }`}
              >
                <div className="text-5xl md:text-6xl font-bold text-foreground mb-6">
                  {currentProblem.displayText}
                </div>
                
                {feedback === "correct" && (
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="text-lg font-medium">Correct!</span>
                  </div>
                )}
                
                {feedback === "incorrect" && (
                  <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 mb-4">
                    <XCircle className="h-6 w-6" />
                    <span className="text-lg font-medium">
                      The answer was {currentProblem.answer}
                    </span>
                  </div>
                )}

                {!feedback && (
                  <div className="flex items-center justify-center gap-4 max-w-xs mx-auto">
                    <Input
                      type="number"
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="?"
                      className="text-center text-2xl h-14 w-32"
                      autoFocus
                      data-testid="input-answer"
                    />
                    <Button 
                      onClick={submitAnswer} 
                      size="lg"
                      disabled={currentAnswer === ""}
                      data-testid="button-submit-answer"
                    >
                      <Zap className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {showResults && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Practice Complete!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-primary">{correctCount}/{results.length}</div>
                    <div className="text-sm text-muted-foreground">Correct</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-primary">{accuracy}%</div>
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
                      <Timer className="h-6 w-6" />
                      {avgTime}s
                    </div>
                    <div className="text-sm text-muted-foreground">Avg. Time</div>
                  </div>
                </div>

                <div className="flex gap-4 justify-center flex-wrap">
                  <Button onClick={startPractice} data-testid="button-practice-again">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Practice Again
                  </Button>
                  <Button variant="outline" onClick={resetPractice} data-testid="button-change-settings">
                    Change Settings
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
      </div>
    </AppLayout>
  );
}
