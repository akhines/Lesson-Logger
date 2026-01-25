import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Play, RotateCcw, Trophy, Home, BookOpen, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@shared/schema";

type GrammarCategory = "nouns" | "verbs" | "adjectives" | "adverbs" | "pronouns" | "prepositions" | "conjunctions" | "mixed";

interface GrammarQuestion {
  sentence: string;
  word: string;
  correctAnswer: string;
  options: string[];
}

interface PracticeResult {
  question: GrammarQuestion;
  userAnswer: string;
  correct: boolean;
  timeSpent: number;
}

const CATEGORY_LABELS: Record<GrammarCategory, string> = {
  nouns: "Nouns",
  verbs: "Verbs",
  adjectives: "Adjectives",
  adverbs: "Adverbs",
  pronouns: "Pronouns",
  prepositions: "Prepositions",
  conjunctions: "Conjunctions",
  mixed: "Mixed Practice",
};

const PARTS_OF_SPEECH = ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction"];

const GRAMMAR_QUESTIONS: Record<string, { sentence: string; word: string; answer: string }[]> = {
  nouns: [
    { sentence: "The _dog_ ran across the yard.", word: "dog", answer: "noun" },
    { sentence: "My _sister_ loves to read books.", word: "sister", answer: "noun" },
    { sentence: "We visited the _museum_ yesterday.", word: "museum", answer: "noun" },
    { sentence: "The _teacher_ explained the lesson.", word: "teacher", answer: "noun" },
    { sentence: "I left my _pencil_ on the desk.", word: "pencil", answer: "noun" },
    { sentence: "The _city_ was very crowded.", word: "city", answer: "noun" },
    { sentence: "Her _kindness_ touched everyone.", word: "kindness", answer: "noun" },
    { sentence: "The _children_ played in the park.", word: "children", answer: "noun" },
    { sentence: "We ate _pizza_ for dinner.", word: "pizza", answer: "noun" },
    { sentence: "The _ocean_ was calm today.", word: "ocean", answer: "noun" },
  ],
  verbs: [
    { sentence: "She _runs_ every morning.", word: "runs", answer: "verb" },
    { sentence: "The birds _sing_ beautifully.", word: "sing", answer: "verb" },
    { sentence: "He _studies_ hard for tests.", word: "studies", answer: "verb" },
    { sentence: "They _built_ a sandcastle.", word: "built", answer: "verb" },
    { sentence: "The baby _sleeps_ peacefully.", word: "sleeps", answer: "verb" },
    { sentence: "We _watched_ a movie last night.", word: "watched", answer: "verb" },
    { sentence: "She _wrote_ a letter to her friend.", word: "wrote", answer: "verb" },
    { sentence: "The cat _jumped_ onto the table.", word: "jumped", answer: "verb" },
    { sentence: "I _think_ this is a good idea.", word: "think", answer: "verb" },
    { sentence: "They _are_ very happy today.", word: "are", answer: "verb" },
  ],
  adjectives: [
    { sentence: "The _tall_ building touched the sky.", word: "tall", answer: "adjective" },
    { sentence: "She wore a _beautiful_ dress.", word: "beautiful", answer: "adjective" },
    { sentence: "The _cold_ water felt refreshing.", word: "cold", answer: "adjective" },
    { sentence: "He has a _loud_ voice.", word: "loud", answer: "adjective" },
    { sentence: "The _happy_ children laughed.", word: "happy", answer: "adjective" },
    { sentence: "It was a _sunny_ day.", word: "sunny", answer: "adjective" },
    { sentence: "The _old_ house needed repairs.", word: "old", answer: "adjective" },
    { sentence: "She made a _delicious_ cake.", word: "delicious", answer: "adjective" },
    { sentence: "The _tiny_ kitten meowed.", word: "tiny", answer: "adjective" },
    { sentence: "He wore a _red_ shirt.", word: "red", answer: "adjective" },
  ],
  adverbs: [
    { sentence: "She spoke _quietly_ in the library.", word: "quietly", answer: "adverb" },
    { sentence: "He ran _quickly_ to catch the bus.", word: "quickly", answer: "adverb" },
    { sentence: "They worked _carefully_ on the project.", word: "carefully", answer: "adverb" },
    { sentence: "The dog barked _loudly_ at the stranger.", word: "loudly", answer: "adverb" },
    { sentence: "She _always_ finishes her homework.", word: "always", answer: "adverb" },
    { sentence: "He _never_ forgets his manners.", word: "never", answer: "adverb" },
    { sentence: "The train arrived _early_ today.", word: "early", answer: "adverb" },
    { sentence: "She danced _gracefully_ on stage.", word: "gracefully", answer: "adverb" },
    { sentence: "He answered the question _correctly_.", word: "correctly", answer: "adverb" },
    { sentence: "They _often_ visit their grandparents.", word: "often", answer: "adverb" },
  ],
  pronouns: [
    { sentence: "_She_ went to the store.", word: "She", answer: "pronoun" },
    { sentence: "_They_ are coming to the party.", word: "They", answer: "pronoun" },
    { sentence: "The book belongs to _him_.", word: "him", answer: "pronoun" },
    { sentence: "_We_ love playing soccer.", word: "We", answer: "pronoun" },
    { sentence: "Is this pencil _yours_?", word: "yours", answer: "pronoun" },
    { sentence: "_It_ is raining outside.", word: "It", answer: "pronoun" },
    { sentence: "The cookies are for _us_.", word: "us", answer: "pronoun" },
    { sentence: "_I_ enjoy reading books.", word: "I", answer: "pronoun" },
    { sentence: "Give the toy to _her_.", word: "her", answer: "pronoun" },
    { sentence: "_Everyone_ was invited to the party.", word: "Everyone", answer: "pronoun" },
  ],
  prepositions: [
    { sentence: "The cat is _under_ the table.", word: "under", answer: "preposition" },
    { sentence: "She walked _through_ the park.", word: "through", answer: "preposition" },
    { sentence: "The book is _on_ the shelf.", word: "on", answer: "preposition" },
    { sentence: "He stood _beside_ his friend.", word: "beside", answer: "preposition" },
    { sentence: "The plane flew _above_ the clouds.", word: "above", answer: "preposition" },
    { sentence: "We arrived _before_ noon.", word: "before", answer: "preposition" },
    { sentence: "She hid _behind_ the door.", word: "behind", answer: "preposition" },
    { sentence: "They walked _across_ the bridge.", word: "across", answer: "preposition" },
    { sentence: "The ball rolled _into_ the street.", word: "into", answer: "preposition" },
    { sentence: "He works _during_ the day.", word: "during", answer: "preposition" },
  ],
  conjunctions: [
    { sentence: "I like apples _and_ oranges.", word: "and", answer: "conjunction" },
    { sentence: "She is tired _but_ happy.", word: "but", answer: "conjunction" },
    { sentence: "Would you like tea _or_ coffee?", word: "or", answer: "conjunction" },
    { sentence: "He studied hard _so_ he passed the test.", word: "so", answer: "conjunction" },
    { sentence: "I stayed home _because_ it was raining.", word: "because", answer: "conjunction" },
    { sentence: "She sings _while_ she cooks.", word: "while", answer: "conjunction" },
    { sentence: "I will go _if_ you come with me.", word: "if", answer: "conjunction" },
    { sentence: "He was late _yet_ he finished on time.", word: "yet", answer: "conjunction" },
    { sentence: "I like both cats _and_ dogs.", word: "and", answer: "conjunction" },
    { sentence: "Wait here _until_ I return.", word: "until", answer: "conjunction" },
  ],
};

