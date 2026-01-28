import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Bot, Send, Loader2, Sparkles, BookOpen, Calculator, Palette, Lightbulb, Plus, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Student, Subject, Lesson } from "@shared/schema";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  { icon: Calculator, text: "Solve 47 + 38 step by step", color: "text-blue-500" },
  { icon: Palette, text: "Give me a creative writing prompt!", color: "text-purple-500" },
  { icon: Lightbulb, text: "How do you spell 'necessary'?", color: "text-amber-500" },
  { icon: BookOpen, text: "What are some good spelling words to practice?", color: "text-teal-500" },
];

export default function StudentHelper() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Text selection state
  const [selectedText, setSelectedText] = useState("");
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [showAddToLessonDialog, setShowAddToLessonDialog] = useState(false);
  
  // Lesson creation state
  const [lessonMode, setLessonMode] = useState<"new" | "existing">("new");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  const { data: currentStudent, isLoading: studentLoading, isError: studentError } = useQuery<Student | null>({
    queryKey: ["/api/student-portal/me"],
    queryFn: async () => {
      const res = await fetch("/api/student-portal/me");
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch student");
      }
      return res.json();
    },
  });

  // Fetch subjects for the current student (for lesson creation)
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    enabled: !!currentStudent,
  });
  
  // Filter subjects for current student
  const studentSubjects = subjects.filter(s => s.studentId === currentStudent?.id);
  
  // Fetch lessons for selected subject
  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: [`/api/lessons?subjectId=${selectedSubjectId}`],
    enabled: !!selectedSubjectId && lessonMode === "existing",
  });
  
  // Create new lesson mutation
  const createLessonMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; subjectId: number }) => {
      return await apiRequest("POST", "/api/lessons", {
        ...data,
        completed: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({
        title: "Lesson Created",
        description: "The text has been added as a new lesson.",
      });
      resetLessonDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lesson",
        variant: "destructive",
      });
    },
  });
  
  // Update existing lesson mutation
  const updateLessonMutation = useMutation({
    mutationFn: async (data: { lessonId: number; content: string }) => {
      return await apiRequest("PATCH", `/api/lessons/${data.lessonId}`, {
        content: data.content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({
        title: "Lesson Updated",
        description: "The text has been added to the lesson.",
      });
      resetLessonDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lesson",
        variant: "destructive",
      });
    },
  });
  
  const resetLessonDialog = () => {
    setShowAddToLessonDialog(false);
    setSelectedText("");
    setSelectionPos(null);
    setLessonMode("new");
    setSelectedSubjectId("");
    setSelectedLessonId("");
    setNewLessonTitle("");
    setLessonContent("");
  };

  useEffect(() => {
    if (!studentLoading && !currentStudent) {
      setLocation("/student-login");
    }
  }, [studentLoading, currentStudent, setLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Handle text selection in assistant messages
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
      setSelectedText("");
      setSelectionPos(null);
      return;
    }
    
    // Check if selection is within an assistant message
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const assistantMessage = (commonAncestor.nodeType === Node.TEXT_NODE 
      ? commonAncestor.parentElement 
      : commonAncestor as Element)?.closest('[data-assistant-message]');
    
    if (!assistantMessage) {
      return;
    }
    
    const text = selection.toString().trim();
    if (text.length > 0) {
      const rect = range.getBoundingClientRect();
      const container = messagesContainerRef.current;
      const containerRect = container?.getBoundingClientRect();
      
      if (containerRect && container) {
        // Account for scroll offset
        const scrollTop = container.scrollTop;
        setSelectedText(text);
        setSelectionPos({
          top: rect.bottom - containerRect.top + scrollTop + 8,
          left: rect.left - containerRect.left + rect.width / 2,
        });
      }
    }
  }, []);
  
  // Set up selection listener
  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    document.addEventListener("keyup", handleTextSelection);
    
    return () => {
      document.removeEventListener("mouseup", handleTextSelection);
      document.removeEventListener("keyup", handleTextSelection);
    };
  }, [handleTextSelection]);
  
  const handleAddToLesson = () => {
    setLessonContent(selectedText);
    setShowAddToLessonDialog(true);
    // Clear the floating button
    setSelectionPos(null);
  };
  
  const handleSaveLesson = () => {
    if (lessonMode === "new") {
      if (!selectedSubjectId || !newLessonTitle.trim()) {
        toast({
          title: "Missing Information",
          description: "Please select a subject and enter a lesson title.",
          variant: "destructive",
        });
        return;
      }
      createLessonMutation.mutate({
        title: newLessonTitle.trim(),
        content: lessonContent,
        subjectId: parseInt(selectedSubjectId),
      });
    } else {
      if (!selectedLessonId) {
        toast({
          title: "Missing Information",
          description: "Please select a lesson to add the text to.",
          variant: "destructive",
        });
        return;
      }
      const existingLesson = lessons.find(l => l.id === parseInt(selectedLessonId));
      const newContent = existingLesson?.content 
        ? `${existingLesson.content}\n\n${lessonContent}`
        : lessonContent;
      
      updateLessonMutation.mutate({
        lessonId: parseInt(selectedLessonId),
        content: newContent,
      });
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/student-portal/ask-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          question: text.trim(),
          studentName: currentStudent?.name || "Student",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "I'm sorry, I couldn't understand that. Can you try asking in a different way?",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Oops! Something went wrong. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  if (studentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-950 dark:to-background">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (studentError || !currentStudent) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-950 dark:to-background">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/student-portal">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold">Study Helper</h1>
              <p className="text-xs text-muted-foreground">Ask me anything!</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        <div ref={messagesContainerRef} className="relative flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {/* Floating selection button */}
          {selectionPos && selectedText && (
            <div
              className="absolute z-50 transform -translate-x-1/2"
              style={{ top: selectionPos.top, left: selectionPos.left }}
            >
              <Button
                size="sm"
                onClick={handleAddToLesson}
                className="shadow-lg"
                data-testid="button-add-to-lesson"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add to Lesson
              </Button>
            </div>
          )}
          
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-display font-bold mb-2">
                Hi, {currentStudent.name}!
              </h2>
              <p className="text-muted-foreground mb-8 max-w-sm">
                I'm your Study Helper! Ask me questions about your schoolwork and I'll do my best to help.
              </p>
              
              <div className="grid gap-3 w-full max-w-md">
                <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
                {SUGGESTED_QUESTIONS.map((q, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleSuggestedQuestion(q.text)}
                    data-testid={`button-suggested-${index}`}
                  >
                    <q.icon className={`h-5 w-5 mr-3 flex-shrink-0 ${q.color}`} />
                    <span className="line-clamp-1">{q.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <Card
                    className={`max-w-[85%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                    {...(message.role === "assistant" ? { "data-assistant-message": "true" } : {})}
                  >
                    <CardContent className="p-3">
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4" />
                          <span className="text-xs font-medium">Study Helper</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap" data-assistant-message={message.role === "assistant" ? "true" : undefined}>{message.content}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <Card className="bg-muted">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-4 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your question here..."
              disabled={isLoading}
              className="h-12 text-base"
              data-testid="input-helper-question"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-12 w-12"
              disabled={!inputValue.trim() || isLoading}
              data-testid="button-send-question"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </div>
      </main>
      
      {/* Add to Lesson Dialog */}
      <Dialog open={showAddToLessonDialog} onOpenChange={(open) => !open && resetLessonDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Add to Lesson
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Selected Text</Label>
              <Textarea
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                className="mt-1.5 min-h-[100px]"
                placeholder="The selected text will appear here..."
                data-testid="textarea-lesson-content"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">What would you like to do?</Label>
              <RadioGroup
                value={lessonMode}
                onValueChange={(value) => setLessonMode(value as "new" | "existing")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="mode-new" data-testid="radio-mode-new" />
                  <Label htmlFor="mode-new" className="cursor-pointer">Create new lesson</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="mode-existing" data-testid="radio-mode-existing" />
                  <Label htmlFor="mode-existing" className="cursor-pointer">Add to existing lesson</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label htmlFor="subject-select" className="text-sm font-medium">Subject</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger id="subject-select" className="mt-1.5" data-testid="select-subject">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {studentSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id.toString()} data-testid={`select-item-subject-${subject.id}`}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {lessonMode === "new" ? (
              <div>
                <Label htmlFor="lesson-title" className="text-sm font-medium">Lesson Title</Label>
                <Input
                  id="lesson-title"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="Enter a title for the new lesson"
                  className="mt-1.5"
                  data-testid="input-lesson-title"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="lesson-select" className="text-sm font-medium">Select Lesson</Label>
                <Select 
                  value={selectedLessonId} 
                  onValueChange={setSelectedLessonId}
                  disabled={!selectedSubjectId}
                >
                  <SelectTrigger id="lesson-select" className="mt-1.5" data-testid="select-lesson">
                    <SelectValue placeholder={selectedSubjectId ? "Select a lesson" : "Select a subject first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {lessons.map((lesson) => (
                      <SelectItem key={lesson.id} value={lesson.id.toString()} data-testid={`select-item-lesson-${lesson.id}`}>
                        {lesson.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={resetLessonDialog} data-testid="button-cancel-lesson">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveLesson}
              disabled={createLessonMutation.isPending || updateLessonMutation.isPending}
              data-testid="button-save-lesson"
            >
              {(createLessonMutation.isPending || updateLessonMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {lessonMode === "new" ? "Create Lesson" : "Add to Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