function generateQuestion(category: GrammarCategory): GrammarQuestion {
  let questionPool: { sentence: string; word: string; answer: string }[] = [];
  
  if (category === "mixed") {
    const allCategories = Object.keys(GRAMMAR_QUESTIONS) as (keyof typeof GRAMMAR_QUESTIONS)[];
    allCategories.forEach(cat => {
      questionPool = questionPool.concat(GRAMMAR_QUESTIONS[cat]);
    });
  } else {
    questionPool = GRAMMAR_QUESTIONS[category] || [];
  }

  const randomIndex = Math.floor(Math.random() * questionPool.length);
  const selected = questionPool[randomIndex];

  const shuffledOptions = [...PARTS_OF_SPEECH].sort(() => Math.random() - 0.5);

  return {
    sentence: selected.sentence,
    word: selected.word,
    correctAnswer: selected.answer,
    options: shuffledOptions,
  };
}

export default function StudentGrammarPractice() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [category, setCategory] = useState<GrammarCategory>("mixed");
  const [problemCount, setProblemCount] = useState(10);
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<GrammarQuestion | null>(null);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [problemStartTime, setProblemStartTime] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);

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

  useEffect(() => {
    if (!studentLoading && !currentStudent) {
      setLocation("/student-login");
    }
  }, [studentLoading, currentStudent, setLocation]);

  const startNextQuestion = useCallback(() => {
    const newQuestion = generateQuestion(category);
    setCurrentQuestion(newQuestion);
    setProblemStartTime(Date.now());
  }, [category]);

  const startPractice = () => {
    setResults([]);
    setShowResults(false);
    setIsPracticing(true);
  };

  useEffect(() => {
    if (isPracticing && !currentQuestion) {
      startNextQuestion();
    }
  }, [isPracticing, currentQuestion, startNextQuestion]);

  const handleAnswerSelect = (answer: string) => {
    if (!currentQuestion) return;

    const timeSpent = Date.now() - problemStartTime;
    const correct = answer === currentQuestion.correctAnswer;

    const result: PracticeResult = {
      question: currentQuestion,
      userAnswer: answer,
      correct,
      timeSpent,
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (newResults.length >= problemCount) {
      setIsPracticing(false);
      setCurrentQuestion(null);
      setShowResults(true);
    } else {
      startNextQuestion();
    }
  };

  const resetPractice = () => {
    setIsPracticing(false);
    setCurrentQuestion(null);
    setResults([]);
    setShowResults(false);
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

  const highlightWord = (sentence: string, word: string) => {
    const parts = sentence.split(`_${word}_`);
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span className="font-bold text-primary underline decoration-2 underline-offset-4">{word}</span>
          {parts[1]}
        </>
      );
    }
    return sentence;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Grammar Practice</h1>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Parts of Speech Practice</CardTitle>
              <CardDescription>Identify the part of speech for the highlighted word in each sentence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as GrammarCategory)}>
                    <SelectTrigger data-testid="select-grammar-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed Practice</SelectItem>
                      <SelectItem value="nouns">Nouns</SelectItem>
                      <SelectItem value="verbs">Verbs</SelectItem>
                      <SelectItem value="adjectives">Adjectives</SelectItem>
                      <SelectItem value="adverbs">Adverbs</SelectItem>
                      <SelectItem value="pronouns">Pronouns</SelectItem>
                      <SelectItem value="prepositions">Prepositions</SelectItem>
                      <SelectItem value="conjunctions">Conjunctions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Questions</Label>
                  <Select value={problemCount.toString()} onValueChange={(v) => setProblemCount(parseInt(v))}>
                    <SelectTrigger data-testid="select-question-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 questions</SelectItem>
                      <SelectItem value="10">10 questions</SelectItem>
                      <SelectItem value="15">15 questions</SelectItem>
                      <SelectItem value="20">20 questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={startPractice} className="w-full" data-testid="button-start-grammar-practice">
                <Play className="h-4 w-4 mr-2" />
                Start Practice
              </Button>
            </CardContent>
          </Card>
        )}

        {isPracticing && currentQuestion && (
          <Card className="text-center">
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline">
                  Question {results.length + 1} of {problemCount}
                </Badge>
                <Badge variant="secondary">
                  {correctCount} / {results.length} correct
                </Badge>
              </div>
              <Progress value={(results.length / problemCount) * 100} className="mb-6" />
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  What part of speech is the highlighted word?
                </p>
                <p className="text-2xl md:text-3xl leading-relaxed">
                  {highlightWord(currentQuestion.sentence, currentQuestion.word)}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {currentQuestion.options.map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    size="lg"
                    className="h-14 text-base capitalize"
                    onClick={() => handleAnswerSelect(option)}
                    data-testid={`button-answer-${option}`}
                  >
                    {option}
                  </Button>
                ))}
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
                  {accuracy >= 80 ? "Excellent work! You're a grammar star!" : 
                   accuracy >= 60 ? "Good effort! Keep practicing!" :
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
                <CardTitle>Question Review</CardTitle>
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
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                        )}
                        <div>
                          <span className="font-medium">"{result.question.word}"</span>
                          <span className="text-muted-foreground"> is a </span>
                          <span className="font-medium capitalize">{result.question.correctAnswer}</span>
                          {!result.correct && (
                            <span className="text-muted-foreground">
                              {" "}(You said: {result.userAnswer})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0">
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
